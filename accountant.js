import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  getAuth
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  getDoc, getDocs, collection, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// 🚪 Logout function (correct usage with signOut)
function logoutUser() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  }).catch((err) => {
    showToast("Logout failed", "error");
    console.error(err);
  });
}

// Wire logout to button
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }

  // 🗓️ Set default month to current if not already set
  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker && !monthPicker.value) {
    monthPicker.value = new Date().toISOString().slice(0, 7);
  }
});

// --- Accountant Auth Guard and Data Load ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showToast("You must be logged in.", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
    return;
  }

  // Check for accountant role, not employee
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.exists() ? userDoc.data().role : null;

  if (role !== 'accountant') {
    alert("Access denied. Accountant role required.");
    window.location.href = "login.html";
    return;
  }

  // Show role in Logout button
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.textContent = `🚪 Logout (${role})`;
  }

  // Load pending expenses table
  
  await renderTable();
});

// -- Expense fields and fetch logic
const FIELD_LABELS = {
  boarding: "Boarding",
  fare: "Fare",
  food: "Food",
  fuel: "Fuel",
  localConveyance: "Local Conveyance",
  misc: "Misc",
  monthlyConveyance: "Monthly Conveyance",
  monthlyPhone: "Monthly Phone"
};

async function fetchPendingExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses");
  const snapshot = await getDocs(expensesRef);
  const records = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const dateStr = typeof data.date === 'string' ? data.date : '';
    const status = (data.status || '').toLowerCase();

    if (
      status === "pending" &&
      dateStr.slice(0, 7) === selectedMonth
    ) {
      records.push({ ...data, id: docSnap.id });
    }
  });

  return records;
}

// Render accountant dashboard table

async function renderTable() {
  const monthPicker = document.getElementById('monthPicker');
  const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
  const expenses = await fetchPendingExpenses(selectedMonth);
  const tbody = document.querySelector('#expenseTable tbody');
  tbody.innerHTML = '';

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 1em; color: #888;">
          📭 No pending expenses found for ${selectedMonth}.
        </td>
      </tr>
    `;
    return;
  }

  expenses.forEach(exp => {
    let amount = 0;
    Object.keys(FIELD_LABELS).forEach(key => {
      if (exp[key] && !isNaN(exp[key])) amount += Number(exp[key]);
    });

    tbody.innerHTML += `
      <tr>
        <td>${exp.userId || "-"}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>
          Place: ${exp.placeVisited || "-"}<br>
          ${Object.keys(FIELD_LABELS).map(key =>
            exp[key] ? `${FIELD_LABELS[key]}: ₹${exp[key]}` : ''
          ).filter(e => e).join(', ')}
        </td>
        <td>₹${amount}</td>
        <td>${exp.status}</td>
        <td>
          <input type="checkbox" class="action-checkbox" data-id="${exp.id}">
        </td>
        <td>
          <input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)">
        </td>
      </tr>
    `;
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

// Event listeners for table actions
document.getElementById('monthPicker').addEventListener('change', renderTable);
document.getElementById('approveBtn').addEventListener('click', approveSelected);
document.getElementById('rejectBtn').addEventListener('click', rejectSelected);

