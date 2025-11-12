document.getElementById('expenseForm').addEventListener('submit', function(e) {
  e.preventDefault();
  alert("Expense submitted successfully!"); 
  // Later: integrate Firebase submission here
});
