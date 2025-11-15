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

  // Render function example
  function renderTable() {
    const tbody = document.querySelector('#expenseTable tbody');
    tbody.innerHTML = '';
    pendingExpenses.forEach(exp => {
      tbody.innerHTML += `<tr>
        <td>${exp.employee}</td>
        <td>${exp.date}</td>
        <td>${exp.type}</td>
        <td>${exp.place}</td>
        <td>₹${exp.amount}</td>
        <td>${exp.status}</td>
        <td>
          <input type="checkbox" class="approve-checkbox">
        </td>
        <td>
          <input type="text" class="comment-box" placeholder="Comment (optional)">
        </td>
      </tr>`;
    });
  }
  renderTable();

  function approveSelected() { /* Approve all checked */}
  function rejectSelected() { /* Reject all checked */}


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
