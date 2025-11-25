// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, addDoc, query, setDoc, where, orderBy, limit, serverTimestamp, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 💰 Currency formatter
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR"
});

// 🔄 Status normalizer (now separates rejected by accountant and manager)
function normalizeStatus(status, regularStatus = "") {
  const s = (status || "").toLowerCase();
  const r = (regularStatus || "").toLowerCase();

  if (s === "approved" || r === "approved") return "Approved";
  if (s === "finalapproved" || r === "finalapproved") return "FinalApproved";
  if (s === "rejected" || r === "rejected") return "RejectedByAccountant";
  if (s === "rejectedbymanager" || r === "rejectedbymanager") return "RejectedByManager";
  if (s === "pending" || r === "pending") return "Pending";

  return "Unknown";
}

// 🧩 Field Labels and Grouping
const FIELD_GROUPS = {
  "🧭 Trip Info": ["placeVisited"],
  "🚗 Travel Costs": ["fuel", "fare", "boarding", "food", "localConveyance", "postCourier", "misc"],
  "📅 Monthly Claims": ["advanceCash", "monthlyConveyance", "monthlyPhone", "adhocRequest"]
};

const FIELD_LABELS = {
  placeVisited: "Place Visited",
  fuel: "Fuel",
  fare: "Fare",
  boarding: "Boarding",
  food: "Food",
  localConveyance: "Local Conveyance",
  postCourier: "Post Courier",
  misc: "Misc",
  advanceCash: "Advance Cash",
  monthlyConveyance: "Monthly Conveyance",
  monthlyPhone: "Monthly Phone",
  adhocRequest: "Adhoc Request"
};

// 🍞 Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// 🚪 Logout
function logoutUser() {
  signOut(auth)
    .then(() => (window.location.href = "login.html"))
    .catch(err => {
      showToast("Logout failed", "error");
      console.error(err);
    });
}

// 👤 Employee Filter
async function populateEmployeeFilter() {
  const empSel = document.getElementById("employeeFilter");
  if (!empSel) return;
  empSel.innerHTML = `<option value="">All Employees</option>`;
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const userList = [];
    usersSnap.forEach(docSnap => {
      const dat = docSnap.data();
      if (dat.role && dat.role.toLowerCase() === "employee") {
        userList.push({ id: docSnap.id, name: dat.name || docSnap.id });
      }
    });
    userList.sort((a, b) => a.name.localeCompare(b.name));
    userList.forEach(user => {
      const opt = document.createElement("option");
      opt.value = user.id;
      opt.textContent = user.name;
      empSel.appendChild(opt);
    });
  } catch {
    showToast("Error loading employees.", "error");
  }
}

// 👤 Employee dropdown
async function populateEmployeeDropdown() {
  const dropdown = document.getElementById("employeeName");
  if (!dropdown) return;

  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.role?.toLowerCase() === "employee") {
        const option = document.createElement("option");
        option.value = data.name;
        option.textContent = data.name;
        dropdown.appendChild(option);
      }
    });
  } catch (err) {
    console.error("Error loading employee names:", err);
  }
}

// 👤 Employee dropdown - For Advance table
async function populateAdvanceEmployeeDropdown() {
  const dropdown = document.getElementById("advanceEmployee");
  if (!dropdown) return;

  const seenNames = new Set();
  const querySnapshot = await getDocs(collection(db, "users"));
  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();
    const name = data.name?.trim();
    if (data.role?.toLowerCase() === "employee" && name && !seenNames.has(name)) {
      seenNames.add(name);
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      dropdown.appendChild(option);
    }
  });
}

// 🔎 Fetch expenses
async function fetchExpenses(selectedMonth, selectedEmployee) {
  const snapshot = await getDocs(collection(db, "expenses"));
  const records = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const dateStr = typeof data.date === 'string' ? data.date : '';
    const matchesMonth = dateStr.slice(0, 7) === selectedMonth;
    const matchesEmployee =
      !selectedEmployee ||
      selectedEmployee === "" ||
      selectedEmployee === "All Employees" ||
      data.userId === selectedEmployee;
    if (matchesMonth && matchesEmployee) {
      records.push({ ...data, id: docSnap.id });
    }
  });
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return records;
}

