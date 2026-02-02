import React, { useEffect, useState } from "react";
import { db, storage } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { TablePagination } from "@mui/material";
import "./VendorsRequest.css";

export default function VendorsRequest() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const pendingRef = collection(db, "PendingVendors");
        const snapshot = await getDocs(pendingRef);

        const pending = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const vendorData = { id: docSnap.id, ...docSnap.data() };

            // Fetch full vendor data
            try {
              const fullDataRef = doc(db, "PendingVendors", docSnap.id, "fullData", "vendorData");
              const fullDataDoc = await getDoc(fullDataRef);
              if (fullDataDoc.exists()) Object.assign(vendorData, fullDataDoc.data());
            } catch (error) {
              console.error("Error fetching full data:", error);
            }

            // Fetch images
            try {
              const imagesRef = collection(db, "PendingVendors", docSnap.id, "images");
              const imagesSnapshot = await getDocs(imagesRef);
              imagesSnapshot.forEach((imgDoc) => {
                const imgData = imgDoc.data();
                vendorData[imgData.type] = imgData.image;
              });
            } catch (error) {
              console.error("Error fetching images:", error);
            }

            return vendorData;
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
        const date =
          v.createdAt.toDate?.().toISOString().split("T")[0] ||
          new Date(v.createdAt).toISOString().split("T")[0];
        return date === dateFilter;
      });
    }
    setFilteredVendors(filtered);
    setPage(0); // Reset to first page when filters change
  }, [searchTerm, dateFilter, vendors]);

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

  const handleRowClick = (vendor) => {
    setSelectedVendor(vendor);
    setModalOpen(true);
  };
  const closeModal = () => {
    setSelectedVendor(null);
    setModalOpen(false);
  };

  // Upload Base64 to Firebase Storage
  const uploadBase64ToStorage = async (base64, filename) => {
    if (!base64 || !base64.startsWith("data:image")) return null;
    try {
      const base64Data = base64.split(",")[1];
      const storageRef = ref(storage, `vendors/${filename}`);
      await uploadString(storageRef, base64Data, "base64", { contentType: "image/jpeg" });
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error(`Error uploading ${filename}:`, error);
      return null;
    }
  };

  // Delete a subcollection
  const deleteSubCollection = async (parentId, subCol) => {
    const subColRef = collection(db, "PendingVendors", parentId, subCol);
    const snapshot = await getDocs(subColRef);
    await Promise.all(snapshot.docs.map(docSnap => deleteDoc(doc(subColRef, docSnap.id))));
  };

  // Approve vendor
  const approveVendor = async () => {
    if (!selectedVendor) return;
    const vendorId = selectedVendor.id;
    const timestamp = Date.now();

    try {
      // Upload images
      const [govIDFrontURL, govIDBackURL, selfieURL, businessPermitURL] = await Promise.all([
        selectedVendor.govIDFront ? uploadBase64ToStorage(selectedVendor.govIDFront, `govIDFront_${vendorId}_${timestamp}.jpg`) : null,
        selectedVendor.govIDBack ? uploadBase64ToStorage(selectedVendor.govIDBack, `govIDBack_${vendorId}_${timestamp}.jpg`) : null,
        selectedVendor.selfie ? uploadBase64ToStorage(selectedVendor.selfie, `selfie_${vendorId}_${timestamp}.jpg`) : null,
        selectedVendor.businessPermit ? uploadBase64ToStorage(selectedVendor.businessPermit, `businessPermit_${vendorId}_${timestamp}.jpg`) : null,
      ]);

      const approvedVendorData = {
        userId: selectedVendor.userId || null,
        businessName: selectedVendor.businessName || null,
        ownerName: selectedVendor.ownerName || null,
        email: selectedVendor.email || null,
        phone: selectedVendor.phone || null,
        birthday: selectedVendor.birthday || null,
        gender: selectedVendor.gender || null,
        businessType: selectedVendor.businessType || null,
        businessAddress: selectedVendor.businessAddress || null,
        govIDFront: govIDFrontURL || null,
        govIDBack: govIDBackURL || null,
        selfie: selfieURL || null,
        businessPermit: businessPermitURL || null,
        latitude: selectedVendor.latitude || null,
        longitude: selectedVendor.longitude || null,
        role: "Vendor",
        subscription: "Unsubscribe",
        verified: true,
        verifiedAt: new Date(),
        status: "Approved",
        createdAt: selectedVendor.createdAt || new Date(),
      };

      await setDoc(doc(db, "ApprovedVendors", vendorId), approvedVendorData);

      // Delete subcollections
      await deleteSubCollection(vendorId, "images");
      await deleteSubCollection(vendorId, "fullData");

      // Delete parent doc
      await deleteDoc(doc(db, "PendingVendors", vendorId));

      setVendors(prev => prev.filter(v => v.id !== vendorId));
      alert("Vendor approved successfully!");
      closeModal();
    } catch (error) {
      console.error("Error approving vendor:", error);
      alert("Error approving vendor: " + error.message);
    }
  };

  // Reject vendor
  const rejectVendor = async () => {
    if (!selectedVendor) return;
    const vendorId = selectedVendor.id;
    try {
      await setDoc(doc(db, "RejectedVendors", vendorId), {
        email: selectedVendor.email || null,
        businessName: selectedVendor.businessName || null,
        ownerName: selectedVendor.ownerName || null,
        rejectedAt: new Date(),
      });

      await deleteSubCollection(vendorId, "images");
      await deleteSubCollection(vendorId, "fullData");
      await deleteDoc(doc(db, "PendingVendors", vendorId));

      setVendors(prev => prev.filter(v => v.id !== vendorId));
      alert("Vendor rejected.");
      closeModal();
    } catch (error) {
      console.error("Error rejecting vendor:", error);
      alert("Error rejecting vendor.");
    }
  };

  return (
    <div className="vendors-wrapper">
      <h2 className="vendors-title">Vendor Registration Requests</h2>

      <div className="search-row">
        <div className="search-row-container">
          <div className="total-card">Total Vendors: {filteredVendors.length}</div>
          <div className="filter-container">
            <input
              type="text"
              placeholder="Search business, owner, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <button onClick={() => setDateFilter("")}>Clear Date</button>
          </div>
        </div>
      </div>

      {!loading && filteredVendors.length === 0 && (
        <p className="empty">No pending vendor requests.</p>
      )}

      {!loading && filteredVendors.length > 0 && (
        <>
          <div className="customers-table-wrapper">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Num.</th>
                  <th>Business Name</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Date</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVendors.map((vendor, idx) => {
                  const date = vendor.createdAt?.toDate?.().toLocaleDateString() || "-";
                  return (
                    <tr key={vendor.id}>
                      <td>{page * rowsPerPage + idx + 1}</td>
                      <td>{vendor.businessName}</td>
                      <td>{vendor.ownerName}</td>
                      <td>{vendor.email}</td>
                      <td>{vendor.phone}</td>
                      <td>{date}</td>
                      <td>
                        <button className="detail-button" onClick={() => handleRowClick(vendor)}>
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
        </>
      )}

      {modalOpen && selectedVendor && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-grid">
              <div className="modal-left">
                <h3>{selectedVendor.businessName}</h3>
                <p><b>Owner:</b> {selectedVendor.ownerName}</p>
                <p><b>Email:</b> {selectedVendor.email}</p>
                <p><b>Phone:</b> {selectedVendor.phone}</p>
                <p><b>Birthday:</b> {selectedVendor.birthday}</p>
                <p><b>Gender:</b> {selectedVendor.gender}</p>
                <p><b>Business Type:</b> {selectedVendor.businessType}</p>
                <p><b>Address:</b> {selectedVendor.businessAddress}</p>
                <p><b>Status:</b> {selectedVendor.status}</p>
                <p><b>Agreed to Terms:</b> {selectedVendor.agreedToTerms ? "Yes" : "No"}</p>

                {selectedVendor.selfie && (
                  <div className="image-card">
                    <p>Selfie</p>
                    <img src={selectedVendor.selfie} alt="Selfie" />
                  </div>
                )}

                <div className="modal-btns">
                  <button className="btn-approve" onClick={approveVendor}>Approve</button>
                  <button className="btn-reject" onClick={rejectVendor}>Reject</button>
                  <button className="btn-close" onClick={closeModal}>Close</button>
                </div>
              </div>

              <div className="modal-middle">
                <h4>Government IDs</h4>
                {selectedVendor.govIDFront && (
                  <div className="image-card">
                    <p>Gov ID Front</p>
                    <img src={selectedVendor.govIDFront} alt="Gov ID Front" />
                  </div>
                )}
                {selectedVendor.govIDBack && (
                  <div className="image-card">
                    <p>Gov ID Back</p>
                    <img src={selectedVendor.govIDBack} alt="Gov ID Back" />
                  </div>
                )}
              </div>

              <div className="modal-right">
                <h4>Verification Photos</h4>
                {selectedVendor.businessPermit && (
                  <div className="image-card">
                    <p>Business Permit</p>
                    <img src={selectedVendor.businessPermit} alt="Business Permit" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
