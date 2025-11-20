import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧾 Toast Alert
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
}

// 📅 Format Date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 🚪 Logout
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

// 🗓️ Month Filter
function setupMonthFilter() {
  document.getElementById("monthPicker")?.addEventListener("change", renderManagerClaims);
}

// ✅ Approval Buttons
function setupApprovalButtons() {
  document.getElementById("finalApproveBtn")?.addEventListener("click", () =>
    handleFinalAction("FinalApproved", "Final approvals submitted.", "success")
  );
  document.getElementById("finalRejectBtn")?.addEventListener("click", () =>
    handleFinalAction("RejectedByManager", "Selected claims rejected.", "error")
  );
}

// 🔄 Handle Final Action
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

// 🛡️ Safe Amount Helper
function safeAmount(value) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// 🧮 Unified Expense Total Calculator
function calculateExpenseTotal(exp) {
  return safeAmount(exp.advanceCash) 
       + safeAmount(exp.monthlyConveyance) 
       + safeAmount(exp.monthlyPhone)
       + safeAmount(exp.fuel) 
       + safeAmount(exp.fare) 
       + safeAmount(exp.boarding)
       + safeAmount(exp.food) 
       + safeAmount(exp.localConveyance) 
       + safeAmount(exp.misc);
}

// 📊 Render Manager Claims (with Employee name & Breakdown column)
async function renderManagerClaims() {
  const tableBody = document.querySelector("#managerClaimsTable tbody");
  const summaryRow = document.querySelector("#managerSummaryRow");
  const selectedMonth = document.getElementById("monthPicker")?.value || new Date().toISOString().slice(0, 7);
  if (!tableBody || !summaryRow) return;

  tableBody.innerHTML = "";
  summaryRow.innerHTML = "";

  const snapshot = await getDocs(collection(db, "expenses"));
  const records = [];
  const userCache = {};

  // Build record list for the month
  snapshot.forEach(docSnap => {
    const exp = docSnap.data();
    const dateStr = typeof exp.date === "string" ? exp.date : "";
    if (dateStr.slice(0, 7) === selectedMonth) {
      records.push({ id: docSnap.id, ...exp });
    }
  });
  records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  let totalApproved = 0, totalRejected = 0, totalPending = 0, totalFinalApproved = 0;

  // Employee name fetch utility
  async function getEmployeeName(userId) {
    if (!userId) return "-";
    if (userCache[userId]) return userCache[userId];
    try {
      const docRef = doc(db, "users", userId);
      const userDoc = await getDoc(docRef);
      const name = userDoc.exists() ? userDoc.data().name || "-" : "-";
      userCache[userId] = name;
      return name;
    } catch {
      userCache[userId] = "-";
      return "-";
    }
  }

  // Breakdown HTML builder
  function buildBreakdown(exp) {
    const items = [];
    if (exp.placeVisited) items.push(`Place Visited: ${exp.placeVisited}`);
    [
      ["Advance Cash", exp.advanceCash], ["Monthly Conveyance", exp.monthlyConveyance],
      ["Monthly Phone", exp.monthlyPhone], ["Fuel", exp.fuel], ["Fare", exp.fare],
      ["Boarding", exp.boarding], ["Food", exp.food],
      ["Local Conveyance", exp.localConveyance], ["Misc", exp.misc]
    ].forEach(([label, amt]) => {
      amt = Number(amt) || 0;
      if (amt > 0) items.push(`${label}: ₹${amt}`);
    });
    return items.length > 0 ? items.join("<br>") : `<em>No breakdown available</em>`;
  }

  for (let i = 0; i < records.length; i++) {
    const exp = records[i];
    const sn = i + 1;
    const total =
      (Number(exp.advanceCash) || 0) + (Number(exp.monthlyConveyance) || 0) +
      (Number(exp.monthlyPhone) || 0) + (Number(exp.fuel) || 0) +
      (Number(exp.fare) || 0) + (Number(exp.boarding) || 0) +
      (Number(exp.food) || 0) + (Number(exp.localConveyance) || 0) +
      (Number(exp.misc) || 0);

    const employeeName = await getEmployeeName(exp.userId);

    let badgeClass = "", badgeText = "";
    if (exp.status === "Approved") {
      badgeClass = "badge approved"; badgeText = "Accountant Approved"; totalApproved += total;
    } else if (exp.status === "Rejected") {
      badgeClass = "badge rejected"; badgeText = "Rejected"; totalRejected += total;
    } else if (exp.status === "FinalApproved") {
      badgeClass = "badge final-approved"; badgeText = "Final Approved"; totalFinalApproved += total;
    } else {
      badgeClass = "badge pending"; badgeText = "Pending"; totalPending += total;
    }

    tableBody.innerHTML += `
      <tr>
        <td>${sn}</td>
        <td>${employeeName}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>
          <button class="toggle-breakdown" data-id="${exp.id}" style="border:none; background:none; cursor:pointer; font-size:1.2em;">▶</button>
          <span style="margin-left:0.5em;">Click to view breakdown</span>
          <div id="breakdown-${exp.id}" style="display:none; margin-top:0.5em; padding:0.5em; background:#f5f5f5; border-left:3px solid #2196F3; border-radius:4px;">
            ${buildBreakdown(exp)}
          </div>
        </td>
        <td>₹${total}</td>
        <td><span class="${badgeClass}">${badgeText}</span></td>
        <td><input type="checkbox" class="select-claim" data-id="${exp.id}"></td>
        <td><input type="text" class="manager-comment" placeholder="Comment (optional)"></td>
      </tr>
    `;
  }

  // After rendering, setup breakdown toggles
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

  // Summary calculations and rows
  const totalSubmittedAmount = records.reduce(
    (sum, exp) => sum + (
      (Number(exp.advanceCash) || 0) + (Number(exp.monthlyConveyance) || 0) +
      (Number(exp.monthlyPhone) || 0) + (Number(exp.fuel) || 0) +
      (Number(exp.fare) || 0) + (Number(exp.boarding) || 0) +
      (Number(exp.food) || 0) + (Number(exp.localConveyance) || 0) +
      (Number(exp.misc) || 0)
    ), 0);

  summaryRow.innerHTML = `
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="9" style="text-align:right;">📊 Total of all the expenses ${selectedMonth}:</td>
      <td>₹${totalSubmittedAmount}</td>
    </tr>
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="9" style="text-align:right;">✅ Approved by Accountant for ${selectedMonth}:</td>
      <td>₹${totalApproved}</td>
    </tr>
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="9" style="text-align:right;">❌ Rejected by Accountant for ${selectedMonth}:</td>
      <td>₹${totalRejected}</td>
    </tr>
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="9" style="text-align:right;">⏳ Actual Pending Expenses - excluding advanced cash for ${selectedMonth}:</td>
      <td>₹${totalPending}</td>
    </tr>
    <tr style="font-weight:bold; background:#e8ffe8;">
      <td colspan="9" style="text-align:right;">💰 Final Approved by Manager for ${selectedMonth}:</td>
      <td>₹${totalFinalApproved}</td>
    </tr>
  `;
}

// ✅ Cleaned CSV Export for Manager Final Approved Expenses
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
  const csvContent = csvRows
    .map(row => row.map(escapeCSV).join(","))
    .join("\n");

  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "FinalApprovedExpenses.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// 🔧 Escape CSV values (quotes, commas, line breaks)
function escapeCSV(val) {
  const str = String(val ?? ""); // ensure it's a string
  const clean = str.replace(/\n/g, " ").replace(/\r/g, " ").trim();
  if (/[,"\n]/.test(clean)) {
    return `"${clean.replace(/"/g, '""')}"`;
  }
  return clean;
}

function sanitize(val) {
  const str = String(val ?? ""); // ensure it's a string
  return str
    .replace(/[\u{1F600}-\u{1F6FF}₹▶📅🧭]/gu, '') // remove emojis and symbols
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}


// 🚦 Init

document.addEventListener("DOMContentLoaded", () => {
  setupLogout();
  setupMonthFilter();
  setupApprovalButtons();

  // Export CSV for Final Approved
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
  }); // closes onAuthStateChanged
});   // closes DOMContentLoaded
