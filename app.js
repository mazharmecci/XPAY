// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧑‍💼 Login Form Logic
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userDoc = await getDoc(doc(db, "users", uid));
      const userData = userDoc.data();
      const role = userData?.role;
      const name = userData?.name || "User";

      let emoji = "👋";
      let redirect = "login.html";

      if (role === "employee") {
        emoji = "🧑‍💼";
        redirect = "employee.html";
      } else if (role === "accountant") {
        emoji = "📊";
        redirect = "accountant.html";
      } else if (role === "manager") {
        emoji = "🧭";
        redirect = "manager.html";
      } else {
        document.getElementById('loginError').textContent = "Role not assigned. Contact admin.";
        return;
      }

      localStorage.setItem("welcomeMessage", `${emoji} Welcome ${name}, you're logged in as ${role}.`);
      window.location.href = redirect;

    } catch (error) {
      document.getElementById('loginError').textContent = error.message;
    }
  });
}

// 💸 Expense Submission Logic
const expenseForm = document.getElementById('expenseForm');
if (expenseForm) {
  expenseForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to submit expenses.");
      return;
    }

    const activeTab = document.querySelector('.tab-content.active');
    const expenseType = activeTab.id;
    const amount = activeTab.querySelector('input[type="number"]').value;
    const date = activeTab.querySelector('input[type="date"]').value;
    const receiptInput = activeTab.querySelector('input[type="file"]');
    const receiptFile = receiptInput?.files[0];
    const receiptName = receiptFile ? receiptFile.name : null;

    const expenseData = {
      userId: user.uid,
      type: expenseType,
      amount: parseFloat(amount),
      date,
      receiptName,
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

// 🗂️ Tab Switching Logic with Required Field Management
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active class from all tabs and contents
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => {
      c.classList.remove('active');

      // Remove required from all inputs in hidden tabs
      c.querySelectorAll('input[type="number"], input[type="date"]').forEach(input => {
        input.required = false;
      });
    });

    // Activate clicked tab and its content
    tab.classList.add('active');
    const activeContent = document.getElementById(tab.dataset.tab);
    activeContent.classList.add('active');

    // Add required to inputs in the active tab only
    activeContent.querySelectorAll('input[type="number"], input[type="date"]').forEach(input => {
      input.required = true;
    });
  });
});


// 🔐 Optional: Logout Logic
window.logoutUser = async function () {
  try {
    await signOut(auth);
    localStorage.removeItem("welcomeMessage");
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout failed:", error);
  }
};