// 🧾 Breakdown builder
function buildBreakdown(exp) {
  return Object.entries(FIELD_GROUPS).map(([groupName, keys]) => {
    const items = keys.map(key => {
      const value = Number(exp[key]) || 0;
      if (key === "placeVisited" && exp[key]) return `${FIELD_LABELS[key]}: ${exp[key]}`;
      if (key === "adhocRequest" && value > 0) return `<span style="color:#007bff;"><strong>${FIELD_LABELS[key]}: ₹${value}</strong></span>`;
      return value > 0 ? `${FIELD_LABELS[key]}: ₹${value}` : '';
    }).filter(Boolean);
    return items.length ? `<strong>${groupName}</strong><br>${items.join(', ')}` : '';
  }).filter(Boolean).join('<br><br>') || `<em>No expense breakdown</em>`;
}

// 🏷️ Status badge (dual status)
function getStatusBadge(status, regularStatus = "") {
  const s = (status || "").toLowerCase();
  const r = (regularStatus || "").toLowerCase();

  if (r === "rejected" && s === "pending") {
    return `<span class="badge rejected">Regular Rejected</span> + <span class="badge pending">Adhoc Pending</span>`;
  }

  switch (s) {
    case "approved":
      return `<span class="badge approved">✅ Approved by Accountant</span>`;
    case "finalapproved":
      return `<span class="badge final-approved">✅ Final Approved by Manager</span>`;
    case "rejected":
      return `<span class="badge rejected">❌ Rejected by Accountant</span>`;
    case "rejectedbymanager":
      return `<span class="badge rejected">❌ Rejected by Manager</span>`;
    case "pending":
      return `<span class="badge pending">⏳ Pending</span>`;
    default:
      return `<span class="badge unknown">❔ Unknown</span>`;
  }
}


// --- Main renderTable with dual-status/tinting/summary logic ---

