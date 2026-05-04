import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

// Page Components
import Analytics from "./Analytics";
import Customers from "./Customers";
import VendorsRequest from "./VendorsRequest";
import ReviewReports from "./ReviewReports";
import Employee from "./Employee";
import Registration from "./Registration";
import OrdersManagement from "./OrdersManagement";
import Products from "./Products";

import "../components/Dashboard.css";

// Icons
import Iconebaligya from "../assets/ebaligya.png";
import menuLogout from "../assets/Logout.png";
import menuAnalytics from "../analytics_png/menu_analytics.png";
import menuCustomers from "../analytics_png/customer.png";
import menuVendors from "../analytics_png/request.png";
import menuReports from "../analytics_png/Reports.png";
import menuEmployee from "../analytics_png/employee.png";
import menuRegistration from "../analytics_png/Register.png";
import menuOrders from "../analytics_png/request.png";
import menuProducts from "../analytics_png/customer.png";

export default function Dashboard({ onLogout }) {
  const [page, setPage] = useState("analytics");
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [jobPosition, setJobPosition] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        onLogout();
        return;
      }
      try {
        const q = query(collection(db, "Employees"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const employeeData = querySnapshot.docs[0].data();
          setCurrentUserRole(employeeData.systemAccessRole);
          setJobPosition(employeeData.jobPositionTitle);
          setUserPhoto(employeeData.photoBase64 || null);
          setFirstName(employeeData.firstName || "");
          setLastName(employeeData.lastName || "");
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [onLogout]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) return <div className="loader-screen">Loading...</div>;

  const isSuperAdmin = currentUserRole === "super-admin";
  const isEmployee = currentUserRole === "employee" && jobPosition === "employee";
  const isComplianceOfficer = currentUserRole === "employee" && jobPosition === "Compliance Officer";

  const menuItems = [
    { key: "analytics", label: "Analytics", icon: menuAnalytics, roles: [isSuperAdmin, isEmployee] },
    { key: "customers", label: "Vendors", icon: menuCustomers, roles: [isSuperAdmin, isEmployee] },
    { key: "orders", label: "Orders", icon: menuOrders, roles: [isSuperAdmin, isEmployee] },
    { key: "vendors", label: "Requests", icon: menuVendors, roles: [isSuperAdmin, isComplianceOfficer, isEmployee] },
    { key: "reviewReports", label: "Reports", icon: menuReports, roles: [isSuperAdmin, isComplianceOfficer, isEmployee] },
    { key: "employee", label: "Staff", icon: menuEmployee, roles: [isSuperAdmin, isEmployee] },
    { key: "registration", label: "Register", icon: menuRegistration, roles: [isSuperAdmin] },
    { key: "products", label: "Products", icon: menuProducts, roles: [isSuperAdmin, isEmployee] }
  ];

  return (
    <div className="dashboard-wrapper">
      {/* HEADER NAVIGATION */}
      <header className="navbar">
        <div className="nav-left">
          <img src={Iconebaligya} alt="e-Baligya" className="nav-logo" />
        </div>

        <nav className={`nav-center${mobileMenuOpen ? " mobile-active" : ""}`}>
          <ul className="nav-menu">
            {menuItems.map((item) =>
              item.roles.includes(true) && (
                <li
                  key={item.key}
                  onClick={() => { setPage(item.key); setMobileMenuOpen(false); }}
                  className={page === item.key ? "nav-link active" : "nav-link"}
                >
                  <img src={item.icon} alt="" className="nav-icon-sm" />
                  {item.label}
                </li>
              )
            )}
          </ul>
        </nav>

        <div className="nav-right">
          <div className="profile-dropdown" ref={profileMenuRef}>
            <button
              className="user-profile"
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
            >
              <div className="user-text">
                <span className="user-name">{firstName} {lastName}</span>
                <span className="user-role">{currentUserRole}</span>
              </div>
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" className="nav-avatar" />
              ) : (
                <div className="nav-avatar-placeholder">👤</div>
              )}
              <span className={`profile-chevron ${profileMenuOpen ? "open" : ""}`} aria-hidden="true">
                ▾
              </span>
            </button>

            {profileMenuOpen && (
              <div className="profile-menu" role="menu">
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    signOut(auth);
                  }}
                >
                  <img src={menuLogout} alt="" />
                  Logout
                </button>
              </div>
            )}
          </div>

          <button className="hamburger-btn" onClick={() => setMobileMenuOpen((prev) => !prev)} aria-label="Open navigation menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="main-content-area">
        <div className="content-container">
          {page === "analytics" && <Analytics />}
          {page === "orders" && <OrdersManagement />}
          {page === "customers" && <Customers />}
          {page === "vendors" && <VendorsRequest />}
          {page === "products" && <Products />}
          {page === "reviewReports" && <ReviewReports />}
          {page === "employee" && <Employee />}
          {page === "registration" && <Registration />}
        </div>
      </main>
    </div>
  );
}