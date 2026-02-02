import { useState, lazy, Suspense } from "react";
import "./App.css"; // we'll add spinner styles here

const Login = lazy(() => import("./components/Login"));
const Dashboard = lazy(() => import("./components/Dashboard"));

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <Suspense
      fallback={
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      }
    >
      {!user ? (
        <Login onLogin={(user) => setUser(user)} />
      ) : (
        <Dashboard onLogout={() => setUser(null)} />
      )}
    </Suspense>
  );
}
