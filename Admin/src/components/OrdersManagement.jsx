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
  const searchLower = search.toLowerCase();

  // Search in main order fields
  const inOrderFields =
    order.userFirstName?.toLowerCase().includes(searchLower) ||
    order.userLastName?.toLowerCase().includes(searchLower) ||
    order.orderNumber?.toString().includes(searchLower);

  // Search inside items array
  const inItems = order.items?.some((item) =>
    item.productName?.toLowerCase().includes(searchLower) ||
    item.uploadedBy?.toLowerCase().includes(searchLower) ||
    item.services?.some((service) =>
      service.toLowerCase().includes(searchLower)
    )
  );

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
        <div className="modal">
          <div className="modal-content">
            <h3>Order #{selectedOrder.orderNumber}</h3>
            <p>User: {selectedOrder.userFirstName} {selectedOrder.userLastName}</p>
            <p>Total: ₱{selectedOrder.totalAmount}</p>
            <p>Delivery: {selectedOrder.deliveryMethod}</p>
            <p>Payment: {selectedOrder.paymentMethod}</p>
            {selectedOrder.leaveNote && <p>Note: {selectedOrder.leaveNote}</p>}
            {selectedOrder.address && (
              <p>Address: {selectedOrder.address.addressLine || ""}, {selectedOrder.address.city || ""}</p>
            )}

            <h4>Items:</h4>
            <table className="modal-items-table">
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
                {selectedOrder.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.productName}</td>
                    <td>{item.quantity}</td>
                    <td>₱{item.basePrice}</td>
                    <td>{item.selectedVariation || "-"}</td>
                    <td>₱{item.selectedVariationPrice || 0}</td>
                    <td>{item.services.length > 0 ? item.services.join(", ") : "-"}</td>
                    <td>{item.uploadedBy || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button onClick={handleCloseModal}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
