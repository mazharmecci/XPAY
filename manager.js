// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 💰 Currency formatter
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

// ✅ Canonical list of regular (accountant-eligible) fields
const REGULAR_KEYS = [
  "fuel","fare","boarding","food","localConveyance","postCourier","misc",
  "monthlyConveyance","monthlyPhone"
];
function getRegularAmount(exp) {
  return REGULAR_KEYS.reduce((sum, key) => sum + (Number(exp[key]) || 0), 0);
}
function getAdhocAmount(exp) {
  return Number(exp.adhocRequest) || 0;
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// Populate employee filter dropdown
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

// Logout setup
function setupLogout() {
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        showToast("Logged out successfully!");
        setTimeout(() => window.location.href = 'login.html', 1500);
      } catch (error) {
        console.error("Logout error:", error);
        showToast("Logout failed. Try again.", 'error');
      }
    });
  }
}

// Month filter setup
function setupMonthFilter() {
  document.getElementById("monthPicker")?.addEventListener("change", renderManagerClaims);
  document.getElementById("employeeFilter")?.addEventListener("change", renderManagerClaims);
}

// Approval buttons setup
function setupApprovalButtons() {
  document.getElementById("finalApproveBtn")?.addEventListener("click", () =>
    handleFinalAction("FinalApproved", "Final approvals submitted.", "success")
  );
  document.getElementById("finalRejectBtn")?.addEventListener("click", () =>
    handleFinalAction("RejectedByManager", "Selected claims rejected.", "error")
  );
}

// Handle status update
async function handleFinalAction(newStatus, toastMessage, toastType) {
  const selected = document.querySelectorAll(".select-claim:checked");
  for (const checkbox of selected) {
    const id = checkbox.dataset.id;
    const comment = checkbox.closest("tr").querySelector(".manager-comment")?.value || "";
    await updateDoc(doc(db, "expenses", id), {
      status: newStatus,
      finalComment: comment
    });
  }
  showToast(toastMessage, toastType);
  await renderManagerClaims();
}

// Utility: get employee name
async function getEmployeeName(userId, cache) {
  if (!userId) return "-";
  if (cache[userId]) return cache[userId];
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const name = userDoc.data().name || "-";
      cache[userId] = name;
      return name;
    }
  } catch { }
  cache[userId] = "-";
  return "-";
}

// Breakdown builder
function buildBreakdown(exp) {
  return Object.entries({
    "🕓 Trip Info": ["placeVisited"],
    "🗓️ Monthly Claims": ["advanceCash","monthlyConveyance","monthlyPhone","adhocRequest"],
    "🚗 Travel Costs": ["fuel","fare","boarding","food","localConveyance","postCourier","misc"]
  }).map(([groupName, keys]) => {
    const items = keys.map(key => {
      const value = Number(exp[key]) || 0;
      if (key === "placeVisited" && exp[key]) return `${key}: ${exp[key]}`;
      if (key === "adhocRequest" && value > 0) return `<span style="color:#007bff;"><strong>Adhoc Request: ₹${value}</strong></span>`;
      return value > 0 ? `${key}: ₹${value}` : '';
    }).filter(Boolean);
    return items.length ? `<strong>${groupName}</strong><br>${items.join(', ')}` : '';
  }).filter(Boolean).join('<br><br>') || `<em>No expense breakdown</em>`;
}

