const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const admin = require("firebase-admin");
const fs = require("fs");

// Initialize Firebase Admin
const serviceAccount = require("./serviceAccountKey.json"); // replace with your actual file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Define users
const users = [
  { firstName: "Mazhar", mobile: "9945266755" },
  { firstName: "Naushad", mobile: "9900198668" },
  { firstName: "skhan", mobile: "9538262779" },
  { firstName: "Sridhar", mobile: "8708502540" },
  { firstName: "Prajwal", mobile: "9347271346" },
  { firstName: "Praveen", mobile: "8754754465" },
];

// Create users
users.forEach(({ firstName, mobile }) => {
  const email = `${firstName.toLowerCase()}@xpay.local`;
  const password = `${firstName}${mobile.slice(-4)}`;

  admin.auth().createUser({
    email,
    password,
    displayName: firstName,
  })
  .then(userRecord => {
    console.log(`✅ Created: ${firstName} (${userRecord.uid})`);
  })
  .catch(error => {
    console.error(`❌ Error creating ${firstName}:`, error.message);
  });
});
