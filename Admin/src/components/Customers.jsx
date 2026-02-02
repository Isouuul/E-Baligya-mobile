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
      <h2 style={{ borderBottom: "1px solid gray", paddingBottom: "8px" }}>
        Approved Vendors
      </h2>

      {/* Search & Filter */}
      <div className="search-filter">
        {/* Dynamic Count Button */}
        <div className="count-btn">
          {statusFilter === "All"
            ? `Total Vendors: ${filteredVendors.length}`
            : `${statusFilter} Vendors: ${filteredVendors.length}`}
        </div>
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
              <th>Business Name</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Business Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedVendors.map((vendor, index) => (
              <tr key={vendor.id}>
                <td>{page * rowsPerPage + index + 1}</td>
                <td>{vendor.businessName}</td>
                <td>{vendor.ownerName}</td>
                <td>{vendor.email}</td>
                <td>{vendor.phone}</td>
                <td>{vendor.businessType}</td>
                <td>{vendor.status}</td>
              </tr>
            ))}
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
    </div>
  );
}
