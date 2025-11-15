// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧩 Field Labels and Grouping
const FIELD_GROUPS = {
  "🧭 Trip Info": ["placeVisited"],
  "🚗 Travel Costs": ["fuel", "fare", "boarding", "food", "localConveyance", "misc"],
  "📅 Monthly Claims": ["advanceCash", "monthlyConveyance", "monthlyPhone"]
};

const FIELD_LABELS = {
  placeVisited: "Place Visited",
  fuel: "Fuel",
  fare: "Fare",
  boarding: "Boarding",
  food: "Food",
  localConveyance: "Local Conveyance",
  misc: "Misc",
  advanceCash: "Advance Cash",
  monthlyConveyance: "Monthly Conveyance",
  monthlyPhone: "Monthly Phone"
};

// 🍞 Toast Notification
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

// 🔎 Fetch expenses for selected month
async function fetchExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses");
  const snapshot = await getDocs(expensesRef);
  const records = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const dateStr = typeof data.date === 'string' ? data.date : '';
    if (dateStr.slice(0, 7) === selectedMonth) {
      records.push({ ...data, id: docSnap.id });
    }
  });

  // Sort by date descending
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return records;
}

// 🧾 Build grouped breakdown
function buildBreakdown(exp) {
  return Object.entries(FIELD_GROUPS).map(([groupName, keys]) => {
    const items = keys
      .map(key => exp[key] ? `${FIELD_LABELS[key]}: ₹${exp[key]}` : '')
      .filter(Boolean);

    return items.length
      ? `<strong>${groupName}</strong><br>${items.join(', ')}`
      : '';
  }).filter(Boolean).join('<br><br>');
}

// 🏷️ Status badge
function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return `<span style="color:green;">✅ Approved</span>`;
  if (s === 'rejected') return `<span style="color:red;">❌ Rejected</span>`;
  return `<span style="color:orange;">⏳ Pending</span>`;
}

// 🖥️ Render accountant dashboard table
async function renderTable() {
  const monthPicker = document.getElementById('monthPicker');
  const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
  const expenses = await fetchExpenses(selectedMonth);
  const tbody = document.querySelector('#expenseTable tbody');
  tbody.innerHTML = '';

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 1em; color: #888;">
          📭 No expenses found for ${selectedMonth}.
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
    Object.values(FIELD_GROUPS).flat().forEach(key => {
      if (exp[key] && !isNaN(exp[key])) amount += Number(exp[key]);
    });

    // 🧾 Build breakdown
    const breakdownHTML = buildBreakdown(exp);
    const statusBadge = getStatusBadge(exp.status);

    // 🖥️ Render row with toggle breakdown
    tbody.innerHTML += `
      <tr>
        <td>${employeeName}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>
          <button class="toggle-breakdown" data-id="${exp.id}" style="border:none; background:none; cursor:pointer;">▶</button>
          <span style="margin-left:0.5em;">Click to view breakdown</span>
          <div id="breakdown-${exp.id}" style="display:none; margin-top:0.5em;">${breakdownHTML || 'No expense breakdown'}</div>
        </td>
        <td>₹${amount}</td>
        <td>${statusBadge}</td>
        <td><input type="checkbox" class="action-checkbox" data-id="${exp.id}"></td>
        <td><input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)"></td>
      </tr>
    `;
  }

  // 🔄 Wire up toggle buttons
  document.querySelectorAll('.toggle-breakdown').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const breakdown = document.getElementById(`breakdown-${id}`);
      const isVisible = breakdown.style.display === 'block';
      breakdown.style.display = isVisible ? 'none' : 'block';
      btn.textContent = isVisible ? '▶' : '▼';
    });
  });
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

// 🚦 Init
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

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.textContent = `🚪 Logout (${role})`;

    await renderTable();
  });
});
