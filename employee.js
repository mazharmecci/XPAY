import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, query, where, getDocs, addDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

/* ---------------------------
   🔐 Auth Guard + Role Redirect
---------------------------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in to access this page.");
    window.location.href = "login.html";
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = userDoc.exists() ? userDoc.data().role : null;

    if (role !== 'employee') {
      alert("Access denied. Redirecting to your dashboard.");
      const redirectMap = {
        manager: "manager.html",
        accountant: "accountant.html"
      };
      window.location.href = redirectMap[role] || "login.html";
      return;
    }

    // ✅ Set logout label
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.textContent = `🚪 Logout ${capitalize(role)}`;
    }

    // ✅ Fetch and render expenses
    const snapshot = await getDocs(
      query(collection(db, 'expenses'), where('userId', '==', user.uid))
    );
    const expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderExpenses(expenses);

  } catch (err) {
    console.error("Auth or role error:", err);
    showToast("Authentication failed", "error");
  }
});

/* ---------------------------
   🛠️ Utilities
---------------------------- */
function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return console.warn("Toast element not found.");
  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

function getTypeIcon(type = "") {
  const icons = {
    food: '🍽️',
    fuel: '⛽',
    boarding: '🏨',
    travel: '✈️',
    cash: '💵',
    localconveyance: '🚌',
    misc: '📦',
    monthlyconveyance: '🚎',
    phone: '📱'
  };
  return icons[type.toLowerCase()] || '🧾';
}

function getStatusBadge(exp = {}) {
  if (exp.approvedByManager) return `<span class="badge badge-final">✅ Final Approval</span>`;
  if (exp.approvedByAccountant) return `<span class="badge badge-accountant">🧾 Approved by Accountant</span>`;
  return `<span class="badge badge-pending">⏳ Pending</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date)) return "-";
  return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

/* ---------------------------
   📊 Render Employee Expenses
---------------------------- */
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

/* ---------------------------
   📝 Expense Submission Handler
---------------------------- */
document.getElementById("expenseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const workflowType = getVal("workflowType");
  if (!workflowType) return showToast("Please select a workflow type", "error");

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit expenses.");
    return;
  }

  const tabs = collectExpenseTabs();
  const expenseRecord = {
    workflowType,
    tabs,
    userId: user.uid,
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

/* ---------------------------
   🔧 Helpers
---------------------------- */
function getVal(name) {
  return document.querySelector(`[name="${name}"]`)?.value?.trim() || null;
}

function collectExpenseTabs() {
  const fields = [
    "fuelAmount", "fuelDate",
    "travelPlace", "travelAmount", "travelDate",
    "boardingAmount", "boardingDate",
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
