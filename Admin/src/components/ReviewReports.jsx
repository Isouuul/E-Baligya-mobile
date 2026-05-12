import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { TablePagination } from "@mui/material";

import "./ReviewReports.css";

export default function ReviewReports({ onLogout }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLoaded, setUserLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sileoDialog, setSileoDialog] = useState({
    visible: false,
    type: "info",
    title: "",
    message: "",
    confirmText: "OK",
    cancelText: "Cancel",
    showCancel: false,
    onConfirm: null,
  });

  const [filterCategory, setFilterCategory] = useState("all");

  const showSileo = ({
    type = "info",
    title,
    message,
    confirmText = "OK",
    cancelText = "Cancel",
    showCancel = false,
    onConfirm = null,
  }) => {
    setSileoDialog({
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      showCancel,
      onConfirm,
    });
  };

  const closeSileo = () => {
    setSileoDialog((prev) => ({ ...prev, visible: false, onConfirm: null }));
  };

  const handleSileoConfirm = async () => {
    const action = sileoDialog.onConfirm;
    closeSileo();
    if (typeof action === "function") {
      await action();
    }
  };

  const getStatusClass = (status) => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "pending") return "premium-status-pending";
    if (normalized === "resolved") return "premium-status-resolved";
    if (normalized === "rejected") return "premium-status-rejected";
    return "premium-status-default";
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user && onLogout) onLogout();
      setUserLoaded(true);
    });
    return () => unsub();
  }, [onLogout]);

  const getUserName = async (userId) => {
    if (!userId) return "Unknown User";
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (userDoc.exists()) {
      const { firstName, middleName, lastName } = userDoc.data();
      return `${firstName} ${middleName ? middleName + " " : ""}${lastName}`;
    }
    return "Unknown User";
  };

  const getVendorInfo = async (vendorId) => {
    if (!vendorId) return { businessName: "N/A", email: "-" };
    const vendorQuery = query(collection(db, "VendorUsers"), where("userId", "==", vendorId));
    const snapshot = await getDocs(vendorQuery);
    if (!snapshot.empty) {
      const vendorData = snapshot.docs[0].data();
      return { businessName: vendorData.businessName || "N/A", email: vendorData.email || "-" };
    }
    return { businessName: "N/A", email: "-" };
  };

  const getCategoryName = (collectionName) => {
    switch (collectionName) {
      case "Reports_Products": return "Products";
      case "Reports_Bidding_Products": return "Bidding Product";
      case "Reports_Vendor": return "Vendor";
      case "Report_User": return "User";
      default: return "Unknown";
    }
  };

  const getPenaltyByVerifiedCount = (verifiedCount) => {
    // Warning system: 1st report = Warning, 2nd = Last Warning, 3rd+ = Strikes with penalties
    if (verifiedCount === 1) {
      return { accountStatus: "active", durationMs: null, label: "⚠️ Warning", strikeCount: 0, isWarning: true };
    }
    if (verifiedCount === 2) {
      return { accountStatus: "active", durationMs: null, label: "🔴 Last Warning", strikeCount: 0, isWarning: true };
    }
    
    // Strike penalties (starting from 3rd report)
    const strikes = verifiedCount - 2;
    
    if (strikes === 1) {
      return { accountStatus: "restricted", durationMs: 12 * 60 * 60 * 1000, label: "⚡ Strike 1 - 12-hour restriction", strikeCount: 1 };
    }
    if (strikes === 2) {
      return { accountStatus: "restricted", durationMs: 2 * 24 * 60 * 60 * 1000, label: "⚡ Strike 2 - 2-day suspension", strikeCount: 2 };
    }
    if (strikes === 3) {
      return { accountStatus: "restricted", durationMs: 5 * 24 * 60 * 60 * 1000, label: "⚡ Strike 3 - 5-day suspension", strikeCount: 3 };
    }
    if (strikes === 4) {
      return { accountStatus: "restricted", durationMs: 7 * 24 * 60 * 60 * 1000, label: "⚡ Strike 4 - 7-day suspension", strikeCount: 4 };
    }
    
    // Permanent ban after 5+ strikes (7+ total reports)
    return { accountStatus: "banned", durationMs: null, label: "🚫 Permanent Ban", strikeCount: 5 };
  };

  const removeReportFromList = (report) => {
    setReports((prev) => prev.filter((item) => !(item.id === report.id && item.collection === report.collection)));
    if (selectedReport?.id === report.id && selectedReport?.collection === report.collection) {
      setSelectedReport(null);
    }
  };

  const resolveTargetVendor = async (report) => {
    const vendorUid = report?.vendorId || null;
    if (!vendorUid) return null;
    const approvedQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", vendorUid));
    const approvedSnapshot = await getDocs(approvedQuery);
    if (approvedSnapshot.empty) return null;
    const vendorDoc = approvedSnapshot.docs[0];
    return { ref: vendorDoc.ref, data: vendorDoc.data(), vendorUid };
  };

  const verifyReportAndApplyPenalty = async (report) => {
    if (!report?.id || !report?.collection) return;
    try {
      const vendorTarget = await resolveTargetVendor(report);
      if (!vendorTarget) {
        showSileo({ type: "warning", title: "Target Not Found", message: "Cannot verify: Target account missing." });
        return;
      }
      const previousVerifiedReports = Number(vendorTarget.data?.verifiedReports ?? vendorTarget.data?.reportStrikeCount ?? 0);
      const updatedVerifiedReports = previousVerifiedReports + 1;
      const penalty = getPenaltyByVerifiedCount(updatedVerifiedReports);
      const now = new Date();
      const restrictedUntilDate = penalty.durationMs != null ? new Date(now.getTime() + penalty.durationMs) : null;

      await updateDoc(vendorTarget.ref, {
        verifiedReports: updatedVerifiedReports,
        reportStrikeCount: penalty.strikeCount || 0,
        accountStatus: penalty.accountStatus,
        restrictedUntil: restrictedUntilDate ? Timestamp.fromDate(restrictedUntilDate) : null,
        lastPenaltyLabel: penalty.label,
        lastPenaltyAt: serverTimestamp(),
        penaltyStatus: penalty.isWarning ? "warning" : "strike",
      });

      await updateDoc(doc(db, report.collection, report.id), {
        status: "resolved",
        reviewAction: "verified",
        reviewedAt: serverTimestamp(),
        penaltyApplied: penalty.label,
        penaltyTargetUserId: vendorTarget.vendorUid,
        verifiedReportCount: updatedVerifiedReports,
        strikeCount: penalty.strikeCount || 0,
        penaltyStatus: penalty.isWarning ? "warning" : "strike",
      });

      removeReportFromList(report);
      showSileo({ type: "success", title: "Action Verified", message: `Penalty Applied: ${penalty.label}` });
    } catch (error) {
      console.error(error);
      showSileo({ type: "warning", title: "Process Error", message: "Failed to apply penalty." });
    }
  };

  const rejectReport = async (report) => {
    if (!report?.id || !report?.collection) return;
    try {
      await updateDoc(doc(db, report.collection, report.id), {
        status: "rejected",
        reviewAction: "dismissed",
        reviewedAt: serverTimestamp(),
      });
      removeReportFromList(report);
      showSileo({ type: "info", title: "Report Dismissed", message: "No action taken." });
    } catch (error) {
      showSileo({ type: "warning", title: "Error", message: "Failed to reject report." });
    }
  };

  useEffect(() => {
    if (!userLoaded) return;
    const fetchAllReports = async () => {
      try {
        const collections = ["Reports_Products", "Reports_Bidding_Products", "Reports_Vendor", "Report_User"];
        let allReports = [];
        for (const colName of collections) {
          const colRef = collection(db, colName);
          const q = query(colRef, where("status", "==", "pending"));
          const snapshot = await getDocs(q);
          const reportsWithUser = await Promise.all(snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            let reporterName = await getUserName(data.userId);
            if (colName === "Reports_Bidding_Products") {
              reporterName = data.reportedBy?.name || reporterName;
              const { businessName, email } = await getVendorInfo(data.vendorId);
              return { id: docSnap.id, collection: colName, category: getCategoryName(colName), userName: reporterName, vendorName: businessName, vendorEmail: email, ...data };
            }
            return { id: docSnap.id, collection: colName, category: getCategoryName(colName), userName: reporterName, ...data };
          }));
          allReports = [...allReports, ...reportsWithUser];
        }
        allReports.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setReports(allReports);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchAllReports();
  }, [userLoaded]);

  if (!userLoaded) return (
    <div className="premium-loader-wrapper">
       <div className="premium-spinner"></div>
       <p>Authenticating Session...</p>
    </div>
  );

  const filteredReports = reports.filter((report) => {
    const matchesCategory = filterCategory === "all" || report.category === filterCategory;
    const search = searchTerm.toLowerCase();
    const matchesSearch = search === "" || 
      (report.userName?.toLowerCase() || "").includes(search) ||
      (report.vendorName?.toLowerCase() || "").includes(search) ||
      (report.reason?.toLowerCase() || "").includes(search);
    return matchesCategory && matchesSearch;
  });

  const paginatedReports = filteredReports.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <div className="premium-reports-container">
      <header className="premium-header">
        <div className="header-text">
          <h2 className="premium-title">Compliance & Oversight</h2>
          <p className="premium-subtitle">Manage reported activities and maintain marketplace integrity.</p>
        </div>
        
        
        <div className="premium-stats-pill">
          <div className="pill-pulse"></div>
          <span className="pill-label">Reports:</span>
          <span className="pill-value">{filteredReports.length} </span>
        </div>
      </header>
      
   <div class="penalty-guide">
  <h5>Penalty Progression</h5>
  <div class="penalty-steps">
    <div class="step">
      <span class="badge warning">1st</span>
      <span class="step-label">Initial Warning</span>
    </div>
    <div class="step">
      <span class="badge warning">2nd</span>
      <span class="step-label">Last Warning</span>
    </div>
    <div class="step">
      <span class="badge strike">3rd</span>
      <span class="step-label">Strike 1 (12h)</span>
    </div>
    <div class="step">
      <span class="badge strike">4th</span>
      <span class="step-label">Strike 2 (2d)</span>
    </div>
    <div class="step">
      <span class="badge strike">5th</span>
      <span class="step-label">Strike 3 (5d)</span>
    </div>
    <div class="step">
      <span class="badge strike">6th</span>
      <span class="step-label">Strike 4 (7d)</span>
    </div>
    <div class="step">
      <span class="badge banned">7th</span>
      <span class="step-label">Permanent Ban</span>
    </div>
  </div>
