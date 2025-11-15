import { db } from './firebase.js';
import { getDocs, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🚪 Logout function (MUST be on window for HTML onclick)
function logoutUser() {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  }).catch((err) => {
    showToast("Logout failed", "error");
    console.error(err);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
  }
});


// 🔐 Auth Guard, role check and initial expense fetch
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showToast("You must be logged in.", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500); // Wait 1.5 seconds before redirect so toast is visible
    return;
  }

  // Check for employee role
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.exists() ? userDoc.data().role : null;

  if (role !== 'employee') {
    alert("Access denied.");
    window.location.href = "login.html";
    return;
  }

  // Display role in Logout button
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.textContent = `🚪 Logout ${role}`;
  }

  // Load expenses for logged in user
  await loadAndRenderExpenses();
});


// Key fields from your doc: boarding, food, fare, fuel, localConveyance, misc, monthlyConveyance, monthlyPhone

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

// Get all pending expenses for a given month
async function fetchPendingExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses");
  const snapshot = await getDocs(expensesRef);
  const records = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    // Only Pending and matching year-month
    if (
      data.status === "Pending" &&
      data.date &&
      data.date.slice(0, 7) === selectedMonth
    ) {
      records.push({ ...data, id: docSnap.id });
    }
  });
  return records;
}

// Render table: handle document layout per your fields, sum up amount
async function renderTable() {
  const selectedMonth = document.getElementById('monthPicker').value;
  const expenses = await fetchPendingExpenses(selectedMonth);
  const tbody = document.querySelector('#expenseTable tbody');
  tbody.innerHTML = '';

  expenses.forEach(exp => {
    // Calculate total amount
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
          Place: ${exp.placeVisited || "-"}
          <br>
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

// Approval/rejection logic (unchanged, works by doc id)
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

// Attach events and init on page load
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

renderTable(); // Initial table load

// Toast (already provided)
function showToast(message, type = 'success') { /* ... */ }
