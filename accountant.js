import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

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

// 🧾 Expense Type Icon
function getTypeIcon(type) {
  const icons = {
    food: '🍽️', fuel: '⛽', hotel: '🏨', travel: '✈️',
    cash: '💵', vehicle: '🚗', service: '🛠️', advance: '📦'
  };
  return icons[type?.toLowerCase()] || '🧾';
}

// 🏷️ Status Badge Renderer
function getStatusBadge(exp) {
  if (exp.approvedByManager) {
    return `<span class="badge badge-final">✅ Final Approval</span>`;
  }
  if (exp.approvedByAccountant) {
    return `<span class="badge badge-accountant">🧾 Approved by Accountant</span>`;
  }
  return `<span class="badge badge-pending">⏳ Pending</span>`;
}

// 🔘 Action Cell Renderer

function renderActionCell(exp, role) {
  const approvedBadge = role === 'manager'
    ? `<span class="badge badge-final">✅ Final Approval</span>`
    : `<span class="badge badge-approved">✅ Approved</span>`;

  if ((role === 'manager' && exp.approvedByManager) ||
      (role === 'accountant' && exp.approvedByAccountant)) {
    return approvedBadge;
  }

  return `
    <button class="approve-btn" data-id="${exp.id}" data-type="${exp.type}">✅ Approve</button>
    <button class="delete-btn" data-id="${exp.id}">🗑️ Delete</button>
  `;
}

<td>${renderActionCell(exp, role)}</td>


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

// 📊 Render Expenses into Table
function renderExpenses(expenses, userNames) {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const employeeName = userNames[exp.userId] || 'Unknown';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDate(exp.date)}</td>
      <td>${employeeName}</td>
      <td>${getTypeIcon(exp.type)} ${exp.type}</td>
      <td>₹${exp.amount}</td>      
      <td>${getStatusBadge(exp)}</td>
      <td>${renderActionCell(exp)}</td>
    `;
    tbody.appendChild(row);
  });

  attachApprovalLogic();
}

// 🔘 Attach delete expense Logic
function attachDeleteLogic() {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expenseId = btn.dataset.id;
      const confirmed = confirm("Are you sure you want to delete this expense?");
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, 'expenses', expenseId));
        showToast("Expense deleted successfully!");
        btn.closest('tr').remove();
      } catch (error) {
        console.error("Delete error:", error);
        showToast("Delete failed. Try again.", 'error');
      }
    });
  });
}

// 🔘 Attach Approval Logic
function attachApprovalLogic() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expenseId = btn.dataset.id;
      const expenseType = btn.dataset.type || 'Expense';

      try {
        await updateDoc(doc(db, 'expenses', expenseId), {
          approvedByAccountant: true,
          status: 'accountant-approved'
        });

        showToast("Expense approved successfully!");
        showApprovalOverlay("Accountant", expenseType);

        btn.disabled = true;
        btn.textContent = "✅ Approved";
        btn.classList.add("badge", "badge-approved");
      } catch (error) {
        console.error("Approval error:", error);
        showToast("Approval failed. Try again.", 'error');
      }
    });
  });
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
