// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { addDoc, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🛡️ Safe value getter
function getVal(id, numeric = false) {
  const el = document.getElementById(id);
  if (!el) return numeric ? 0 : "";
  const val = el.value;
  return numeric ? (Number(val) || 0) : val.trim();
}

// 💠 Helpers
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const isoNow = () => new Date().toISOString();

function normalizeStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "finalapproved" || s === "final approved") return "FinalApproved";
  if (s === "rejected") return "Rejected";
  return "Pending";
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
    .catch((err) => {
      showToast("Logout failed", "error");
      console.error(err);
    });
}

// 🏷️ Status badge
function getStatusBadge(status) {
  const s = normalizeStatus(status);
  if (s === 'Approved') return `<span style="color:green;">✅ Approved by accountant</span>`;
  if (s === 'FinalApproved') return `<span style="color:blue;">🔷 Approved by Manager</span>`;
  if (s === 'Rejected') return `<span style="color:red;">❌ Rejected</span>`;
  return `<span style="color:orange;">⏳ Pending</span>`;
}

// 🧾 Build Expense Data (advanceCash excluded for employees; set to 0 to avoid undefined)
function buildExpenseData(userId) {
  return {
    userId: userId || "",
    workflowType: getVal("workflowType"),
    date: getVal("date"),
    placeVisited: getVal("placeVisited"),
    monthlyConveyance: getVal("monthlyConveyance", true),
    monthlyPhone: getVal("monthlyPhone", true),
    fuel: getVal("fuel", true),
    fare: getVal("fare", true),
    boarding: getVal("boarding", true),
    food: getVal("food", true),
    localConveyance: getVal("localConveyance", true),
    misc: getVal("misc", true),
    postCourier: getVal("postCourier", true),
    advanceCash: 0, // explicit 0 for employees
    status: "Pending",
    timestamp: isoNow(),
  };
}

// 🧮 Safe amount parser
function safeAmount(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// 📤 Submit Expense (with validation + double-submit guard)
let isSubmitting = false;
function createSubmitExpense(currentUserId) {
  return async function submitExpense(e) {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      if (!currentUserId) {
        showToast("You must be logged in.", "error");
        isSubmitting = false;
        return;
      }

      const expenseData = buildExpenseData(currentUserId);

      // ✅ Validation
      const workflowType = expenseData.workflowType;
      const validWorkflowTypes = ["sales", "service", "others"];
      if (!workflowType || !validWorkflowTypes.includes(workflowType)) {
        showToast("Please choose a valid workflow type.", "error");
        isSubmitting = false;
        return;
      }
      if (!expenseData.date || !expenseData.placeVisited) {
        showToast("Please fill Date and Place Visited.", "error");
        isSubmitting = false;
        return;
      }
      ["monthlyConveyance", "monthlyPhone", "fuel", "fare", "boarding", "food", "localConveyance", "misc", "postCourier"].forEach(k => {
        expenseData[k] = safeAmount(expenseData[k]);
        if (expenseData[k] < 0) expenseData[k] = 0;
      });

      await addDoc(collection(db, "expenses"), expenseData);
      showToast("Expense submitted successfully ✅", "success");
      document.getElementById("expenseForm")?.reset();
      await renderExpenses(currentUserId); // refresh expenses after submit, with UID
    } catch (err) {
      console.error("Error submitting expense:", err);
      showToast("Error submitting expense ❌", "error");
    } finally {
      isSubmitting = false;
    }
  }
}

// 🧩 Render sections
function renderTripInfoRow(sn, date, workflow, place, badge) {
  return `
    <tr>
      <td>${sn}</td>
      <td>${date}</td>
      <td>${workflow}</td>
      <td>${place}</td>
      <td>${badge}</td>
    </tr>
  `;
}
function renderTravelCostRow(sn, date, fuel, fare, boarding, food, local, misc, postCourier, badge) {
  return `
    <tr>
      <td>${sn}</td>
      <td>${date}</td>
      <td>${fuel}</td>
      <td>${fare}</td>
      <td>${boarding}</td>
      <td>${food}</td>
      <td>${local}</td>
      <td>${misc}</td>
      <td>${postCourier}</td>
      <td>${badge}</td>
    </tr>
  `;
}
function renderMonthlyClaimsRow(sn, date, convey, phone, badge) {
  return `
    <tr>
      <td>${sn}</td>
      <td>${date}</td>
      <td>${INR.format(convey)}</td>
      <td>${INR.format(phone)}</td>
      <td>${badge}</td>
    </tr>
  `;
}

