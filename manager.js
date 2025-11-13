import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, query, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// ✅ Toast Alert
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
}

// 📊 Render expenses with manager approval
function renderExpenses(expenses) {
  const tbody = document.querySelector('#managerTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const isReady = exp.approvedByAccountant && !exp.approvedByManager;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${exp.userId}</td>
      <td>${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${exp.date}</td>
      <td>${exp.status}</td>
      <td>
        ${isReady
          ? `<button class="approve-btn" data-id="${exp.id}">✅ Final Approve</button>`
          : `<span class="badge">${exp.approvedByManager ? '✅ Approved' : '⏳ Awaiting Accountant'}</span>`
        }
      </td>
    `;
    tbody.appendChild(row);
  });

  // 🔘 Final approval logic
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expenseId = btn.dataset.id;
      try {
        await updateDoc(doc(db, 'expenses', expenseId), {
          approvedByManager: true,
          status: 'manager-approved'
        });
        showToast("Final approval successful!");
        btn.disabled = true;
        btn.textContent = "✅ Approved";
      } catch (error) {
        showToast("Approval failed. Try again.", 'error');
        console.error("Manager approval error:", error);
      }
    });
  });
}

// 🚀 On load: fetch all expenses
document.addEventListener('DOMContentLoaded', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  if (userData.role !== 'manager') return;

  const snapshot = await getDocs(collection(db, 'expenses'));
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderExpenses(expenses);
});

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