// Main render - renderMnagerClaims
async function renderManagerClaims() {
  const legendHtml = `
    <div id="claimLegend" class="claim-legend">
      <span style="background:#f9f9ff; border-radius:3px; padding:2px 7px; margin-right:10px;">Mixed Claim: blue background</span>
      <span style="color:#007bff;">Adhoc Only</span>: Tracked for audit purpose
    </div>
  `;

  const tableBody = document.querySelector("#managerClaimsTable tbody");
  const tableWrapper = document.querySelector("#managerClaimsTable").parentElement;
  if (tableWrapper && !document.getElementById("claimLegend")) {
    tableWrapper.insertAdjacentHTML("afterbegin", legendHtml);
  }

  const monthPicker = document.getElementById("monthPicker");
  const empSel = document.getElementById("employeeFilter");
  const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
  const selectedEmployee = empSel?.value || "";
  if (!tableBody) return;

  tableBody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "expenses"));
  const records = [];
  const userCache = {};

  snapshot.forEach(docSnap => {
    const exp = docSnap.data();
    const dateStr = typeof exp.date === "string" ? exp.date : "";
    if (dateStr.slice(0, 7) === selectedMonth && (!selectedEmployee || exp.userId === selectedEmployee)) {
      records.push({ id: docSnap.id, ...exp });
    }
  });

  records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // For manager summary calculations
  let totalAdhocApproved = 0;
  let totalAdhocRejected = 0;
  let totalFinalApproved = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let totalPending = 0;
  let totalAdhoc = 0;

  let rowBuffer = "";
  for (const exp of records) {
    const regularAmount = getRegularAmount(exp);
    const adhocAmount = getAdhocAmount(exp);
    const employeeName = await getEmployeeName(exp.userId, userCache);

    totalAdhoc += adhocAmount;

    // SUMMARY MATH:
    // Only count Adhoc approvals/rejections for expense rows genuinely FinalApproved or RejectedByManager
    if ((exp.status || "") === "FinalApproved") {
      totalAdhocApproved += adhocAmount;
      totalFinalApproved += regularAmount + adhocAmount;
    } else if ((exp.status || "").toLowerCase() === "rejectedbymanager") {
      totalAdhocRejected += adhocAmount;
      totalRejected += regularAmount;
    } else if ((exp.status || "") === "Approved") {
      totalApproved += regularAmount;
    } else if ((exp.status || "") === "Rejected") {
      totalRejected += regularAmount;
    } else {
      totalPending += regularAmount;
    }

    // BADGE LOGIC & ROW COLOR
    let badgeHtml = "";
    if ((exp.status || "") === "FinalApproved") {
      badgeHtml = `<span class="badge final-approved">✅ Final Approved by Manager</span>`;
    } else if ((exp.status || "").toLowerCase() === "rejectedbymanager") {
      badgeHtml = `<span class="badge rejected">❌ Rejected by Manager</span>`;
    } else if ((exp.status || "") === "Approved") {
      badgeHtml = `<span class="badge approved">✅ Accountant Approved</span>`;
    } else if ((exp.status || "") === "Rejected") {
      badgeHtml = `<span class="badge rejected">❌ Rejected</span>`;
    } else {
      badgeHtml = `<span class="badge pending">⏳ Pending</span>`;
    }

    const isMixed = regularAmount > 0 && adhocAmount > 0;
    const isAdhocOnly = (regularAmount === 0 && adhocAmount > 0);
    const rowStyle = isMixed ? 'style="background-color:#f9f9ff;"' : '';

    rowBuffer += `
      <tr ${rowStyle}>
        <td>${employeeName}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>
          <button class="toggle-breakdown" data-id="${exp.id}" style="border:none; background:none; cursor:pointer; font-size:1.2em;" aria-label="Toggle breakdown">▶</button>
          <span style="margin-left:0.5em;">Click to view breakdown</span>
          <div id="breakdown-${exp.id}" style="display:none; margin-top:0.5em; padding:0.5em; background:#f5f5f5; border-left:3px solid #2196F3; border-radius:4px;">
            ${buildBreakdown(exp)}
          </div>
        </td>
        <td style="font-size:0.85em; color:#555;">
          Regular: ₹${regularAmount} <br>
          Adhoc (Manager): <span style="color:#007bff;">₹${adhocAmount}</span>
        </td>
        <td>${badgeHtml}</td>
        <td>
          <input type="checkbox" class="select-claim" data-id="${exp.id}" aria-label="Select for approval or rejection">
        </td>
        <td>
          <input type="text" class="manager-comment" placeholder="Comment (optional)" aria-label="Add comment">
        </td>
      </tr>
    `;
  }

  tableBody.innerHTML = rowBuffer;

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

  // 🔄 Advance cash
  const advanceSnapshot = await getDocs(collection(db, "advanceCash"));
  let totalAdvanceReceived = 0;
  advanceSnapshot.forEach(docSnap => {
    const adv = docSnap.data();
    const advDate = typeof adv.date === "string" ? adv.date : "";
    const advMonth = advDate.slice(0, 7);
    const empFilter = selectedEmployee.trim().toLowerCase();
    const empId = (adv.employeeId || "").toLowerCase();
    const empName = (adv.employeeName || "").toLowerCase();
    const isMonthMatch = advMonth === selectedMonth;
    const isEmpMatch = !empFilter || empId === empFilter || empName === empFilter;
    if (isMonthMatch && isEmpMatch) {
      totalAdvanceReceived += Number(adv.advanceCash) || 0;
    }
  });

  // ✅ Summary block
  renderManagerSummary({
    selectedMonth,
    selectedEmployee,
    totalApproved,
    totalRejected,
    totalPending,
    totalFinalApproved,
    totalAdvance: totalAdvanceReceived,
    totalSubmitted: records.reduce((sum, exp) => sum + getRegularAmount(exp) + getAdhocAmount(exp), 0),
    totalAdhoc,
    totalAdhocApproved,
    totalAdhocRejected
  });
}