// 📊 Render Employee Expenses
async function renderExpenses(currentUserId) {
  try {
    const tripInfoTable = document.querySelector("#tripInfoTable tbody");
    const travelCostTable = document.querySelector("#travelCostTable tbody");
    const monthlyClaimsTable = document.querySelector("#monthlyClaimsTable tbody");
    const adhocClaimsTable = document.querySelector("#adhocClaimsTable tbody");
    const monthPicker = document.getElementById("monthPicker");
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);

    if (!tripInfoTable || !travelCostTable || !monthlyClaimsTable || !adhocClaimsTable) {
      showToast("Required expense tables missing in DOM.", "error");
      return;
    }

    tripInfoTable.innerHTML = "";
    travelCostTable.innerHTML = "";
    monthlyClaimsTable.innerHTML = "";
    adhocClaimsTable.innerHTML = "";

    const snapshot = await getDocs(collection(db, "expenses"));
    const records = [];

    snapshot.forEach(docSnap => {
      const exp = docSnap.data();
      const dateStr = typeof exp.date === 'string' ? exp.date : '';
      if (exp.userId === currentUserId && dateStr.slice(0, 7) === selectedMonth) {
        records.push(exp);
      }
    });

    records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let monthlyTotal = 0;
    let travelTotal = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let totalAdvanceReceived = 0;

    records.forEach((exp, index) => {
      const badge = getStatusBadge(exp.status);
      const sn = index + 1;
      const date = exp.date || "-";

      // Trip Info
      tripInfoTable.innerHTML += renderTripInfoRow(sn, date, exp.workflowType || "-", exp.placeVisited || "-", badge);

      // Travel Costs
      const fuel = safeAmount(exp.fuel);
      const fare = safeAmount(exp.fare);
      const boarding = safeAmount(exp.boarding);
      const food = safeAmount(exp.food);
      const local = safeAmount(exp.localConveyance);
      const misc = safeAmount(exp.misc);
      const postCourier = safeAmount(exp.postCourier);
      const travelSum = fuel + fare + boarding + food + local + postCourier;
      travelTotal += travelSum;

      travelCostTable.innerHTML += renderTravelCostRow(sn, date, fuel, fare, boarding, food, local, misc, postCourier, badge);

      // Monthly Claims
      const convey = safeAmount(exp.monthlyConveyance);
      const phone = safeAmount(exp.monthlyPhone);
      const monthlySum = convey + phone;
      monthlyTotal += monthlySum;

      monthlyClaimsTable.innerHTML += renderMonthlyClaimsRow(sn, date, convey, phone, badge);

      const totalForRecord = travelSum + monthlySum;
      const normalized = normalizeStatus(exp.status);

      if (normalized === "Approved" || normalized === "FinalApproved") {
        totalApproved += totalForRecord;
      } else if (normalized === "Rejected") {
        totalRejected += totalForRecord;
      } else {
        totalPending += totalForRecord;
      }
    });

    // 🔄 Fetch accountant-recorded advance cash
    let employeeName = "";
    if (currentUserId) {
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      employeeName = userDoc.exists() ? (userDoc.data().name || "") : "";
    }

    const advanceSnapshot = await getDocs(collection(db, "advanceCash"));
    const advanceRecords = [];

    advanceSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const dateStr = typeof data.date === 'string' ? data.date : '';
      const sameMonth = dateStr.slice(0, 7) === selectedMonth;
      const sameEmp = (data.employeeName || "").toLowerCase() === (employeeName || "").toLowerCase();
      if (sameEmp && sameMonth) advanceRecords.push(data);
    });

    advanceRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    advanceRecords.forEach((record, index) => {
      monthlyClaimsTable.innerHTML += `
        <tr style="background:#fffbe6;">
          <td>AC-${index + 1}</td>
          <td>${record.date || "-"}</td>
          <td colspan="2">${INR.format(Number(record.advanceCash) || 0)}</td>
          <td><span style="color:green;">✅ Cash Advance Recorded</span></td>
        </tr>
      `;
      totalAdvanceReceived += Number(record.advanceCash) || 0;
    });

    // 🔄 Fetch manager-approved and pending Adhoc Pre-Approval records
    const adhocSnapshot = await getDocs(collection(db, "adhocRequests"));
    const adhocRecords = [];

    adhocSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const dateStr = typeof data.date === 'string' ? data.date : '';
      const sameMonth = dateStr.slice(0, 7) === selectedMonth;
      const statusLower = (data.status || "").toLowerCase();
      const sameEmp = (data.raisedBy || "").toLowerCase() === (auth.currentUser?.email || "").toLowerCase();

      if (sameMonth && sameEmp && (statusLower === "pending" || statusLower === "approved")) {
        adhocRecords.push(data);
      }
    });

    adhocRecords.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    adhocRecords.forEach((record, index) => {
      const status = (record.status || "").toLowerCase();
      let statusHtml = "";
    
      if (status === "approved") {
        statusHtml = `<span style="color:blue;">🔷 Approved by Manager</span>`;
        totalAdvanceReceived += Number(record.amount) || 0; // include in totals
      } else if (status === "pending") {
        statusHtml = `<span style="color:orange;">⏳ Pending</span>`;
      } else {
        statusHtml = `<span style="color:red;">❌ Rejected</span>`;
      }
    
      adhocClaimsTable.innerHTML += `
        <tr>
          <td>AD-${index + 1}</td>
          <td>${record.date || "-"}</td>
          <td>${record.purpose || "-"}</td>
          <td>${INR.format(Number(record.amount) || 0)}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
    });

try {
  // 🧾 Final Summary Block (shown after all sections, in its own table)
  const summaryBody = document.querySelector("#summaryTable tbody");
  if (summaryBody) {
    const totalSubmitted = monthlyTotal + travelTotal;
    const netReimbursementDue = totalApproved - totalAdvanceReceived;

    // Build summaryRows string
    const summaryRows = `
      <tr style="font-weight:bold; background:#fff;">
        <td>SUM-1</td>
        <td>📝 Total Expenses Submitted (Monthly + Travel)</td>
        <td>${selectedMonth}</td>
        <td>${INR.format(totalSubmitted)}</td>
        <td></td>
      </tr>
      <tr style="font-weight:bold; background:#e6f7ff;">
        <td>SUM-2</td>
        <td>🪙 Total Advance Received</td>
        <td>${selectedMonth}</td>
        <td>${INR.format(totalAdvanceReceived)}</td>
        <td></td>
      </tr>
      <tr style="font-weight:bold; background:#f0fff0;">
        <td>SUM-3</td>
        <td>✅ Total Approved by Accountant</td>
        <td>${selectedMonth}</td>
        <td>${INR.format(totalApproved)}</td>
        <td></td>
      </tr>
      <tr style="font-weight:bold; background:#fff0f0;">
        <td>SUM-4</td>
        <td>❌ Total Rejected by Accountant</td>
        <td>${selectedMonth}</td>
        <td>${INR.format(totalRejected)}</td>
        <td></td>
      </tr>
      <tr style="font-weight:bold; background:#e8ffe8;">
        <td>SUM-5</td>
        <td>💰 Net Payable to Employee</td>
        <td>${selectedMonth}</td>
        <td>${INR.format(netReimbursementDue)}</td>
        <td>${netReimbursementDue < 0 ? "⚠️ Advance exceeds approved; payout holds" : ""}</td>
      </tr>
    `;

    summaryBody.innerHTML = summaryRows; // Only set this once, after building all rows
  }
} catch (err) {
  console.error("❌ Error rendering expenses:", err);
  showToast("Failed to load expenses.", "error");
}

// 🍽️ Adhoc Pre-Approval Submission (independent of main form)
document.getElementById("submitAdhoc")?.addEventListener("click", async function (e) {
  e.preventDefault();

  const adhocDate = getVal("adhocDate");
  const adhocPurpose = getVal("adhocPurpose");
  const adhocAmount = getVal("adhocAmount", true);
  const currentUserEmail = auth.currentUser?.email || "";

  if (!adhocDate || !adhocPurpose || adhocAmount <= 0) {
    showToast("Please fill Adhoc fields correctly.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "adhocRequests"), {
      date: adhocDate,
      purpose: adhocPurpose,
      amount: adhocAmount,
      raisedBy: currentUserEmail,
      status: "Pending",
      approvalTarget: "mazhar@istos.in",
      approvedAt: null
    });

    showToast("Adhoc request submitted for manager approval ✅", "success");
    document.getElementById("adhocDate").value = "";
    document.getElementById("adhocPurpose").value = "";
    document.getElementById("adhocAmount").value = "0";
  } catch (err) {
    console.error("Error submitting Adhoc request:", err);
    showToast("Submission failed ❌", "error");
  }
});

// 🚦 Init: Now, ONLY runs after auth state is ready
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    let currentUserId = user.uid;

    try {
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      const role = (userDoc.exists() ? userDoc.data().role : "").toLowerCase();

      if (role !== "employee") {
        alert("Access denied. Employee role required.");
        window.location.href = "login.html";
        return;
      }

      // Form event listener, using the current UID
      const form = document.getElementById("expenseForm");
      if (form) {
        form.onsubmit = createSubmitExpense(currentUserId);
      }

      // Month picker (etc)’s change handler – ensures always uses valid UID
      document.getElementById("monthPicker")?.addEventListener("change", () => renderExpenses(currentUserId));

      // Initial load!
      await renderExpenses(currentUserId);
    } catch (err) {
      console.error("❌ Error loading user/role:", err);
      showToast("Failed to load user profile.", "error");
    }
  });
});
