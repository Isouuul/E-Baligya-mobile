import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import SuccessIcon from "../assets/Success.png";
import eBaligyaImg from "../assets/eBaligya.png";
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

      if (querySnapshot.empty) throw new Error("No employee record found.");
      
      const employee = querySnapshot.docs[0].data();
      if (employee.jobPositionTitle !== jobPositionTitle) {
        throw new Error("Job Position does not match registered role.");
      }

      setLoading(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onLogin(employee);
      }, 1500);
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <header className="auth-header">
          <img src={eBaligyaImg} alt="eBaligya Logo" className="auth-logo" />
          <h1>Welcome back</h1>
          <p>Please enter your details to access the portal</p>
        </header>

        {error && <div className="auth-error-alert">{error}</div>}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="field-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="field-group">
            <label>Department Role</label>
            <select
              value={jobPositionTitle}
              onChange={(e) => setJobPositionTitle(e.target.value)}
              required
            >
              <option value="" disabled>Select your role</option>
              <option value="super-admin">Super Admin</option>
              <option value="employee">Employee</option>
              <option value="Compliance Officer">Compliance Officer</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? <span className="loader"></span> : "Sign in"}
          </button>
        </form>
      </div>

      {showSuccess && (
        <div className="success-overlay">
          <div className="success-modal">
            <img src={SuccessIcon} alt="Success" />
            <h3>Authenticated</h3>
            <p>Redirecting to dashboard...</p>
          </div>
        </div>
      )}
    </div>
  );
}