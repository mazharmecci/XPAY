// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, addDoc, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 💰 Currency formatter (ADDED – required by renderAccountantSummary)
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

// 🔄 Status normalizer (ADDED – used in renderTable)
function normalizeStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "finalapproved") return "FinalApproved";
  if (s === "rejected" || s === "rejectedbymanager") return "Rejected";
  if (s === "pending") return "Pending";
  return "Unknown";
}

// 🧩 Field Labels and Grouping
const FIELD_GROUPS = {
  "🧭 Trip Info": ["placeVisited"],
  "🚗 Travel Costs": ["fuel", "fare", "boarding", "food", "localConveyance", "PostCourier"],
  "📅 Monthly Claims": ["advanceCash", "monthlyConveyance", "monthlyPhone"]
};

const FIELD_LABELS = {
  placeVisited: "Place Visited",
  fuel: "Fuel",
  fare: "Fare",
  boarding: "Boarding",
  food: "Food",
  localConveyance: "Local Conveyance",
  PostCourier: "PostCourier",
  advanceCash: "Advance Cash",
  monthlyConveyance: "Monthly Conveyance",
  monthlyPhone: "Monthly Phone"
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
    const items = keys
      .map(key => exp[key] ? `${FIELD_LABELS[key]}: ₹${exp[key]}` : '')
      .filter(Boolean);
    return items.length
      ? `<strong>${groupName}</strong><br>${items.join(', ')}`
      : '';
  }).filter(Boolean).join('<br><br>');
}

// 🏷️ Status badge
function getStatusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return `<span class="badge approved">Accountant Approved</span>`;
  if (s === "finalapproved") return `<span class="badge final-approved">Final Approved</span>`;
  if (s === "rejected") return `<span class="badge rejected">Rejected</span>`;
  if (s === "rejectedbymanager") return `<span class="badge rejected">Rejected by Manager</span>`;
  if (s === "pending") return `<span class="badge pending">Pending</span>`;
  return `<span class="badge unknown">Unknown</span>`;
}

