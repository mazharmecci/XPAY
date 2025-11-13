
import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = email.value;
  const password = password.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userDoc = await getDoc(doc(db, "users", uid));
    const role = userDoc.data().role;

    if (role === 'employee') {
      window.location.href = 'employee.html';
    } else if (role === 'accountant') {
      window.location.href = 'accountant.html';
    } else if (role === 'manager') {
      window.location.href = 'manager.html';
    } else {
      alert("Role not assigned. Contact admin.");
    }
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('expenseForm').addEventListener('submit', function(e) {
  e.preventDefault();
  alert("Expense submitted successfully!"); 
  // Later: integrate Firebase submission here
});


// Tab switching

const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('expenseForm').addEventListener('submit', function(e) {
  e.preventDefault();
  alert("Expense submitted successfully!");
  // Firebase logic will go here
});


// Form submission

document.getElementById('expenseForm').addEventListener('submit', function(e) {
  e.preventDefault();
  alert("Expense submitted successfully!");
  // Later: integrate Firebase submission here
});

// Login form logic - Firebase Auth + Role Detection

const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = email.value;
  const password = password.value;

  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    // Fetch role from Firestore
    const userDoc = await firebase.firestore().collection('users').doc(uid).get();
    const role = userDoc.data().role;

    // Redirect based on role
    if (role === 'employee') {
      window.location.href = 'employee.html';
    } else if (role === 'accountant') {
      window.location.href = 'accountant.html';
    } else if (role === 'manager') {
      window.location.href = 'manager.html';
    } else {
      document.getElementById('loginError').textContent = 'Role not assigned. Contact admin.';
    }
  } catch (error) {
    document.getElementById('loginError').textContent = error.message;
  }
});
