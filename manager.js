import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧾 Toast Alert
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
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// ✨ Branded Overlay
function showApprovalOverlay(role, expenseType) {
  const overlay = document.createElement('div');
  overlay.className = 'approval-overlay';
  overlay.innerHTML = `
    <div class="overlay-content">
      <img src="images/x.png" class="overlay-logo" />
      <h2>✅ ${role} Approval</h2>
      <p>${expenseType} expense has been approved and logged.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3000);
}

// 🔘 Render Action Cell
function renderActionCell(exp) {
  const isReady = exp.approvedByAccountant && !exp.approvedByManager;

  if (isReady) {
    return `<button class="approve-btn" data-id="${exp.id}" data-type="${exp.type}">✅ Final Approve</button>`;
  }

  return `<span class="badge">${exp.approvedByManager ? '✅ Approved' : '⏳ Awaiting Accountant'}</span>`;
}

// 📊 Render Expenses into Table
function renderExpenses(expenses, userNames) {
  const tbody = document.querySelector('#managerTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const employeeName = userNames[exp.userId] || 'Unknown';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${employeeName}</td>
      <td>${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${formatDate(exp.date)}</td>
      <td>${exp.status}</td>
      <td>${renderActionCell(exp)}</td>
    `;
    tbody.appendChild(row);
  });

  attachApprovalLogic();
}

// 🔘 Attach Approval Logic
function attachApprovalLogic() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expenseId = btn.dataset.id;
      const expenseType = btn.dataset.type || 'Expense';

      try {
        await updateDoc(doc(db, 'expenses', expenseId), {
          approvedByManager: true,
          status: 'manager-approved'
        });

        showToast("Expense approved successfully!");
        showApprovalOverlay("Manager", expenseType);

        btn.disabled = true;
        btn.textContent = "✅ Approved";
        btn.classList.add("badge", "badge-final");
      } catch (error) {
        console.error("Approval error:", error);
        showToast("Approval failed. Try again.", 'error');
      }
    });
  });
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

// 🚀 Auth + Expense Fetch
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.data().role;
  if (role !== 'manager') return;

  document.querySelector('.logout-btn').textContent = `🔒 Logout ${role.charAt(0).toUpperCase() + role.slice(1)}`;

  const [expenseSnapshot, userNames] = await Promise.all([
    getDocs(collection(db, 'expenses')),
    fetchUserNames()
  ]);

  const expenses = expenseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderExpenses(expenses, userNames);
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