</div>

      <div className="premium-controls-bar">
        <div className="search-glass-container">
          <svg className="glass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search reporters, vendors, or violations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="premium-select-wrapper">
          <span className="select-label">Category:</span>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">Global Review</option>
            <option value="Products">Products</option>
            <option value="Bidding Product">Bidding</option>
            <option value="Vendor">Vendors</option>
            <option value="User">Users</option>
          </select>
        </div>
      </div>


      {loading ? (
        <div className="premium-inner-loading">
           <div className="shimmer-row"></div>
           <div className="shimmer-row"></div>
           <div className="shimmer-row"></div>
        </div>
      ) : (
        <div className="premium-glass-card">
          <div className="table-responsive">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Actions</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Reporter</th>
                  <th>Reason</th>
                  <th>Vendor Target</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No pending reports match your filters.</td></tr>
                ) : (
                  paginatedReports.map((report) => (
                    <tr key={report.id} className="premium-row">
                      <td className="actions-cell">
                        <button className="p-btn view" onClick={() => setSelectedReport(report)} title="Inspect">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button className="p-btn verify" onClick={() => showSileo({
                          type: "warning",
                          title: "Confirm Enforcement",
                          message: "Verify this report and apply penalty:\n\n⚠️ 1st Report: Warning\n🔴 2nd Report: Last Warning\n⚡ 3rd+: Strikes with suspensions\n🚫 7th+: Permanent ban",
                          confirmText: "Verify & Apply",
                          showCancel: true,
                          onConfirm: () => verifyReportAndApplyPenalty(report),
                        })} title="Verify">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button className="p-btn reject" onClick={() => showSileo({
                          type: "warning",
                          title: "Dismiss Report",
                          message: "Are you sure you want to dismiss this report without action?",
                          confirmText: "Dismiss",
                          showCancel: true,
                          onConfirm: () => rejectReport(report),
                        })} title="Dismiss">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </td>
                      <td>
                        <span className={`premium-badge ${getStatusClass(report.status)}`}>
                          {report.status?.toUpperCase() || "Pe"}
                        </span>
                      </td>
                      <td className="cat-cell"><span>{report.category}</span></td>
                      <td className="reporter-cell">{report.userName}</td>
                      <td className="reason-cell"><strong>{report.reason}</strong></td>
                      <td>
                        <div className="vendor-stack">
                          <span className="v-name">{report.vendorName || report.businessName || "N/A"}</span>
                          <span className="v-mail">{report.vendorEmail || "-"}</span>
                        </div>
                      </td>
                      <td className="date-cell">{report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString() : "--"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="premium-pagination">
            <TablePagination
              component="div"
              count={filteredReports.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, p) => setPage(p)}
              rowsPerPageOptions={[10]}
            />
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="premium-modal-overlay">
          <div className="premium-modal-card">
            <div className="modal-header" style={{paddingBottom: 0}}>
              <h4 style={{marginTop: '20px', marginBottom: 0, fontWeight: 700}}>Evidence Investigation</h4>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px'}}>
                <div className="modal-timestamp" style={{fontSize: '0.97em', color: '#888', marginLeft: '2px', textAlign: 'left'}}>
                  {selectedReport?.createdAt?.toDate ? selectedReport.createdAt.toDate().toLocaleString() : ''}
                </div>
                <button className="modal-close" style={{marginLeft: '16px', fontSize: '1.7em', lineHeight: '1'}} onClick={() => setSelectedReport(null)}>&times;</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="evidence-grid">
                <div className="evidence-info two-row-info">
                  <div className="info-row">
                    <div className="info-group"><label>Report ID</label><p className="info-highlight">#{selectedReport.id.slice(0,8)}</p></div>
                    <div className="info-group"><label>Vendor</label><p className="info-highlight">{selectedReport.vendorName || selectedReport.businessName || "N/A"}</p></div>
                  </div>
                  <div className="info-row">
                    <div className="info-group"><label>Reasoning</label><p className="info-highlight">{selectedReport.reason}</p></div>
                  </div>
                  <div className="info-row">
                    <div className="info-group"><label>Description</label><p className="desc-box">{selectedReport.details || "No additional context provided."}</p></div>
                </div>
                </div>
                <div className="evidence-visual">
                  <label>Attached Evidence</label>
                  <div className="img-frame">
                    {selectedReport.evidenceImage || selectedReport.image ? (
                      <img src={selectedReport.evidenceImage || selectedReport.image} alt="Evidence" />
                    ) : (
                      <div className="no-img">No visual evidence attached</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sileoDialog.visible && (
        <div className="premium-dialog-overlay">
          <div className={`premium-dialog-box ${sileoDialog.type}`}>
            <div className="dialog-icon-header">
              {sileoDialog.type === "success" ? "✓" : "!"}
            </div>
            <h4>{sileoDialog.title}</h4>
            <p>{sileoDialog.message}</p>
            <div className="dialog-footer">
              {sileoDialog.showCancel && (
                <button className="d-btn-cancel" onClick={closeSileo}>{sileoDialog.cancelText}</button>
              )}
              <button className="d-btn-confirm" onClick={handleSileoConfirm}>{sileoDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}