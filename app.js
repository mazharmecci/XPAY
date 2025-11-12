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
    // Remove active from all
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // Add active to clicked tab and its content
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Form submission
document.getElementById('expenseForm').addEventListener('submit', function(e) {
  e.preventDefault();
  alert("Expense submitted successfully!");
  // Later: integrate Firebase submission here
});
