import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧾 Toast Alert
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
}

// 📅 Format Date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

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

// 👥 Fetch Employee Names
async function fetchUserNames() {
  const snapshot = await getDocs(collection(db, 'users'));
  const userNames = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    userNames[doc.id] = data.name || 'Unknown';
  });
  return userNames;
}

// 🚀 Auth + Expense Fetch
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.data().role;
  if (role !== 'manager') return;

  document.querySelector('.logout-btn').textContent = `🔒 Logout ${role.charAt(0).toUpperCase() + role.slice(1)}`;

  const [expenseSnapshot, userNames] = await Promise.all([
    getDocs(collection(db, 'expenses')),
    fetchUserNames()
  ]);

  const expenses = expenseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderExpenses(expenses, userNames);
});

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

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    const userDoc = await getDoc(doc(db, "users", user.uid));
    const role = (userDoc.exists() ? userDoc.data().role : "").toLowerCase();

    if (role !== "manager") {
      alert("Access denied. Manager role required.");
      window.location.href = "login.html";
      return;
    }

    await renderManagerClaims();
  });
});

async function renderManagerClaims() {
  const tableBody = document.querySelector("#managerClaimsTable tbody");
  const selectedMonth = document.getElementById("monthPicker")?.value || new Date().toISOString().slice(0, 7);
  tableBody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "expenses"));
  const records = [];

  snapshot.forEach(docSnap => {
    const exp = docSnap.data();
    const dateStr = typeof exp.date === 'string' ? exp.date : '';
    if (exp.status === "Approved" && dateStr.slice(0, 7) === selectedMonth) {
      records.push({ id: docSnap.id, ...exp });
    }
  });

  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  records.forEach((exp, index) => {
    const sn = index + 1;
    const total = safeAmount(exp.advanceCash) + safeAmount(exp.monthlyConveyance) + safeAmount(exp.monthlyPhone)
                + safeAmount(exp.fuel) + safeAmount(exp.fare) + safeAmount(exp.boarding)
                + safeAmount(exp.food) + safeAmount(exp.localConveyance) + safeAmount(exp.misc);

    tableBody.innerHTML += `
      <tr>
        <td>${sn}</td>
        <td>${exp.date || "-"}</td>
        <td>${exp.workflowType || "-"}</td>
        <td>${exp.placeVisited || "-"}</td>
        <td>₹${total}</td>
        <td><span class="badge approved">Approved</span></td>
        <td><input type="checkbox" class="select-claim" data-id="${exp.id}"></td>
        <td><input type="text" class="manager-comment" placeholder="Comment (optional)"></td>
      </tr>
    `;
  });
}

document.getElementById("finalApproveBtn")?.addEventListener("click", async () => {
  const selected = document.querySelectorAll(".select-claim:checked");
  for (const checkbox of selected) {
    const id = checkbox.dataset.id;
    const comment = checkbox.closest("tr").querySelector(".manager-comment")?.value || "";
    await updateDoc(doc(db, "expenses", id), {
      status: "FinalApproved",
      finalComment: comment
    });
  }
  showToast("Final approvals submitted.", "success");
  await renderManagerClaims();
});

document.getElementById("finalRejectBtn")?.addEventListener("click", async () => {
  const selected = document.querySelectorAll(".select-claim:checked");
  for (const checkbox of selected) {
    const id = checkbox.dataset.id;
    const comment = checkbox.closest("tr").querySelector(".manager-comment")?.value || "";
    await updateDoc(doc(db, "expenses", id), {
      status: "RejectedByManager",
      finalComment: comment
    });
  }
  showToast("Selected claims rejected.", "error");
  await renderManagerClaims();
});



