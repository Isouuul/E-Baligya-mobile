import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import SuccessIcon from "../assets/Success.png";
import eBaligyaImg from "../assets/eBaligya.png"; // <-- import your image
import "../components/Login.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jobPositionTitle, setJobPositionTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const q = query(collection(db, "Employees"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("❌ No employee record found.");
        setLoading(false);
        return;
      }

      const employee = querySnapshot.docs[0].data();

      if (employee.jobPositionTitle !== jobPositionTitle) {
        setError("❌ Job Position does not match registered role.");
        setLoading(false);
        return;
      }

      if (!["super-admin", "employee", "Compliance Officer"].includes(employee.jobPositionTitle)) {
        setError("❌ Invalid job position.");
        setLoading(false);
        return;
      }

      setLoading(false);
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        onLogin(employee);
      }, 1500);

    } catch (err) {
      console.error(err);
      setError("❌ Login failed. Check your email and password.");
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Left side - eBaligya image */}
      <div className="login-image">
        <img src={eBaligyaImg} alt="eBaligya Logo" />
      </div>

      {/* Right side - Login card */}
      <div className="login-card">
        <h2>Login</h2>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select
            value={jobPositionTitle}
            onChange={(e) => setJobPositionTitle(e.target.value)}
            required
          >
            <option value="">Select Job Position</option>
            <option value="super-admin">Super Admin</option>
            <option value="employee">Employee</option>
            <option value="Compliance Officer">Compliance Officer</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? <div className="button-spinner"></div> : "Login"}
          </button>
        </form>

        {/* Success Modal */}
        {showSuccess && (
          <div className="modal-overlay">
            <div className="modal-content">
              <img src={SuccessIcon} alt="Success" className="success-img" />
              <p>Login Successful!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
