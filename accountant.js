import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  getDocs,
  collection,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Toast Alert
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// Fetch pending expenses from Firestore for the selected month
async function fetchPendingExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses"); // Make sure your backend collection matches
  const snapshot = await getDocs(expensesRef);
  const expenses = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    // Filter: Only 'Pending' and matching month
    if (
      data.status === "Pending" &&
      data.date && data.date.slice(0, 7) === selectedMonth
    ) {
      expenses.push({ ...data, id: docSnap.id });
    }
  });
  return expenses;
}

// Render the expense table
async function renderTable() {
  const selectedMonth = document.getElementById('monthPicker').value;
  const expenses = await fetchPendingExpenses(selectedMonth);
  const tbody = document.querySelector('#expenseTable tbody');
  tbody.innerHTML = '';
  expenses.forEach(exp => {
    tbody.innerHTML += `
      <tr>
        <td>${exp.employee}</td>
        <td>${exp.date}</td>
        <td>${exp.type}</td>
        <td>${exp.place}</td>
        <td>₹${exp.amount}</td>
        <td>${exp.status}</td>
        <td>
          <input type="checkbox" class="action-checkbox" data-id="${exp.id}">
        </td>
        <td>
          <input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)">
        </td>
      </tr>`;
  });
}

// Approve selected expenses
async function approveSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Approved",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error approving:", err);
    }
  }
  showToast(`${success} expense(s) approved.`);
  renderTable();
}

// Reject selected expenses
async function rejectSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Rejected",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error rejecting:", err);
    }
  }
  showToast(`${success} expense(s) rejected.`);
  renderTable();
}

// Event Listeners
document.getElementById('monthPicker').addEventListener('change', renderTable);
document.getElementById('approveBtn').addEventListener('click', approveSelected);
document.getElementById('rejectBtn').addEventListener('click', rejectSelected);
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast("Logged out successfully!");
    setTimeout(() => (window.location.href = 'login.html'), 1500);
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Logout failed. Try again.", 'error');
  }
});

// On page load, show table
renderTable();
