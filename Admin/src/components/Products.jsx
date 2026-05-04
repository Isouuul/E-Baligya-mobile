import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { TablePagination, CircularProgress, Tooltip } from "@mui/material";
import AllIcon from "../assets/all.png";
import AlertIcon from "../assets/Alert.png";
import WalletIcon from "../assets/Wallet.png";
import "../components/Products.css";
export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const [stockFilter, setStockFilter] = useState("all"); // 'all', 'low', 'healthy'

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, "Products"));
        setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesSearch =
        p.productName?.toLowerCase().includes(search.toLowerCase()) ||
        p.uploadedBy?.businessName?.toLowerCase().includes(search.toLowerCase()) ||
        p.id?.toLowerCase().includes(search.toLowerCase());
      const isLowStock = Number(p.quantityKg) < 15;
      if (stockFilter === "low" && !isLowStock) return false;
      if (stockFilter === "healthy" && isLowStock) return false;
      return matchesSearch;
    });
  }, [search, products, stockFilter]);

  const totalValue = useMemo(() => 
    filtered.reduce((a, b) => a + (Number(b.basePrice) * (Number(b.quantityKg) || 1)), 0), 
  [filtered]);

  const lowStockCount = useMemo(() => 
    filtered.filter(p => Number(p.quantityKg) < 15).length, 
  [filtered]);

  if (loading) return (
    <div className="loader-orbit" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress size={60} thickness={4} style={{ color: 'var(--primary)' }} />
    </div>
  );

  return (
    <div className="products-elite premium-glass-container" style={{ padding: '2rem', animation: 'fadeIn 0.5s ease-out' }}>
      {/* HEADER SECTION (like ReviewReports) */}
      <header className="premium-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="header-text">
          <h2 className="premium-title">Product Inventory</h2>
          <p className="premium-subtitle">Monitor, search, and manage all product listings in your marketplace.</p>
        </div>
        <div className="premium-stats-pill">
          <div className="pill-pulse"></div>
          <span className="pill-label">Products:</span>
          <span className="pill-value">{filtered.length}</span>
        </div>
      </header>

      {/* METRICS GRID */}
      <div className="metrics-grid">
        {/* Inventory Value - Blue */}
        <div className="info-box-metric blue-highlight">
          <div className="metric-icon-wrapper metric-icon-inventory">
            <img src={WalletIcon} alt="Inventory" className="premium-metric-icon" />
          </div>
          <div>
            <div className="metric-label">Inventory Value</div>
            <div className="metric-value metric-value-inventory">₱{totalValue.toLocaleString()}</div>
          </div>
        </div>
        {/* Active Listings - Green */}
        <div className="info-box-metric green-highlight">
          <div className="metric-icon-wrapper metric-icon-listings">
            <img src={AllIcon} alt="All Products" className="premium-metric-icon" />
          </div>
          <div>
            <div className="metric-label">Active Listings</div>
            <div className="metric-value metric-value-listings">{filtered.length}</div>
          </div>
        </div>
        {/* Stock Alerts - Purple */}
        <div className="info-box-metric purple-highlight">
          <div className="metric-icon-wrapper metric-icon-alerts">
            <img src={AlertIcon} alt="Alert" className="premium-metric-icon icon-pulse" />
          </div>
          <div>
            <div className="metric-label">Stock Alerts</div>
            <div className="metric-value metric-value-alerts">
              {lowStockCount > 0 ? (
                <span>{lowStockCount} Items Low</span>
              ) : (
                <span>0 Items Low</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS BAR (search + filter, like ReviewReports) */}
      <div className="premium-controls-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div className="search-glass-container" style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'white', border: '2px solid transparent', borderRadius: '14px', padding: '0 1rem' }}>
          <svg className="glass-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search inventory, vendors, or serial numbers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            autoComplete="off"
            style={{ width: '100%', padding: '0.9rem', border: 'none', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#1e293b', background: 'transparent' }}
          />
        </div>
        <div className="premium-select-wrapper" style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '0.4rem 1rem', borderRadius: '14px' }}>
          <span className="select-label">Stock:</span>
          <select
            value={stockFilter}
            onChange={e => { setStockFilter(e.target.value); setPage(0); }}
            style={{ border: 'none', outline: 'none', fontWeight: 600, color: '#1e293b', cursor: 'pointer', padding: '0.5rem', background: 'transparent' }}
          >
            <option value="all">All Stock</option>
            <option value="low">Low Stock (&lt;15kg)</option>
            <option value="healthy">Healthy Stock (15kg+)</option>
          </select>
        </div>
      </div>

      {/* DATA TABLE CONTAINER */}
      <div className="table-container glass-morph" style={{ borderRadius: '18px', overflow: 'hidden', border: '1.5px solid #e0e7ef', background: '#f9fafb', marginBottom: '2rem' }}>
        <table className="elite-table">
          <thead>
            <tr>
              <th style={{ width: '32px', textAlign: 'center' }}>#</th>
              <th>Product</th>
              <th>Vendor</th>
              <th>Base Price</th>
              <th>Stock Level</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', paddingRight: '24px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(page * 10, page * 10 + 10).map((p, idx) => {
              const isLowStock = Number(p.quantityKg) < 15;
              return (
                <tr key={p.id} className="table-row-hover">
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#334155' }}>{(page * 10 + idx + 1).toString().padStart(2, '0')}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <img src={p.imageBase64 || "https://via.placeholder.com/50"} alt="" style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #e0e7ef' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '700', fontSize: '1.05rem', color: '#1e293b' }}>{p.productName}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>#{p.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="vendor-pill">{p.uploadedBy?.businessName || "Independent"}</span></td>
                  <td className="price-bold">₱{Number(p.basePrice).toLocaleString()}</td>
                  <td>
                    <div style={{ width: '120px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', color: '#64748b', fontWeight: 600 }}>
                        <span>{p.quantityKg}kg</span>
                        <span>{isLowStock ? 'Low' : 'OK'}</span>
                      </div>
                      <div style={{ height: '6px', background: '#f1f5fb', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min((p.quantityKg / 100) * 100, 100)}%`, 
                          height: '100%', 
                          background: isLowStock ? 'linear-gradient(90deg, #fbbf24, #f59e42)' : 'linear-gradient(90deg, #4ade80, #22c55e)',
                          borderRadius: '10px'
                        }}></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-blob ${isLowStock ? 'blob-red' : 'blob-green'}`}>
                      {isLowStock ? 'Reorder' : 'Healthy'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '24px' }}>
                    <button className="btn-glass-action" onClick={() => setSelected(p)} title="View Details">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: 6 }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TablePagination
          component="div"
          count={filtered.length}
          rowsPerPage={10}
          page={page}
          onPageChange={(_, n) => setPage(n)}
          rowsPerPageOptions={[]}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'inherit' }}
        />
      </div>

      {/* PRODUCT INSPECTION MODAL */}
      {selected && (
        <div className="modal-backdrop-blur" onClick={() => setSelected(null)}>
          <div className="glass-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-premium">
              <div>
                <small style={{ color: 'var(--primary)', letterSpacing: '1px', fontWeight: 'bold' }}>PRODUCT OVERVIEW</small>
                <h2 style={{ margin: '5px 0 0 0' }}>{selected.productName}</h2>
              </div>
              <button className="close-circle" onClick={() => setSelected(null)}>&times;</button>
            </div>
            
            <div className="modal-scroll-content">
              <div className="stats-row" style={{ display: 'flex', gap: '1.2rem', marginBottom: '1.1rem' }}>
                <div className="stat-item" style={{
                  background: '#e8edff', // lighter blue
                  border: '1px solid #7ea6f7', // lighter blue border
                  borderRadius: '16px',
                  padding: '10px 16px',
                  minWidth: '100px',
                  textAlign: 'left',
                  flex: 1
                }}>
                  <label style={{ color: '#64748b', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.7px' }}>CURRENT PRICE</label>
                  <p style={{ color: '#111827', fontWeight: 700, fontSize: '1.3rem', margin: '6px 0 0 0' }}>₱{Number(selected.basePrice).toLocaleString()}</p>
                </div>
                <div className="stat-item" style={{
                  background: '#fffddc', // lighter yellow
                  border: '1px solid #ffe066', // lighter yellow border
                  borderRadius: '16px',
                  padding: '10px 16px',
                  minWidth: '100px',
                  textAlign: 'left',
                  flex: 1
                }}>
                  <label style={{ color: '#b08916', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.7px' }}>STOCK ON HAND</label>
                  <p style={{ color: '#111827', fontWeight: 700, fontSize: '1.3rem', margin: '6px 0 0 0' }}>{selected.quantityKg} <small style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 600 }}>kg</small></p>
                </div>
                <div className="stat-item" style={{
                  background: '#f6edff', // lighter purple
                  border: 'px solid #c084fc', // lighter purple border
                  borderRadius: '16px',
                  padding: '10px 16px',
                  minWidth: '100px',
                  textAlign: 'left',
                  flex: 1
                }}>
                  <label style={{ color: '#a21caf', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.7px' }}>CATEGORY</label>
                  <p style={{ color: '#111827', fontWeight: 700, fontSize: '1.3rem', margin: '6px 0 0 0' }}>{selected.category || "General"}</p>
                </div>
              </div>

              <div className="detail-section">
                <div style={{
                  display: 'inline-block',
                  background: '#e0e7ff', // blue background
                  color: '#3730a3',      // blue text
                  borderRadius: '18px',
                  padding: '5px 18px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  letterSpacing: '0.5px',
                  marginBottom: '14px',
                  textAlign: 'center',
                  boxShadow: '0 1px 4px 0 rgba(99,102,241,0.06)'
                }}>
                  VARIATIONS & OPTIONS
                </div>
                <div className="variation-grid">
                  {selected.variations && Object.keys(selected.variations).length > 0 ? (
                    Object.entries(selected.variations)
                      .sort(([a], [b]) => {
                        // Extract numeric part for sorting (e.g., '1kg' -> 1)
                        const getNum = s => parseFloat(s);
                        return getNum(a) - getNum(b);
                      })
                      .map(([k, v]) => (
                        <div className="variation-card-glass" key={k}>
                          <span className="v-label">{k}</span>
                          <span className="v-price">₱{v.price}</span>
                        </div>
                      ))
                  ) : (
                    <div className="empty-state-simple">No variations defined</div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <div style={{
                  display: 'inline-block',
                  background: '#ede9fe', // purple background
                  color: '#7c3aed',      // purple text
                  borderRadius: '18px',
                  padding: '5px 18px',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  letterSpacing: '0.5px',
                  marginBottom: '14px',
                  textAlign: 'center',
                  boxShadow: '0 1px 4px 0 rgba(99,102,241,0.06)'
                }}>
                  VALUE ADDED SERVICES
                </div>
                <div className="services-flex">
                  {selected.services && Object.values(selected.services).some(s => s.enabled) ? (
                    Object.entries(selected.services).map(([k, v]) =>
                      v.enabled && (
                        <div className="service-chip-premium" key={k}>
                          <span className="dot"></span>
                          {v.label} <span className="s-price">+₱{v.price}</span>
                        </div>
                      )
                    )
                  ) : (
                    <div className="empty-state-simple">No additional services</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}