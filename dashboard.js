import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Fetch expenses based on role
async function fetchExpenses(user) {
  let q;

  if (user.role === 'employee') {
    q = query(collection(db, 'expenses'), where('userId', '==', user.uid));
  } else if (user.role === 'accountant' || user.role === 'manager') {
    q = query(collection(db, 'expenses')); // See all
  }

  const snapshot = await getDocs(q);
  const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return expenses;
}
