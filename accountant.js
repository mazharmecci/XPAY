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
function normalizeStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "finalapproved") return "FinalApproved";
  if (s === "rejected") return "RejectedByAccountant";
  if (s === "rejectedbymanager") return "RejectedByManager";
  if (s === "pending") return "Pending";
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
  if (s === "approved") return `<span class="badge approved">Accountant Approved</span>`;
  if (s === "finalapproved") return `<span class="badge final-approved">Final Approved</span>`;
  if (s === "rejected") return `<span class="badge rejected">Rejected by Accountant</span>`;
  if (s === "rejectedbymanager") return `<span class="badge rejected">Rejected by Manager</span>`;
  if (s === "pending") return `<span class="badge pending">Pending</span>`;
  return `<span class="badge unknown">Unknown</span>`;
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

      // For summaries, only track Manager status, not accountant, for Adhoc.
      totalAdhocSubmitted += adhocAmount;
      const normalized = normalizeStatus(exp.status);
      const regularStatus = (exp.accountant_regular_status || "").toLowerCase();

      // Only regular amounts for accountant summary buckets
      if (normalized === "approved") {
        totalApproved += regularAmount;
      } else if (normalized === "rejectedbyaccountant") {
        totalRejected += regularAmount;
      } else if (normalized === "finalapproved") {
        totalFinalApprovedRegular += regularAmount;
        // Adhoc Approved by Manager only
        if (adhocAmount > 0) totalAdhocApproved += adhocAmount;
      } else if (normalized === "rejectedbymanager") {
        totalPending += regularAmount; // Adhoc rejected, regular could be approved/pending depending on setup
        if (adhocAmount > 0) totalAdhocRejected += adhocAmount;
      } else {
        totalPending += regularAmount;
      }

      const breakdownHTML = buildBreakdown(exp);
      const statusBadge = getStatusBadge(exp.status, regularStatus);

      // Auto-tint for dual-status: Accountant rejects regular, Adhoc is still pending
      let rowStyle = "";
      if (regularStatus === "rejected" && normalized === "pending" && adhocAmount > 0) {
        rowStyle = 'style="background-color:#ffe6e6;"'; // light red
      } else if (regularAmount > 0 && adhocAmount > 0) {
        rowStyle = 'style="background-color:#f9f9ff;"';
      }

      tbody.innerHTML += `
        <tr ${rowStyle}>
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
          <td style="font-size:0.85em; color:#555;">
            Regular: ₹${regularAmount} <br>
            Adhoc (Manager): <span style="color:#007bff;">₹${adhocAmount}</span>
          </td>
          <td>${statusBadge}</td>
          ${
            (regularAmount === 0 && adhocAmount > 0)
              ? `<td colspan="2" style="text-align:center; color:#007bff;">Adhoc request – Manager only</td>`
              : `<td>
                   <input type="checkbox" class="action-checkbox" data-id="${exp.id}" 
                     title="Only regular expenses will be approved/rejected. Adhoc portion is manager-only." />
                 </td>
                 <td>
                   <input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)" />
                 </td>`
          }
        </tr>`;
    }

    // Advance calculation & summary rendering
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
  totalFinalApproved,
  totalAdhocSubmitted,
  totalAdhocApproved,
  totalAdhocRejected
}) {
  const summaryContainer = document.getElementById("accountantSummary");
  if (!summaryContainer) return;

  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const netPayable = (totalFinalApproved + totalAdhocApproved) - totalAdvance;
  const netLabel = netPayable < 0
    ? "💰 Advance exceeds approved"
    : "🔶 Net payable to employee";

  summaryContainer.innerHTML = `
    <div class="summary-block">
      <h4>📋 Summary for ${selectedEmployee || "All Employees"} – ${monthLabel}</h4>
      <table class="summary-table">
        <tr><td>🧾 Total expenses submitted by emp:</td><td class="amount-cell">${INR.format(totalSubmitted)}</td></tr>
        <tr><td>✅ Accountant-eligible expenses:</td><td class="amount-cell">${INR.format(totalApproved + totalPending + totalRejected)}</td></tr>
        <tr><td>❌ Rejected by accountant (Regular only):</td><td class="amount-cell">${INR.format(totalRejected)}</td></tr>
        <tr><td>⏳ Pending expenses to be reviewed by accountant:</td><td class="amount-cell">${INR.format(totalPending)}</td></tr>
        <tr><td>💸 Advance cash received by emp:</td><td class="amount-cell">${INR.format(totalAdvance)}</td></tr>
        <tr><td>📌 Adhoc Requests submitted (manager approval needed):</td><td class="amount-cell"><span style="color:#007bff; font-weight:bold;">${INR.format(totalAdhocSubmitted)}</span></td></tr>
        <tr><td>🔷 Adhoc Requests approved by manager:</td><td class="amount-cell"><span style="color:green; font-weight:bold;">${INR.format(totalAdhocApproved)}</span></td></tr>
        <tr><td>❌ Adhoc Requests rejected by manager:</td><td class="amount-cell"><span style="color:red; font-weight:bold;">${INR.format(totalAdhocRejected)}</span></td></tr>
        <tr class="net-row"><td>${netLabel}:</td><td class="amount-cell">${INR.format(netPayable)}</td></tr>
      </table>
    </div>
  `;
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

// (rest unchanged: advance cash logic, CSV, bank workflow...)
// --- All remaining code: downloadApprovedCSV, sanitize, escapeCSV, bank block, etc. ---

// ...Place your unchanged helpers and init code below...

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

  // ...other event listeners and authentication, as in your recent code.

  // Your additional helpers such as recordAdvanceCash, renderAdvanceCashTable, downloadApprovedCSV, etc.
});