async function renderTable() {
  try {
    const monthPicker = document.getElementById('monthPicker');
    const empSel = document.getElementById('employeeFilter');
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
    const selectedEmployee = empSel?.value || "";

    const expenses = await fetchExpenses(selectedMonth, selectedEmployee);

    const filteredExpenses = expenses.filter(exp => {
      const advance = Number(exp.advanceCash) || 0;
      const allOthers =
        (Number(exp.fuel) || 0) +
        (Number(exp.fare) || 0) +
        (Number(exp.boarding) || 0) +
        (Number(exp.food) || 0) +
        (Number(exp.localConveyance) || 0) +
        (Number(exp.postCourier) || 0) +
        (Number(exp.monthlyConveyance) || 0) +
        (Number(exp.monthlyPhone) || 0) +
        (Number(exp.adhocRequest) || 0) +
        (Number(exp.misc) || 0);
      return !(advance > 0 && allOthers === 0);
    });

    const tbody = document.querySelector('#expenseTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredExpenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 1em; color: #888;">
            📭 No expenses found for selection.
          </td>
        </tr>`;
      const summaryEl = document.getElementById("accountantSummary");
      if (summaryEl) summaryEl.innerHTML = "";
      return;
    }

    const userCache = {};
    let totalApproved = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let totalSubmitted = 0;
    let totalFinalApprovedRegular = 0;
    let totalAdhocSubmitted = 0;
    let totalAdhocApproved = 0;
    let totalAdhocRejected = 0;

    // 🔹 Build adhocDecisionMap
    const adhocDecisionMap = new Map();
    const adhocSnap = await getDocs(collection(db, "adhocRequests"));
    adhocSnap.forEach(docSnap => {
      const req = docSnap.data();
      const dateStr = typeof req.date === "string" ? req.date : "";
      const status = (req.status || "").toLowerCase();
      const amount = Number(req.amount) || 0;
      const raisedBy = (req.raisedBy || "").toLowerCase().trim();
      if (dateStr.slice(0, 7) === selectedMonth && amount > 0 && raisedBy) {
        const key = `${dateStr}|${amount}|${raisedBy}`;
        adhocDecisionMap.set(key, status);
      }
    });

    for (const exp of filteredExpenses) {
      let employeeName = exp.userId || "-";
      if (exp.userId && !userCache[exp.userId]) {
        const userDoc = await getDoc(doc(db, "users", exp.userId));
        if (userDoc.exists()) {
          employeeName = userDoc.data().name || employeeName;
          userCache[exp.userId] = employeeName;
        }
      } else if (exp.userId && userCache[exp.userId]) {
        employeeName = userCache[exp.userId];
      }

      let regularAmount = 0;
      ["fuel","fare","boarding","food","localConveyance","postCourier","misc","monthlyConveyance","monthlyPhone"]
        .forEach(key => { if (exp[key]) regularAmount += Number(exp[key]); });

      const adhocAmount = Number(exp.adhocRequest) || 0;
      totalSubmitted += (regularAmount + adhocAmount);
      totalAdhocSubmitted += adhocAmount;

      const regularStatus = exp.accountant_regular_status || "";
      const employeeKey = (employeeName || "").toLowerCase().trim();
      const adhocKey = `${exp.date || ""}|${adhocAmount}|${employeeKey}`;
      let managerDecision = adhocDecisionMap.get(adhocKey);

      if (!managerDecision && exp.status === "FinalApproved") {
        managerDecision = "approved";
      }

      let normalized = normalizeStatus(exp.status, regularStatus);

      if (managerDecision === "approved") {
        normalized = "FinalApproved";
      } else if (managerDecision === "rejected") {
        normalized = "RejectedByManager";
      } else if (exp.status === "approved") {
        normalized = "Approved";
      } else if (exp.status === "rejected") {
        normalized = "RejectedByAccountant";
      }

      if (normalized === "Approved") {
        totalApproved += regularAmount;
      } else if (normalized === "FinalApproved") {
        totalFinalApprovedRegular += regularAmount;
        if (adhocAmount > 0) totalAdhocApproved += adhocAmount;
      } else if (normalized === "RejectedByAccountant" || normalized === "RejectedByManager") {
        totalRejected += regularAmount;
        if (normalized === "RejectedByManager" && adhocAmount > 0) {
          totalAdhocRejected += adhocAmount;
        }
      } else {
        totalPending += regularAmount;
      }

      const statusBadge = getStatusBadge(normalized, regularStatus);
      const breakdownHTML = buildBreakdown(exp);

      let rowStyle = "";
      if (regularStatus.toLowerCase() === "rejected" && normalized === "Pending" && adhocAmount > 0) {
        rowStyle = 'style="background-color:#ffe6e6;"';
      } else if (regularAmount > 0 && adhocAmount > 0) {
        rowStyle = 'style="background-color:#f9f9ff;"';
      }

summaryEl.innerHTML = `
  <div class="expense-summary-block" style="
      font-weight:500;
      margin-top:1.2em;
      background:#fafafa;
      border:1px solid #e5e5e5;
      border-radius:10px;
      padding:1.2em 1em 1em 1em;
      box-shadow:0 1px 3px rgba(0,0,0,0.05);
      max-width:550px;
      ">
    <h4 style="margin-top:0; margin-bottom:1em; font-size:1.1em; color:#2176ae;">
      🧾 Employee Expense Summary
    </h4>
    <table style="width:100%; border-collapse:collapse; font-size:1em;">
      <tr>
        <td style="color:#333;">🧾 <strong>Total expenses submitted by emp:</strong></td>
        <td style="text-align:right; color:#222;">${INR.format(totalSubmitted)}</td>
      </tr>
      <tr>
        <td style="color:#2e7d32;">✅ Accountant-eligible expenses:</td>
        <td style="text-align:right; color:#2e7d32;">${INR.format(totalApproved + totalFinalApprovedRegular)}</td>
      </tr>
      <tr>
        <td style="color:#b71c1c;">❌ Rejected by accountant (Regular only):</td>
        <td style="text-align:right; color:#b71c1c;">${INR.format(totalRejected)}</td>
      </tr>
      <tr>
        <td style="color:#ff9800;">⏳ Pending expenses to be reviewed:</td>
        <td style="text-align:right; color:#ff9800;">${INR.format(totalPending)}</td>
      </tr>
      <tr>
        <td style="color:#4e42c7;">💸 Advance cash received by emp:</td>
        <td style="text-align:right; color:#4e42c7;">${INR.format(totalAdvanceReceived)}</td>
      </tr>
      <tr>
        <td style="color:#2196f3;">📌 Adhoc Requests submitted (manager approval needed):</td>
        <td style="text-align:right; color:#2196f3;">${INR.format(totalAdhocSubmitted)}</td>
      </tr>
      <tr>
        <td style="color:#006400;">🔷 Adhoc Requests <strong>approved by manager</strong>:</td>
        <td style="text-align:right; color:#006400;">${INR.format(totalAdhocApproved)}</td>
      </tr>
      <tr>
        <td style="color:#e53935;">❌ Adhoc Requests <strong>rejected by manager</strong>:</td>
        <td style="text-align:right; color:#e53935;">${INR.format(totalAdhocRejected)}</td>
      </tr>
      <tr style="background:#e8f5e9; font-weight:bold;">
        <td style="border-top:2px solid #cfd8dc; color:#1976d2;">${netLabel || "Net Payable"}:</td>
        <td style="border-top:2px solid #cfd8dc; text-align:right; color:#1976d2;">
          ${INR.format(netReimbursementDue)}
        </td>
      </tr>
    </table>
  </div>
`;


    // ✅ Merge FinalApproved regular into totalApproved
    totalApproved += totalFinalApprovedRegular;

    // 🔹 Advance calculation
    let totalAdvanceReceived = 0;
    const advanceSnapshot = await getDocs(collection(db, "advanceCash"));
    advanceSnapshot.forEach(docSnap => {
      const adv = docSnap.data();
      const advDate = typeof adv.date === "string" ? adv.date : "";
      const advMonth = advDate.slice(0, 7);
      const isMonthMatch = advMonth === selectedMonth;
      const empFilter = selectedEmployee?.toLowerCase() || "";
      const empId = (adv.employeeId || "").toLowerCase();
      const empName = (adv.employeeName || "").toLowerCase();
      const isEmpMatch =
        !empFilter || empFilter === "all employees" ||
        empId === empFilter || empName === empFilter;
      if (isMonthMatch && isEmpMatch) {
        totalAdvanceReceived += Number(adv.advanceCash) || 0;
      }
    });

    // 🔹 Render summary
    renderAccountantSummary({
      selectedMonth,
      selectedEmployee,
      totalApproved,
      totalRejected,
      totalPending,
      totalAdvance: totalAdvanceReceived,
      totalSubmitted,
      totalFinalApproved: totalFinalApprovedRegular,
      totalAdhocSubmitted,
      totalAdhocApproved,
      totalAdhocRejected
    });

    // 🔹 Breakdown toggles
    document.querySelectorAll('.toggle-breakdown').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const breakdown = document.getElementById(`breakdown-${id}`);
        if (!breakdown) return;
        const isVisible = breakdown.style.display === 'block';
        breakdown.style.display = isVisible ? 'none' : 'block';
        btn.textContent = isVisible ? '▶' : '▼';
      });
    });

  } catch (err) {
    console.error("renderTable Fatal Error:", err);
    const tbody = document.querySelector('#expenseTable tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color:red; padding:1em;">
            ❌ Error loading expenses. Check console for details.
          </td>
        </tr>`;
    }
    const summaryEl = document.getElementById("accountantSummary");
    if (summaryEl) summaryEl.innerHTML = "";
  }
}
       

