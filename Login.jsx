import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase"; // adjust path to your Firebase config
import toast from "react-hot-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = `${username.toLowerCase()}@xpay.local`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast.success(`Welcome, ${userCredential.user.displayName}!`);
      // redirect to dashboard
    } catch (error) {
      toast.error("Login failed. Please check your credentials.");
      console.error("Login error:", error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-biscuit-50 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-lg rounded-lg p-6 w-full max-w-sm space-y-4"
      >
        <div className="text-center text-biscuit-700 font-bold text-xl">XPAY Login</div>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-biscuit-400"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-biscuit-400"
          required
        />

        <button
          type="submit"
          className="w-full bg-biscuit-600 text-white py-2 rounded hover:bg-biscuit-700 transition"
        >
          Login
        </button>
      </form>
    </div>
  );
}
