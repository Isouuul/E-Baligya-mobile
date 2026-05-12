import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { TablePagination } from "@mui/material";
import "../components/Employee.css";

export default function Employees() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  // ...removed dateFilter state...
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function fetchEmployees() {
      setLoading(true);
      try {
        const employeesRef = collection(db, "Employees");
        const employeesSnapshot = await getDocs(query(employeesRef, orderBy("registeredAt", "desc")));
        const employeesList = employeesSnapshot.docs.map((doc) => {
          const data = doc.data();
          const date = data.registeredAt?.toDate 
            ? data.registeredAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
            : "-";

          return { id: doc.id, ...data, formattedDate: date };
        });
        setEmployees(employeesList);
        setFilteredEmployees(employeesList);
      } catch (err) {
        console.error("Error fetching employees:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEmployees();
  }, [user]);

  useEffect(() => {
    let filtered = employees.filter(e => {
      const fullName = `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase());
    });
    setFilteredEmployees(filtered);
    setPage(0);
  }, [searchTerm, employees]);

  const toggleStatus = async () => {
    if (!selectedEmployee) return;
    const newStatus = selectedEmployee.status === "Active" ? "Suspended" : "Active";
    
    const updateState = (list) => list.map(emp => emp.id === selectedEmployee.id ? { ...emp, status: newStatus } : emp);
    setEmployees(updateState);
    setSelectedEmployee(prev => ({ ...prev, status: newStatus }));

    try {
      await updateDoc(doc(db, "Employees", selectedEmployee.id), { status: newStatus });
    } catch (error) {
      alert("Failed to update status.");
    }
  };

  if (!user) return <div className="auth-fallback-container"><div className="auth-fallback">Please log in to access the Directory.</div></div>;

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-container">
        <header className="page-header">
          <div className="header-text">
            <h1>Employee Directory</h1>
            <p>Manage workforce access and organizational roles</p>
          </div>
          
          <div className="filter-bar">
            <div className="input-group">
              <input 
                className="search-input"
                type="text" 
                placeholder="Search by name or email..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            {/* Date filter removed */}
          </div>
        </header>

        {loading ? (
          <div className="loader-container"><div className="spinner"></div></div>
        ) : (
          <div className="table-card">
            <div className="table-responsive">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role & Position</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((emp) => (
                      <tr key={emp.id} className="table-row">
                        <td>
                          <div className="user-info">
                            <div className="avatar-mini">
                              {emp.photoBase64 ? <img src={emp.photoBase64} alt="" /> : <span>{emp.firstName[0]}</span>}
                            </div>
                            <div>
                              <div className="user-name">{emp.lastName}, {emp.firstName}</div>
                              <div className="user-email">{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="role-badge">{emp.systemAccessRole}</div>
                          <div className="position-text">{emp.jobPositionTitle}</div>
                        </td>
                        <td>
                          <span className={`status-pill ${emp.status?.toLowerCase()}`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="date-text">{emp.formattedDate}</td>
                        <td className="text-right">
                          <button className="btn-view-profile" onClick={() => { setSelectedEmployee(emp); setShowModal(true); }}>
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontWeight: 500 }}>
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <TablePagination
              component="div"
              count={filteredEmployees.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, p) => setPage(p)}
              rowsPerPageOptions={[10]}
              className="premium-pagination"
            />
          </div>
        )}

        {/* MODAL */}
        {showModal && selectedEmployee && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-banner"></div>
              <button className="modal-close-top" onClick={() => setShowModal(false)}>×</button>
              
              <div className="modal-header">
                 <div className="avatar-large-wrapper">
                    <div className="avatar-large">
                        {selectedEmployee.photoBase64 ? <img src={selectedEmployee.photoBase64} alt="" /> : <span>{selectedEmployee.firstName[0]}</span>}
                    </div>
                 </div>
                 <div className="header-details">
                    <h2 style={{marginTop: "-6px", color: "#fff"}}>{selectedEmployee.firstName} {selectedEmployee.lastName}</h2>
                    <span className={`status-pill ${selectedEmployee.status?.toLowerCase()}`}>{selectedEmployee.status}</span>
                 </div>
              </div>

              <div className="modal-body">
                <div className="info-section">
                  <h4 className="section-title">Contact Information</h4>
                  <div className="info-grid">
                    <div className="info-block"><label>Email Address</label><p>{selectedEmployee.email}</p></div>
                    <div className="info-block"><label>Location</label><p>{`${selectedEmployee.streetName}, ${selectedEmployee.cityProvince}`}</p></div>
                  </div>
                </div>

                <div className="info-section">
                  <h4 className="section-title">Professional Profile</h4>
                  <div className="info-grid">
                    <div className="info-block"><label>System Role</label><p>{selectedEmployee.systemAccessRole}</p></div>
                    <div className="info-block"><label>Job Title</label><p>{selectedEmployee.jobPositionTitle}</p></div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className={`btn-toggle-status ${selectedEmployee.status === "Active" ? "danger" : "success"}`} onClick={toggleStatus}>
                  {selectedEmployee.status === "Active" ? "Deactivate Account" : "Activate Account"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}