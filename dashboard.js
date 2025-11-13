import { auth, db } from './firebase.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🔍 Fetch expenses based on role
async function fetchExpenses(user) {
  let q;

  if (user.role === 'employee') {
    q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
  } else if (user.role === 'accountant' || user.role === 'manager') {
    q = query(collection(db, 'expenses')); // See all
  }

  const snapshot = await getDocs(q);
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return expenses;
}

// 🧾 Expense Type Icon Generator
function getTypeIcon(type) {
  const icons = {
    food: '🍽️',
    fuel: '⛽',
    hotel: '🏨',
    travel: '✈️',
    cash: '💵',
    vehicle: '🚗',
    service: '🛠️',
    advance: '📦'
  };
  return icons[type.toLowerCase()] || '🧾';
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

// 📊 Render Expenses into Table
function renderExpenses(expenses) {
  const tbody = document.querySelector('#reportTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const badge = getStatusBadge(exp);
    const icon = getTypeIcon(exp.type);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${icon} ${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${exp.date}</td>
      <td>${badge}</td>
    `;
    tbody.appendChild(row);
  });
}


// 🚀 On page load, fetch user and render report
document.addEventListener('DOMContentLoaded', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();

  const expenses = await fetchExpenses({ uid: user.uid, role: userData.role });
  renderExpenses(expenses);
});
