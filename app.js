// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
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

// 🧑‍💼 submit Handler - Adhoc requests
async function submitAdhocRequest() {
  const adhocDate = getEl("adhocDate").value;
  const adhocPurpose = getEl("adhocPurpose").value;
  const adhocAmount = parseFloat(getEl("adhocAmount").value);
  const currentUserEmail = auth.currentUser?.email || "unknown@istos.in";

  if (!adhocDate || !adhocPurpose || isNaN(adhocAmount)) {
    toast.error("Please fill all fields correctly.");
    return;
  }

  try {
    await addDoc(collection(db, "adhocRequests"), {
      date: adhocDate,
      purpose: adhocPurpose,
      amount: adhocAmount,
      raisedBy: currentUserEmail,
      status: "Pending",
      approvalTarget: "mazhar@istos.in",
      approvedAt: null
    });

    toast.success("Adhoc request submitted for manager approval.");
  } catch (error) {
    console.error("Error submitting adhoc request:", error);
    toast.error("Submission failed. Please try again.");
  }
}

// 🚦 Init adhoc Form
getEl("submitAdhoc").addEventListener("click", function (e) {
  e.preventDefault();
  submitAdhocRequest();
});
