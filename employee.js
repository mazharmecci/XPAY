// 🔥 Firebase Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { addDoc, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// 🛡️ Safe value getter
function getVal(id, numeric = false) {
  const el = document.getElementById(id);
  if (!el) return numeric ? 0 : "";
  const val = el.value;
  return numeric ? (Number(val) || 0) : val.trim();
}

// 💠 Helpers
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const isoNow = () => new Date().toISOString();

function normalizeStatus(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "finalapproved" || s === "final approved") return "FinalApproved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

// ✅ Canonical list of regular (accountant-eligible) fields
const REGULAR_KEYS = [
  "fuel",
  "fare",
  "boarding",
  "food",
  "localConveyance",
  "postCourier",
  "misc",
  "monthlyConveyance",
  "monthlyPhone"
];

// 🔢 Helpers to split amounts
function getRegularAmount(exp) {
  return REGULAR_KEYS.reduce((sum, key) => sum + (safeAmount(exp[key])), 0);
}
function getAdhocAmount(exp) {
  return safeAmount(exp.adhocRequest);
}


// 🍞 Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 3000);
}

// 🚪 Logout
function logoutUser() {
  signOut(auth)
    .then(() => window.location.href = "login.html")
    .catch(err => {
      showToast("Logout failed", "error");
      console.error(err);
    });
}

// 🏷️ Status badge
function getStatusBadge(status) {
  const s = normalizeStatus(status);
  if (s === 'Approved') return `<span style="color:green;">✅ Approved by Accountant</span>`;
  if (s === 'FinalApproved') return `<span style="color:#6CBDE9;">☑️ Final Approved by Manager</span>`; // 🔶 blue
  if (s === 'Rejected') return `<span style="color:red;">❌ Rejected</span>`;
  return `<span style="color:orange;">⏳ Pending</span>`;
}

// 🧾 Build Expense Data
function buildExpenseData(userId) {
  return {
    userId: userId || "",
    workflowType: getVal("workflowType"),
    date: getVal("date"),
    placeVisited: getVal("placeVisited"),
    monthlyConveyance: getVal("monthlyConveyance", true),
    monthlyPhone: getVal("monthlyPhone", true),
    adhocRequest: getVal("adhocRequest", true), // ✅ included
    fuel: getVal("fuel", true),
    fare: getVal("fare", true),
    boarding: getVal("boarding", true),
    food: getVal("food", true),
    localConveyance: getVal("localConveyance", true),
    postCourier: getVal("postCourier", true),
    misc: getVal("misc", true), // ✅ included
    advanceCash: 0,
    status: "Pending",
    timestamp: isoNow(),
  };
}

// 🧮 Safe amount parser
function safeAmount(val) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : 0; // ✅ clamp negatives to 0
}

// 📤 Submit Expense
let isSubmitting = false;
function createSubmitExpense(currentUserId) {
  return async function submitExpense(e) {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      if (!currentUserId) {
        showToast("You must be logged in.", "error");
        isSubmitting = false;
        return;
      }

      const expenseData = buildExpenseData(currentUserId);

      const validWorkflowTypes = ["sales", "service", "others"];
      if (!expenseData.workflowType || !validWorkflowTypes.includes(expenseData.workflowType)) {
        showToast("Please choose a valid workflow type.", "error");
        isSubmitting = false;
        return;
      }
      if (!expenseData.date || !expenseData.placeVisited) {
        showToast("Please fill Date and Place Visited.", "error");
        isSubmitting = false;
        return;
      }

      // ✅ normalize all numeric fields
      ["monthlyConveyance", "monthlyPhone", "adhocRequest", "fuel", "fare", "boarding", "food", "localConveyance", "postCourier", "misc"].forEach(k => {
        expenseData[k] = safeAmount(expenseData[k]);
      });

      await addDoc(collection(db, "expenses"), expenseData);
      showToast("Expense submitted successfully ✅", "success");
      document.getElementById("expenseForm")?.reset();
      await renderExpenses(currentUserId);
    } catch (err) {
      console.error("Error submitting expense:", err);
      showToast("Error submitting expense ❌", "error");
    } finally {
      isSubmitting = false;
    }
  };
}

