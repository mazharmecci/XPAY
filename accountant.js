// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getDoc, getDocs, collection, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🧩 Field Labels and Grouping
const FIELD_GROUPS = {
  "🧭 Trip Info": ["placeVisited"],
  "🚗 Travel Costs": ["fuel", "fare", "boarding", "food", "localConveyance", "misc"],
  "📅 Monthly Claims": ["advanceCash", "monthlyConveyance", "monthlyPhone"]
};

const FIELD_LABELS = {
  placeVisited: "Place Visited",
  fuel: "Fuel",
  fare: "Fare",
  boarding: "Boarding",
  food: "Food",
  localConveyance: "Local Conveyance",
  misc: "Misc",
  advanceCash: "Advance Cash",
  monthlyConveyance: "Monthly Conveyance",
  monthlyPhone: "Monthly Phone"
};

// 🍞 Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// 🚪 Logout
function logoutUser() {
  signOut(auth)
    .then(() => {
      window.location.href = "login.html";
    })
    .catch((err) => {
      showToast("Logout failed", "error");
      console.error(err);
    });
}

// 🔎 Fetch expenses for selected month
async function fetchExpenses(selectedMonth) {
  const expensesRef = collection(db, "expenses");
  const snapshot = await getDocs(expensesRef);
  const records = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const dateStr = typeof data.date === 'string' ? data.date : '';
    if (dateStr.slice(0, 7) === selectedMonth) {
      records.push({ ...data, id: docSnap.id });
    }
  });

  // Sort by date descending
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return records;
}

// 🧾 Build grouped breakdown
function buildBreakdown(exp) {
  return Object.entries(FIELD_GROUPS).map(([groupName, keys]) => {
    const items = keys
      .map(key => exp[key] ? `${FIELD_LABELS[key]}: ₹${exp[key]}` : '')
      .filter(Boolean);
    return items.length
      ? `<strong>${groupName}</strong><br>${items.join(', ')}`
      : '';
  }).filter(Boolean).join('<br><br>');
}

// 🏷️ Status badge
function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return `<span style="color:green;">✅ Approved</span>`;
  if (s === 'rejected') return `<span style="color:red;">❌ Rejected</span>`;
  return `<span style="color:orange;">⏳ Pending</span>`;
}

// 🛠️ Debug Logger Utility
const DebugLogger = {
  isEnabled: true, // Toggle for production
  
  log: (title, data) => {
    if (!DebugLogger.isEnabled) return;
    console.group(`🔍 ${title}`);
    console.log(data);
    console.groupEnd();
  },
  
  table: (title, data) => {
    if (!DebugLogger.isEnabled) return;
    console.group(`📊 ${title}`);
    console.table(data);
    console.groupEnd();
  },
  
  error: (title, error) => {
    console.group(`❌ ERROR: ${title}`);
    console.error(error);
    console.groupEnd();
  },
  
  warn: (title, message) => {
    console.group(`⚠️ WARNING: ${title}`);
    console.warn(message);
    console.groupEnd();
  }
};