// --- Only reflect manager actions for Adhoc in summary
function renderAccountantSummary({
  selectedMonth,
  selectedEmployee,
  totalApproved,
  totalRejected,
  totalPending,
  totalAdvance,
  totalSubmitted,
  totalAdhocSubmitted,
  totalAdhocApproved,
  totalAdhocRejected
}) {
  const summaryEl = document.getElementById("accountantSummary");
  if (!summaryEl) return; // ✅ this return is valid because it's inside a function

  const netReimbursementDue = (totalApproved + totalAdhocApproved) - totalAdvance;
  const netLabel = netReimbursementDue < 0
    ? "💰 Advance exceeds approved"
    : "🔶 Net payable to employee";

  summaryEl.innerHTML = `
    <div style="font-weight:bold; margin-top:1em;">
      🧾 Total expenses submitted by emp: ₹${INR.format(totalSubmitted)}<br>
      ✅ Accountant-eligible expenses: ₹${INR.format(totalApproved)}<br>
      ❌ Rejected by accountant (Regular only): ₹${INR.format(totalRejected)}<br>
      ⏳ Pending expenses to be reviewed by accountant: ₹${INR.format(totalPending)}<br>
      💸 Advance cash received by emp: ₹${INR.format(totalAdvance)}<br>
      📌 Adhoc Requests submitted (manager approval needed): ₹${INR.format(totalAdhocSubmitted)}<br>
      🔷 Adhoc Requests approved by manager: ₹${INR.format(totalAdhocApproved)}<br>
      ❌ Adhoc Requests rejected by manager: ₹${INR.format(totalAdhocRejected)}<br>
      ${netLabel}: ₹${INR.format(netReimbursementDue)}
    </div>
  `;
}

