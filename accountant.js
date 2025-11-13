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

// 📊 Render expenses with approval buttons
function renderExpenses(expenses) {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${exp.userId}</td>
      <td>${exp.type}</td>
      <td>₹${exp.amount}</td>
      <td>${exp.date}</td>
      <td>${exp.status}</td>
      <td>
        <button class="approve-btn" data-id="${exp.id}">✅ Approve</button>
      </td>
    `;
    tbody.appendChild(row);
  });

// 🔘 Attach approval logic
document.querySelectorAll('.approve-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const expenseId = btn.dataset.id;
    const expenseType = btn.dataset.type || 'Expense'; // optional for overlay

    try {
      await updateDoc(doc(db, 'expenses', expenseId), {
        approvedByAccountant: true,
        status: 'accountant-approved'
      });

      showToast("Expense approved successfully!");
      showApprovalOverlay('Accountant', expenseType); // optional branded feedback

      btn.disabled = true;
      btn.textContent = "✅ Approved";
    } catch (error) {
      console.error("Approval error:", error);
      showToast("Approval failed. Try again.", 'error');
    }
  });
});


// 🚀 On load: fetch all expenses
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