// 🧩 Render sections (with mobile-friendly data-labels and currency formatting)
function renderTripInfoRow(sn, date, workflow, place, badge) {
  return `
    <tr>
      <td data-label="S.No">${sn}</td>
      <td data-label="Date">${date}</td>
      <td data-label="Workflow">${workflow}</td>
      <td data-label="Place Visited">${place}</td>
      <td data-label="Status">${badge}</td>
    </tr>`;
}

function renderTravelCostRow(sn, date, fuel, fare, boarding, food, local, postCourier, misc, badge) {
  return `
    <tr>
      <td data-label="S.No">${sn}</td>
      <td data-label="Date">${date}</td>
      <td data-label="Fuel">${INR.format(fuel)}</td>
      <td data-label="Fare">${INR.format(fare)}</td>
      <td data-label="Boarding">${INR.format(boarding)}</td>
      <td data-label="Food">${INR.format(food)}</td>
      <td data-label="Local Conveyance">${INR.format(local)}</td>
      <td data-label="Post/Courier">${INR.format(postCourier)}</td>
      <td data-label="Misc">${INR.format(misc)}</td>
      <td data-label="Status">${badge}</td>
    </tr>`;
}

function renderMonthlyClaimsRow(sn, date, convey, phone, adhoc, badge) {
  const adhocCell = adhoc > 0
    ? `<span style="color:#007bff; font-weight:bold;">${INR.format(adhoc)}</span>` // ✅ highlight adhoc
    : INR.format(adhoc);

  return `
    <tr>
      <td data-label="S.No">${sn}</td>
      <td data-label="Date">${date}</td>
      <td data-label="Monthly Conveyance">${INR.format(convey)}</td>
      <td data-label="Monthly Phone">${INR.format(phone)}</td>
      <td data-label="Adhoc Request">${adhocCell}</td>
      <td data-label="Status">${badge}</td>
    </tr>`;
}

