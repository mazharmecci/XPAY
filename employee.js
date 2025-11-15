// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { addDoc, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// 🚪 Logout
function logoutUser() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  }).catch((err) => {
    showToast("Logout failed", "error");
    console.error(err);
  });
}

// 🏷️ Status badge
function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return `<span style="color:green;">✅ Approved</span>`;
  if (s === 'rejected') return `<span style="color:red;">❌ Rejected</span>`;
  return `<span style="color:orange;">⏳ Pending</span>`;
}

// 🧾 Build Expense Data
function buildExpenseData() {
  return {
    userId: auth.currentUser?.uid || "",
    workflowType: getVal("workflowType"),
    date: getVal("date"),
    placeVisited: getVal("placeVisited"),
    advanceCash: getVal("advanceCash", true),
    monthlyConveyance: getVal("monthlyConveyance", true),
    monthlyPhone: getVal("monthlyPhone", true),
    fuel: getVal("fuel", true),
    fare: getVal("fare", true),
    boarding: getVal("boarding", true),
    food: getVal("food", true),
    localConveyance: getVal("localConveyance", true),
    misc: getVal("misc", true),
    status: "Pending"
  };
}

// 📤 Submit Expense
async function submitExpense(e) {
  e.preventDefault();
  try {
    const expenseData = buildExpenseData();
    await addDoc(collection(db, "expenses"), expenseData);
    showToast("Expense submitted successfully ✅", "success");
    document.getElementById("expenseForm").reset();
    await renderExpenses();
  } catch (err) {
    console.error("Error submitting expense:", err);
    showToast("Error submitting expense ❌", "error");
  }
}

// 🧮 Safe amount parser
function safeAmount(val) {
  return (val === null || val === undefined || isNaN(val)) ? 0 : Number(val);
}

// 📊 Render Employee Expenses

async function renderExpenses() {
  const tripInfoTable = document.querySelector("#tripInfoTable tbody");
  const travelCostTable = document.querySelector("#travelCostTable tbody");
  const monthlyClaimsTable = document.querySelector("#monthlyClaimsTable tbody");
  const selectedMonth = document.getElementById("monthPicker")?.value || new Date().toISOString().slice(0, 7);
  const currentUserId = auth.currentUser?.uid;

  tripInfoTable.innerHTML = "";
  travelCostTable.innerHTML = "";
  monthlyClaimsTable.innerHTML = "";

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

  records.forEach((exp, index) => {
    const badge = getStatusBadge(exp.status);
    const sn = index + 1;

    // Trip Info
    tripInfoTable.innerHTML += `
      <tr>
        <td>${sn}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>${exp.placeVisited || "-"}</td>
        <td>${badge}</td>
      </tr>
    `;

    // Travel Costs
    travelCostTable.innerHTML += `
      <tr>
        <td>${sn}</td>
        <td>${safeAmount(exp.fuel)}</td>
        <td>${safeAmount(exp.fare)}</td>
        <td>${safeAmount(exp.boarding)}</td>
        <td>${safeAmount(exp.food)}</td>
        <td>${safeAmount(exp.localConveyance)}</td>
        <td>${safeAmount(exp.misc)}</td>
        <td>${badge}</td>
      </tr>
    `;

    // Monthly Claims
    const advance = safeAmount(exp.advanceCash);
    const convey = safeAmount(exp.monthlyConveyance);
    const phone = safeAmount(exp.monthlyPhone);
    monthlyTotal += advance + convey + phone;

    monthlyClaimsTable.innerHTML += `
      <tr>
        <td>${sn}</td>
        <td>${advance}</td>
        <td>${convey}</td>
        <td>${phone}</td>
        <td>${badge}</td>
      </tr>
    `;
  });

  // ➕ Summary row for Monthly Claims
  monthlyClaimsTable.innerHTML += `
    <tr style="font-weight:bold; background:#f9f9f9;">
      <td colspan="4" style="text-align:right;">Total Pending for ${selectedMonth}:</td>
      <td>₹${monthlyTotal}</td>
    </tr>
  `;
}


// 🚦 Init

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("expenseForm");
  if (form) form.addEventListener("submit", submitExpense);

  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  // 🗓️ Month filter listener
  document.getElementById("monthPicker")?.addEventListener("change", renderExpenses);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = (userDoc.exists() ? userDoc.data().role : "").toLowerCase();

    if (role !== "employee") {
      alert("Access denied. Employee role required.");
      window.location.href = "login.html";
      return;
    }

    await renderExpenses();
  });
});

