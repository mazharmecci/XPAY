import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, query, where, getDocs
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
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
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

  console.log("🔍 Employee expenses:", expenses.length);

  expenses.forEach((exp, index) => {
    console.log(`📄 Expense #${index + 1}`, exp);

    const badge = getStatusBadge(exp);
    const icon = getTypeIcon(exp.type);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(exp.date)}</td>
      <td>${icon} ${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${badge}</td>
    `;
    tbody.appendChild(row);
  });

  console.log("✅ Employee expense table rendered.");
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
