import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

import Analytics from "./Analytics";
import Customers from "./Customers";
import VendorsRequest from "./VendorsRequest";
import ReviewReports from "./ReviewReports";
import Employee from "./Employee";
import Registration from "./Registration";
import OrdersManagement from "./OrdersManagement";
import Products from "./Products";


import "../components/Dashboard.css";

// Menu icons
import Iconebaligya from "../assets/ebaligya.png"
import menuLogout from "../assets/Logout.png"; // adjust path if needed
import menuAnalytics from "../analytics_png/menu_analytics.png";
import menuCustomers from "../analytics_png/customer.png";
import menuVendors from "../analytics_png/request.png";
import menuReports from "../analytics_png/Reports.png";
import menuEmployee from "../analytics_png/employee.png";
import menuRegistration from "../analytics_png/Register.png";
import menuOrders from "../analytics_png/request.png";
import menuProducts from "../analytics_png/customer.png"; // your product icon

export default function Dashboard({ onLogout }) {
  const [page, setPage] = useState("analytics");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [jobPosition, setJobPosition] = useState(null);
const [userPhoto, setUserPhoto] = useState(null);
const [collapsed, setCollapsed] = useState(false);
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [firstName, setFirstName] = useState("");
const [lastName, setLastName] = useState("");





  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        onLogout();
        return;
      }

      setCurrentUser(user);
      user && currentUser;
      setCollapsed(false);


      try {
        const q = query(collection(db, "Employees"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const employeeData = querySnapshot.docs[0].data();
          setCurrentUserRole(employeeData.systemAccessRole);
          setJobPosition(employeeData.jobPositionTitle);
          setUserPhoto(employeeData.photoBase64 || null);
          setFirstName(employeeData.firstName || "");
          setLastName(employeeData.lastName || ""); // ✅ ADD THIS // <-- fetch photo

        } else {
          setCurrentUserRole(null);
          setJobPosition(null);
        }
      } catch (err) {
        console.error("Failed to fetch user role:", err);
        setCurrentUserRole(null);
        setJobPosition(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [onLogout]);

  if (loading) return <p className="loading">Loading...</p>;

  const isSuperAdmin = currentUserRole === "super-admin";
  const isEmployee = currentUserRole === "employee" && jobPosition === "employee";
  const isComplianceOfficer = currentUserRole === "employee" && jobPosition === "Compliance Officer";

  const menuItems = [
    { key: "analytics", label: "Analytics", icon: menuAnalytics, roles: [isSuperAdmin, isEmployee] },
    { key: "customers", label: "Registered Vendors", icon: menuCustomers, roles: [isSuperAdmin, isEmployee] },
    { key: "orders", label: "Orders Management", icon: menuOrders, roles: [isSuperAdmin, isEmployee] },
    { key: "vendors", label: "Vendors Request", icon: menuVendors, roles: [isSuperAdmin, isComplianceOfficer, isEmployee] },
    { key: "reviewReports", label: "Review Reports", icon: menuReports, roles: [isSuperAdmin, isComplianceOfficer, isEmployee] },
    { key: "employee", label: "Employee", icon: menuEmployee, roles: [isSuperAdmin, isEmployee] },
    { key: "registration", label: "Registration", icon: menuRegistration, roles: [isSuperAdmin] },
  { key: "products", label: "Products", icon: menuProducts, roles: [isSuperAdmin, isEmployee] }
  ];

  return (
    <div className="dashboard-wrapper">
      {/* Mobile Menu Toggle Button */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        ></div>
      )}

      <div className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <img
              src={Iconebaligya}
              alt="e-Baligya"
              className="sidebar-logo"
            />
          )}
        </div>



        <ul className="menu">
          {menuItems.map((item, index) =>
            item.roles.includes(true) && (
              <li
                key={item.key}
                onClick={() => {
                  setPage(item.key);
                  setMobileMenuOpen(false);
                }}
                className={page === item.key ? "active menu-item" : "menu-item"}
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <img src={item.icon} alt={item.label} className="menu-icon" />
                {!collapsed && item.label}
              </li>
            )
          )}
        </ul>
         <div className="sidebar-footer">

            {!collapsed && (
    <div className="profile-section">
      {userPhoto ? (
        <img src={userPhoto} alt="Profile" className="profile-pic" />
      ) : (
        <div className="profile-placeholder">👤</div>
      )}
    </div>
  )}

 <p style={{marginBottom: 2}}>{firstName} {lastName}</p>
  {!collapsed && currentUserRole && (
  <p style={{backgroundColor: "#7133ee",color:"#fff", padding: "8px 8px", borderRadius: "12px", fontSize: "12px", marginTop: "4px", fontWeight:600, marginBottom: -5}}>
    {currentUserRole}
  </p>
)}

    <button
      className="logout-btn"
      onClick={async () => {
        try {
          await signOut(auth);
          onLogout();
        } catch (err) {
          console.error("Logout failed:", err);
        }
      }}
    >
      <img src={menuLogout} alt="Logout" className="logout-icon" />
      {!collapsed && "Logout"}
    </button>
  </div>
      </div>

      <div className="main">
        <div className="content">
          {page === "analytics" && <div className="page show"><Analytics /></div>}
          {page === "orders" && <div className="page show"><OrdersManagement /></div>}
          {page === "customers" && <div className="page show"><Customers /></div>}
          {page === "vendors" && <div className="page show"><VendorsRequest /></div>}
          {page === "products" && <div className="page show"><Products /></div>}
          {page === "reviewReports" && <div className="page show"><ReviewReports /></div>}
          {page === "employee" && <div className="page show"><Employee /></div>}
          {page === "registration" && <div className="page show"><Registration /></div>}
        </div>
        
      </div>

      
    </div>
  );
}
