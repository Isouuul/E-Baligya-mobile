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
  writeBatch,
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
    if (normalized === "pending" || normalized === "pendingreview") return "premium-status-pending";
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
      case "VendorToUserReports": return "Bogus Buyer";
      case "Reports_Chats": return "Chat Room";
      default: return "Unknown";
    }
  };

  const getPenaltyByVerifiedCount = (verifiedCount) => {
    if (verifiedCount === 1) {
      return { accountStatus: "active", durationMs: null, label: "⚠️ Warning", strikeCount: 0, isWarning: true };
    }
    if (verifiedCount === 2) {
      return { accountStatus: "active", durationMs: null, label: "🔴 Last Warning", strikeCount: 0, isWarning: true };
    }
    if (verifiedCount === 3) {
      return { accountStatus: "restricted", durationMs: 12 * 60 * 60 * 1000, label: "⚡ Strike 1 - 12-hour restriction", strikeCount: 1 };
    }
    if (verifiedCount === 4) {
      return { accountStatus: "restricted", durationMs: 2 * 24 * 60 * 60 * 1000, label: "⚡ Strike 2 - 2-day suspension", strikeCount: 2 };
    }
    if (verifiedCount === 5) {
      return { accountStatus: "restricted", durationMs: 5 * 24 * 60 * 60 * 1000, label: "⚡ Strike 3 - 5-day suspension", strikeCount: 3 };
    }
    if (verifiedCount === 6) {
      return { accountStatus: "restricted", durationMs: 7 * 24 * 60 * 60 * 1000, label: "⚡ Strike 4 - 7-day suspension", strikeCount: 4 };
    }
    return { accountStatus: "banned", durationMs: null, label: "🚫 Permanent Ban", strikeCount: 5 };
  };

  const removeReportFromList = (report) => {
    setReports((prev) => prev.filter((item) => !(item.id === report.id && item.collection === report.collection)));
    if (selectedReport?.id === report.id && selectedReport?.collection === report.collection) {
      setSelectedReport(null);
    }
  };

  const resolveTargetEntity = async (report) => {
    if (report.collection === "VendorToUserReports") {
      const customerUid = report?.customerUid || null;
      if (!customerUid) return null;
      const userDocRef = doc(db, "Users", customerUid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) return null;
      return { ref: userDocRef, data: userSnap.data(), targetUid: customerUid, isVendor: false };
    } else if (report.collection === "Reports_Chats") {
      // Direct assignment fallback checking for variations of target offender variables
      const offUserId = report?.reportedUserId || report?.offenderId || report?.userId || null;
      if (!offUserId) return null;

      // Scan dynamic schemas checking user tables first, then vendor profile fallbacks
      const userDocRef = doc(db, "Users", offUserId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        return { ref: userDocRef, data: userSnap.data(), targetUid: offUserId, isVendor: false };
      }
      
      const approvedQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", offUserId));
      const approvedSnapshot = await getDocs(approvedQuery);
      if (!approvedSnapshot.empty) {
        const vendorDoc = approvedSnapshot.docs[0];
        return { ref: vendorDoc.ref, data: vendorDoc.data(), targetUid: offUserId, isVendor: true };
      }
      return null;
    } else {
      const vendorUid = report?.vendorId || null;
      if (!vendorUid) return null;
      const approvedQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", vendorUid));
      const approvedSnapshot = await getDocs(approvedQuery);
      if (approvedSnapshot.empty) return null;
      const vendorDoc = approvedSnapshot.docs[0];
      return { ref: vendorDoc.ref, data: vendorDoc.data(), targetUid: vendorUid, isVendor: true };
    }
  };

  const restrictAllTargetProducts = async (targetUid) => {
    try {
      const batch = writeBatch(db);
      let totalUpdated = 0;

      const standardProductsRef = collection(db, "Products");
      const standardQuery = query(
        standardProductsRef,
        where("uploadedBy.uid", "==", targetUid)
      );
      const standardSnapshot = await getDocs(standardQuery);
      standardSnapshot.forEach((productDoc) => {
        batch.update(productDoc.ref, {
          status: "restricted",
          restrictedAt: serverTimestamp(),
          restrictionReason: "Compliance enforcement applied to profile account"
        });
        totalUpdated++;
      });

      const biddingProductsRef = collection(db, "Bidding_Products");
      const biddingQuery = query(
        biddingProductsRef,
        where("uploadedBy.uid", "==", targetUid),
        where("status", "==", "active")
      );
      const biddingSnapshot = await getDocs(biddingQuery);
      biddingSnapshot.forEach((bidDoc) => {
        batch.update(bidDoc.ref, {
          status: "restricted",
          restrictedAt: serverTimestamp(),
          restrictionReason: "Compliance enforcement applied to profile account"
        });
        totalUpdated++;
      });

      if (totalUpdated > 0) {
        await batch.commit();
        console.log(`Cascade action finished. Restricted ${totalUpdated} assets linked to user.`);
      }
    } catch (error) {
      console.error("Critical error executing dynamic cascade mutation script:", error);
    }
  };

  const verifyReportAndApplyPenalty = async (report) => {
    if (!report?.id || !report?.collection) return;
    try {
      const targetEntity = await resolveTargetEntity(report);
      if (!targetEntity) {
        showSileo({ type: "warning", title: "Target Not Found", message: "Cannot verify: Target account missing." });
        return;
      }
      
      const previousVerifiedReports = Number(targetEntity.data?.verifiedReports ?? targetEntity.data?.reportStrikeCount ?? 0);
      const updatedVerifiedReports = previousVerifiedReports + 1;
      const penalty = getPenaltyByVerifiedCount(updatedVerifiedReports);
      const now = new Date();
      const restrictedUntilDate = penalty.durationMs != null ? new Date(now.getTime() + penalty.durationMs) : null;

      await updateDoc(targetEntity.ref, {
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
        penaltyTargetUserId: targetEntity.targetUid,
        verifiedReportCount: updatedVerifiedReports,
        strikeCount: penalty.strikeCount || 0,
        penaltyStatus: penalty.isWarning ? "warning" : "strike",
      });

      if (penalty.accountStatus === "restricted" || penalty.accountStatus === "banned") {
        await restrictAllTargetProducts(targetEntity.targetUid);
      }

      removeReportFromList(report);
      showSileo({ 
        type: "success", 
        title: "Action Verified", 
        message: `Penalty Applied: ${penalty.label}. Linked marketplace listings have been restricted successfully.` 
      });
    } catch (error) {
      console.error(error);
      showSileo({ type: "warning", title: "Process Error", message: "Failed to apply penalty successfully." });
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
        // Appended "Reports_Chats" to indices scope list
        const collections = ["Reports_Products", "Reports_Bidding_Products", "Reports_Vendor", "Report_User", "VendorToUserReports", "Reports_Chats"];
        let allReports = [];
        
        for (const colName of collections) {
          const colRef = collection(db, colName);
          const statusValue = colName === "VendorToUserReports" ? "PendingReview" : "pending";
          const q = query(colRef, where("status", "==", statusValue));
          const snapshot = await getDocs(q);
          
          const reportsWithUser = await Promise.all(snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            
            if (colName === "VendorToUserReports") {
              return {
                id: docSnap.id,
                collection: colName,
                category: getCategoryName(colName),
                userName: data.reportedCustomerName || "Unknown Customer", 
                reason: data.reasonCategory || "Bogus Buyer",
                details: data.reasonDetails || "No data",
                vendorName: `User UID: ${data.customerUid?.slice(0, 8) || "N/A"}`,
                vendorEmail: data.reportedCustomerPhone || "-",
                createdAt: data.reportedAt || null, 
                ...data
              };
            }

            if (colName === "Reports_Chats") {
              return {
                id: docSnap.id,
                collection: colName,
                category: getCategoryName(colName),
                userName: data.reportedName || data.reporterName || "User Chat Report",
                reason: data.reason || "Chat Violation",
                details: data.messageText || data.details || "Inappropriate message behavior reported",
                vendorName: `Room ID: ${data.chatRoomId?.slice(0, 12) || "Chat Context"}`,
                vendorEmail: `Offender ID: ${data.reportedUserId?.slice(0, 8) || "N/A"}`,
                createdAt: data.timestamp || data.createdAt || null,
                ...data
              };
            }

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
        
        allReports.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.() || a.reportedAt?.toDate?.() || a.timestamp?.toDate?.() || 0;
          const timeB = b.createdAt?.toDate?.() || b.reportedAt?.toDate?.() || b.timestamp?.toDate?.() || 0;
          return timeB - timeA;
        });
        
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
      
      <div className="penalty-guide">
        <h5>Penalty Progression</h5>
        <div className="penalty-steps">
          <div className="step">
            <span className="badge warning">1st</span>
            <span className="step-label">Initial Warning</span>
          </div>
          <div className="step">
            <span className="badge warning">2nd</span>
            <span className="step-label">Last Warning</span>
          </div>
          <div className="step">
            <span className="badge strike">3rd</span>
            <span className="step-label">Strike 1 (12h)</span>
          </div>
          <div className="step">
            <span className="badge strike">4th</span>
            <span className="step-label">Strike 2 (2d)</span>
          </div>
          <div className="step">
            <span className="badge strike">5th</span>
            <span className="step-label">Strike 3 (5d)</span>
          </div>
          <div className="step">
            <span className="badge strike">6th</span>
            <span className="step-label">Strike 4 (7d)</span>
          </div>
          <div className="step">
            <span className="badge banned">7th</span>
            <span className="step-label">Permanent Ban</span>
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
            placeholder="Search reporters, targets, or violations..."
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
            <option value="Bogus Buyer">Bogus Buyers</option>
            <option value="Chat Room">Chat Rooms</option>
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
                  <th>Target Entity</th>
                  <th>Reason Given</th>
                  <th>Meta Details</th>
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
                        
                        <button className="p-btn verify" onClick={async () => {
                          const targetEntity = await resolveTargetEntity(report);
                          const currentCount = Number(targetEntity?.data?.verifiedReports ?? targetEntity?.data?.reportStrikeCount ?? 0);
                          const incomingCount = currentCount + 1;
                          const incomingPenalty = getPenaltyByVerifiedCount(incomingCount);
                          
                          showSileo({
                            type: "warning",
                            title: "Confirm Enforcement",
                            message: `You are verifying a report against this entity.\n\n` +
                                     `• Current Standing: ${currentCount} Verified Violation(s)\n` +
                                     `• Upcoming Enforcement Level: Report #${incomingCount}\n\n` +
                                     `💥 ACTION TO APPLY:\n${incomingPenalty.label}\n\n` +
                                     `Are you sure you want to proceed?`,
                            confirmText: "Verify & Apply",
                            showCancel: true,
                            onConfirm: () => verifyReportAndApplyPenalty(report),
                          });
                        }} title="Verify">
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
                          {(report.status === "PendingReview" ? "PENDING" : report.status)?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td className="cat-cell"><span>{report.category}</span></td>
                      <td className="reporter-cell">{report.userName}</td>
                      <td className="reason-cell"><strong>{report.reason}</strong></td>
                      <td>
                        <div className="vendor-stack">
                          <span className="v-name">{report.vendorName || "N/A"}</span>
                          <span className="v-mail">{report.vendorEmail || "-"}</span>
                        </div>
                      </td>
                      <td className="date-cell">
                        {report.createdAt?.toDate 
                          ? report.createdAt.toDate().toLocaleDateString() 
                          : report.reportedAt?.toDate 
                            ? report.reportedAt.toDate().toLocaleDateString() 
                            : report.timestamp?.toDate
                              ? report.timestamp.toDate().toLocaleDateString()
                              : "--"}
                      </td>
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
                  {selectedReport?.createdAt?.toDate 
                    ? selectedReport.createdAt.toDate().toLocaleString() 
                    : selectedReport?.reportedAt?.toDate 
                      ? selectedReport.reportedAt.toDate().toLocaleString() 
                      : selectedReport?.timestamp?.toDate
                        ? selectedReport.timestamp.toDate().toLocaleString()
                        : ''}
                </div>
                <button className="modal-close" style={{marginLeft: '16px', fontSize: '1.7em', lineHeight: '1'}} onClick={() => setSelectedReport(null)}>&times;</button>
              </div>
            </div>
            <div className="modal-body">
              <div className="evidence-grid">
                <div className="evidence-info two-row-info">
                  <div className="info-row">
                    <div className="info-group"><label>Report ID</label><p className="info-highlight">#{selectedReport.id.slice(0,8)}</p></div>
                    <div className="info-group">
                      <label>
                        {selectedReport.collection === "VendorToUserReports" 
                          ? "Reported Target" 
                          : selectedReport.collection === "Reports_Chats" 
                            ? "Reported User/Sender" 
                            : "Vendor Name"}
                      </label>
                      <p className="info-highlight">{selectedReport.userName}</p>
                    </div>
                  </div>
                  <div className="info-row">
                    <div className="info-group"><label>Reasoning Category</label><p className="info-highlight">{selectedReport.reason}</p></div>
                  </div>
                  <div className="info-row">
                    <div className="info-group">
                      <label>{selectedReport.collection === "Reports_Chats" ? "Flagged Message Log" : "Description & Statement Log"}</label>
                      <p className="desc-box">{selectedReport.details || selectedReport.reasonDetails || "No additional context provided."}</p>
                    </div>
                  </div>
                  {selectedReport.chatRoomId && (
                    <div className="info-row">
                      <div className="info-group"><label>Active Chat Room Reference</label><p className="info-highlight">{selectedReport.chatRoomId}</p></div>
                    </div>
                  )}
                  {selectedReport.orderNumber && (
                    <div className="info-row">
                      <div className="info-group"><label>Associated Order ID</label><p className="info-highlight">#{selectedReport.orderNumber}</p></div>
                    </div>
                  )}
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