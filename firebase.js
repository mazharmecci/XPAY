// ─── Firebase SDK Imports ────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// ─── Firebase Configuration ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC-heT_dKo-O6523VVNPKW_Q-D6qxW8_HY",
  authDomain: "xpay-b0298.firebaseapp.com",
  projectId: "xpay-b0298",
  storageBucket: "xpay-b0298.firebasestorage.app",
  messagingSenderId: "518708112275",
  appId: "1:518708112275:web:0ea8d94b4c3734d1895666"
};

// ─── Initialize Firebase Services ────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── Export Modules ──────────────────────────────────────────────────────
export { auth, db };
