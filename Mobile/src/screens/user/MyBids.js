import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { auth, db } from "../../firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

const MyBids = ({ navigation }) => {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatPeso = (amount) => {
    return parseFloat(amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const fetchMyBids = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      const requestBiddingRef = collection(db, "RequestBidding");
      const productsSnap = await getDocs(requestBiddingRef);

      const allBids = [];

      for (const productDoc of productsSnap.docs) {
        const productId = productDoc.id;
        const bidsRef = collection(db, "RequestBidding", productId, "Bids");
        const userBidsQuery = query(
          bidsRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const bidsSnap = await getDocs(userBidsQuery);

        bidsSnap.forEach((bidDoc) => {
          const data = bidDoc.data();
          allBids.push({
            id: bidDoc.id,
            productId: data.productId,
            productName: data.productName,
            variation: data.variation,
            bidAmount: data.bidAmount,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          });
        });
      }

      allBids.sort((a, b) => b.createdAt - a.createdAt);
      setBids(allBids);
    } catch (error) {
      console.error("Error fetching bids:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBids();
  }, []);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );

  if (bids.length === 0)
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 16, color: "gray" }}>No bids yet.</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <FlatList
        data={bids}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={styles.bidCard}>
            <Text style={styles.productName}>{item.productName}</Text>
            <Text style={styles.variationText}>
              Variation: {item.variation || "—"}
            </Text>
            <Text style={styles.bidAmount}>💰 {formatPeso(item.bidAmount)}</Text>
            <Text style={styles.bidDate}>
              📅 {item.createdAt.toLocaleDateString()}{" "}
              {item.createdAt.toLocaleTimeString()}
            </Text>

            <TouchableOpacity
              style={styles.viewButton}
              onPress={() =>
                navigation.navigate("ViewBiddingProduct", {
                  productId: item.productId,
                })
              }
            >
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.viewButtonText}>View Product</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

export default MyBids;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  bidCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  productName: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  variationText: { fontSize: 14, color: "#6B7280", marginBottom: 4 },
  bidAmount: { fontSize: 16, fontWeight: "600", color: "#008000", marginBottom: 4 },
  bidDate: { fontSize: 12, color: "#9CA3AF", marginBottom: 8 },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  viewButtonText: { color: "#fff", fontSize: 14, fontWeight: "600", marginLeft: 5 },
});
