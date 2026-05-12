// src/pages/ApprovedVendors.jsx
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { TablePagination } from "@mui/material";
import "../components/Customers.css";

export default function ApprovedVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); 
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10); 
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch ApprovedVendors
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "ApprovedVendors"), (snapshot) => {
      setVendors(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter vendors based on search and status
  const filteredVendors = vendors.filter((vendor) => {
    const name = vendor.ownerName || "";
    const business = vendor.businessName || "";
    const email = vendor.email || "";
    const searchLower = search.toLowerCase();

    const matchesSearch =
      name.toLowerCase().includes(searchLower) ||
      business.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "All" || vendor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get paginated data
  const paginatedVendors = filteredVendors.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) return <p>Loading vendors...</p>;

  return (
    <div className="orders-container">
            <header className="premium-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>

        <div className="header-text">
          <h2 className="premium-title">Registered Vendors List</h2>
          <p className="premium-subtitle">Manage and review incoming customer requests</p>
        </div>
        <div className="premium-stats-pill">
          <div className="pill-pulse"></div>
          <span className="pill-label">Orders:</span>
          <span className="pill-value">{filteredVendors.length}</span>
        </div>
</header>
      {/* Search & Filter */}
      <div className="search-filter">

        <input
          type="text"
          placeholder="Search by Name, Business, or Email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="status-filter"
        >
          <option value="All">All Status</option>
          <option value="Approved">Approved</option>
        </select>
      </div>

      {/* Vendors Table */}
      <div className="orders-table-wrapper">
        <table className="orders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Shop's Name</th>
              <th>Business Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedVendors.length > 0 ? (
              paginatedVendors.map((vendor, index) => (
                <tr key={vendor.id}>
                  <td>{String(page * rowsPerPage + index + 1).padStart(2, '0')}</td>
                  <td>{vendor.businessName}</td>
                  <td>{vendor.businessType}</td>
                  <td>{vendor.status}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-glass-action"
                      title="View Details"
                      onClick={() => { setSelectedVendor(vendor); setShowModal(true); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 4 }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
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

      <div className="pagination-wrapper">
        <TablePagination
          rowsPerPageOptions={[10]}
          component="div"
          count={filteredVendors.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Rows:"
        />
      </div>

      {/* Shop Details Modal */}
      {showModal && selectedVendor && (
        <div className="modal-overlay-vendor" onClick={() => setShowModal(false)}>
          <div className="modal-card-vendor" onClick={e => e.stopPropagation()}>
            <div className="modal-header-vendor">
              <div>
                <h2 className="modal-title-vendor">{selectedVendor.businessName}</h2>
                <p className="modal-subtitle-vendor">Vendor Details</p>
              </div>
              <button className="modal-close-vendor" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body-vendor">
              {/* Personal Information Section */}
              <div className="modal-section">
                <div className="section-header">
                  <h3 className="section-title">Personal Information</h3>
                </div>
                <div className="section-content">
                  <div className="detail-row">
                    <span className="detail-label">Owner Name</span>
                    <span className="detail-value">{selectedVendor.ownerName || "—"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email Address</span>
                    <span className="detail-value">{selectedVendor.email || "—"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Contact Number</span>
                    <span className="detail-value">{selectedVendor.contactNumber || "—"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Gender</span>
                    <span className="detail-value">{selectedVendor.gender || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Business Information Section */}
              <div className="modal-section">
                <div className="section-header">
                  <h3 className="section-title">Business Information</h3>
                </div>
                <div className="section-content">
                  <div className="detail-row">
                    <span className="detail-label">Business Name</span>
                    <span className="detail-value">{selectedVendor.businessName || "—"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Business Type</span>
                    <span className="detail-value">{selectedVendor.businessType || "—"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status</span>
                    <span className={`status-pill ${selectedVendor.status?.toLowerCase()}`}>
                      {selectedVendor.status || "—"}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Address</span>
                    <span className="detail-value">{selectedVendor.businessAddress || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Additional Details Section */}
              {(selectedVendor.registrationDate || selectedVendor.accountStatus || selectedVendor.verifiedReports) && (
                <div className="modal-section">
                  <div className="section-header">
                    <h3 className="section-title">Account Details</h3>
                  </div>
                  <div className="section-content">
                    {selectedVendor.registrationDate && (
                      <div className="detail-row">
                        <span className="detail-label">Registration Date</span>
                        <span className="detail-value">
                          {typeof selectedVendor.registrationDate?.toDate === 'function'
                            ? selectedVendor.registrationDate.toDate().toLocaleDateString()
                            : selectedVendor.registrationDate}
                        </span>
                      </div>
                    )}
                    {selectedVendor.accountStatus && (
                      <div className="detail-row">
                        <span className="detail-label">Account Status</span>
                        <span className="detail-value">{selectedVendor.accountStatus}</span>
                      </div>
                    )}
                    {selectedVendor.verifiedReports !== undefined && (
                      <div className="detail-row">
                        <span className="detail-label">Verified Reports</span>
                        <span className="detail-value">{selectedVendor.verifiedReports || 0}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
