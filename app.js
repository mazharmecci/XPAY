
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



import { db, auth } from './firebase.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

document.getElementById('expenseForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit expenses.");
    return;
  }

  // Detect active tab
  const activeTab = document.querySelector('.tab-content.active');
  const expenseType = activeTab.id;

  // Extract fields
  const amount = activeTab.querySelector('input[type="number"]').value;
  const date = activeTab.querySelector('input[type="date"]').value;
  const receiptInput = activeTab.querySelector('input[type="file"]');
  const receiptFile = receiptInput?.files[0];

  // Optional: Store receipt name or base64 preview
  const receiptName = receiptFile ? receiptFile.name : null;

  // Prepare Firestore payload
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
    document.getElementById('expenseForm').reset();
  } catch (error) {
    console.error("Error submitting expense:", error);
    alert("Failed to submit expense. Please try again.");
  }
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
