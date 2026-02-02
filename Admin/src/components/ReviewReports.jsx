import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
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

  // ⭐ FILTER STATE
  const [filterCategory, setFilterCategory] = useState("all");

  // 🔐 AUTH CHECK
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user && onLogout) onLogout();
      setUserLoaded(true);
    });
    return () => unsub();
  }, [onLogout]);

  // 🔍 Fetch user name
  const getUserName = async (userId) => {
    if (!userId) return "Unknown User";
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (userDoc.exists()) {
      const { firstName, middleName, lastName } = userDoc.data();
      return `${firstName} ${middleName ? middleName + " " : ""}${lastName}`;
    }
    return "Unknown User";
  };

  // 🔍 Fetch vendor
  const getVendorInfo = async (vendorId) => {
    if (!vendorId) return { businessName: "N/A", email: "-" };

    const vendorQuery = query(
      collection(db, "VendorUsers"),
      where("userId", "==", vendorId)
    );

    const snapshot = await getDocs(vendorQuery);
    if (!snapshot.empty) {
      const vendorData = snapshot.docs[0].data();
      return {
        businessName: vendorData.businessName || "N/A",
        email: vendorData.email || "-"
      };
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

  // 📥 FETCH ALL REPORTS
  useEffect(() => {
    if (!userLoaded) return;

    const fetchAllReports = async () => {
      try {
        const collections = [
          "Reports_Products",
          "Reports_Bidding_Products",
          "Reports_Vendor",
          "Report_User",
        ];

        let allReports = [];

        for (const colName of collections) {
          const colRef = collection(db, colName);
          const q = query(colRef, where("status", "==" , "pending"));
          const snapshot = await getDocs(q);

          const reportsWithUser = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data();
              let reporterName = await getUserName(data.userId);

              if (colName === "Reports_Bidding_Products") {
                reporterName = data.reportedBy?.name || reporterName;
                const { businessName, email } = await getVendorInfo(data.vendorId);

                return {
                  id: docSnap.id,
                  collection: colName,
                  category: getCategoryName(colName),
                  userName: reporterName,
                  vendorName: businessName,
                  vendorEmail: email,
                  ...data
                };
              }

              return {
                id: docSnap.id,
                collection: colName,
                category: getCategoryName(colName),
                userName: reporterName,
                ...data
              };
            })
          );

          allReports = [...allReports, ...reportsWithUser];
        }

        allReports.sort((a, b) => {
          if (!a.createdAt?.toDate || !b.createdAt?.toDate) return 0;
          return b.createdAt.toDate() - a.createdAt.toDate();
        });

        setReports(allReports);
      } catch (err) {
        console.error("Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllReports();
  }, [userLoaded]);

  if (!userLoaded) return <p>Checking authentication...</p>;

  // ⭐ APPLY FILTER + SEARCH (FIXED)
  const filteredReports = reports.filter((report) => {
    const matchesCategory =
      filterCategory === "all" || report.category === filterCategory;

    const name = report.userName?.toLowerCase() || "";
    const vendor = report.vendorName?.toLowerCase() || "";
    const reason = report.reason?.toLowerCase() || "";
    const details = report.details?.toLowerCase() || "";

    const search = searchTerm.toLowerCase();

    const matchesSearch =
      search === "" ||
      name.includes(search) ||
      vendor.includes(search) ||
      reason.includes(search) ||
      details.includes(search);

    return matchesCategory && matchesSearch;
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
  const paginatedReports = filteredReports.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="reports-container">
      <h2>Pending Reports</h2>

      {/* ⭐ SEARCH + FILTER */}
      <div className="filter-wrapper">
        <input
          type="text"
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="filter-search"
        />

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="filter-dropdown"
        >
          <option value="all">All</option>
          <option value="Products">Products</option>
          <option value="Bidding Product">Bidding Product</option>
          <option value="Vendor">Vendor</option>
          <option value="User">User</option>
        </select>
      </div>

      {loading ? (
        <p>Loading reports...</p>
      ) : (
        <>
          <div className="reports-table-wrapper">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Reporter</th>
                  <th>Reason</th>
                  <th>Vendor</th>

                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedReports.length === 0 ? (
                  <tr>
                    <td colSpan="7">No reports found.</td>
                  </tr>
                ) : (
                  paginatedReports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.category}</td>
                      <td>{report.userName}</td>
                      <td>{report.reason}</td>
                      <td>
                        {report.vendorName || report.businessName || "N/A"} <br />
                        <small>{report.vendorEmail || "-"}</small>
                      </td>

                      <td>{report.status}</td>
                      <td>
                        {report.createdAt?.toDate
                          ? report.createdAt.toDate().toLocaleDateString()
                          : "No date"}
                      </td>
                          <td>
                            <button
                              className="view-btn"
                              onClick={() => setSelectedReport(report)}
                            >
                              View
                            </button>
                          </td>                
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-wrapper">
            <TablePagination
              rowsPerPageOptions={[10]}
              component="div"
              count={filteredReports.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Rows:"
            />
          </div>
        </>
      )}

{selectedReport && (
  <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>


      <div className="modal-details">
        <div className="headerclose">
           <h3 className="ReportDet">Report Details</h3>
          <div className="Close" onClick={() => setSelectedReport(null)}> X </div>

      </div>
        <div className="modal-row">
          <span className="modal-label">Category:</span>
          <span className="modal-value">{selectedReport.category}</span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Reporter:</span>
          <span className="modal-value">{selectedReport.userName}</span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Reason:</span>
          <span className="modal-value">{selectedReport.reason}</span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Vendor:</span>
          <span className="modal-value">{selectedReport.vendorName || "N/A"}</span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Email:</span>
          <span className="modal-value">{selectedReport.vendorEmail || "-"}</span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Details:</span>
          <span className="modal-value">{selectedReport.details || "None"}</span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Submitted:</span>
          <span className="modal-value">
            {selectedReport.createdAt?.toDate
              ? selectedReport.createdAt.toDate().toLocaleString()
              : "No date"}
          </span>
        </div>

        <div className="modal-row">
          <span className="modal-label">Status:</span>
          <span className="modal-value">{selectedReport.status}</span>
        </div>
      </div>

      <div className="modal-image-wrapper">
        {selectedReport.evidenceImage || selectedReport.image ? (
          <img
            src={selectedReport.evidenceImage || selectedReport.image}
            alt="Evidence"
            className="modal-evidence-img"
          />
        ) : (
          <p>No evidence image.</p>
        )}
        
      </div>
    </div>
  </div>
)}


    </div>

    
  );
}
