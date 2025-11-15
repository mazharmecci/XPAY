// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { Toaster } from "react-hot-toast";

// 🍪 Toast Setup
const toast = window.toast || window["react-hot-toast"];

// 🧩 Utility
const getEl = (id) => document.getElementById(id);
const showError = (id, message) => {
  const el = getEl(id);
  if (el) el.textContent = message;
};

// 🧑‍💼 Login Handler
async function loginUser(username, password) {
  const email = `${username.toLowerCase()}@xpay.local`;

  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();

    const role = (userData?.role || "").toLowerCase();
    const name = userData?.name || "User";

    const emojiMap = { employee: "🧑‍💼", accountant: "📊", manager: "🧭" };
    const redirectMap = {
      manager: "manager.html",
      employee: "employee.html",
      accountant: "accountant.html"
    };

    if (!redirectMap[role]) {
      showError("loginError", "Role not assigned. Contact admin.");
      return;
    }

    localStorage.setItem("welcomeMessage", `${emojiMap[role]} Welcome ${name}, ISTOS ${role}.`);
    window.location.href = redirectMap[role];
  } catch (error) {
    showError("loginError", error.message);
  }
}

// 🚦 Init Login Form
function initLoginForm() {
  const loginForm = getEl("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = getEl("username")?.value;
    const password = getEl("password")?.value;

    if (!username || !password) {
      showError("loginError", "Username and password are required.");
      return;
    }

    loginUser(username, password);
  });
}

// 🔐 Logout
window.logoutUser = async function () {
  try {
    await signOut(auth);
    localStorage.removeItem("welcomeMessage");
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout failed:", error);
  }
};

// 🚀 Init
document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
});
