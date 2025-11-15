// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧩 Utility: Toast notifications
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// 🚪 Logout
function logoutUser() {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  }).catch((err) => {
    showToast("Logout failed", "error");
    console.error(err);
  });
}

// 📊 Field labels for expense breakdown
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

// 🔎 Fetch pending expenses for selected month
async function fetchPendingExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses");
  const snapshot = await getDocs(expensesRef);
  const records = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const dateStr = typeof data.date === 'string' ? data.date : '';
    const status = (data.status || '').toLowerCase();

    if (status === "pending" && dateStr.slice(0, 7) === selectedMonth) {
      records.push({ ...data, id: docSnap.id });
    }
  });

  return records;
}

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

  const userCache = {};

  for (const exp of expenses) {
    // 🔍 Fetch employee name
    let employeeName = exp.userId || "-";
    if (exp.userId) {
      if (userCache[exp.userId]) {
        employeeName = userCache[exp.userId];
      } else {
        try {
          const userDoc = await getDoc(doc(db, "users", exp.userId));
          if (userDoc.exists()) {
            employeeName = userDoc.data().name || employeeName;
            userCache[exp.userId] = employeeName;
          }
        } catch (err) {
          console.warn("Failed to fetch employee name:", err);
        }
      }
    }

    // 💰 Calculate total amount
    let amount = 0;
    Object.keys(FIELD_LABELS).forEach(key => {
      if (exp[key] && !isNaN(exp[key])) amount += Number(exp[key]);
    });

    // 🧾 Build breakdown section
    const breakdown = Object.keys(FIELD_LABELS)
      .map(key => exp[key] ? `${FIELD_LABELS[key]}: ₹${exp[key]}` : '')
      .filter(Boolean)
      .join(', ');

    const detailsSection = [
      exp.placeVisited ? `Place: ${exp.placeVisited}` : '',
      breakdown || 'No expense breakdown'
    ].filter(Boolean).join('<br>');

    // 🖥️ Render table row
    tbody.innerHTML += `
      <tr>
        <td>${employeeName}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>${detailsSection}</td>
        <td>₹${amount}</td>
        <td>${exp.status}</td>
        <td><input type="checkbox" class="action-checkbox" data-id="${exp.id}"></td>
        <td><input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)"></td>
      </tr>
    `;
  }
}


// ✅ Approve selected expenses
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

// ❌ Reject selected expenses
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

// 🚦 Init: Auth guard + event wiring
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker && !monthPicker.value) {
    monthPicker.value = new Date().toISOString().slice(0, 7);
  }

  document.getElementById('approveBtn')?.addEventListener('click', approveSelected);
  document.getElementById('rejectBtn')?.addEventListener('click', rejectSelected);
  document.getElementById('monthPicker')?.addEventListener('change', renderTable);

  // 🔐 Auth guard
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const role = (userDoc.exists() ? userDoc.data().role : '').toLowerCase();

    if (role !== 'accountant') {
      alert("Access denied. Accountant role required.");
      window.location.href = "login.html";
      return;
    }

    if (logoutBtn) logoutBtn.textContent = `🚪 Logout (${role})`;

    await renderTable();
  });
});
