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
  } catch (err) {
    console.error("Error submitting expense:", err);
    showToast("Error submitting expense ❌", "error");
  }
}

// 📊 Render Employee Expenses (optional reporting)
async function renderExpenses() {
  const tripInfoTable = document.querySelector("#tripInfoTable tbody");
  const travelCostTable = document.querySelector("#travelCostTable tbody");
  const monthlyClaimsTable = document.querySelector("#monthlyClaimsTable tbody");

  tripInfoTable.innerHTML = "";
  travelCostTable.innerHTML = "";
  monthlyClaimsTable.innerHTML = "";

  const snapshot = await getDocs(collection(db, "expenses"));
  snapshot.forEach(docSnap => {
    const exp = docSnap.data();

    // Trip Info
    tripInfoTable.innerHTML += `
      <tr>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>${exp.placeVisited || "-"}</td>
        <td>${exp.status || "-"}</td>
      </tr>
    `;

    // Travel Costs
    travelCostTable.innerHTML += `
      <tr>
        <td>${exp.date || "-"}</td>
        <td>${exp.fuel || 0}</td>
        <td>${exp.fare || 0}</td>
        <td>${exp.boarding || 0}</td>
        <td>${exp.food || 0}</td>
        <td>${exp.localConveyance || 0}</td>
        <td>${exp.misc || 0}</td>
        <td>${exp.status || "-"}</td>
      </tr>
    `;

    // Monthly Claims
    monthlyClaimsTable.innerHTML += `
      <tr>
        <td>${exp.date || "-"}</td>
        <td>${exp.advanceCash || 0}</td>
        <td>${exp.monthlyConveyance || 0}</td>
        <td>${exp.monthlyPhone || 0}</td>
        <td>${exp.status || "-"}</td>
      </tr>
    `;
  });
}

// 🚦 Init
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("expenseForm");
  if (form) form.addEventListener("submit", submitExpense);

  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

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
