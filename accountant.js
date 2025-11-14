import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  doc, getDoc, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// ✅ Toast Alert
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
  return `${date.getMonth() + 1}-${date.getFullYear()}`;
}

// 👥 Fetch Employee Names
async function fetchUserNames() {
  const snapshot = await getDocs(collection(db, 'users'));
  const userNames = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    userNames[doc.id] = data.name || 'Unknown';
  });
  return userNames;
}

// 📊 Render Grouped Expenses
function renderGroupedExpenses(grouped, userNames) {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';

  Object.entries(grouped).forEach(([key, records]) => {
    const [userId, month] = key.split('|');
    const employeeName = userNames[userId] || 'Unknown';
    const total = records.reduce((sum, r) => {
      return sum + Object.values(r.tabs || {}).reduce((s, tab) => s + (parseFloat(tab.amount) || 0), 0);
    }, 0);
    const approved = records.every(r => r.approvedByAccountant);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${employeeName}</td>
      <td>${month}</td>
      <td>₹${total}</td>
      <td>${approved ? '✅ Approved' : '⏳ Pending'}</td>
      <td>
        ${approved ? '' : `<button class="approve-batch" data-user="${userId}" data-month="${month}">✅ Approve Batch</button>`}
      </td>
    `;
    tbody.appendChild(row);
  });

  attachBatchApproval(grouped);
}

// 🔘 Attach Batch Approval Logic
function attachBatchApproval(grouped) {
  document.querySelectorAll('.approve-batch').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.user;
      const month = btn.dataset.month;
      const key = `${userId}|${month}`;
      const records = grouped[key];

      try {
        await Promise.all(records.map(r =>
          updateDoc(doc(db, 'expenses', r.id), {
            approvedByAccountant: true,
            status: 'accountant-approved'
          })
        ));
        showToast("Batch approved successfully!");
        btn.disabled = true;
        btn.textContent = "✅ Approved";
      } catch (error) {
        console.error("Batch approval error:", error);
        showToast("Approval failed. Try again.", 'error');
      }
    });
  });
}

// 🚀 Auth + Expense Fetch
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.data().role;
  if (role !== 'accountant') return;

  document.querySelector('.logout-btn').textContent = `🔒 Logout ${role.charAt(0).toUpperCase() + role.slice(1)}`;

  const [expenseSnapshot, userNames] = await Promise.all([
    getDocs(collection(db, 'expenses')),
    fetchUserNames()
  ]);

  const grouped = {};
  expenseSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const monthKey = formatDate(data.date);
    const key = `${data.userId}|${monthKey}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ id: doc.id, ...data });
  });

  renderGroupedExpenses(grouped, userNames);
});

// 🚪 Logout Logic
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast("Logged out successfully!");
    setTimeout(() => window.location.href = 'login.html', 1500);
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Logout failed. Try again.", 'error');
  }
});