// Main renderExpenses employee
async function renderExpenses(currentUserId) {
  try {
    const tripInfoTable = document.querySelector("#tripInfoTable tbody");
    const travelCostTable = document.querySelector("#travelCostTable tbody");
    const monthlyClaimsTable = document.querySelector("#monthlyClaimsTable tbody");
    const monthPicker = document.getElementById("monthPicker");
    const selectedMonth = monthPicker?.value || new Date().toISOString().slice(0, 7);

    if (!tripInfoTable || !travelCostTable || !monthlyClaimsTable) {
      showToast("Required expense tables missing in DOM.", "error");
      return;
    }

    tripInfoTable.innerHTML = "";
    travelCostTable.innerHTML = "";
    monthlyClaimsTable.innerHTML = "";

    // 🔹 Get employee name for adhocRequests filtering
    let employeeName = "";
    if (currentUserId) {
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      employeeName = userDoc.exists() ? (userDoc.data().name || "") : "";
    }
    const employeeKey = (employeeName || "").toLowerCase();

    // 🔹 Pull manager decisions from adhocRequests
    const adhocDecisionMap = new Map(); // key: `${date}|${amount}` → "approved" | "rejected"
    let totalAdhocApproved = 0;
    let totalAdhocRejected = 0;

    const adhocSnap = await getDocs(collection(db, "adhocRequests"));
    adhocSnap.forEach(docSnap => {
      const req = docSnap.data();
      const dateStr = typeof req.date === "string" ? req.date : "";
      const monthMatch = dateStr.slice(0, 7) === selectedMonth;
      const raisedBy = (req.raisedBy || "").toLowerCase();
      const status = (req.status || "").toLowerCase();
      const amount = Number(req.amount) || 0;

      if (monthMatch && raisedBy === employeeKey && amount > 0) {
        const key = `${dateStr}|${amount}`;
        adhocDecisionMap.set(key, status);
        if (status === "approved") totalAdhocApproved += amount;
        else if (status === "rejected") totalAdhocRejected += amount;
      }
    });

    // 🔹 Fetch employee expenses for month
    const snapshot = await getDocs(collection(db, "expenses"));
    const records = [];
    snapshot.forEach(docSnap => {
      const exp = docSnap.data();
      const dateStr = typeof exp.date === "string" ? exp.date : "";
      if (exp.userId === currentUserId && dateStr.slice(0, 7) === selectedMonth) {
        records.push(exp);
      }
    });
    records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // 🔄 Fallback: derive Adhoc approvals/rejections from expense rows if not already counted
    records.forEach(exp => {
      const adhocAmount = Number(exp.adhocRequest) || 0;
      const normalized = normalizeStatus(exp.status);
      const adhocKey = `${exp.date || ""}|${adhocAmount || 0}`;
      const alreadyCounted = adhocDecisionMap.has(adhocKey);

      if (!alreadyCounted && adhocAmount > 0) {
        if (normalized === "FinalApproved") totalAdhocApproved += adhocAmount;
        else if (normalized === "Rejected") totalAdhocRejected += adhocAmount;
      }
    });

    // 🔹 Totals
    let monthlyTotal = 0;
    let travelTotal = 0;
    let totalApproved = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let totalAdvanceReceived = 0;
    let totalAdhocSubmitted = 0;

    // 🔹 Render rows with badge override based on adhocDecisionMap
    records.forEach((exp, index) => {
      const sn = index + 1;
      const date = exp.date || "-";

      const fuel = safeAmount(exp.fuel);
      const fare = safeAmount(exp.fare);
      const boarding = safeAmount(exp.boarding);
      const food = safeAmount(exp.food);
      const local = safeAmount(exp.localConveyance);
      const postCourier = safeAmount(exp.postCourier);
      const misc = safeAmount(exp.misc);
      const travelSum = fuel + fare + boarding + food + local + postCourier + misc;
      travelTotal += travelSum;

      const convey = safeAmount(exp.monthlyConveyance);
      const phone = safeAmount(exp.monthlyPhone);
      const adhoc = safeAmount(exp.adhocRequest);
      const monthlySum = convey + phone + adhoc;
      monthlyTotal += monthlySum;

      totalAdhocSubmitted += adhoc;

      // 🔹 Badge override
      const normalized = normalizeStatus(exp.status);
      const adhocKey = `${exp.date || ""}|${adhoc || 0}`;
      const managerDecision = adhocDecisionMap.get(adhocKey);

      let badge = "";
      if (managerDecision === "approved") {
        badge = '<span class="badge final-approved">✅ Final Approved by Manager</span>';
      } else if (managerDecision === "rejected") {
        badge = '<span class="badge rejected">❌ Rejected by Manager</span>';
      } else {
        badge = getStatusBadge(exp.status);
      }

      tripInfoTable.innerHTML += renderTripInfoRow(
        sn, date, exp.workflowType || "-", exp.placeVisited || "-", badge
      );

      travelCostTable.innerHTML += renderTravelCostRow(
        sn, date, fuel, fare, boarding, food, local, postCourier, misc, badge
      );

      monthlyClaimsTable.innerHTML += renderMonthlyClaimsRow(
        sn, date, convey, phone, adhoc, badge
      );

      // 🔹 Accountant buckets for regular
      const regularAmount = travelSum + convey + phone;
      if (normalized === "Approved") {
        totalApproved += regularAmount;
      } else if (normalized === "FinalApproved") {
        totalApproved += regularAmount;
      } else if (normalized === "Rejected") {
        totalRejected += regularAmount;
      } else {
        totalPending += regularAmount;
      }
    });

    // 🔹 Fetch advance cash
    const advanceSnapshot = await getDocs(collection(db, "advanceCash"));
    const advanceRecords = [];
    advanceSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const dateStr = typeof data.date === "string" ? data.date : "";
      const sameMonth = dateStr.slice(0, 7) === selectedMonth;
      const sameEmp = (data.employeeName || "").toLowerCase() === employeeKey;
      if (sameEmp && sameMonth) advanceRecords.push(data);
    });
    advanceRecords.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    advanceRecords.forEach((record, index) => {
      monthlyClaimsTable.innerHTML += `
        <tr style="background:#fffbe6;">
          <td>AC-${index + 1}</td>
          <td>${record.date || "-"}</td>
          <td colspan="3">${INR.format(Number(record.advanceCash) || 0)}</td>
          <td><span style="color:green;">✅ Cash Advance Recorded</span></td>
        </tr>
      `;
      totalAdvanceReceived += Number(record.advanceCash) || 0;
    });

    // 🧾 Final Summary Block
    const totalSubmitted = monthlyTotal + travelTotal;
    const netReimbursementDue = (totalApproved + totalAdhocApproved) - totalAdvanceReceived;
    const netLabel = netReimbursementDue < 0 ? "💰 Advance exceeds approved" : "🔶 Net payable to employee";

    monthlyClaimsTable.innerHTML += `
      <tr style="font-weight:bold; background:#fff;">
        <td colspan="5" style="text-align:right;">🧾 Total expenses submitted by emp:</td>
        <td>${INR.format(totalSubmitted)}</td>
      </tr>
      <tr style="font-weight:bold; background:#f9f9f9;">
        <td colspan="5" style="text-align:right;">✅ Approved by Accountant:</td>
        <td>${INR.format(totalApproved)}</td>
      </tr>
      <tr style="font-weight:bold; background:#f9f9f9;">
        <td colspan="5" style="text-align:right;">❌ Rejected by Accountant:</td>
        <td>${INR.format(totalRejected)}</td>
      </tr>
      <tr style="font-weight:bold; background:#f9f9f9;">
        <td colspan="5" style="text-align:right;">⏳ Pending Expenses yet to get approved (excl Adhoc):</td>
        <td>${INR.format(totalPending)}</td>
      </tr>
      <tr style="font-weight:bold; background:#e6f7ff;">
        <td colspan="5" style="text-align:right;">💸 Advance Cash Received (${selectedMonth}):</td>
        <td>${INR.format(totalAdvanceReceived)}</td>
      </tr>
      <tr style="font-weight:bold; background:#fff;">
        <td colspan="5" style="text-align:right;">🛠 Total Adhoc Requests submitted by emp:</td>
        <td>${INR.format(totalAdhocSubmitted)}</td>
      </tr>
      <tr style="font-weight:bold; background:#fff;">
        <td colspan="5" style="text-align:right;">🔷 Adhoc Requests approved by Manager:</td>
        <td><span style="color:green;">${INR.format(totalAdhocApproved)}</span></td>
      </tr>
      <tr style="font-weight:bold; background:#fff;">
        <td colspan="5" style="text-align:right;">❌ Adhoc Requests rejected by Manager:</td>
        <td><span style="color:red;">${INR.format(totalAdhocRejected)}</span></td>
      </tr>
      <tr style="font-weight:bold; background:#fff;">
        <td colspan="5" style="text-align:right;">${netLabel}:</td>
        <td>${INR.format(netReimbursementDue)}</td>
      </tr>
    `;
    }

