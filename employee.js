// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  addDoc,
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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
  if (s === 'Approved') return `<span style="color:green;">✅ Approved</span>`;
  if (s === 'FinalApproved') return `<span style="color:blue;">🔷 Final Approved</span>`;
  if (s === 'Rejected') return `<span style="color:red;">❌ Rejected</span>`;
  return `<span style="color:orange;">⏳ Pending</span>`;
}

// 🧾 Build Expense Data (advanceCash excluded for employees; set to 0 to avoid undefined)
function buildExpenseData() {
  return {
    userId: auth.currentUser?.uid || "",
    workflowType: getVal("workflowType"), // must be "service" or "others"
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
async function submitExpense(e) {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  try {
    if (!auth.currentUser?.uid) {
      showToast("You must be logged in.", "error");
      isSubmitting = false;
      return;
    }

    const expenseData = buildExpenseData();

    // ✅ Validation
    const workflowType = expenseData.workflowType;
    const validWorkflowTypes = ["service", "others"];
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

    // Optional: client-side guard for big negatives or nonsense values
    ["monthlyConveyance", "monthlyPhone", "fuel", "fare", "boarding", "food", "localConveyance", "misc"].forEach(k => {
      expenseData[k] = safeAmount(expenseData[k]);
      if (expenseData[k] < 0) expenseData[k] = 0;
    });

    // Submit
    await addDoc(collection(db, "expenses"), expenseData);
    showToast("Expense submitted successfully ✅", "success");
    document.getElementById("expenseForm")?.reset();
    await renderExpenses();
  } catch (err) {
    console.error("Error submitting expense:", err);
    showToast("Error submitting expense ❌", "error");
  } finally {
    isSubmitting = false;
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

function renderTravelCostRow(sn, date, fuel, fare, boarding, food, local, misc, badge) {
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
      <td>${badge}</td>
    </tr>
  `;
}

function renderMonthlyClaimsRow(sn, date, advance, convey, phone, badge) {
  return `
    <tr>
      <td>${sn}</td>
      <td>${date}</td>
      <td>${INR.format(advance)}</td>
      <td>${INR.format(convey)}</td>
      <td>${INR.format(phone)}</td>
      <td>${badge}</td>
    </tr>
  `;
}

// 📊 Render Employee Expenses
async function renderExpenses() {
  try {
    const tripInfoTable = document.querySelector("#tripInfoTable tbody");
    const travelCostTable = document.querySelector("#travelCostTable tbody");
    const monthlyClaimsTable = document.querySelector("#monthlyClaimsTable tbody");
    const monthPicker = document.getElementById("monthPicker");
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
    const currentUserId = auth.currentUser?.uid;

    if (!tripInfoTable || !travelCostTable || !monthlyClaimsTable) return;

    tripInfoTable.innerHTML = "";
    travelCostTable.innerHTML = "";
    monthlyClaimsTable.innerHTML = "";

    // Fetch expenses
    const snapshot = await getDocs(collection(db, "expenses"));
    const records = [];
    snapshot.forEach(docSnap => {
      const exp = docSnap.data();
      const dateStr = typeof exp.date === 'string' ? exp.date : '';
      if (exp.userId === currentUserId && dateStr.slice(0, 7) === selectedMonth) {
        records.push(exp);
      }
    });

    // Sort desc by date string
    records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let monthlyTotal = 0;
    let travelTotal = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let totalAdvanceReceived = 0;

    // Render expense rows
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
      const travelSum = fuel + fare + boarding + food + local + misc;
      travelTotal += travelSum;

      travelCostTable.innerHTML += renderTravelCostRow(sn, date, fuel, fare, boarding, food, local, misc, badge);

      // Monthly Claims (employee form has no advanceCash; stays 0 here)
      const advance = safeAmount(exp.advanceCash);
      const convey = safeAmount(exp.monthlyConveyance);
      const phone = safeAmount(exp.monthlyPhone);
      const monthlySum = convey + phone;
      monthlyTotal += monthlySum;

      monthlyClaimsTable.innerHTML += renderMonthlyClaimsRow(sn, date, advance, convey, phone, badge);

      const totalForRecord = travelSum + monthlySum;
      const normalized = normalizeStatus(exp.status);
      if (normalized === "Approved" || normalized === "FinalApproved") {
        totalApproved += totalForRecord;
      } else if (normalized === "Rejected") {
        totalRejected += totalForRecord;
      } else {
        totalPending += totalForRecord;
      }

      totalAdvanceReceived += advance;
    });

    // 🔄 Fetch and render accountant-recorded advance cash
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
          <td>${INR.format(Number(record.advanceCash) || 0)}</td>
          <td>-</td>
          <td>-</td>
          <td><span style="color:green;">✅ Accountant Recorded</span></td>
        </tr>
      `;
      totalAdvanceReceived += Number(record.advanceCash) || 0;
    });

    // 🧾 Final Summary Block
    const totalExpenses = monthlyTotal + travelTotal;
    const netReimbursementDue = totalExpenses - totalAdvanceReceived;

    monthlyClaimsTable.innerHTML += `
      <tr style="font-weight:bold; background:#f9f9f9;">
        <td colspan="5" style="text-align:right;">📊 Total expenses submitted for ${selectedMonth}:</td>
        <td>${INR.format(totalExpenses)}</td>
      </tr>
      <tr style="font-weight:bold; background:#e6f7ff;">
        <td colspan="5" style="text-align:right;">🪙 Advance Cash Received (${selectedMonth}):</td>
        <td>${INR.format(totalAdvanceReceived)}</td>
      </tr>
      <tr style="font-weight:bold; background:#f9f9f9;">
        <td colspan="5" style="text-align:right;">✅ Approved by Accountant for ${selectedMonth}:</td>
        <td>${INR.format(totalApproved)}</td>
      </tr>
      <tr style="font-weight:bold; background:#f9f9f9;">
        <td colspan="5" style="text-align:right;">❌ Rejected by Accountant for ${selectedMonth}:</td>
        <td>${INR.format(totalRejected)}</td>
      </tr>
      <tr style="font-weight:bold; background:#e8ffe8;">
        <td colspan="5" style="text-align:right;">💰 Net payable to the emp (${selectedMonth}):</td>
        <td>${INR.format(netReimbursementDue)}</td>
      </tr>
    `;
  } catch (err) {
    console.error("❌ Error rendering expenses:", err);
    showToast("Failed to load expenses.", "error");
  }
}

// 🚦 Init
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("expenseForm");
  if (form) form.addEventListener("submit", submitExpense);

  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  document.getElementById("monthPicker")?.addEventListener("change", renderExpenses);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const role = (userDoc.exists() ? userDoc.data().role : "").toLowerCase();

      if (role !== "employee") {
        alert("Access denied. Employee role required.");
        window.location.href = "login.html";
        return;
      }

      await renderExpenses();
    } catch (err) {
      console.error("❌ Error loading user/role:", err);
      showToast("Failed to load user profile.", "error");
    }
  });
});
