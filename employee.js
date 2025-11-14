import { auth, db } from './firebase.js';
import {
  doc, getDoc, collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";

// 🔐 Auth Guard
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("You must be logged in.");
    window.location.href = "login.html";
    return;
  }

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const role = userDoc.exists() ? userDoc.data().role : null;

  if (role !== 'employee') {
    alert("Access denied.");
    window.location.href = "login.html";
    return;
  }

  document.querySelector('.logout-btn')!.textContent = `🚪 Logout ${role}`;
});

// 📝 Form Submission
document.getElementById("expenseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.workflowType || !data.date) {
    return showToast("Workflow and date are required", "error");
  }

  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to submit.");
    return;
  }

  const expenseRecord = {
    userId: user.uid,
    workflowType: data.workflowType,
    date: data.date,
    fields: {
      placeVisited: data.placeVisited || null,
      fuel: parseFloat(data.fuel) || null,
      fare: parseFloat(data.fare) || null,
      boarding: parseFloat(data.boarding) || null,
      food: parseFloat(data.food) || null,
      localConveyance: parseFloat(data.localConveyance) || null,
      misc: parseFloat(data.misc) || null,
      advanceCash: parseFloat(data.advanceCash) || null,
      monthlyConveyance: parseFloat(data.monthlyConveyance) || null,
      monthlyPhone: parseFloat(data.monthlyPhone) || null
    },
    status: "pending",
    submittedAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "expenses"), expenseRecord);
    showToast("Expense submitted!");
    form.reset();
  } catch (err) {
    console.error("Error submitting:", err);
    showToast("Submission failed", "error");
  }
});

// 🔧 Toast
function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

