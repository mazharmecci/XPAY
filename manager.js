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

// 📊 Render Manager Claims

async function renderManagerClaims() {
  const tableBody = document.querySelector("#managerClaimsTable tbody");
  const summaryRow = document.querySelector("#managerSummaryRow");
  const selectedMonth = document.getElementById("monthPicker")?.value || new Date().toISOString().slice(0, 7);

  if (!tableBody || !summaryRow) return;

  tableBody.innerHTML = "";
  summaryRow.innerHTML = "";

  const snapshot = await getDocs(collection(db, "expenses"));
  const records = [];

  snapshot.forEach(docSnap => {
    const exp = docSnap.data();
    const dateStr = typeof exp.date === 'string' ? exp.date : '';
    if (dateStr.slice(0, 7) === selectedMonth) {
      records.push({ id: docSnap.id, ...exp });
    }
  });

  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  let totalApproved = 0;
  let totalRejected = 0;
  let totalPending = 0;
  let totalFinalApproved = 0;

  records.forEach((exp, index) => {
    const sn = index + 1;
    const total = calculateExpenseTotal(exp);

    let badgeClass = "";
    let badgeText = "";
    if (exp.status === "Approved") {
      badgeClass = "badge approved";
      badgeText = "Accountant Approved";
      totalApproved += total;
    } else if (exp.status === "Rejected") {
      badgeClass = "badge rejected";
      badgeText = "Rejected";
      totalRejected += total;
    } else if (exp.status === "FinalApproved") {
      badgeClass = "badge final-approved";
      badgeText = "Final Approved";
      totalFinalApproved += total;
    } else {
      badgeClass = "badge pending";
      badgeText = "Pending";
      totalPending += total;
    }

    tableBody.innerHTML += `
      <tr>
        <td>${sn}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>${exp.placeVisited || "-"}</td>
        <td>₹${total}</td>
        <td><span class="${badgeClass}">${badgeText}</span></td>
        <td><input type="checkbox" class="select-claim" data-id="${exp.id}"></td>
        <td><input type="text" class="manager-comment" placeholder="Comment (optional)"></td>
      </tr>
    `;
  });

  const totalSubmittedAmount = records.reduce((sum, exp) => sum + calculateExpenseTotal(exp), 0);

  summaryRow.innerHTML = `
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="7" style="text-align:right;">📊 Total of all the expenses ${selectedMonth}:</td>
      <td>₹${totalSubmittedAmount}</td>
    </tr>
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="7" style="text-align:right;">✅ Approved by Accountant for ${selectedMonth}:</td>
      <td>₹${totalApproved}</td>
    </tr>
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="7" style="text-align:right;">❌ Rejected by Accountant for ${selectedMonth}:</td>
      <td>₹${totalRejected}</td>
    </tr>
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="7" style="text-align:right;">⏳ Still Pending for ${selectedMonth}:</td>
      <td>₹${totalPending}</td>
    </tr>
    <tr style="font-weight:bold; background:#e8ffe8;">
      <td colspan="7" style="text-align:right;">💰 Final Approved by Manager for ${selectedMonth}:</td>
      <td>₹${totalFinalApproved}</td>
    </tr>
  `;
}

// 📥 Download expenses in csv format

function downloadFinalApproved() {
  const tableBody = document.querySelector("#expenseTable tbody");  if (!tableBody) {
    alert("No expenses table found.");
    return;
  }

  const rows = Array.from(tableBody.querySelectorAll("tr"));
  const approvedExpenses = [];

  rows.forEach((row, i) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 8) return;
    const statusText = cells[5].textContent.trim().toLowerCase();
    if (!statusText.includes('final approved')) return;
    approvedExpenses.push([
      i + 1,
      cells[1].textContent.trim(),
      cells[2].textContent.trim(),
      cells[3].textContent.trim(),
      cells[4].textContent.trim(),
      cells[5].textContent.trim(),
      cells[7].querySelector("input") ? cells[7].querySelector("input").value.trim() : ""
    ]);
  });

  if (approvedExpenses.length === 0) {
    alert("No final approved expenses found.");
    return;
  }

  const csvRows = [
    ["S.No", "Date", "Type", "Place", "Total Amount", "Status", "Comment"],
    ...approvedExpenses
  ];

  // Escape CSV fields if needed (quotes for fields with commas/newlines)
  function escapeCSV(val) {
    if (/[,"\n]/.test(val)) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
  const csvContent = csvRows.map(row => row.map(escapeCSV).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "FinalApprovedExpenses.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

document.addEventListener("DOMContentLoaded", () => {
  // ... other setup ...
  const dlBtn = document.getElementById("downloadFinalBtn");
  if (dlBtn) {
    dlBtn.addEventListener("click", downloadFinalApproved);
  }
});


// 🚦 Init

document.addEventListener("DOMContentLoaded", () => {
  setupLogout();
  setupMonthFilter();
  setupApprovalButtons();

  // CSV export button event handler
  const dlBtn = document.getElementById("downloadFinalBtn");
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