// 📋 Summary block renderer
function renderManagerSummary({
  selectedMonth,
  selectedEmployee,
  totalApproved,
  totalRejected,
  totalPending,
  totalFinalApproved,
  totalAdvance,
  totalSubmitted,
  totalAdhoc,
  totalAdhocApproved,
  totalAdhocRejected
}) {
  const summaryContainer = document.getElementById("managerSummaryBlock");
  if (!summaryContainer) return;

  const monthLabel = new Date(`${selectedMonth}-01`).toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const netPayable = totalFinalApproved - totalAdvance;
  const netLabel = netPayable < 0 ? "💰 Advance exceeds approved" : "🔥 Net payable to employee";

  summaryContainer.innerHTML = `
    <div class="summary-block">
      <h4>📋 Summary for ${selectedEmployee || "All Employees"} – ${monthLabel}</h4>
      <table class="summary-table">
        <tr><td>🧾 Total expenses submitted by emp:</td><td class="amount-cell">${INR.format(totalSubmitted)}</td></tr>
        <tr><td>✅ Accountant-approved regular claims:</td><td class="amount-cell">${INR.format(totalApproved)}</td></tr>
        <tr><td>❌ Accountant-rejected regular claims:</td><td class="amount-cell">${INR.format(totalRejected)}</td></tr>
        <tr><td>⏳ Pending expenses from accountant (needed approval):</td><td class="amount-cell">${INR.format(totalPending)}</td></tr>
        <tr><td>💸 Advance Cash Received by emp:</td><td class="amount-cell">${INR.format(totalAdvance)}</td></tr>
        <tr><td>📌 Total Adhoc Requests submitted:</td><td class="amount-cell"><span style="color:#007bff;">${INR.format(totalAdhoc)}</span></td></tr>
        <tr><td>🔷 Adhoc Requests approved by manager:</td><td class="amount-cell"><span style="color:green;">${INR.format(totalAdhocApproved)}</span></td></tr>
        <tr><td>❌ Adhoc Requests rejected by manager:</td><td class="amount-cell"><span style="color:red;">${INR.format(totalAdhocRejected)}</span></td></tr>        
        <tr class="net-row"><td>${netLabel}:</td><td class="amount-cell">${INR.format(netPayable)}</td></tr>
      </table>
      ${netPayable < 0 ? `
        <div style="margin-top:0.5em; font-size:0.9em; color:#888;">
          Note: Negative value means advance exceeds approved reimbursements. No payout expected until approval.
        </div>` : ""}
    </div>
  `;
}

// Export to CSV for final approved
function downloadFinalApproved() {
  const tableBody = document.querySelector("#managerClaimsTable tbody");
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
    if (!statusText.includes("final approved")) return;
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
    alert("No final approved expenses found.");
    return;
  }

  const csvRows = [
    ["S.No", "Date", "Type", "Place/Details", "Total Amount", "Status", "Comment"],
    ...approvedExpenses
  ];
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const csvContent = csvRows.map(row => row.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "FinalApprovedExpenses.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

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
  return str.replace(/[\u{1F600}-\u{1F6FF}₹▶📅🧭]/gu, '').replace(/\s+/g, ' ').trim();
}

// 🚦 Init
document.addEventListener("DOMContentLoaded", async () => {
  setupLogout();
  await populateEmployeeFilter();
  setupMonthFilter();
  setupApprovalButtons();

  const dlBtn = document.getElementById("downloadApprovedBtn");
  if (dlBtn) {
    dlBtn.addEventListener("click", downloadFinalApproved);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = (userDoc.exists() ? userDoc.data().role : "").toLowerCase();
    if (role !== "manager") {
      alert("Access denied. Manager role required.");
      window.location.href = "login.html";
      return;
    }
    await renderManagerClaims();
  });
});
