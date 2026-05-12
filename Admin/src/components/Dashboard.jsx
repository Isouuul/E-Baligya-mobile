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
import HelpDesk from "./HelpDesk";
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
  
  // Dropdown States
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [operationsDropdownOpen, setOperationsDropdownOpen] = useState(false); // Added for Operations

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Refs for Outside Clicks
  const profileMenuRef = useRef(null);
  const accountDropdownRef = useRef(null);
  const productDropdownRef = useRef(null);
  const operationsDropdownRef = useRef(null); // Added for Operations

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
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setAccountDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setProductDropdownOpen(false);
      }
      if (operationsDropdownRef.current && !operationsDropdownRef.current.contains(event.target)) {
        setOperationsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) return (
    <div className="loader-screen">
      <div className="premium-loader"></div>
      <span>Securing Session...</span>
    </div>
  );

  const isSuperAdmin = currentUserRole === "super-admin";
  const isEmployee = currentUserRole === "employee" && jobPosition === "employee";
  const isComplianceOfficer = currentUserRole === "employee" && jobPosition === "Compliance Officer";

  const menuItems = [
    { key: "analytics", label: "Analytics", icon: menuAnalytics, roles: [isSuperAdmin, isEmployee] },
  ];

  const productManagementItems = [
    { key: "orders", label: "Orders", icon: menuOrders, roles: [isSuperAdmin, isEmployee] },
    { key: "products", label: "Products", icon: menuProducts, roles: [isSuperAdmin, isEmployee] },
  ];

  const accountManagementItems = [
    { key: "customers", label: "Vendors", icon: menuCustomers, roles: [isSuperAdmin, isEmployee] },
    { key: "vendors", label: "Requests", icon: menuVendors, roles: [isSuperAdmin, isComplianceOfficer, isEmployee] },
    { key: "employee", label: "Staff", icon: menuEmployee, roles: [isSuperAdmin, isEmployee] },
    { key: "registration", label: "Register", icon: menuRegistration, roles: [isSuperAdmin, isEmployee] },
  ];

  const Operations = [
    { key: "helpdesk", label: "Help Desk", icon: menuReports, roles: [isSuperAdmin, isEmployee] },
    { key: "reviewReports", label: "Reports", icon: menuReports, roles: [isSuperAdmin, isComplianceOfficer, isEmployee] },
  ];

  const userInitial = firstName ? firstName.charAt(0).toUpperCase() : "U";

  const ChevronIcon = () => (
    <span style={{ marginLeft: 6, display: 'flex', alignItems: 'center' }}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );

  return (
    <div className="dashboard-wrapper">
      <header className="navbar-container">
        <div className="navbar-content">
          <div className="nav-left">
            <img src={Iconebaligya} alt="Logo" className="nav-logo" />
            <div className="logo-divider"></div>
          </div>

          <nav className={`nav-center ${mobileMenuOpen ? "mobile-active" : ""}`}>
            <ul className="nav-menu">
              {menuItems.map((item) =>
                item.roles.includes(true) && (
                  <li
                    key={item.key}
                    onClick={() => { 
                      setPage(item.key); 
                      setMobileMenuOpen(false); 
                      setAccountDropdownOpen(false); 
                      setProductDropdownOpen(false);
                      setOperationsDropdownOpen(false);
                    }}
                    className={`nav-item ${page === item.key ? "active" : ""}`}
                  >
                    <img src={item.icon} alt="" className="nav-icon" />
                    <span>{item.label}</span>
                  </li>
                )
              )}

              {/* Product Management Dropdown */}
              {productManagementItems.some(item => item.roles.includes(true)) && (
                <li
                  className={`nav-item dropdown-parent ${productDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setProductDropdownOpen(!productDropdownOpen);
                    setAccountDropdownOpen(false);
                    setOperationsDropdownOpen(false);
                  }}
                  ref={productDropdownRef}
                  style={{ position: "relative" }}
                >
                  <img src={menuProducts} alt="" className="nav-icon" />
                  <span>Product Management</span>
                  <ChevronIcon />
                  {productDropdownOpen && (
                    <ul className="dropdown-panel nav-dropdown-list" style={{ position: "absolute", top: "110%", left: 0, minWidth: 200, zIndex: 1001 }}>
                      {productManagementItems.map((item) =>
                        item.roles.includes(true) && (
                          <li
                            key={item.key}
                            className={`dropdown-item ${page === item.key ? "active" : ""}`}
                            onClick={e => { 
                              e.stopPropagation(); 
                              setPage(item.key); 
                              setMobileMenuOpen(false); 
                              setProductDropdownOpen(false); 
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <img src={item.icon} alt="" className="nav-icon" />
                            <span>{item.label}</span>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </li>
              )}

              {/* Account Management Dropdown */}
              {(accountManagementItems.some(item => item.roles.includes(true))) && (
                <li
                  className={`nav-item dropdown-parent ${accountDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setAccountDropdownOpen((open) => !open);
                    setProductDropdownOpen(false);
                    setOperationsDropdownOpen(false);
                  }}
                  ref={accountDropdownRef}
                  style={{ position: "relative" }}
                >
                  <img src={menuRegistration} alt="" className="nav-icon" />
                  <span>Account Management</span>
                  <ChevronIcon />
                  {accountDropdownOpen && (
                    <ul className="dropdown-panel nav-dropdown-list" style={{ position: "absolute", top: "110%", left: 0, minWidth: 200, zIndex: 1001 }}>
                      {accountManagementItems.map((item) =>
                        item.roles.includes(true) && (
                          <li
                            key={item.key}
                            className={`dropdown-item ${page === item.key ? "active" : ""}`}
                            onClick={e => { 
                              e.stopPropagation(); 
                              setPage(item.key); 
                              setMobileMenuOpen(false); 
                              setAccountDropdownOpen(false); 
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <img src={item.icon} alt="" className="nav-icon" />
                            <span>{item.label}</span>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </li>
              )}

              {/* Operations Dropdown - NEWLY ADDED SECTION */}
              {Operations.some(item => item.roles.includes(true)) && (
                <li
                  className={`nav-item dropdown-parent ${operationsDropdownOpen ? "active" : ""}`}
                  onClick={() => {
                    setOperationsDropdownOpen(!operationsDropdownOpen);
                    setAccountDropdownOpen(false);
                    setProductDropdownOpen(false);
                  }}
                  ref={operationsDropdownRef}
                  style={{ position: "relative" }}
                >
                  <img src={menuReports} alt="" className="nav-icon" />
                  <span>Operations</span>
                  <ChevronIcon />
                  {operationsDropdownOpen && (
                    <ul className="dropdown-panel nav-dropdown-list" style={{ position: "absolute", top: "110%", left: 0, minWidth: 200, zIndex: 1001 }}>
                      {Operations.map((item) =>
                        item.roles.includes(true) && (
                          <li
                            key={item.key}
                            className={`dropdown-item ${page === item.key ? "active" : ""}`}
                            onClick={e => { 
                              e.stopPropagation(); 
                              setPage(item.key); 
                              setMobileMenuOpen(false); 
                              setOperationsDropdownOpen(false); 
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                          >
                            <img src={item.icon} alt="" className="nav-icon" />
                            <span>{item.label}</span>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </li>
              )}
            </ul>
          </nav>

          <div className="nav-right">
            <div className="profile-wrapper" ref={profileMenuRef}>
              <button
                className="profile-trigger"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              >
                <div className="profile-info">
                  <span className="p-name">{firstName} {lastName}</span>
                  <span className="p-role">{currentUserRole}</span>
                </div>
                <div className="p-avatar">
                  {userPhoto ? <img src={userPhoto} alt="Profile" /> : <span>{userInitial}</span>}
                  <div className="status-indicator"></div>
                </div>
              </button>

              {profileMenuOpen && (
                <div className="dropdown-panel">
                  <div className="dropdown-header">
                    <strong>Account Settings</strong>
                  </div>
                  <button
                    className="dropdown-item logout"
                    onClick={() => {
                      if (window.confirm("Do you want to logout?")) {
                        signOut(auth);
                      }
                    }}
                    title="Sign out of your account"
                  >
                    <img src={menuLogout} alt="" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            <button className="mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <div className={`burger ${mobileMenuOpen ? "open" : ""}`}></div>
            </button>
          </div>
        </div>
      </header>

      <main className="main-viewport">
        <div className="content-shell">
          {page === "analytics" && <Analytics />}
          {page === "orders" && <OrdersManagement />}
          {page === "customers" && <Customers />}
          {page === "vendors" && <VendorsRequest />}
          {page === "products" && <Products />}
          {page === "reviewReports" && <ReviewReports />}
          {page === "employee" && <Employee />}
          {page === "registration" && <Registration />}
          {page === "helpdesk" && <HelpDesk />} {/* Added matching logic for Help Desk */}
        </div>
      </main>
    </div>
  );
}