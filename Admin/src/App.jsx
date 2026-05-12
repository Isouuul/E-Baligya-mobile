import { useState, lazy, Suspense, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";

const Login = lazy(() => import("./components/Login"));
const Dashboard = lazy(() => import("./components/Dashboard"));

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (session persistence)
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          // Fetch employee data from Firestore
          const q = query(collection(db, "Employees"), where("uid", "==", authUser.uid));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const employee = querySnapshot.docs[0].data();
            setUser(employee);
            // Store user data in localStorage for quick access
            localStorage.setItem("user", JSON.stringify(employee));
          }
        } catch (err) {
          console.error("Error fetching employee data:", err);
          // Fallback to localStorage data if Firestore fails
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } else {
        setUser(null);
        localStorage.removeItem("user");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <Suspense
      fallback={
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      }
    >
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : !user ? (
        <Login onLogin={(user) => setUser(user)} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </Suspense>
  );
}
