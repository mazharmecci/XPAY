import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, query, where, getDocs, addDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

// ✅ Role-aware logout label
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.data().role;
  document.querySelector('.logout-btn').textContent = `🚪 Logout ${role.charAt(0).toUpperCase() + role.slice(1)}`;
});

// ✅ Toast Alert
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) {
    console.warn("Toast element not found.");
    return;
  }

  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;

  setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}


// 🧾 Expense Type Icon Generator
function getTypeIcon(type) {
  const icons = {
    food: '🍽️', fuel: '⛽', hotel: '🏨', travel: '✈️',
    cash: '💵', vehicle: '🚗', service: '🛠️', advance: '📦'
  };
  return icons[type?.toLowerCase()] || '🧾';
}

// 🏷️ Badge Generator
function getStatusBadge(exp) {
  if (exp.approvedByManager) {
    return `<span class="badge badge-final">✅ Final Approval</span>`;
  } else if (exp.approvedByAccountant) {
    return `<span class="badge badge-accountant">🧾 Approved by Accountant</span>`;
  } else {
    return `<span class="badge badge-pending">⏳ Pending</span>`;
  }
}

// 📅 Date Formatter
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 📊 Render Employee Expenses
function renderExpenses(expenses) {
  const tbody = document.querySelector('#reportTable tbody');
  tbody.innerHTML = '';

  expenses.forEach((exp, index) => {
    const badge = getStatusBadge(exp);
    const workflow = exp.workflowType || 'Unknown';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="4"><strong>${workflow.toUpperCase()} Workflow</strong></td>
    `;
    tbody.appendChild(row);

    const tabs = exp.tabs || {};
    Object.entries(tabs).forEach(([type, data]) => {
      if (!data?.amount) return;
      const icon = getTypeIcon(type);
      const date = formatDate(data.date);
      const amount = data.amount;
      const subRow = document.createElement('tr');
      subRow.innerHTML = `
        <td>${date}</td>
        <td>${icon} ${type}</td>
        <td>₹${amount}</td>
        <td>${badge}</td>
      `;
      tbody.appendChild(subRow);
    });
  });
}

// 🚀 On Load: Fetch Employee Expenses
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  if (userData.role !== 'employee') return;

  const snapshot = await getDocs(
    query(collection(db, 'expenses'), where('userId', '==', user.uid))
  );
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderExpenses(expenses);
});

// 📝 Unified Expense Submission
document.getElementById("expenseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const workflowType = document.getElementById("workflowType").value;
  if (!workflowType) return showToast("Please select a workflow type", "error");

  const tabs = {
    fuel: {
      amount: getVal("fuelAmount"),
      date: getVal("fuelDate")
    },
    travel: {
      place: getVal("travelPlace"),
      amount: getVal("travelAmount"),
      date: getVal("travelDate")
    },
    hotel: {
      amount: getVal("hotelAmount"),
      date: getVal("hotelDate")
    },
    food: {
      amount: getVal("foodAmount"),
      date: getVal("foodDate")
    },
    localconveyance: {
      amount: getVal("localConveyanceAmount"),
      date: getVal("localConveyanceDate")
    },
    misc: {
      amount: getVal("miscAmount"),
      date: getVal("miscDate")
    },
    cash: {
      amount: getVal("cashAmount"),
      date: getVal("cashDate")
    },
    monthlyconveyance: {
      amount: getVal("monthlyConveyanceAmount"),
      date: getVal("monthlyConveyanceDate")
    },
    phone: {
      amount: getVal("phoneAmount"),
      date: getVal("phoneDate")
    }
  };

  const expenseRecord = {
    workflowType,
    tabs,
    userId: auth.currentUser.uid,
    date: new Date().toISOString(),
    status: "pending"
  };

  try {
    await addDoc(collection(db, "expenses"), expenseRecord);
    showToast("Expense submitted successfully!");
    document.getElementById("expenseForm").reset();
  } catch (error) {
    console.error("Submission error:", error);
    showToast("Failed to submit expense", "error");
  }
});

// 🔧 Helper to get input values
function getVal(name) {
  const el = document.querySelector(`[name="${name}"]`);
  return el?.value?.trim() || null;
}