// 🚦 Init
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.querySelector(".logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);

  // 🔽 Adhoc Request guidance toggle
const adhocToggleBtn = document.getElementById("toggleAdhocInfo");
if (adhocToggleBtn) {
  adhocToggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const block = document.getElementById("adhocInfoBlock");
    if (!block) return;

    const isVisible = block.style.display === "block";
    block.style.display = isVisible ? "none" : "block";
    adhocToggleBtn.textContent = isVisible ? "▶ Show examples" : "▼ Hide examples";
    adhocToggleBtn.setAttribute("aria-expanded", String(!isVisible));
  });

  adhocToggleBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      adhocToggleBtn.click();
    }
  });
}


  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast("You must be logged in.", "error");
      setTimeout(() => window.location.href = "login.html", 1500);
      return;
    }

    let currentUserId = user.uid;

    try {
      const userDoc = await getDoc(doc(db, "users", currentUserId));
      const role = (userDoc.exists() ? userDoc.data().role : "").toLowerCase();

      if (role !== "employee") {
        alert("Access denied. Employee role required.");
        window.location.href = "login.html";
        return;
      }

      const form = document.getElementById("expenseForm");
      if (form) {
        form.onsubmit = createSubmitExpense(currentUserId);
      }

      document.getElementById("monthPicker")?.addEventListener("change", () => renderExpenses(currentUserId));

      await renderExpenses(currentUserId);
    } catch (err) {
      console.error("❌ Error loading user/role:", err);
      showToast("Failed to load user profile.", "error");
    }
  });
});

