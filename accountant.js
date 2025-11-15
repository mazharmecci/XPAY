import { db } from './firebase.js';
import { collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

async function fetchPendingExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses"); // (update to your collection name!)
  const querySnapshot = await getDocs(expensesRef);
  const expenses = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    // Filter: Only pending and matching month
    if (
      data.status === "Pending" &&
      data.date.slice(0, 7) === selectedMonth // e.g., "2025-11"
    ) {
      expenses.push({
        id: docSnap.id,
        employee: data.employee,
        date: data.date,
        type: data.type,
        place: data.place,
        amount: data.amount,
        status: data.status
      });
    }
  });
  return expenses;
}

async function renderTable() {
  const selectedMonth = document.getElementById('monthPicker').value;
  const pendingExpenses = await fetchPendingExpenses(selectedMonth);

  const tbody = document.querySelector('#expenseTable tbody');
  tbody.innerHTML = '';
  pendingExpenses.forEach(exp => {
    tbody.innerHTML += `<tr>
      <td>${exp.employee}</td>
      <td>${exp.date}</td>
      <td>${exp.type}</td>
      <td>${exp.place}</td>
      <td>₹${exp.amount}</td>
      <td>${exp.status}</td>
      <td>
        <input type="checkbox" class="approve-checkbox" data-id="${exp.id}">
      </td>
      <td>
        <input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)">
      </td>
    </tr>`;
  });
}

// Listen to picker changes
document.getElementById('monthPicker').addEventListener('change', renderTable);

// Initial table load
renderTable();
