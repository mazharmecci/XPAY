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
