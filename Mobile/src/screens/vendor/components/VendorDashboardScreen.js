// src/screens/Vendor/VendorDashboardScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFirestore, collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export default function VendorDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  // Stats States
  const [totalPendingOrders, setTotalPendingOrders] = useState(0);
  const [totalPreparingOrders, setTotalPreparingOrders] = useState(0);
  const [totalToDeliverOrders, setTotalToDeliverOrders] = useState(0);
  const [totalCompletedOrders, setTotalCompletedOrders] = useState(0);

  const [totalSales, setTotalSales] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [totalItemsSold, setTotalItemsSold] = useState(0);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const db = getFirestore();

    // 1. Listen to Active Orders (Pending & Preparing)
    const unsubOrders = onSnapshot(collection(db, "Orders"), (snapshot) => {
      let pending = 0;
      let preparing = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const hasVendorItems = data.items?.some(item => item.uploadedBy?.uid === user.uid);
        if (hasVendorItems) {
          if (data.status === "Pending") pending++;
          if (data.status === "Preparing") preparing++;
        }
      });
      setTotalPendingOrders(pending);
      setTotalPreparingOrders(preparing);
    });

    // 2. Listen to To Deliver Orders
    const unsubDeliver = onSnapshot(collection(db, "To_Deliver_Orders"), (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        if (doc.data().items?.some(i => i.uploadedBy?.uid === user.uid)) count++;
      });
      setTotalToDeliverOrders(count);
    });

    // 3. Listen to Completed Orders & Calculate Analytics
    const qCompleted = query(collection(db, "Completed_Orders"), orderBy("completedAt", "desc"));
    const unsubCompleted = onSnapshot(qCompleted, (snapshot) => {
      let sales = 0;
      let mSales = 0;
      let itemsCount = 0;
      let completedCount = 0;
      const productMap = {};
      const categoryMap = {};

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        const vendorItems = order.items?.filter(item => item.uploadedBy?.uid === user.uid) || [];

        if (vendorItems.length > 0) {
          completedCount++;
          vendorItems.forEach(item => {
            // Full Estimation Formula: (Base + Variation + Services) * Qty
            const base = Number(item.basePrice || 0);
            const varPrice = Number(item.selectedVariationPrice || 0);
            const srvPrice = (item.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
            const itemTotal = (base + varPrice + srvPrice) * (item.quantity || 1);

            sales += itemTotal;
            itemsCount += (item.quantity || 0);

            // 30-Day Check
            const compDate = order.completedAt?.toDate?.() || new Date();
            if (compDate >= thirtyDaysAgo) mSales += itemTotal;

            // Mapping for Top 3
            productMap[item.productName] = (productMap[item.productName] || 0) + (item.quantity || 0);
            const cat = item.category || "Uncategorized";
            categoryMap[cat] = (categoryMap[cat] || 0) + (item.quantity || 0);
          });
        }
      });

      setTotalSales(sales);
      setMonthlySales(mSales);
      setTotalItemsSold(itemsCount);
      setTotalCompletedOrders(completedCount);
      setTopProducts(Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, quantity]) => ({ name, quantity })));
      setTopCategories(Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, quantity]) => ({ category, quantity })));
      setLoading(false);
    });

    return () => { unsubOrders(); unsubDeliver(); unsubCompleted(); };
  }, []);

  if (loading) return (
    <View style={[styles.container, { justifyContent: "center" }]}><ActivityIndicator size="large" color="#2563eb" /></View>
  );

  const totalOrders = totalPendingOrders + totalPreparingOrders + totalToDeliverOrders + totalCompletedOrders;

  const orderBreakdown = [
    { label: "Pending", value: totalPendingOrders, color: "#64748b", icon: "time-outline" },
    { label: "Preparing", value: totalPreparingOrders, color: "#2563eb", icon: "restaurant-outline" },
    { label: "To Deliver", value: totalToDeliverOrders, color: "#f97316", icon: "bicycle-outline" },
    { label: "Completed", value: totalCompletedOrders, color: "#10b981", icon: "checkmark-circle-outline" },
  ];

  const overviewCards = [
    { label: "Total Sales", value: `₱${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: "wallet-outline", accent: "#0f766e" },
    { label: "30-Day Sales", value: `₱${monthlySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: "trending-up-outline", accent: "#1d4ed8" },
    { label: "Total Orders", value: `${totalOrders}`, icon: "receipt-outline", accent: "#7c3aed" },
    { label: "Items Sold", value: `${totalItemsSold}`, icon: "cube-outline", accent: "#b45309" },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a8a" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Performance Overview</Text>
            <Text style={styles.headerTitle}>Vendor Dashboard</Text>
          </View>
          <TouchableOpacity style={styles.iconButtonBg} onPress={() => navigation.navigate("VendorNotifications")}>
            <Ionicons name="notifications-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.analyticsSection}>
          <Text style={styles.analyticsTitle}>Business Analytics</Text>
          <View style={styles.overviewGrid}>
            {overviewCards.map((item) => (
              <View key={item.label} style={styles.overviewCard}>
                <View style={[styles.overviewIconWrap, { backgroundColor: item.accent }]}><Ionicons name={item.icon} size={16} color="#fff" /></View>
                <Text style={styles.overviewLabel}>{item.label}</Text>
                <Text style={styles.overviewValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Top Products */}
          <View style={styles.analyticsCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.analyticsCardTitle}>Top Selling Products</Text>
              <Ionicons name="star-outline" size={18} color="#334155" />
            </View>
            {topProducts.length === 0 ? <Text style={styles.emptyText}>No sales yet</Text> : topProducts.map((item, idx) => (
              <View key={idx} style={styles.rankedRow}>
                <View style={styles.rankBadge}><Text style={styles.rankBadgeText}>{idx + 1}</Text></View>
                <Text style={styles.rankedLabel} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rankedQty}>{item.quantity}</Text>
              </View>
            ))}
          </View>

          {/* Orders Breakdown */}
          <View style={styles.analyticsCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.analyticsCardTitle}>Orders Breakdown</Text>
              <Ionicons name="pie-chart-outline" size={18} color="#334155" />
            </View>
            {orderBreakdown.map((item, idx) => {
              const widthPercent = totalOrders === 0 ? 0 : (item.value / totalOrders) * 100;
              return (
                <View key={idx} style={styles.breakdownRow}>
                  <View style={styles.breakdownTopRow}>
                    <View style={styles.breakdownLabelWrap}><Ionicons name={item.icon} size={14} color={item.color} /><Text style={styles.breakdownLabel}>{item.label}</Text></View>
                    <Text style={styles.breakdownValue}>{item.value}</Text>
                  </View>
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${widthPercent}%`, backgroundColor: item.color }]} /></View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  scrollContent: { paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 25, backgroundColor: "#1e3a8a", borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 7 },
  headerEyebrow: { fontSize: 12, color: "#bfdbfe", fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginTop: 2 },
  iconButtonBg: { padding: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  analyticsSection: { marginTop: 20, paddingHorizontal: 16 },
  analyticsTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  overviewCard: { width: "48.6%", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, elevation: 3 },
  overviewIconWrap: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  overviewLabel: { fontSize: 12, color: "#64748b", fontWeight: "600", marginBottom: 4 },
  overviewValue: { fontSize: 15, color: "#0f172a", fontWeight: "800" },
  analyticsCard: { backgroundColor: "#fff", padding: 14, borderRadius: 16, marginBottom: 10, elevation: 3 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  analyticsCardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  rankedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginRight: 10 },
  rankBadgeText: { fontSize: 12, color: "#334155", fontWeight: "700" },
  rankedLabel: { flex: 1, fontSize: 14, color: "#1e293b", fontWeight: "600" },
  rankedQty: { fontSize: 14, color: "#2563eb", fontWeight: "700" },
  emptyText: { fontSize: 14, color: "#64748b", fontStyle: "italic" },
  breakdownRow: { marginBottom: 10 },
  breakdownTopRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  breakdownLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  breakdownLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  breakdownValue: { fontSize: 14, fontWeight: "700" },
  progressTrack: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
});