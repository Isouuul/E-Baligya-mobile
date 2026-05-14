import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { TablePagination } from "@mui/material";
import "../components/OrdersManagement.css";

export default function OrdersManagement() {
  // --- State Management ---
  const [ordersData, setOrdersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'all', 'today', 'yesterday', 'week'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // --- Modal Logic ---
  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setShowModal(false);
  };

  // --- Firebase Real-time Sync ---
  useEffect(() => {
    const q = query(collection(db, "Orders"), where("status", "==", "Pending"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrdersData(pendingOrders);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Functional Search & Date Logic ---
  const filteredOrders = ordersData.filter((order) => {
    // 1. Search Logic
    const searchLower = search.toLowerCase().trim();
    const firstName = (order.userFirstName || "").toLowerCase();
    const lastName = (order.userLastName || "").toLowerCase();
    const orderNum = String(order.orderNumber || "").toLowerCase();
    const items = Array.isArray(order.items) ? order.items : [];
    
    const matchesSearch = !searchLower || 
                          firstName.includes(searchLower) || 
                          lastName.includes(searchLower) || 
                          orderNum.includes(searchLower) ||
                          items.some(item => (item.productName || "").toLowerCase().includes(searchLower));

    // 2. Date Filter Logic
    if (!matchesSearch) return false;
    if (dateFilter === "all") return true;

    const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    if (dateFilter === "today") return orderDate >= today;
    if (dateFilter === "yesterday") return orderDate >= yesterday && orderDate < today;
    if (dateFilter === "week") return orderDate >= lastWeek;

    return true;
  });

  // --- Pagination Handling ---
  const handleChangePage = (event, newPage) => setPage(newPage);
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedOrders = filteredOrders.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="premium-loader-state">
        <div className="premium-spinner"></div>
        <div className="premium-loader-text">Syncing with Database...</div>
      </div>
    );
  }

  return (
    <div className="orders-management-wrapper premium-glass-container" style={{ padding: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      {/* HEADER SECTION (modern style) */}
      <header className="premium-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="header-text">
          <h2 className="premium-title">Pending Orders</h2>
          <p className="premium-subtitle">Manage and review incoming customer requests</p>
        </div>
        <div className="premium-stats-pill">
          <div className="pill-pulse"></div>
          <span className="pill-label">Orders:</span>
          <span className="pill-value">{filteredOrders.length}</span>
        </div>
      </header>

      {/* CONTROLS BAR (search + filter, modern style) */}
      <div className="premium-controls-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div className="search-glass-container" style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'white', border: '2px solid transparent', borderRadius: '14px', padding: '0 1rem' }}>
          <svg className="glass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search Order #, Name, or Product..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            autoComplete="off"
            style={{ width: '100%', padding: '0.9rem', border: 'none', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#1e293b', background: 'transparent' }}
          />
        </div>
        <div className="premium-select-wrapper" style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '0.4rem 1rem', borderRadius: '14px' }}>
          <span className="select-label">Date:</span>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ border: 'none', outline: 'none', fontWeight: 600, color: '#1e293b', cursor: 'pointer', padding: '0.5rem', background: 'transparent' }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.length > 0 ? (
              paginatedOrders.map((order, index) => (
                <tr key={order.id}>
                  <td className="text-muted">{(page * rowsPerPage + index + 1).toString().padStart(2, '0')}</td>
                  <td><code className="permit-code">#{order.orderNumber}</code></td>
                  <td>
                    <div className="business-cell">
                        <span className="b-name">{order.userFirstName} {order.userLastName}</span>
                        <span className="b-email">{order.paymentMethod || "COD"}</span>
                    </div>
                  </td>
                  <td className="price-cell price-bold">{formatCurrency(order.totalAmount)}</td>
                  <td><span className="badge-pending">{order.status}</span></td>
                  <td className="actions-cell">
                    <div className="action-group">
                      <button className="icon-btn view" title="View Details" onClick={() => handleViewOrder(order)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontWeight: 500 }}>
                    No data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="footer-pagination">
        <TablePagination
          rowsPerPageOptions={[10, 25]}
          component="div"
          count={filteredOrders.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </div>

      {/* --- MODAL SECTION REMAINS SAME --- */}
      {showModal && selectedOrder && (
        <div className="orders-modal-overlay" onClick={handleCloseModal}>
          <div className="orders-modal-content premium-glass" onClick={(e) => e.stopPropagation()}>
           <div className="orders-modal-header">
  <div className="header-left">
    <span className="modal-category-badge">
      {selectedOrder.items && selectedOrder.items[0]?.uploadedBy?.businessName
        ? selectedOrder.items[0].uploadedBy.businessName
        : "Business"}
    </span>

  </div>
  <button className="close-x-btn" onClick={handleCloseModal}>&times;</button>
</div>
            <div className="orders-modal-body">
<div className="order-info-grid">
  {/* Customer Details - Light Blue */}
  <div className="info-box blue-highlight">
    <label>Customer Details</label>
    <span className="primary-text">{selectedOrder.userFirstName} {selectedOrder.userLastName}</span>
  </div>

  {/* Payment & Delivery - Light Green */}
  <div className="info-box green-highlight">
    <label>Payment & Delivery</label>
    <span className="secondary-text">
      {selectedOrder.paymentMethod || "COD"} • {selectedOrder.deliveryMethod || "Standard"}
    </span>
  </div>

  {/* Total Revenue - Already Set (Assuming it's Purple/Darker Green) */}
  <div className="info-box total-highlight">
    <label>Total Revenue</label>
    <span className="price-tag">{formatCurrency(selectedOrder.totalAmount)}</span>
  </div>
</div>

              {selectedOrder.address && (
                <div className="shipping-banner indicator-bg">
                  <div className="shipping-details">
                    <label>Shipping Destination</label>
                    <p>{selectedOrder.address.fullAddress}</p>
                  </div>
                </div>
              )}

              <div className="items-section">
                <h3>Order Items</h3>
                <div className="section-header">
    <span className="order-number-badge">#{selectedOrder.orderNumber}</span>
                  <span className="item-count-pill">{selectedOrder.items?.length || 0} Items</span>
                </div>
                
                <div className="item-list-scrollable">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="premium-item-card">
                      <div className="item-main">
                        <div className="item-lead">
                          {item.productImage && (
                            <img
                              src={item.productImage}
                              alt={item.productName || "Product"}
                              className="order-modal-product-img"
                            />
                          )}
                          <div>
                        <h3 style={{marginTop: "-5px"}}>{item.productName}</h3>

                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '-15px', gap: '8px' }}>
                          <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.98em' }}>Qty: {item.quantity}</span>
                        </div>
                          </div>
                        </div>
                      </div>
                      <div className="item-math">

                        <span className="item-subtotal">{formatCurrency(item.selectedVariationPrice || item.basePrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
           
          </div>
        </div>
      )}
    </div>
  );
}