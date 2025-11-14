import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, addDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

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
    // If the user was just logged out, redirect silently without alert
    window.location.href = "login.html";
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

// 📝 Form Submission Handler
document.getElementById("expenseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  // Validate key fields
  if (!data.workflowType || !data.date) {
    return showToast("Workflow and date are required", "error");
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit.");
    return;
  }

  // Build the expense record object
  const expenseRecord = {
    userId: user.uid,
    workflowType: data.workflowType,
    date: data.date,
    fields: {
      placeVisited: data.place || null,
      fuel: parseFloat(data.fuel) || null,
      fare: parseFloat(data.fare) || null,
      boarding: parseFloat(data.boarding) || null,
      food: parseFloat(data.food) || null,
      localConveyance: parseFloat(data.local) || null,
      misc: parseFloat(data.misc) || null,
      advanceCash: parseFloat(data.advance) || null,
      monthlyConveyance: parseFloat(data["monthly-conveyance"]) || null,
      monthlyPhone: parseFloat(data["monthly-phone"]) || null
    },
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "expenses"), expenseRecord);
    showToast("Expense submitted!");
    form.reset();
    await loadAndRenderExpenses(); // ⬅ Refresh after submit
  } catch (err) {
    console.error("Error submitting:", err);
    showToast("Submission failed", "error");
  }
});

// 🧾 Toast function for feedback
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

// 📊 Load all expenses for current user & render, grouped
async function loadAndRenderExpenses() {
  const user = auth.currentUser;
  if (!user) return;

  // Query expenses where userId matches
  const expenseQuery = query(
    collection(db, "expenses"),
    where("userId", "==", user.uid)
  );
  const snapshot = await getDocs(expenseQuery);
  const expenses = [];
  snapshot.forEach(doc => {
    expenses.push(doc.data());
  });
  renderExpenses(expenses);
}

// 📊 Render expenses into three grouped tables
function renderExpenses(expenses = []) {
  // Arrays for grouping
  const tripRows = [];
  const travelRows = [];
  const monthlyRows = [];

  expenses.forEach(exp => {
    const f = exp.fields || {};

    // Trip Info table (always fill)
    tripRows.push(`
      <tr>
        <td>${formatDate(exp.date)}</td>
        <td>${exp.workflowType || '-'}</td>
        <td>${f.placeVisited || '-'}</td>
        <td>${exp.status || 'pending'}</td>
      </tr>
    `);

    // Travel Costs (🚖 at least one travel field present)
    if ([f.fuel, f.fare, f.boarding, f.food, f.localConveyance, f.misc].some(x => x != null && x !== "")) {
      travelRows.push(`
        <tr>
          <td>${formatDate(exp.date)}</td>
          <td>₹${f.fuel || 0}</td>
          <td>₹${f.fare || 0}</td>
          <td>₹${f.boarding || 0}</td>
          <td>₹${f.food || 0}</td>
          <td>₹${f.localConveyance || 0}</td>
          <td>₹${f.misc || 0}</td>
          <td>${exp.status || 'pending'}</td>
        </tr>
      `);
    }

    // Monthly Claims (📱 at least one monthly field present)
    if ([f.advanceCash, f.monthlyConveyance, f.monthlyPhone].some(x => x != null && x !== "")) {
      monthlyRows.push(`
        <tr>
          <td>${formatDate(exp.date)}</td>
          <td>₹${f.advanceCash || 0}</td>
          <td>₹${f.monthlyConveyance || 0}</td>
          <td>₹${f.monthlyPhone || 0}</td>
          <td>${exp.status || 'pending'}</td>
        </tr>
      `);
    }
  });

  // Fill the tables (needs the grouped tables in your HTML)
  document.querySelector('#tripInfoTable tbody').innerHTML = tripRows.join('');
  document.querySelector('#travelCostTable tbody').innerHTML = travelRows.join('');
  document.querySelector('#monthlyClaimsTable tbody').innerHTML = monthlyRows.join('');
}

// 🗓️ Date formatting helper
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// (Optional) Run expense fetch/render after DOMContentLoaded for safety
document.addEventListener('DOMContentLoaded', async () => {
  if (auth.currentUser) {
    await loadAndRenderExpenses();
  }
});