// 🖥️ Render accountant table
async function renderTable() {
  try {
    const monthPicker = document.getElementById('monthPicker');
    const empSel = document.getElementById('employeeFilter');
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
    const selectedEmployee = empSel?.value || "";

    const expenses = await fetchExpenses(selectedMonth, selectedEmployee);

    // Filter out advance-cash-only records
    const filteredExpenses = expenses.filter(exp => {
      const advance = Number(exp.advanceCash) || 0;
      const allOthers =
        (Number(exp.fuel) || 0) +
        (Number(exp.fare) || 0) +
        (Number(exp.boarding) || 0) +
        (Number(exp.food) || 0) +
        (Number(exp.localConveyance) || 0) +
        (Number(exp.PostCourier) || 0) +
        (Number(exp.monthlyConveyance) || 0) +
        (Number(exp.monthlyPhone) || 0);
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

      let amount = 0;
      ["fuel", "fare", "boarding", "food", "localConveyance", "PostCourier", "monthlyConveyance", "monthlyPhone"]
        .forEach(key => { if (exp[key]) amount += Number(exp[key]); });

      totalSubmitted += amount;

      const normalized = normalizeStatus(exp.status);
      if (normalized === "Approved" || normalized === "FinalApproved") {
        totalApproved += amount;
      } else if (normalized === "Rejected") {
        totalRejected += amount;
      } else {
        totalPending += amount;
      }

      const breakdownHTML = buildBreakdown(exp);
      const statusBadge = getStatusBadge(exp.status);

      tbody.innerHTML += `
        <tr>
          <td>${employeeName}</td>
          <td>${exp.date || "-"}</td>
          <td>${exp.workflowType || "-"}</td>
          <td>
            <button class="toggle-breakdown" data-id="${exp.id}" style="border:none; background:none; cursor:pointer;">▶</button>
            <span style="margin-left:0.5em;">Click to view breakdown</span>
            <div id="breakdown-${exp.id}" style="display:none; margin-top:0.5em; padding:0.5em; background:#f5f5f5; border-left:3px solid #2196F3; border-radius:4px;">
              ${breakdownHTML || '<em>No expense breakdown</em>'}
            </div>
          </td>
          <td style="font-weight:bold; color:${amount > 0 ? '#4CAF50' : '#999'};">₹${amount}</td>
          <td>${statusBadge}</td>
          <td><input type="checkbox" class="action-checkbox" data-id="${exp.id}"></td>
          <td><input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)"></td>
        </tr>`;
    }

    // 🔄 Sum accountant-recorded advances from advanceCash collection for summary
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

    // ✅ Render summary block
    renderAccountantSummary({
      selectedMonth,
      selectedEmployee,
      totalApproved,
      totalRejected,
      totalPending,
      totalAdvance: totalAdvanceReceived,
      totalSubmitted
    });

    // 🔽 Breakdown toggle handlers
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

// 📋 Summary renderer
function renderAccountantSummary({
  selectedMonth,
  selectedEmployee,
  totalApproved,
  totalRejected,
  totalPending,
  totalAdvance,
  totalSubmitted
}) {
  const summaryContainer = document.getElementById("accountantSummary");
  if (!summaryContainer) return;

  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const netPayable = totalApproved - totalAdvance;
  const netLabel = netPayable < 0
    ? "💰 Advance exceeds approved"
    : "💰 Net payable to employee";

  summaryContainer.innerHTML = `
    <div class="summary-block">
      <h4>📋 Summary for ${selectedEmployee || "All Employees"} – ${monthLabel}</h4>
      <table class="summary-table">
        <tr><td>🧾 Total expenses submitted:</td><td class="amount-cell">${INR.format(totalSubmitted)}</td></tr>
        <tr><td>✅ Approved by Accountant:</td><td class="amount-cell">${INR.format(totalApproved)}</td></tr>
        <tr><td>❌ Rejected by Accountant:</td><td class="amount-cell">${INR.format(totalRejected)}</td></tr>
        <tr><td>⏳ Pending Expenses:</td><td class="amount-cell">${INR.format(totalPending)}</td></tr>
        <tr><td>💸 Advance Cash Received:</td><td class="amount-cell">${INR.format(totalAdvance)}</td></tr>
        <tr class="net-row"><td>${netLabel}:</td><td class="amount-cell">${INR.format(netPayable)}</td></tr>
      </table>
      ${netPayable < 0 ? `
        <div style="margin-top:0.5em; font-size:0.9em; color:#888;">
          Note: Negative value means advance exceeds approved reimbursements. No payout expected until approval.
        </div>` : ""}
    </div>
  `;
}

// 🧾 Advance cash table

function formatDateDDMMYYYY(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr || "-";
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

// ✅ Approve selected expenses
async function approveSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Approved",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error approving:", err);
    }
  }
  showToast(`${success} expense(s) approved.`);
  renderTable();
}

// ❌ Reject selected expenses
async function rejectSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Rejected",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error rejecting:", err);
    }
  }
  showToast(`${success} expense(s) rejected.`);
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

// 🚦 Init
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  populateEmployeeDropdown();
  populateAdvanceEmployeeDropdown();
  populateEmployeeFilter();

  document.getElementById('approveBtn')?.addEventListener('click', approveSelected);
  document.getElementById('rejectBtn')?.addEventListener('click', rejectSelected);
  document.getElementById('monthPicker')?.addEventListener('change', renderTable);
  document.getElementById('employeeFilter')?.addEventListener('change', renderTable);
  document.getElementById("downloadApprovedBtn")?.addEventListener("click", downloadApprovedCSV);

  const advanceForm = document.getElementById("advanceCashForm");
  if (advanceForm) advanceForm.addEventListener("submit", recordAdvanceCash);

  document.getElementById("goToAdvanceCashBtn")?.addEventListener("click", () => {
    const workflow = document.getElementById("advanceCashWorkflow");
    if (!workflow) return;
    if (workflow.style.display === "none" || workflow.style.display === "") {
      workflow.style.display = "block";
      workflow.scrollIntoView({ behavior: "smooth" });
    } else {
      workflow.style.display = "none";
    }
  });

  document.getElementById("advanceMonth")?.addEventListener("change", renderAdvanceCashTable);
  document.getElementById("advanceEmployee")?.addEventListener("change", renderAdvanceCashTable);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => (window.location.href = "login.html"), 1500);
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = (userDoc.exists() ? userDoc.data().role : '').toLowerCase();

    if (role !== 'accountant') {
      alert("Access denied. Accountant role required.");
      window.location.href = "login.html";
      return;
    }

    const lb = document.querySelector('.logout-btn');
    if (lb) lb.textContent = `🚪 Logout (${role})`;

    await renderTable();
    await renderAdvanceCashTable();
  });
});