// 🖥️ Render accountant dashboard table - REFACTORED
async function renderTable() {
  try {
    const monthPicker = document.getElementById('monthPicker');
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);
    
    DebugLogger.log('Selected Month', selectedMonth);
    
    const expenses = await fetchExpenses(selectedMonth);
    DebugLogger.log('Total Expenses Fetched', expenses.length);
    
    const tbody = document.querySelector('#expenseTable tbody');
    if (!tbody) {
      DebugLogger.error('Table Body Not Found', 'Could not find #expenseTable tbody');
      return;
    }
    
    tbody.innerHTML = '';

    // ============================================
    // 🔍 FULL DIAGNOSTIC - First Expense Analysis
    // ============================================
    if (expenses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 1em; color: #888;">
            📭 No expenses found for ${selectedMonth}.
          </td>
        </tr>
      `;
      DebugLogger.warn('No Data', `No expenses found for ${selectedMonth}`);
      return;
    }

    // Log complete first expense object
    DebugLogger.log(
      'COMPLETE FIRST EXPENSE OBJECT',
      JSON.parse(JSON.stringify(expenses[0]))
    );
    
    DebugLogger.table('All Expense Keys', {
      keys: Object.keys(expenses[0]),
      values: Object.entries(expenses[0]).map(([k, v]) => ({
        key: k,
        value: v,
        type: typeof v
      }))
    });

    // ============================================
    // 🔄 PROCESS EACH EXPENSE
    // ============================================
    const userCache = {};
    const expenseDebugData = [];

    for (const exp of expenses) {
      try {
        const expDebug = {
          id: exp.id,
          date: exp.date,
          workflowType: exp.workflowType
        };

        // 🔍 Fetch employee name
        let employeeName = exp.userId || "-";
        if (exp.userId) {
          if (userCache[exp.userId]) {
            employeeName = userCache[exp.userId];
          } else {
            try {
              const userDoc = await getDoc(doc(db, "users", exp.userId));
              if (userDoc.exists()) {
                employeeName = userDoc.data().name || employeeName;
                userCache[exp.userId] = employeeName;
              }
            } catch (err) {
              DebugLogger.warn(`Failed to fetch employee name for ${exp.userId}`, err);
            }
          }
        }
        expDebug.employeeName = employeeName;

        // ============================================
        // 💰 CALCULATE TOTAL AMOUNT - DETAILED DEBUG
        // ============================================
        let amount = 0;
        const allKeys = Object.values(FIELD_GROUPS).flat();
        
        // Create detailed breakdown of what's being checked
        const fieldCheckResults = {};
        const fieldSourceMap = {};

        // Check 1: Direct flat properties
        DebugLogger.log(`Checking flat fields for expense ${exp.id}`, 
          allKeys.map(k => ({
            field: k,
            value: exp[k],
            exists: k in exp,
            isNumeric: !isNaN(exp[k])
          }))
        );

        // Check 2: Nested 'expenses' object
        if (exp.expenses && typeof exp.expenses === 'object') {
          DebugLogger.log(`Nested 'expenses' object found for ${exp.id}`, exp.expenses);
          Object.entries(exp.expenses).forEach(([key, val]) => {
            fieldSourceMap[key] = { value: val, source: 'exp.expenses' };
            if (!isNaN(val) && val) {
              amount += Number(val);
            }
          });
        }

        // Check 3: Nested 'items' array
        if (Array.isArray(exp.items)) {
          DebugLogger.log(`Items array found for ${exp.id}`, exp.items);
          exp.items.forEach((item, idx) => {
            if (item.amount && !isNaN(item.amount)) {
              amount += Number(item.amount);
              fieldSourceMap[`${item.type || 'unknown'}_${idx}`] = { 
                value: item.amount, 
                source: 'exp.items[]' 
              };
            }
          });
        }

        // Check 4: Flat properties as fallback
        allKeys.forEach(key => {
          if (exp[key] && !isNaN(exp[key])) {
            amount += Number(exp[key]);
            fieldSourceMap[key] = { value: exp[key], source: 'flat' };
          }
        });

        DebugLogger.table(`Amount Calculation for ${exp.id}`, {
          sources: fieldSourceMap,
          totalAmount: amount
        });

        expDebug.amount = amount;
        expDebug.fieldSources = fieldSourceMap;

        // 🧾 Build breakdown
        const breakdownHTML = buildBreakdown(exp);
        expDebug.breakdownGenerated = !!breakdownHTML && breakdownHTML !== '';

        const statusBadge = getStatusBadge(exp.status);
        expDebug.status = exp.status;

        expenseDebugData.push(expDebug);

        // 🖥️ Render row
        tbody.innerHTML += `
          <tr>
            <td>${employeeName}</td>
            <td>${exp.date || "-"}</td>
            <td>${exp.workflowType || "-"}</td>
            <td>
              <button class="toggle-breakdown" data-id="${exp.id}" style="border:none; background:none; cursor:pointer; font-size: 1.2em;">▶</button>
              <span style="margin-left:0.5em;">Click to view breakdown</span>
              <div id="breakdown-${exp.id}" style="display:none; margin-top:0.5em; padding:0.5em; background:#f5f5f5; border-left: 3px solid #2196F3; border-radius: 4px;">
                ${breakdownHTML || '<em>No expense breakdown</em>'}
              </div>
            </td>
            <td style="font-weight: bold; color: ${amount > 0 ? '#4CAF50' : '#999'};">₹${amount}</td>
            <td>${statusBadge}</td>
            <td><input type="checkbox" class="action-checkbox" data-id="${exp.id}"></td>
            <td><input type="text" class="comment-box" data-id="${exp.id}" placeholder="Comment (optional)"></td>
          </tr>
        `;

      } catch (expError) {
        DebugLogger.error(`Error processing expense ${exp.id}`, expError);
      }
    }

    // ============================================
    // 📊 SUMMARY LOG
    // ============================================
    DebugLogger.table('Processing Summary', expenseDebugData);

    // ============================================
    // 🔄 Wire up toggle buttons
    // ============================================
    const toggleButtons = document.querySelectorAll('.toggle-breakdown');
    DebugLogger.log('Toggle Buttons Found', toggleButtons.length);

    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const breakdown = document.getElementById(`breakdown-${id}`);
        
        if (!breakdown) {
          DebugLogger.error('Breakdown Element Not Found', `breakdown-${id}`);
          return;
        }

        const isVisible = breakdown.style.display === 'block';
        breakdown.style.display = isVisible ? 'none' : 'block';
        btn.textContent = isVisible ? '▶' : '▼';
        
        DebugLogger.log(`Toggled breakdown for ${id}`, {
          nowVisible: !isVisible
        });
      });
    });

    DebugLogger.log('Render Complete', {
      rowsRendered: expenses.length,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    DebugLogger.error('renderTable Fatal Error', err);
    const tbody = document.querySelector('#expenseTable tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; color: red; padding: 1em;">
            ❌ Error loading expenses. Check console for details.
          </td>
        </tr>
      `;
    }
  }
}

// ✅ Approve selected expenses
async function approveSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Approved",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error approving:", err);
    }
  }
  showToast(`${success} expense(s) approved.`);
  renderTable();
}

// ❌ Reject selected expenses
async function rejectSelected() {
  const checkboxes = document.querySelectorAll('.action-checkbox:checked');
  let success = 0;
  for (const cb of checkboxes) {
    try {
      const expenseId = cb.dataset.id;
      const commentBox = document.querySelector(`.comment-box[data-id="${expenseId}"]`);
      await updateDoc(doc(db, "expenses", expenseId), {
        status: "Rejected",
        accountant_comment: commentBox ? commentBox.value : ""
      });
      success++;
    } catch (err) {
      console.error("Error rejecting:", err);
    }
  }
  showToast(`${success} expense(s) rejected.`);
  renderTable();
}

// 🚦 Init
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  const monthPicker = document.getElementById('monthP