// 🧾 Advance cash table

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr || "-";
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function renderAdvanceCashTable() {
  const tableBody = document.querySelector("#advanceCashTable tbody");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const selectedMonth = document.getElementById("advanceMonth")?.value || "";
  const selectedEmployee = document.getElementById("advanceEmployee")?.value?.toLowerCase() || "";

  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
  const role = userDoc.exists() ? userDoc.data().role?.toLowerCase() : "";
  const userName = userDoc.exists() ? userDoc.data().name?.toLowerCase() : "";

  const snapshot = await getDocs(collection(db, "advanceCash"));
  const records = [];
  snapshot.forEach(docSnap => records.push(docSnap.data()));

  records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const visibleRecords = records.filter(record => {
    const recordDate = record.date || "";
    const recordEmployee = record.employeeName?.toLowerCase() || "";

    const matchMonth = selectedMonth ? recordDate.startsWith(selectedMonth) : true;
    const matchEmployee = selectedEmployee ? recordEmployee === selectedEmployee : true;

    if (role === "employee") {
      return recordEmployee === userName && matchMonth;
    }

    return matchMonth && matchEmployee;
  });

  if (visibleRecords.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;">📭 No advance cash records found.</td>
      </tr>`;
    return;
  }

  visibleRecords.forEach(record => {
    const formattedDate = formatDateDDMMYYYY(record.date);
    tableBody.innerHTML += `
      <tr>
        <td>${record.employeeName || "-"}</td>
        <td>${formattedDate}</td>
        <td>₹${record.advanceCash || 0}</td>
        <td>${record.note || "-"}</td>
        <td>${record.status || "Recorded"}</td>
      </tr>`;
  });
}

// ✅ Advance cash logic
async function recordAdvanceCash(e) {
  e.preventDefault();

  const employeeNameInput = document.getElementById("employeeName");
  const advanceDateInput = document.getElementById("advanceDate");
  const advanceAmountInput = document.getElementById("advanceAmount");
  const advanceNoteInput = document.getElementById("advanceNote");

  const employeeName = employeeNameInput?.value.trim().toLowerCase() || "";
  const advanceDate = advanceDateInput?.value || "";
  const advanceAmount = Number(advanceAmountInput?.value) || 0;
  const advanceNote = advanceNoteInput?.value.trim() || "";

  if (!employeeName || !advanceDate || advanceAmount <= 0) {
    showToast("Please fill all required fields correctly.", "error");
    return;
  }

  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const matchedUser = usersSnapshot.docs.find(d =>
      (d.data().name || "").toLowerCase() === employeeName
    );

    if (!matchedUser) {
      showToast("Employee not found. Please check the name.", "error");
      return;
    }

    const employeeId = matchedUser.id;

    const advanceData = {
      employeeName,
      employeeId,
      date: advanceDate,
      advanceCash: advanceAmount,
      note: advanceNote,
      status: "Recorded",
      createdBy: auth.currentUser?.uid || ""
    };

    await addDoc(collection(db, "advanceCash"), advanceData);

    showToast("Advance cash recorded ✅", "success");
    document.getElementById("advanceCashForm").reset();
    await renderAdvanceCashTable();
  } catch (err) {
    console.error("Error recording advance cash:", err);
    showToast("Error recording advance ❌", "error");
  }
}

// --- Approve selected (accountant can only approve regular)
async function approveSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Approved",
        accountant_regular_status: "Approved",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error approving:", err);
    }
  }
  if (success > 0) showToast(`${success} regular expense(s) approved.`);
  renderTable();
}

// --- Reject selected (accountant only: regular claims, leave Adhoc pending)
async function rejectSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const expenseDoc = await getDoc(doc(db, "expenses", expenseId));
      if (!expenseDoc.exists()) continue;
      const exp = expenseDoc.data();

      let regularAmount =
        (Number(exp.fuel) || 0) +
        (Number(exp.fare) || 0) +
        (Number(exp.boarding) || 0) +
        (Number(exp.food) || 0) +
        (Number(exp.localConveyance) || 0) +
        (Number(exp.postCourier) || 0) +
        (Number(exp.misc) || 0) +
        (Number(exp.monthlyConveyance) || 0) +
        (Number(exp.monthlyPhone) || 0);

      const adhocAmount = Number(exp.adhocRequest) || 0;

      if (regularAmount > 0 && adhocAmount > 0) {
        // Mixed claim: reject regular, Adhoc left as pending
        const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
        await updateDoc(doc(db, "expenses", expenseId), {
          status: "Pending",
          accountant_regular_status: "Rejected",
          accountant_comment: commentBox ? commentBox.value : ""
        });
        success++;
      } else if (regularAmount > 0) {
        // Regular only
        const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
        await updateDoc(doc(db, "expenses", expenseId), {
          status: "Rejected",
          accountant_regular_status: "Rejected",
          accountant_comment: commentBox ? commentBox.value : ""
        });
        success++;
      } else if (adhocAmount > 0) {
        showToast("Adhoc Requests can only be rejected by Manager.", "warning");
      }
    } catch (err) {
      console.error("Error rejecting:", err);
    }
  }
  if (success > 0) showToast(`${success} regular expense(s) rejected.`);
  renderTable();
}

// 📥 CSV Export
function downloadApprovedCSV() {
  const tableBody = document.querySelector("#expenseTable tbody");
  if (!tableBody) {
    alert("No expenses table found.");
    return;
  }
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  const approvedExpenses = [];
  rows.forEach((row, i) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) return;
    const statusSpan = cells[5].querySelector("span");
    const statusText = statusSpan ? statusSpan.textContent.trim().toLowerCase() : "";
    if (statusText !== "accountant approved" && statusText !== "approved") return;
    approvedExpenses.push([
      i + 1,
      sanitize(cells[1].textContent),
      sanitize(cells[2].textContent),
      sanitize(cells[3].textContent),
      sanitize(cells[4].textContent),
      sanitize(statusSpan ? statusSpan.textContent : cells[5].textContent),
      sanitize(cells[7].querySelector("input") ? cells[7].querySelector("input").value : "")
    ]);
  });

  if (approvedExpenses.length === 0) {
    alert("No approved expenses found.");
    return;
  }

  const csvRows = [
    ["S.No", "Date", "Type", "Place/Details", "Total Amount", "Status", "Comment"],
    ...approvedExpenses
  ];
  const BOM = "\uFEFF";
  const csvContent = csvRows.map(row => row.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ApprovedExpenses.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// 📊 CSV helpers
function escapeCSV(val) {
  const str = String(val ?? "");
  const clean = str.replace(/\n/g, " ").replace(/\r/g, " ").trim();
  if (/[,"\n]/.test(clean)) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

function sanitize(val) {
  const str = String(val ?? "");
  return str
    .replace(/[\u{1F600}-\u{1F6FF}₹▶📅🧭]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 🧾 Bank Reimbursement Workflow — Refined for Parity

// --- Helper: Get latest bank status for an employee/month ---
async function getLatestBankStatus(employeeUid, selectedMonth) {
  const q = query(
    collection(db, "bankEvents"),
    where("userId", "==", employeeUid),
    where("month", "==", selectedMonth),
    orderBy("updatedAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const data = snap.docs[0].data();
    return data.reimbursed === true;
  }
  return false;
}

// --- Main workflow: renders bank status block and toggle ---
async function initBankWorkflow(employeeUid, employeeName, isAccountantView) {
  const monthPicker = document.getElementById("monthPicker");
  const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
  const reimbursementBlock = document.getElementById("reimbursementBlock");

  if (!employeeUid || employeeName.toLowerCase() === "all") {
    reimbursementBlock.innerHTML = `
      <div style="color:#f44336; font-weight:500; padding:12px 8px;">
        Please select an individual employee to enable bank reimbursement confirmation.
      </div>
    `;
    return;
  }

  const isReimbursed = await getLatestBankStatus(employeeUid, selectedMonth);

  const html = `
    <div style="margin-bottom:6px; font-weight:500;">
      Employee: <span style="color:#2196F3;">${employeeName}</span>
      | Month: <span style="color:#2196F3;">${selectedMonth}</span>
    </div>
    <table class="confirmation-table" style="margin-top:1em; width:100%; border-collapse:collapse;">
      <thead>
        <tr style="background:#f0f8ff;">
          <th style="text-align:left; padding:8px;">💳 Bank Amount Reimbursed</th>
          <th style="text-align:left; padding:8px;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px;">Final reimbursement credited to employee account</td>
          <td style="padding:8px;">
            ${
              isAccountantView
                ? `<button class="reimb-btn" data-emp="${employeeUid}" data-month="${selectedMonth}" 
                      style="background:${isReimbursed ? '#4CAF50' : '#f44336'};color:#fff;border:none;
                             padding:7px 16px;border-radius:4px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.07);">
                    ${isReimbursed ? "Yes" : "No"}
                 </button>
                 <span style="margin-left:10px; font-weight:600; color:${isReimbursed ? 'green' : 'red'};">
                   ${isReimbursed ? "Reimbursed" : "Not Reimbursed"}
                 </span>`
                : `<span style="font-weight:bold; color:${isReimbursed ? "green" : "red"};">
                     ${isReimbursed ? "Yes" : "No"}
                   </span>`
            }
          </td>
        </tr>
      </tbody>
    </table>
  `;
  reimbursementBlock.innerHTML = html;

  // Button handler (toggle) for accountant view
  if (isAccountantView) {
    const btn = document.querySelector(".reimb-btn");
    if (btn) {
      btn.onclick = async () => {
        const empUid = btn.dataset.emp;
        const month = btn.dataset.month;
        const newStatus = !(btn.textContent.trim() === "Yes");

        await addDoc(collection(db, "bankEvents"), {
          userId: empUid,
          month,
          reimbursed: newStatus,
          updatedBy: "accountant",
          updatedAt: serverTimestamp()
        });

        showToast(`Reimbursement status updated to ${newStatus ? "Yes" : "No"}`, "success");
        await initBankWorkflow(empUid, employeeName, isAccountantView);
      };
    }
  }
}

// 🚦 Init

document.addEventListener('DOMContentLoaded', () => {
  // Attach logout
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  // Safe function checks before calling (avoids load-order bugs)
  if (typeof populateEmployeeDropdown === "function") populateEmployeeDropdown();
  if (typeof populateAdvanceEmployeeDropdown === "function") populateAdvanceEmployeeDropdown();
  if (typeof populateEmployeeFilter === "function") populateEmployeeFilter();

  // Action listeners for approve/reject
  document.getElementById('approveBtn')?.addEventListener('click', approveSelected);
  document.getElementById('rejectBtn')?.addEventListener('click', rejectSelected);
  document.getElementById('monthPicker')?.addEventListener('change', renderTable);
  document.getElementById('employeeFilter')?.addEventListener('change', renderTable);
  document.getElementById('downloadApprovedBtn')?.addEventListener('click', downloadApprovedCSV);

  // Advance cash form
  const advanceForm = document.getElementById('advanceCashForm');
  if (advanceForm) advanceForm.addEventListener('submit', recordAdvanceCash);

  // Advance cash workflow UI toggle
  document.getElementById('goToAdvanceCashBtn')?.addEventListener('click', () => {
    const workflow = document.getElementById('advanceCashWorkflow');
    if (!workflow) return;
    if (workflow.style.display === '' || workflow.style.display === 'none') {
      workflow.style.display = 'block';
      workflow.scrollIntoView({ behavior: 'smooth' });
    } else {
      workflow.style.display = 'none';
    }
  });

  // Advance cash filters
  document.getElementById('advanceMonth')?.addEventListener('change', renderAdvanceCashTable);
  document.getElementById('advanceEmployee')?.addEventListener('change', renderAdvanceCashTable);

  // --- Accountant authentication and secure workflow separation ---
  onAuthStateChanged(auth, async user => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => (window.location.href = "login.html"), 1500);
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const role = (userData.role || '').toLowerCase();

    if (role !== 'accountant') {
      alert("Access denied. Accountant role required.");
      window.location.href = "login.html";
      return;
    }

    const lb = document.querySelector('.logout-btn');
    if (lb) lb.textContent = `🚪 Logout (${role})`;

    await renderTable?.();          // Show main table with dual-status logic
    await renderAdvanceCashTable?.();

    // --- BANK REIMBURSEMENT WORKFLOW ---
    const employeeFilter = document.getElementById('employeeFilter');
    function refreshBankBlock() {
      const employeeUid = employeeFilter.value || "";
      const employeeName = employeeFilter.options[employeeFilter.selectedIndex]?.text || "";
      if (typeof initBankWorkflow === "function") {
        initBankWorkflow(employeeUid, employeeName, true);
      }
    }
    employeeFilter?.addEventListener('change', refreshBankBlock);
    document.getElementById('monthPicker')?.addEventListener('change', refreshBankBlock);

    // Initial reimbursement load
    refreshBankBlock();
  });
});
