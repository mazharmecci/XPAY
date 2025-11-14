// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  doc, getDoc, collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧩 Utility Functions
function getEl(id) {
  return document.getElementById(id);
}

function showError(id, message) {
  const el = getEl(id);
  if (el) el.textContent = message;
}

function toggleRequired(container, isRequired) {
  container?.querySelectorAll('input[type="number"], input[type="date"]').forEach(input => {
    input.required = isRequired;
  });
}

// 🧑‍💼 Login Handler
function handleLogin() {
  const loginForm = getEl('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = getEl('email')?.value;
    const password = getEl('password')?.value;

    if (!email || !password) {
      showError('loginError', "Email and password are required.");
      return;
    }

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();

      const role = userData?.role;
      const name = userData?.name || "User";
      const emojiMap = { employee: "🧑‍💼", accountant: "📊", manager: "🧭" };
      const redirectMap = {
        employee: "employee.html",
        accountant: "accountant.html",
        manager: "manager.html"
      };

      if (!role || !redirectMap[role]) {
        showError('loginError', "Role not assigned. Contact admin.");
        return;
      }

      localStorage.setItem("welcomeMessage", `${emojiMap[role]} Welcome ${name}, ISTOS ${role}.`);
      window.location.href = redirectMap[role];

    } catch (error) {
      showError('loginError', error.message);
    }
  });
}

// 💸 Expense Submission Handler
function handleExpenseSubmission() {
  const expenseForm = getEl('expenseForm');
  if (!expenseForm) return;

  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to submit expenses.");
      return;
    }

    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) {
      alert("No active expense tab found.");
      return;
    }

    const amount = activeTab.querySelector('input[type="number"]')?.value;
    const date = activeTab.querySelector('input[type="date"]')?.value;
    const receiptFile = activeTab.querySelector('input[type="file"]')?.files[0];

    if (!amount || !date) {
      alert("Amount and date are required.");
      return;
    }

    const expenseData = {
      userId: user.uid,
      type: activeTab.id,
      amount: parseFloat(amount),
      date,
      receiptName: receiptFile?.name || null,
      status: 'pending',
      approvedByAccountant: false,
      approvedByManager: false,
      submittedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'expenses'), expenseData);
      alert("Expense submitted successfully!");
      expenseForm.reset();
    } catch (error) {
      console.error("Error submitting expense:", error);
      alert("Failed to submit expense. Please try again.");
    }
  });
}

// 🗂️ Tab Switching Handler
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => {
        c.classList.remove('active');
        toggleRequired(c, false);
      });

      tab.classList.add('active');
      const activeContent = getEl(tab.dataset.tab);
      activeContent?.classList.add('active');
      toggleRequired(activeContent, true);
    });
  });

  // 🚀 Auto-activate first tab
  if (tabs[0]) tabs[0].click();
}

// 🔐 Logout Handler
window.logoutUser = async function () {
  try {
    await signOut(auth);
    localStorage.removeItem("welcomeMessage");
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

// 🚦 Init
document.addEventListener("DOMContentLoaded", () => {
  handleLogin();
  handleExpenseSubmission();
  setupTabs();
});
