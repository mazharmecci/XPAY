import { auth, db } from './firebase.js';
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

// 📊 Render Expenses into Table

function renderExpenses(expenses) {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';

  console.log("🔍 Total expenses fetched:", expenses.length);

  expenses.forEach((exp, index) => {
    console.log(`📄 Expense #${index + 1}`, {
      id: exp.id,
      userId: exp.userId,
      type: exp.type,
      amount: exp.amount,
      date: exp.date,
      status: exp.status,
      approvedByAccountant: exp.approvedByAccountant,
      approvedByManager: exp.approvedByManager
    });

    const badge = getStatusBadge(exp);
    const icon = getTypeIcon(exp.type);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${exp.userId}</td>
      <td>${icon} ${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${exp.date}</td>
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

  console.log("✅ Expense table rendered.");
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

// 🚀 On Load: Fetch All Expenses

document.addEventListener('DOMContentLoaded', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  if (userData.role !== 'accountant') return;

  const snapshot = await getDocs(collection(db, 'expenses'));
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderExpenses(expenses);
});

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


// ✨ Logout logic

import { signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast("Logged out successfully!");
    setTimeout(() => {
      window.location.href = 'index.html'; // or login.html
    }, 1500);
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Logout failed. Try again.", 'error');
  }
});
