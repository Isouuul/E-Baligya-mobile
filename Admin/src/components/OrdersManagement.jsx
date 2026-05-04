import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { TablePagination } from "@mui/material";
import "../components/OrdersManagement.css";

export default function OrdersManagement() {
  const [ordersData, setOrdersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleViewOrder = (order) => {
    setSelectedOrder(order); // order already contains items array
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setSelectedOrder(null);
    setShowModal(false);
  };

  useEffect(() => {
    const q = query(collection(db, "Orders"), where("status", "==", "Pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pendingOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrdersData(pendingOrders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  const filteredOrders = ordersData.filter((order) => {
    const searchLower = search.toLowerCase().trim();

    if (!searchLower) return true;

    const firstName = (order.userFirstName || "").toLowerCase();
    const lastName = (order.userLastName || "").toLowerCase();
    const orderNumber = String(order.orderNumber || "").toLowerCase();

    const inOrderFields =
      firstName.includes(searchLower) ||
      lastName.includes(searchLower) ||
      orderNumber.includes(searchLower);

    const orderItems = Array.isArray(order.items) ? order.items : [];

    const inItems = orderItems.some((item) => {
      const productName = (item.productName || "").toLowerCase();
      const uploadedBy = (item.uploadedBy || "").toLowerCase();
      const itemServices = Array.isArray(item.services) ? item.services : [];
      const hasMatchingService = itemServices.some((service) =>
        String(service || "").toLowerCase().includes(searchLower)
      );

      return (
        productName.includes(searchLower) ||
        uploadedBy.includes(searchLower) ||
        hasMatchingService
      );
    });

    return inOrderFields || inItems;
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
  const paginatedOrders = filteredOrders.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const selectedOrderItems = Array.isArray(selectedOrder?.items)
    ? selectedOrder.items
    : [];

  const formatValue = (value, fallback = "-") => {
    if (value === null || value === undefined || value === "") return fallback;
    if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };


  if (loading) return <p>Loading orders...</p>;

  return (
    <div className="orders-container">
      <h2 style={{ borderBottom: "1px solid gray", paddingBottom: "8px" }}>
        Pending Orders
      </h2>

      <div className="search-filter">
        <div className="count-btn">
          Total Pending Orders: {filteredOrders.length}
        </div>
        <input
          type="text"
          placeholder="Search by Order # or User"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="orders-table-wrapper">
        <table className="orders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Order #</th>
              <th>User</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order, index) => (
              <tr key={order.id}>
                <td>{page * rowsPerPage + index + 1}</td>
                <td>{order.orderNumber}</td>
                <td>{order.userFirstName} {order.userLastName}</td>
                <td>₱{order.totalAmount}</td>
                <td>{order.status}</td>
                <td>
                  <button className="view-btn" onClick={() => handleViewOrder(order)}>
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
          count={filteredOrders.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Rows:"
        />
      </div>

      {/* Modal for viewing order details */}
      {showModal && selectedOrder && (
        <div className="orders-modal-overlay" onClick={handleCloseModal}>
          <div className="orders-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="orders-modal-header">
              <h3>Order #{selectedOrder.orderNumber}</h3>
              <button className="orders-modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <p>User: {formatValue(selectedOrder.userFirstName, "")} {formatValue(selectedOrder.userLastName, "")}</p>
            <p>Total: ₱{formatValue(selectedOrder.totalAmount, 0)}</p>
            <p>Delivery: {formatValue(selectedOrder.deliveryMethod)}</p>
            <p>Payment: {formatValue(selectedOrder.paymentMethod)}</p>
            {selectedOrder.leaveNote && <p>Note: {selectedOrder.leaveNote}</p>}
            {selectedOrder.address && (
              <p>Address: {formatValue(selectedOrder.address.addressLine, "")}, {formatValue(selectedOrder.address.city, "")}</p>
            )}

            <h4>Items:</h4>
            <table className="orders-modal-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Base Price</th>
                  <th>Variation</th>
                  <th>Variation Price</th>
                  <th>Services</th>
                  <th>Uploaded By</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrderItems.map((item, idx) => {
                  const itemServices = Array.isArray(item.services)
                    ? item.services
                    : [];

                  return (
                  <tr key={idx}>
                    <td>{formatValue(item.productName)}</td>
                    <td>{formatValue(item.quantity)}</td>
                    <td>₱{formatValue(item.basePrice, 0)}</td>
                    <td>{formatValue(item.selectedVariation)}</td>
                    <td>₱{formatValue(item.selectedVariationPrice, 0)}</td>
                    <td>{itemServices.length > 0 ? itemServices.join(", ") : "-"}</td>
                    <td>{formatValue(item.uploadedBy)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <button className="orders-close-btn" onClick={handleCloseModal}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
