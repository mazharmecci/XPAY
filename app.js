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
