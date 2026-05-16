import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFirestore, collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const { width } = Dimensions.get("window");

export default function VendorDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Today"); // Filter State: Today, Yesterday, 30D, All

  // Stats States
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [totalPreparingOrders, setTotalPreparingOrders] = useState(0);
  const [totalToDeliverOrders, setTotalToDeliverOrders] = useState(0);
  const [totalCompletedOrders, setTotalCompletedOrders] = useState(0);

  const [totalSales, setTotalSales] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [totalItemsSold, setTotalItemsSold] = useState(0);

  // Helper function to check if a date falls within the selected filter
  const isWithinFilter = (timestamp) => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (filter === "Today") return date >= today;
    if (filter === "Yesterday") return date >= yesterday && date < today;
    if (filter === "30D") return date >= thirtyDaysAgo;
    return true; // "All"
  };

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const db = getFirestore();

    // 1. & 2. Listen to Active and Delivery Orders (Always real-time counts)
    const unsubOrders = onSnapshot(collection(db, "Orders"), (snapshot) => {
      let pending = 0; let preparing = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.items?.some(item => item.uploadedBy?.uid === user.uid) && isWithinFilter(data.createdAt)) {
          if (data.status === "Pending") pending++;
          if (data.status === "Preparing") preparing++;
        }
      });
      setTotalPendingOrders(pending);
      setTotalPreparingOrders(preparing);
    });

    const unsubDeliver = onSnapshot(collection(db, "To_Deliver_Orders"), (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.items?.some(i => i.uploadedBy?.uid === user.uid) && isWithinFilter(data.createdAt)) count++;
      });
      setTotalToDeliverOrders(count);
    });

    // 3. Listen to Completed Orders & Calculate Analytics based on Filter
    const qCompleted = query(collection(db, "Completed_Orders"), orderBy("completedAt", "desc"));
    const unsubCompleted = onSnapshot(qCompleted, (snapshot) => {
      let sales = 0;
      let itemsCount = 0;
      let completedCount = 0;
      const productMap = {};

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        // Check if order belongs to vendor AND fits the date filter
        const orderDate = order.completedAt || order.createdAt;
        if (isWithinFilter(orderDate)) {
          const vendorItems = order.items?.filter(item => item.uploadedBy?.uid === user.uid) || [];
          if (vendorItems.length > 0) {
            completedCount++;
            vendorItems.forEach(item => {
              const base = Number(item.basePrice || 0);
              const varPrice = Number(item.selectedVariationPrice || 0);
              const srvPrice = (item.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
              const itemTotal = (base + varPrice + srvPrice) * (item.quantity || 1);

              sales += itemTotal;
              itemsCount += (item.quantity || 0);
              productMap[item.productName] = (productMap[item.productName] || 0) + (item.quantity || 0);
            });
          }
        }
      });

      setTotalSales(sales);
      setTotalItemsSold(itemsCount);
      setTotalCompletedOrders(completedCount);
      setTopProducts(Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, quantity]) => ({ name, quantity })));
      setLoading(false);
    });

    return () => { unsubOrders(); unsubDeliver(); unsubCompleted(); };
  }, [filter]); // Re-run effect when filter changes

  if (loading) return (
    <View style={[styles.container, { justifyContent: "center" }]}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );

  const totalOrders = totalPendingOrders + totalPreparingOrders + totalToDeliverOrders + totalCompletedOrders;

  const orderBreakdown = [
    { label: "Pending", value: totalPendingOrders, color: "#94a3b8" },
    { label: "Preparing", value: totalPreparingOrders, color: "#3b82f6" },
    { label: "Delivery", value: totalToDeliverOrders, color: "#f59e0b" },
    { label: "Done", value: totalCompletedOrders, color: "#10b981" },
  ];

  const filterOptions = ["Today", "Yesterday", "30D", "All"];

  return (
    <View style={styles.container}>
      <StatusBar hidden={false}/>
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Modern Date Filter Chips */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterOptions.map((opt) => (
            <TouchableOpacity 
              key={opt} 
              onPress={() => setFilter(opt)}
              style={[styles.filterChip, filter === opt && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === opt && styles.filterTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Main Sales Highlight */}
        <View style={styles.mainSalesCard}>
          <Text style={styles.salesLabel}>{filter} Sales</Text>
          <Text style={styles.salesValue}>₱{totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          <View style={styles.salesSubRow}>
            <View style={styles.salesSubItem}>
              <Ionicons name="cart-outline" size={16} color="#bfdbfe" />
              <Text style={styles.salesSubText}>{totalOrders} Orders</Text>
            </View>
            <View style={styles.salesSubItem}>
              <Ionicons name="cube-outline" size={16} color="#bfdbfe" />
              <Text style={styles.salesSubText}>{totalItemsSold} Items</Text>
            </View>
          </View>
        </View>

        {/* Order Pipeline */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Order Pipeline</Text>
            <Text style={styles.viewAllText}>{filter}</Text>
          </View>
          <View style={styles.unifiedTrack}>
            {orderBreakdown.map((item, idx) => {
              const segmentWidth = totalOrders === 0 ? 0 : (item.value / totalOrders) * 100;
              return segmentWidth > 0 ? (
                <View key={idx} style={{ width: `${segmentWidth}%`, backgroundColor: item.color, height: '100%' }} />
              ) : null;
            })}
          </View>
          <View style={styles.pipelineLegend}>
            {orderBreakdown.map((item, idx) => (
              <View key={idx} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendVal}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Selling Products */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Products</Text>
            <Ionicons name="ribbon-outline" size={20} color="#3b82f6" />
          </View>
          {topProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products sold in this period</Text>
            </View>
          ) : (
            topProducts.map((item, idx) => {
              const maxQty = topProducts[0].quantity;
              const barWidth = (item.quantity / maxQty) * 100;
              return (
                <View key={idx} style={styles.productRow}>
                  <View style={styles.productMain}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.productQty}>{item.quantity} sold</Text>
                  </View>
                  <View style={styles.productTrack}>
                    <View style={[styles.productFill, { width: `${barWidth}%` }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { 
    backgroundColor: "#1e3a8a", 
    marginTop: 35,
    paddingTop: 20,
    paddingBottom: 20, 
    paddingHorizontal: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  headerDate: { color: "#bfdbfe", fontSize: 12, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  notifBtn: { width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  filterWrapper: { backgroundColor: "#1e3a8a", paddingBottom: 15 },
  filterScroll: { paddingHorizontal: 20, gap: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)" },
  filterChipActive: { backgroundColor: "#fff" },
  filterText: { color: "#bfdbfe", fontWeight: "600", fontSize: 13 },
  filterTextActive: { color: "#1e3a8a" },

  scrollContent: { padding: 16, paddingBottom: 40 },
  mainSalesCard: { backgroundColor: '#3b82f6', borderRadius: 24, padding: 25, marginBottom: 20, elevation: 8, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 10 },
  salesLabel: { color: '#dbeafe', fontSize: 14, fontWeight: '600', textTransform: 'uppercase' },
  salesValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginVertical: 8 },
  salesSubRow: { flexDirection: 'row', gap: 20, marginTop: 5, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 15 },
  salesSubItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  salesSubText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  sectionCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  viewAllText: { fontSize: 12, color: '#3b82f6', fontWeight: '700' },

  unifiedTrack: { height: 12, backgroundColor: '#f1f5f9', borderRadius: 6, flexDirection: 'row', overflow: 'hidden', marginBottom: 20 },
  pipelineLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  legendItem: { width: '48%', flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLabel: { flex: 1, fontSize: 13, color: '#64748b' },
  legendVal: { fontSize: 13, fontWeight: '700', color: '#1e293b' },

  productRow: { marginBottom: 18 },
  productMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  productName: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },
  productQty: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  productTrack: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  productFill: { height: '100%', backgroundColor: '#3b82f6' },
  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontStyle: 'italic' }
});