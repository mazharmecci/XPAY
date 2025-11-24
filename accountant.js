// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, addDoc, query, setDoc, where, orderBy, limit, serverTimestamp, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 💰 Currency formatter (ADDED – required by renderAccountantSummary)
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

// 🔄 Status normalizer
function normalizeStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "finalapproved") return "FinalApproved";
  if (s === "rejected") return "RejectedByAccountant";
  if (s === "rejectedbymanager") return "RejectedByManager";
  if (s === "pending") return "Pending";
  return "Unknown";
}

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
    .then(() => {
      window.location.href = "login.html";
    })
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

// 🏷️ Status badge (supports dual status)
function getStatusBadge(status, regularStatus = "") {
  const s = (status || "").toLowerCase();
  const r = (regularStatus || "").toLowerCase();

  if (r === "rejected" && s === "pending") {
    return `<span class="badge rejected">Regular Rejected</span> + <span class="badge pending">Adhoc Pending</span>`;
  }
  if (s === "approved") return `<span class="badge approved">Accountant Approved</span>`;
  if (s === "finalapproved") return `<span class="badge final-approved">Final Approved</span>`;
  if (s === "rejected") return `<span class="badge rejected">Rejected by accountant</span>`;
  if (s === "rejectedbymanager") return `<span class="badge rejected">Rejected by manager</span>`;
  if (s === "pending") return `<span class="badge pending">Pending</span>`;
  return `<span class="badge unknown">Unknown</span>`;
}

// ❌ Reject selected expenses (Regular only)
async function rejectSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const expenseDoc = await getDoc(doc(db, "expenses", expenseId));
      if (!expenseDoc.exists()) continue;

      const exp = expenseDoc.data();
      const regularAmount =
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
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);

      if (regularAmount > 0) {
        // ✅ Reject only Regular portion
        await updateDoc(doc(db, "expenses", expenseId), {
          accountant_regular_status: "Rejected",
          accountant_comment: commentBox ? commentBox.value : "",
          // Keep main status Pending if Adhoc exists
          status: adhocAmount > 0 ? "Pending" : "Rejected"
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

// ✅ Approve selected expenses (Regular only)
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

// --- Main renderTable for accountant
async function renderTable() {
  try {
    const monthPicker = document.getElementById('monthPicker');
    const empSel = document.getElementById('employeeFilter');
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
    const selectedEmployee = empSel?.value || "";

    const expenses = await fetchExpenses(selectedMonth, selectedEmployee);

    const tbody = document.querySelector('#expenseTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 1em; color: #888;">
            📭 No expenses found for selection.
          </td>
        </tr>`;
      return;
    }

    for (const exp of expenses) {
      let regularAmount = 0;
      ["fuel","fare","boarding","food","localConveyance","postCourier","misc",
       "monthlyConveyance","monthlyPhone"]
        .forEach(key => { if (exp[key]) regularAmount += Number(exp[key]); });

      const adhocAmount = Number(exp.adhocRequest) || 0;
      const normalized = normalizeStatus(exp.status);
      const regularStatus = exp.accountant_regular_status || "";

      const breakdownHTML = buildBreakdown(exp);
      const statusBadge = getStatusBadge(exp.status, regularStatus);

      // 🎨 Auto-tint mixed rejection rows
      let rowStyle = "";
      if (regularStatus === "Rejected" && normalized === "Pending" && adhocAmount > 0) {
        rowStyle = 'style="background-color:#ffe6e6;"'; // light red tint
      } else if (regularAmount > 0 && adhocAmount > 0) {
        rowStyle = 'style="background-color:#f9f9ff;"'; // light blue tint for mixed
      }

      tbody.innerHTML += `
        <tr ${rowStyle}>
          <td>${exp.userId || "-"}</td>
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

// --- Accountant Summary (Adhoc rows only reflect Manager decisions)
function renderAccountantSummary({
  selectedMonth,
  selectedEmployee,
  totalApproved,
  totalRejected,
  totalPending,
  totalAdvance,
  totalSubmitted,
  totalFinalApproved,
  totalAdhoc,
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
        <tr><td>📌 Adhoc Requests submitted (manager approval needed):</td><td class="amount-cell"><span style="color:#007bff; font-weight:bold;">${INR.format(totalAdhoc)}</span></td></tr>
        <tr><td>🔷 Adhoc Requests approved by manager:</td><td class="amount-cell"><span style="color:green; font-weight:bold;">${INR.format(totalAdhocApproved)}</span></td></tr>
        <tr><td>❌ Adhoc Requests rejected by manager:</td><td class="amount-cell"><span style="color:red; font-weight:bold;">${INR.format(totalAdhocRejected)}</span></td></tr>
        <tr class="net-row"><td>${netLabel}:</td><td class="amount-cell">${INR.format(netPayable)}</td></tr>
      </table>
      ${netPayable < 0 ? `
        <div style="margin-top:0.5em; font-size:0.9em; color:#888;">
          Note: Negative value means advance exceeds approved reimbursements. No payout expected until approval.
        </div>` : ""}
    </div>
  `;
}

// 🚦 Init
document.addEventListener('DOMContentLoaded', () => {
  // Attach logout
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  // Standard page setup
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
    if (workflow.style.display === "" || workflow.style.display === "none") {
      workflow.style.display = "block";
      workflow.scrollIntoView({ behavior: "smooth" });
    } else {
      workflow.style.display = "none";
    }
  });

  document.getElementById("advanceMonth")?.addEventListener("change", renderAdvanceCashTable);
  document.getElementById("advanceEmployee")?.addEventListener("change", renderAdvanceCashTable);

  // --- Accountant authentication ---
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
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

    await renderTable();
    await renderAdvanceCashTable();
  });
});
