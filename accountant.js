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
function renderActionCell(exp) {
  if (exp.approvedByManager) {
    return `<span class="badge badge-final">✅ Final Approval</span>`;
  }
  if (exp.approvedByAccountant) {
    return `<span class="badge badge-approved">✅ Approved</span>`;
  }
  return `<button class="approve-btn" data-id="${exp.id}" data-type="${exp.type}">✅ Approve</button>`;
}

// 📊 Render Expenses into Table
function renderExpenses(expenses) {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${exp.userId}</td>
      <td>${getTypeIcon(exp.type)} ${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${formatDate(exp.date)}</td>
      <td>${getStatusBadge(exp)}</td>
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


// 📅 Format Date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// 📊 Render Expenses
function renderExpenses(expenses) {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';

  expenses.forEach((exp, index) => {
    const badge = getStatusBadge(exp);
    const icon = getTypeIcon(exp.type);
    const formattedDate = formatDate(exp.date);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${exp.userId}</td>
      <td>${icon} ${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${formattedDate}</td>
      <td>${badge}</td>
      <td>
        ${!exp.approvedByAccountant
          ? `<button class="approve-btn" data-id="${exp.id}" data-type="${exp.type}">✅ Approve</button>`
          : `<span class="badge badge-approved">✅ Approved</span>`
        }
      </td>
    `;
    tbody.appendChild(row);
  });

  attachApprovalLogic();
}

// 🔘 Approval Logic
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
        showApprovalOverlay('Accountant', expenseType);

        btn.disabled = true;
        btn.textContent = "✅ Approved";
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

  document.querySelector('.logout-btn').textContent = `🚪 Logout ${role.charAt(0).toUpperCase() + role.slice(1)}`;

  const snapshot = await getDocs(collection(db, 'expenses'));
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderExpenses(expenses);
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
