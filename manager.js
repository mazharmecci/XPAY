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

// 📊 Render Manager Claims

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

  if (!tableBody || !summaryRow) return; // defensive check

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

    // 🎨 Badge color coding
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

  // 📊 Summary Totals
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

<script>
(function () {
  // Utility: get current month YYYY-MM from header or fallback to today
  function getCurrentMonthKey() {
    // Try reading "November 2025" from your header and convert to "2025-11"
    const header = document.body.innerText.match(/([A-Za-z]+)\s+(\d{4})/);
    if (header) {
      const months = {
        January: "01", February: "02", March: "03", April: "04",
        May: "05", June: "06", July: "07", August: "08",
        September: "09", October: "10", November: "11", December: "12"
      };
      const mm = months[header[1]] || String(new Date().getMonth() + 1).padStart(2, "0");
      return `${header[2]}-${mm}`;
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  // Replace this with your actual data source
  // Example: if you already have a global "expenses" array used to render the table, use that.
  // Expected shape per row: { date, type, place, totalAmount, status, comment }
  const getAllExpenses = () => {
    // Fallback: scrape table rows if no array is available
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    return rows
      .map((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 7) return null;
        return {
          date: tds[1]?.textContent?.trim(),
          type: tds[2]?.textContent?.trim(),
          place: tds[3]?.textContent?.trim(),
          totalAmount: tds[4]?.textContent?.trim(),
          status: tds[5]?.textContent?.trim(),
          comment: tds[7]?.textContent?.trim() || ""
        };
      })
      .filter(Boolean);
  };

  function toCSV(rows) {
    const header = ["S.No", "Date", "Type", "Place", "Total Amount", "Status", "Comment"];
    const lines = [header.join(",")];
    rows.forEach((exp, i) => {
      const line = [
        i + 1,
        exp.date,
        exp.type,
        exp.place,
        exp.totalAmount,
        exp.status,
        (exp.comment || "").replace(/\r?\n/g, " ").replace(/,/g, ";")
      ].join(",");
      lines.push(line);
    });
    return lines.join("\n");
  }

  function downloadBlob(filename, text, mime = "text/csv;charset=utf-8;") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Expose globally for inline onclick
  window.downloadFinalApproved = function () {
    const monthKey = getCurrentMonthKey();         // e.g., "2025-11"
    const all = getAllExpenses();
    const finalApproved = all.filter((x) =>
      (x.status || "").toLowerCase().includes("final approved")
    );

    if (finalApproved.length === 0) {
      alert("No final approved expenses found.");
      return;
    }

    const csv = toCSV(finalApproved);
    downloadBlob(`FinalApprovedExpenses_${monthKey}.csv`, csv);
  };
})();
</script>

// Download expenses in csv format
function downloadFinalApproved() {
  const approvedExpenses = allExpenses.filter(exp => exp.status === "Final Approved by Manager");
  if (approvedExpenses.length === 0) {
    alert("No final approved expenses found.");
    return;
  }

  const csvContent = [
    ["S.No", "Date", "Type", "Place", "Total Amount", "Status", "Comment"],
    ...approvedExpenses.map((exp, index) => [
      index + 1,
      exp.date,
      exp.type,
      exp.place,
      exp.totalAmount,
      exp.status,
      exp.comment || ""
    ])
  ].map(row => row.join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "FinalApprovedExpenses.csv";
  link.click();
}

// 🚦 Init
document.addEventListener("DOMContentLoaded", () => {
  setupLogout();
  setupMonthFilter();
  setupApprovalButtons();

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
  }); // ✅ closes onAuthStateChanged
});   // ✅ closes DOMContentLoaded



