// src/components/Products.jsx
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { TablePagination } from "@mui/material";
import "../components/Products.css";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(""); 
  const [selectedProduct, setSelectedProduct] = useState(null); // for modal
  const [isModalOpen, setIsModalOpen] = useState(false); // modal state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const categories = ["All", "Fish", "Mollusks", "Crustaceans", "Trend"];

  const handleView = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setSelectedProduct(null);
    setIsModalOpen(false);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsCol = collection(db, "Products");
        const productsSnapshot = await getDocs(productsCol);
        const productsList = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsList);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product => {
    const lowerSearch = search.toLowerCase();
    const matchesSearch =
      product.productName?.toLowerCase().includes(lowerSearch) ||
      product.vendor?.toLowerCase().includes(lowerSearch) ||
      product.orderNumber?.toLowerCase().includes(lowerSearch);

    const matchesCategory = category ? product.category === category : true;

    return matchesSearch && matchesCategory;
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
  const paginatedProducts = filteredProducts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) return <p className="loading">Loading products...</p>;
  if (products.length === 0) return <p className="loading">No products found.</p>;

  return (
    <div className="products-container">
      <h2>Products</h2>

      <div className="products-controls">
        <div className="count-btn">
          <strong>Total Products:</strong> {filteredProducts.length}
        </div>

        <div className="search-input">
          <input
            type="text"
            placeholder="Search by Order #, User, or Vendor"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input-field"
          />
        </div>

        <div className="category-dropdown">
          <select
            value={category || "All"}
            onChange={(e) => setCategory(e.target.value === "All" ? "" : e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="products-table-wrapper">
      <table className="products-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Owner Name</th> {/* <-- Added */}
            <th>Product Name</th>
            <th>Base Price</th>
            <th>Quantity (kg)</th>
            <th>Variations</th>
            <th>Services</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {paginatedProducts.length > 0 ? (
            paginatedProducts.map(product => (
              <tr key={product.id}>
                <td>
                  <img
                    src={product.imageBase64 || "https://via.placeholder.com/100"}
                    alt={product.productName}
                    className="product-image"
                  />
                </td>
<td>{product.uploadedBy?.businessName || "-"}</td>
                <td>{product.productName}</td>
                <td>{product.basePrice ? `₱${product.basePrice}` : "-"}</td>
                <td>{product.quantityKg ? `${product.quantityKg} kg` : "-"}</td>
                <td>
                  {product.variations && Object.keys(product.variations).length > 0 ? (
                    <ul>
                      {Object.entries(product.variations).map(([key, val]) => (
                        <li key={key}>{key}: ₱{val.price}</li>
                      ))}
                    </ul>
                  ) : "-"}
                </td>
                <td>
                  {product.services && Object.keys(product.services).length > 0 ? (
                    <ul>
                      {Object.entries(product.services).map(([key, val]) =>
                        val.enabled ? <li key={key}>{val.label}: ₱{val.price || 0}</li> : null
                      )}
                    </ul>
                  ) : "-"}
                </td>
                <td>
                  <button className="view-button" onClick={() => handleView(product)}>
                    View
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} style={{ textAlign: "center" }}>
                No matching products.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      <TablePagination
        rowsPerPageOptions={[10]}
        component="div"
        count={filteredProducts.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Rows:"
      />

      {/* ================= MODAL ================= */}
      {isModalOpen && selectedProduct && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="headerclose">
              <h3>{selectedProduct.productName}</h3>
              <span className="Close" onClick={closeModal}>×</span>
            </div>

            <div className="modal-details">
              <img
                src={selectedProduct.imageBase64 || "https://via.placeholder.com/200"}
                alt={selectedProduct.productName}
                style={{ width: "100%", borderRadius: "8px", marginBottom: "10px", height: "200px" }}
              />
              <div className="modal-row">
                <span className="modal-label">Owner Name:</span>
                <span className="modal-value">{selectedProduct.uploadedBy?.businessName || "-"}</span>
              </div>


              <div className="modal-row">
                <span className="modal-label">Base Price:</span>
                <span className="modal-value">{selectedProduct.basePrice ? `₱${selectedProduct.basePrice}` : "-"}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Quantity:</span>
                <span className="modal-value">{selectedProduct.quantityKg ? `${selectedProduct.quantityKg} kg` : "-"}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Category:</span>
                <span className="modal-value">{selectedProduct.category || "-"}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Variations:</span>
                <span className="modal-value">
                  {selectedProduct.variations ? (
                    <ul>
                      {Object.entries(selectedProduct.variations).map(([key, val]) => (
                        <li key={key}>{key}: ₱{val.price}</li>
                      ))}
                    </ul>
                  ) : "-"}
                </span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Services:</span>
                <span className="modal-value">
                  {selectedProduct.services ? (
                    <ul>
                      {Object.entries(selectedProduct.services).map(([key, val]) =>
                        val.enabled ? <li key={key}>{val.label}: ₱{val.price || 0}</li> : null
                      )}
                    </ul>
                  ) : "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
