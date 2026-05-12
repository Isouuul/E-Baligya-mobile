import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { TablePagination } from "@mui/material";
import "./VendorsRequest.css";

export default function VendorsRequest() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef(null);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: "",
    message: "",
    type: "info",
    confirmText: "OK",
    cancelText: "",
    onConfirm: null,
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailVendor, setDetailVendor] = useState(null);

  const imageKeyMap = {
    selfie: "selfie",
    selfieUri: "selfie",
    govIDFront: "govIDFront",
    govIDBack: "govIDBack",
    permit: "businessPermit",
    businessPermit: "businessPermit",
    permitImage: "businessPermit",
  };

  const normalizeVendorData = (vendorData) => {
    const normalized = { ...vendorData };
    normalized.selfie = normalized.selfie || normalized.selfieUri || null;
    normalized.govIDFront = normalized.govIDFront || normalized.govID || null;
    normalized.govIDBack = normalized.govIDBack || null;
    normalized.businessPermit =
      normalized.businessPermit || normalized.permit || normalized.permitImage || null;
    return normalized;
  };


  // Dropdown outside click handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target)) {
        setDateDropdownOpen(false);
      }
    }
    if (dateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dateDropdownOpen]);

  // Fetch vendors on mount
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const pendingRef = collection(db, "PendingVendors");
        const snapshot = await getDocs(pendingRef);

        const pending = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const vendorData = { id: docSnap.id, ...docSnap.data() };
            try {
              const fullDataRef = doc(db, "PendingVendors", docSnap.id, "fullData", "vendorData");
              const fullDataDoc = await getDoc(fullDataRef);
              if (fullDataDoc.exists()) Object.assign(vendorData, fullDataDoc.data());
            } catch (error) {}

            try {
              const imagesRef = collection(db, "PendingVendors", docSnap.id, "images");
              const imagesSnapshot = await getDocs(imagesRef);
              imagesSnapshot.forEach((imgDoc) => {
                const imgData = imgDoc.data();
                const imageValue = imgData?.image;
                const rawType = imgData?.type || imgDoc.id;
                const normalizedType = imageKeyMap[rawType] || rawType;
                if (imageValue) vendorData[normalizedType] = imageValue;
              });
            } catch (error) {}

            return normalizeVendorData(vendorData);
          })
        );
        setVendors(pending);
        setFilteredVendors(pending);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, []);

  useEffect(() => {
    let filtered = vendors;
    if (searchTerm) {
      filtered = filtered.filter((v) =>
        v.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (dateFilter) {
      filtered = filtered.filter((v) => {
        if (!v.createdAt) return false;
        const createdDate = v.createdAt.toDate?.() || new Date(v.createdAt);
        const today = new Date();
        today.setHours(0,0,0,0);
        createdDate.setHours(0,0,0,0);
        if (dateFilter === "today") {
          return createdDate.getTime() === today.getTime();
        } else if (dateFilter === "yesterday") {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          return createdDate.getTime() === yesterday.getTime();
        } else if (dateFilter === "3days") {
          const threeDaysAgo = new Date(today);
          threeDaysAgo.setDate(today.getDate() - 3);
          return createdDate >= threeDaysAgo && createdDate <= today;
        } else if (dateFilter === "7days") {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          return createdDate >= sevenDaysAgo && createdDate <= today;
        } else if (dateFilter === "lastmonth") {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          return createdDate >= lastMonth && createdDate < thisMonth;
        } else {
          // fallback to ISO string match for custom date
          const date = createdDate.toISOString().split("T")[0];
          return date === dateFilter;
        }
      });
    }
    setFilteredVendors(filtered);
    setPage(0);
  }, [searchTerm, dateFilter, vendors]);

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedVendors = filteredVendors.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const showSileo = (config) => {
    setSileoConfig({ ...config });
    setSileoVisible(true);
  };

  const closeSileo = () => {
    setSileoVisible(false);
    setSileoConfig((prev) => ({ ...prev, onConfirm: null }));
  };

  const confirmSileo = async () => {
    const callback = sileoConfig.onConfirm;
    closeSileo();
    if (typeof callback === "function") await callback();
  };

  const getPermitNumber = (vendor) => {
    return vendor?.permitNumber || vendor?.permitNo || vendor?.businessPermitNumber || vendor?.permitText?.permitNumber || "-";
  };

  const deleteSubCollection = async (parentId, subCol) => {
    const subColRef = collection(db, "PendingVendors", parentId, subCol);
    const snapshot = await getDocs(subColRef);
    await Promise.all(snapshot.docs.map(docSnap => deleteDoc(doc(subColRef, docSnap.id))));
  };

  const approveVendor = async (vendorToApprove) => {
    if (!vendorToApprove) return;
    const vendorId = vendorToApprove.id;
    try {
      // Use base64 images directly (no Firebase Storage upload)
      const approvedVendorData = {
        ...vendorToApprove,
        govIDFront: vendorToApprove.govIDFront || null,
        govIDBack: vendorToApprove.govIDBack || null,
        selfie: vendorToApprove.selfie || null,
        businessPermit: vendorToApprove.businessPermit || null,
        role: "Vendor",
        verified: true,
        verifiedAt: new Date(),
        status: "Approved",
      };

      await setDoc(doc(db, "ApprovedVendors", vendorId), approvedVendorData);
      await deleteSubCollection(vendorId, "images");
      await deleteSubCollection(vendorId, "fullData");
      await deleteDoc(doc(db, "PendingVendors", vendorId));

      setVendors(prev => prev.filter(v => v.id !== vendorId));
      showSileo({ title: "Success", message: "Vendor has been onboarded.", type: "success" });
    } catch (error) {
      console.error("Approval error:", error);
      showSileo({ title: "Error", message: error.message, type: "warning" });
    }
  };

  const rejectVendor = async (vendorToReject) => {
    if (!vendorToReject) return;
    try {
      await setDoc(doc(db, "RejectedVendors", vendorToReject.id), {
        email: vendorToReject.email,
        businessName: vendorToReject.businessName,
        rejectedAt: new Date(),
      });
      await deleteSubCollection(vendorToReject.id, "images");
      await deleteSubCollection(vendorToReject.id, "fullData");
      await deleteDoc(doc(db, "PendingVendors", vendorToReject.id));
      setVendors(prev => prev.filter(v => v.id !== vendorToReject.id));
      showSileo({ title: "Rejected", message: "Application declined.", type: "warning" });
    } catch (error) {}
  };

  return (

    <div className="vendors-wrapper">
      <header className="premium-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="header-text">
          <h2 className="premium-title">Vendor Request</h2>
          <p className="premium-subtitle">Manage and review incoming customer requests</p>
        </div>
        <div className="premium-stats-pill">
          <div className="pill-pulse"></div>
          <span className="pill-label">Orders:</span>
          <span className="pill-value">{filteredVendors.length}</span>
        </div>
      </header>

      {/* Unified toolbar row for count, search, and filters */}
      <div className="toolbar-unified">

          <div className="premium-search-bar">
            <span className="search-icon-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              className="premium-search-input"
              type="text"
              placeholder="Search by name, business or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
          </div>






        <div className="date-dropdown-wrapper" ref={dateDropdownRef}>
          <button
            className="date-dropdown-btn"
            onClick={() => setDateDropdownOpen((open) => !open)}
          >
            {dateFilter === "today" ? "Today"
              : dateFilter === "yesterday" ? "Yesterday"
              : dateFilter === "3days" ? "3 Days Ago"
              : dateFilter === "7days" ? "7 Days Ago"
              : dateFilter === "lastmonth" ? "Last Month"
              : dateFilter ? dateFilter : "Date Filter"}
            <span className="date-dropdown-arrow">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 8 10 12 14 8" />
              </svg>
            </span>
          </button>
          {dateDropdownOpen && (
            <div className="date-dropdown-menu">
              <div className="date-dropdown-item" onClick={() => { setDateFilter("today"); setDateDropdownOpen(false); }}>Today</div>
              <div className="date-dropdown-item" onClick={() => { setDateFilter("yesterday"); setDateDropdownOpen(false); }}>Yesterday</div>
              <div className="date-dropdown-item" onClick={() => { setDateFilter("3days"); setDateDropdownOpen(false); }}>3 Days Ago</div>
              <div className="date-dropdown-item" onClick={() => { setDateFilter("7days"); setDateDropdownOpen(false); }}>7 Days Ago</div>
              <div className="date-dropdown-item" onClick={() => { setDateFilter("lastmonth"); setDateDropdownOpen(false); }}>Last Month</div>
            </div>
          )}
        </div>
        
      </div>

      <div className="table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Business Entity</th>
              <th>Permit ID</th>
              <th>Owner Name</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredVendors.length > 0 ? (
              paginatedVendors.map((vendor, idx) => (
                <tr key={vendor.id}>
                  <td className="text-muted">#{(page * rowsPerPage + idx + 1).toString().padStart(2, '0')}</td>
                  <td>
                    <div className="business-cell">
                      <span className="b-name">{vendor.businessName || "Unnamed Business"}</span>
                      <span className="b-email">{vendor.email}</span>
                    </div>
                  </td>
                  <td><code className="permit-code">{getPermitNumber(vendor)}</code></td>
                  <td>{vendor.ownerName || "-"}</td>
                  <td><span className="badge-pending">Pending</span></td>
                  <td className="actions-cell">
                    <div className="action-group">
                      <button className="icon-btn view" title="View Details" onClick={() => { setDetailVendor(vendor); setShowDetailModal(true); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                      <button className="icon-btn approve" onClick={() => showSileo({ title: "Approve Vendor", message: `Confirm approval for ${vendor.businessName}?`, type: "info", confirmText: "Approve", cancelText: "Cancel", onConfirm: () => approveVendor(vendor) })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg></button>
                      <button className="icon-btn reject" onClick={() => showSileo({ title: "Reject Vendor", message: `Are you sure you want to reject ${vendor.businessName}?`, type: "warning", confirmText: "Reject", cancelText: "Cancel", onConfirm: () => rejectVendor(vendor) })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontWeight: 500 }}>
                  No pending applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && (
          <div className="premium-loader-state">
            <div className="premium-spinner"></div>
          </div>
        )}
      </div>

      <div className="footer-pagination">
        <TablePagination
          rowsPerPageOptions={[10]}
          component="div"
          count={filteredVendors.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </div>

      {sileoVisible && (
        <div className="sileo-overlay">
          <div className="sileo-card">
            <div className={`sileo-status-bar ${sileoConfig.type}`}></div>
            <h3>{sileoConfig.title}</h3>
            <p>{sileoConfig.message}</p>
            <div className="sileo-actions">
              {sileoConfig.cancelText && <button className="s-btn-secondary" onClick={closeSileo}>{sileoConfig.cancelText}</button>}
              <button className={`s-btn-primary ${sileoConfig.type}`} onClick={confirmSileo}>{sileoConfig.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Detail Modal */}
      {showDetailModal && detailVendor && (
        <div className="vendor-detail-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="vendor-detail-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="vendor-detail-header">
              <div>
                <h2 className="vendor-detail-title">{detailVendor.businessName || "Unnamed Business"}</h2>
                <p className="vendor-detail-subtitle">Application Details</p>
              </div>
              <button className="vendor-detail-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>

            {/* Body */}
            <div className="vendor-detail-body">
              {/* Personal Information Section */}
              <div className="vendor-section">
                <div className="vendor-section-header">
                  <h3 className="vendor-section-title">📋 Personal Information</h3>
                </div>
                <div className="vendor-section-content">
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Full Name</span>
                    <span className="vendor-detail-value">{detailVendor.ownerName || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Email Address</span>
                    <span className="vendor-detail-value">{detailVendor.email || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Contact Number</span>
                    <span className="vendor-detail-value">{detailVendor.phone || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Birthdate</span>
                    <span className="vendor-detail-value">{detailVendor.birthday || detailVendor.birthDate || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Gender</span>
                    <span className="vendor-detail-value">{detailVendor.gender || detailVendor.genderFromID || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Home Address</span>
                    <span className="vendor-detail-value">{detailVendor.businessAddress || detailVendor.streetName || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Business Information Section */}
              <div className="vendor-section">
                <div className="vendor-section-header">
                  <h3 className="vendor-section-title">🏢 Business Information</h3>
                </div>
                <div className="vendor-section-content">
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Business Name</span>
                    <span className="vendor-detail-value">{detailVendor.businessName || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Business Type</span>
                    <span className="vendor-detail-value">{detailVendor.businessType || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Permit Number</span>
                    <span className="vendor-detail-value"><code>{getPermitNumber(detailVendor)}</code></span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Market Location</span>
                    <span className="vendor-detail-value">{detailVendor.marketName || detailVendor.selectedCity || "—"}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <span className="vendor-detail-label">Submission Date</span>
                    <span className="vendor-detail-value">
                      {detailVendor.createdAt
                        ? new Date(detailVendor.createdAt.toDate?.() || detailVendor.createdAt).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              {(detailVendor.govIDFront || detailVendor.govIDBack || detailVendor.businessPermit || detailVendor.selfie) && (
                <div className="vendor-section">
                  <div className="vendor-section-header">
                    <h3 className="vendor-section-title">📸 Uploaded Documents</h3>
                  </div>
                  <div className="vendor-documents-grid">
                    {detailVendor.govIDFront && (
                      <div className="vendor-doc-item">
                        <img src={detailVendor.govIDFront} alt="ID Front" className="vendor-doc-image" />
                        <span className="vendor-doc-label">ID Front</span>
                      </div>
                    )}
                    {detailVendor.govIDBack && (
                      <div className="vendor-doc-item">
                        <img src={detailVendor.govIDBack} alt="ID Back" className="vendor-doc-image" />
                        <span className="vendor-doc-label">ID Back</span>
                      </div>
                    )}
                    {detailVendor.businessPermit && (
                      <div className="vendor-doc-item">
                        <img src={detailVendor.businessPermit} alt="Business Permit" className="vendor-doc-image" />
                        <span className="vendor-doc-label">Permit</span>
                      </div>
                    )}
                    {detailVendor.selfie && (
                      <div className="vendor-doc-item">
                        <img src={detailVendor.selfie} alt="Selfie" className="vendor-doc-image" />
                        <span className="vendor-doc-label">Selfie</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="vendor-detail-footer">
              <button className="vendor-action-btn cancel" onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="vendor-action-btn reject" onClick={() => { setShowDetailModal(false); showSileo({ title: "Reject Vendor", message: `Are you sure you want to reject ${detailVendor.businessName}?`, type: "warning", confirmText: "Reject", cancelText: "Cancel", onConfirm: () => rejectVendor(detailVendor) }); }}>Reject</button>
              <button className="vendor-action-btn approve" onClick={() => { setShowDetailModal(false); showSileo({ title: "Approve Vendor", message: `Confirm approval for ${detailVendor.businessName}?`, type: "info", confirmText: "Approve", cancelText: "Cancel", onConfirm: () => approveVendor(detailVendor) }); }}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}