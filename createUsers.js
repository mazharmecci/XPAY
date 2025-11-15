const admin = require("firebase-admin");
const fs = require("fs");

// Load service account
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Define users with roles
const users = [
  { firstName: "Mazhar", mobile: "9945266755", role: "manager" },
  { firstName: "Naushad", mobile: "9900198668", role: "manager" },
  { firstName: "skhan", mobile: "9538262779", role: "employee" },
  { firstName: "Sridhar", mobile: "8708502540", role: "employee" },
  { firstName: "Prajwal", mobile: "9347271346", role: "employee" },
  { firstName: "Praveen", mobile: "8754754465", role: "employee" },
];

// Create user with retry logic
async function createUserWithRetry(user, retries = 3) {
  const email = `${user.firstName.toLowerCase()}@xpay.local`;
  const password = `${user.firstName}${user.mobile.slice(-4)}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: user.firstName,
      });

      // Assign custom role
      await admin.auth().setCustomUserClaims(userRecord.uid, { role: user.role });

      console.log(`✅ Created: ${user.firstName} (${user.role}) [${userRecord.uid}]`);
      return;
    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed for ${user.firstName}: ${error.message}`);
      if (attempt === retries) {
        console.error(`🚫 Giving up on ${user.firstName} after ${retries} attempts.`);
      }
    }
  }
}

// Run batch creation
(async () => {
  for (const user of users) {
    await createUserWithRetry(user);
  }
})();
