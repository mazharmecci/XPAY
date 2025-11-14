import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, query, where, getDocs, addDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

// ✅ Role-aware logout label
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = userDoc.exists() ? userDoc.data().role : "User";
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.textContent = `🚪 Logout ${capitalize(role)}`;
    }
  } catch (err) {
    console.error("Error fetching user role:", err);
  }
});

// 🔧 Utility: Capitalize string
function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ✅ Toast Alert
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return console.warn("Toast element not found.");

  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;

  setTimeout(() => toast.classList.remove("visible"), 3000);
}

// 🧾 Expense Type Icon Generator (aligned with employee.html tabs)
function getTypeIcon(type = "") {
  const icons = {
    food: '🍽️',
    fuel: '⛽',
    boarding: '🏨',        // renamed from hotel
    travel: '✈️',
    cash: '💵',
    localconveyance: '🚌',
    misc: '📦',
    monthlyconveyance: '🚎',
    phone: '📱'
  };
  return icons[type.toLowerCase()] || '🧾';
}


// 🏷️ Badge Generator
function getStatusBadge(exp = {}) {
  if (exp.approvedByManager) return `<span class="badge badge-final">✅ Final Approval</span>`;
  if (exp.approvedByAccountant) return `<span class="badge badge-accountant">🧾 Approved by Accountant</span>`;
  return `<span class="badge badge-pending">⏳ Pending</span>`;
}

// 📅 Date Formatter
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date)) return "-";
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

// 📊 Render Employee Expenses
function renderExpenses(expenses = []) {
  const tbody = document.querySelector('#reportTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const badge = getStatusBadge(exp);
    const workflow = exp.workflowType || 'Unknown';

    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<td colspan="4"><strong>${workflow.toUpperCase()} Workflow</strong></td>`;
    tbody.appendChild(headerRow);

    Object.entries(exp.tabs || {}).forEach(([type, data]) => {
      if (!data?.amount) return;
      const subRow = document.createElement('tr');
      subRow.innerHTML = `
        <td>${formatDate(data.date)}</td>
        <td>${getTypeIcon(type)} ${capitalize(type)}</td>
        <td>₹${data.amount}</td>
        <td>${badge}</td>
      `;
      tbody.appendChild(subRow);
    });
  });
}

// 🚀 On Load: Fetch Employee Expenses
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};
    if (userData.role !== 'employee') return;

    const snapshot = await getDocs(
      query(collection(db, 'expenses'), where('userId', '==', user.uid))
    );
    const expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExpenses(expenses);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    showToast("Failed to load expenses", "error");
  }
});

// 📝 Unified Expense Submission
document.getElementById("expenseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const workflowType = getVal("workflowType");
  if (!workflowType) return showToast("Please select a workflow type", "error");

  const tabs = collectExpenseTabs();

  const expenseRecord = {
    workflowType,
    tabs,
    userId: auth.currentUser?.uid,
    date: new Date().toISOString(),
    status: "pending"
  };

  try {
    await addDoc(collection(db, "expenses"), expenseRecord);
    showToast("Expense submitted successfully!");
    e.target.reset();
  } catch (error) {
    console.error("Submission error:", error);
    showToast("Failed to submit expense", "error");
  }
});

// 🔧 Helper to get input values
function getVal(name) {
  return document.querySelector(`[name="${name}"]`)?.value?.trim() || null;
}

// 🔧 Collect expense tabs dynamically
function collectExpenseTabs() {
  const fields = [
    "fuelAmount", "fuelDate",
    "travelPlace", "travelAmount", "travelDate",
    "hotelAmount", "hotelDate",
    "foodAmount", "foodDate",
    "localConveyanceAmount", "localConveyanceDate",
    "miscAmount", "miscDate",
    "cashAmount", "cashDate",
    "monthlyConveyanceAmount", "monthlyConveyanceDate",
    "phoneAmount", "phoneDate"
  ];

  const tabs = {};
  fields.forEach(name => {
    const val = getVal(name);
    if (val) {
      const type = name.replace(/Amount|Date|Place/i, "").toLowerCase();
      tabs[type] = { ...(tabs[type] || {}), [name.match(/Amount|Date|Place/i)[0].toLowerCase()]: val };
    }
  });
  return tabs;
}
