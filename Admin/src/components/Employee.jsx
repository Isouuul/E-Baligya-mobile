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
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Auth check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
    });
    return () => unsubscribe();
  }, []);

  // Fetch employees
  useEffect(() => {
    if (!user) return;

    async function fetchEmployees() {
      setLoading(true);
      try {
        const employeesRef = collection(db, "Employees");
        const employeesSnapshot = await getDocs(
          query(employeesRef, orderBy("registeredAt", "desc"))
        );

        const employeesList = employeesSnapshot.docs.map((doc) => {
          const data = doc.data();
          const date = data.registeredAt
            ? data.registeredAt.toDate
              ? data.registeredAt.toDate().toLocaleDateString()
              : new Date(data.registeredAt).toLocaleDateString()
            : "-";

          return {
            id: doc.id,
            firstName: data.firstName || "-",
            middleName: data.middleName || "-",
            lastName: data.lastName || "-",
            email: data.email || "-",
            status: data.status || "-",
            systemAccessRole: data.systemAccessRole || "-",
            jobPositionTitle: data.jobPositionTitle || "-",
            streetName: data.streetName || "-",
            brgySubd: data.brgySubd || "-",
            cityProvince: data.cityProvince || "-",
            zipCode: data.zipCode || "-",
            photoBase64: data.photoBase64 || null,
            date,
          };
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

  // Search & date filter
  useEffect(() => {
    let filtered = employees;

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.middleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      filtered = filtered.filter((e) => e.date === dateFilter);
    }

    setFilteredEmployees(filtered);
    setPage(0); // Reset to first page when filters change
  }, [searchTerm, dateFilter, employees]);

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get paginated data
  const paginatedEmployees = filteredEmployees.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const openModal = (employee) => {
    setSelectedEmployee(employee);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedEmployee(null);
    setShowModal(false);
  };

  if (!user) return <div>Please log in to view employees.</div>;
  if (loading) return <div className="loading">Loading Employees...</div>;

  return (
    <div className="customers-card">
      <h2>Registered Employees</h2>

      <div className="filter-container">
        <input
          type="text"
          className="filter-input-text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <input
          type="date"
          className="filter-input-date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <button
          className="filter-button-clear"
          onClick={() => setDateFilter("")}
        >
          Clear Date
        </button>
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="no-customers-message">No registered employees</div>
      ) : (
        <>
          <div className="employees-table-wrapper">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Num.</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th>Position</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEmployees.map((emp, idx) => (
                  <tr key={emp.id}>
                    <td>{page * rowsPerPage + idx + 1}</td>
                    <td>{emp.lastName}, {emp.firstName} {emp.middleName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.status}</td>
                    <td>{emp.systemAccessRole}</td>
                    <td>{emp.jobPositionTitle}</td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={() => openModal(emp)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination-wrapper">
            <TablePagination
              rowsPerPageOptions={[10]}
              component="div"
              count={filteredEmployees.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Rows:"
            />
          </div>
        </>
      )}

      {showModal && selectedEmployee && (
        <div className="employee-modal-overlay" onClick={closeModal}>
          <div className="employee-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Employee Details</h3>
            {selectedEmployee.photoBase64 && (
              <img
                src={selectedEmployee.photoBase64}
                alt="Employee Photo"
                style={{ width: "120px", height: "120px", borderRadius: "50%" }}
              />
            )}
            <p><strong>First Name:</strong> {selectedEmployee.firstName}</p>
            <p><strong>Middle Name:</strong> {selectedEmployee.middleName}</p>
            <p><strong>Last Name:</strong> {selectedEmployee.lastName}</p>
            <p><strong>Email:</strong> {selectedEmployee.email}</p>
            <p><strong>Status:</strong> {selectedEmployee.status}</p>
            <p><strong>Role:</strong> {selectedEmployee.systemAccessRole}</p>
            <p><strong>Position:</strong> {selectedEmployee.jobPositionTitle}</p>
            <p><strong>Address:</strong> {`${selectedEmployee.streetName}, ${selectedEmployee.brgySubd}, ${selectedEmployee.cityProvince}, ${selectedEmployee.zipCode}`}</p>

            {/* Toggle Status Button */}
            <button
              onClick={async () => {
                if (!selectedEmployee) return;

                const previousStatus = selectedEmployee.status;
                const newStatus = previousStatus === "Active" ? "Suspended" : "Active";

                // Update UI optimistically
                setSelectedEmployee((prev) => ({ ...prev, status: newStatus }));
                setEmployees((prev) =>
                  prev.map((emp) =>
                    emp.id === selectedEmployee.id ? { ...emp, status: newStatus } : emp
                  )
                );
                setFilteredEmployees((prev) =>
                  prev.map((emp) =>
                    emp.id === selectedEmployee.id ? { ...emp, status: newStatus } : emp
                  )
                );

                // Update Firestore
                try {
                  const employeeRef = doc(db, "Employees", selectedEmployee.id);
                  await updateDoc(employeeRef, { status: newStatus });
                  console.log(`Employee status updated to ${newStatus}`);
                } catch (error) {
                  console.error("Error updating status:", error);
                  // Revert UI if error
                  setSelectedEmployee((prev) => ({ ...prev, status: previousStatus }));
                  setEmployees((prev) =>
                    prev.map((emp) =>
                      emp.id === selectedEmployee.id ? { ...emp, status: previousStatus } : emp
                    )
                  );
                  setFilteredEmployees((prev) =>
                    prev.map((emp) =>
                      emp.id === selectedEmployee.id ? { ...emp, status: previousStatus } : emp
                    )
                  );
                  alert("Failed to update status. Please try again.");
                }
              }}
              style={{
                padding: "8px 16px",
                marginTop: "10px",
                backgroundColor: selectedEmployee.status === "Active" ? "red" : "green",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {selectedEmployee.status === "Active" ? "Suspend" : "Enable"}
            </button>

            <button onClick={closeModal} style={{ marginLeft: "10px" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
