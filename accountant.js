// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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

// 🛡️ Safe value getter
function getVal(id, numeric = false) {
  const el = document.getElementById(id);
  if (!el) return numeric ? 0 : "";
  const val = el.value;
  return numeric ? (Number(val) || 0) : val;
}

// 🍞 Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// 🚪 Logout
function logoutUser() {
  signOut(auth)
    .then(() => {
      window.location.href = "login.html";
    })
    .catch((err) => {
      showToast("Logout failed", "error");
      console.error(err);
    });
}

// 👤 Employee Filter - Populate dropdown with list of employees
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
  } catch (e) {
    showToast("Error loading employees.", "error");
  }
}

// 🔎 Fetch expenses for selected month and employee (if supplied)
async function fetchExpenses(selectedMonth, selectedEmployee) {
  const expensesRef = collection(db, "expenses");
  const snapshot = await getDocs(expensesRef);
  const records = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const dateStr = typeof data.date === 'string' ? data.date : '';
    if (
      dateStr.slice(0, 7) === selectedMonth &&
      (!selectedEmployee || data.userId === selectedEmployee)
    ) {
      records.push({ ...data, id: docSnap.id });
    }
  });
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return records;
}

// 🧾 Build grouped breakdown display
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

// 🏷️ Status badge renderer
function getStatusBadge(status) {
  if (status === "Approved") return `<span class="badge approved">Accountant Approved</span>`;
  if (status === "FinalApproved") return `<span class="badge final-approved">Final Approved</span>`;
  if (status === "Rejected") return `<span class="badge rejected">Rejected</span>`;
  if (status === "RejectedByManager") return `<span class="badge rejected">Rejected by Manager</span>`;
  if (status === "Pending") return `<span class="badge pending">Pending</span>`;
  return `<span class="badge unknown">Unknown</span>`;
}

// 🛠️ Debug Logger Utility
const DebugLogger = {
  isEnabled: true, // Set false for production

  log: (title, data) => {
    if (!DebugLogger.isEnabled) return;
    console.group(`🔍 ${title}`);
    console.log(data);
    console.groupEnd();
  },
  table: (title, data) => {
    if (!DebugLogger.isEnabled) return;
    console.group(`📊 ${title}`);
    console.table(data);
    console.groupEnd();
  },
  error: (title, error) => {
    console.group(`❌ ERROR: ${title}`);
    console.error(error);
    console.groupEnd();
  },
  warn: (title, message) => {
    console.group(`⚠️ WARNING: ${title}`);
    console.warn(message);
    console.groupEnd();
  }
};

// 🖥️ Render accountant dashboard table (filtered/employee, omitting advance-cash-only records)
async function renderTable() {
  try {
    const monthPicker = document.getElementById('monthPicker');
    const empSel = document.getElementById('employeeFilter');
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
    const selectedEmployee = empSel?.value || "";

    DebugLogger.log('Selected Month', selectedMonth);
    DebugLogger.log('Selected Employee', selectedEmployee);

    const expenses = await fetchExpenses(selectedMonth, selectedEmployee);
    DebugLogger.log('Total Expenses Fetched', expenses.length);

    // Filter out advance-cash-only
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
    if (!tbody) {
      DebugLogger.error('Table Body Not Found', 'Could not find #expenseTable tbody');
      return;
    }
    tbody.innerHTML = '';

    if (filteredExpenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 1em; color: #888;">
            📭 No expenses found for selection.
          </td>
        </tr>
      `;
      DebugLogger.warn('No Data', `No accountant-relevant expenses for filter`);
      return;
    }

    // Employee name cache for efficiency
    const userCache = {};

    for (const exp of filteredExpenses) {
      let employeeName = exp.userId || "-";
      if (exp.userId) {
        if (userCache[exp.userId]) {
          employeeName = userCache[exp.userId];
        } else {
          try {
            const userDoc = await getDoc(doc(db, "users", exp.userId));
            if (userDoc.exists()) {
              employeeName = userDoc.data().name || employeeName;
              userCache[exp.userId] = employeeName;
            }
          } catch (err) {
            DebugLogger.warn(`Failed to fetch employee name for ${exp.userId}`, err);
          }
        }
      }
      let amount = 0;
      [
        "fuel", "fare", "boarding", "food",
        "localConveyance", "PostCourier", "monthlyConveyance", "monthlyPhone"
      ].forEach(key => {
        if (exp[key] && !isNaN(exp[key])) {
          amount += Number(exp[key]);
        }
      });
      const breakdownHTML = buildBreakdown(exp);
      const statusBadge = getStatusBadge(exp.status);

      tbody.innerHTML += `
        <tr>
          <td>${employeeName}</td>
          <td>${exp.date || "-"}</td>
          <td>${exp.workflowType || "-"}</td>
          <td>
            <button class="toggle-breakdown" data-id="${exp.id}" style="border:none; background:none; cursor:pointer; font-size: 1.2em;">▶</button>
            <span style="margin-left:0.5em;">Click to view breakdown</span>
            <div id="breakdown-${exp.id}" style="display:none; margin-top:0.5em; padding:0.5em; background:#f5f5f5; border-left: 3px solid #2196F3; border-radius: 4px;">
              ${breakdownHTML || '<em>No expense breakdown</em>'}
            </div>
          </td>
          <td style="font-weight: bold; color: ${amount > 0 ? '#4CAF50' : '#999'};">₹${amount}</td>
          <td>${statusBadge}</td>
          <td><input type="checkbox" class="action-checkbox" data-id="${exp.id}"></td>
          <td><input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)"></td>
        </tr>
      `;
    }

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
    DebugLogger.error('renderTable Fatal Error', err);
    const tbody = document.querySelector('#expenseTable tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color: red; padding: 1em;">
            ❌ Error loading expenses. Check console for details.
          </td>
        </tr>
      `;
    }
  }
}

// Approve selected expenses
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

// Reject selected expenses
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

// CSV Export
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
      sanitize(cells[1].textContent), // Date
      sanitize(cells[2].textContent), // Type
      sanitize(cells[3].textContent), // Place/Details
      sanitize(cells[4].textContent), // Amount
      sanitize(statusSpan ? statusSpan.textContent : cells[5].textContent), // Status
      sanitize(cells[7].querySelector("input") ? cells[7].querySelector("input").value : "") // Comment
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
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const csvContent = csvRows
    .map(row => row.map(escapeCSV).join(","))
    .join("\n");
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ApprovedExpenses.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// CSV helpers
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
    .replace(/[\u{1F600}-\u{1F6FF}₹▶📅🧭]/gu, '') // remove emojis
    .replace(/\s+/g, ' ')
    .trim();
}

// 🚦 Init
document.addEventListener('DOMContentLoaded', async () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  await populateEmployeeFilter();
  document.getElementById('approveBtn')?.addEventListener('click', approveSelected);
  document.getElementById('rejectBtn')?.addEventListener('click', rejectSelected);
  document.getElementById('monthPicker')?.addEventListener('change', renderTable);
  document.getElementById('employeeFilter')?.addEventListener('change', renderTable);
  const dlBtn = document.getElementById("downloadApprovedBtn");
  if (dlBtn) {
    dlBtn.addEventListener("click", downloadApprovedCSV);
  }

  // Auth/role logic and initial render
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
      return;
    }
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = (userDoc.exists() ? userDoc.data().role : '').toLowerCase();
    if (role !== 'accountant') {
      alert("Access denied. Accountant role required.");
      window.location.href = "login.html";
      return;
    }
    if (logoutBtn) logoutBtn.textContent = `🚪 Logout (${role})`;
    await renderTable();
  });
});
