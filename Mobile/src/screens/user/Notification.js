import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import { Ionicons } from "@expo/vector-icons";

import MessageIcon from '../../../assets/message.png';
import BasketIcon from '../../../assets/basket.png';
import NoOrderImg from '../../../assets/no-order.png';

const UserNotificationsBidding = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // ---------------- REALTIME NOTIFICATIONS ----------------
  useEffect(() => {
    if (!currentUser) return;

    const notifRef = collection(db, "User_Notifications_Product");

    const notifQuery = query(
      notifRef,
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const now = Date.now();

      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        const readAt = data.readAt?.toDate?.()?.getTime();
        let isExpired = false;

        if (readAt) {
          const diffMin = (now - readAt) / (1000 * 60);
          if (diffMin > 60) isExpired = true;
        }

        return {
          id: docSnap.id,
          ...data,
          isExpired,
        };
      }).filter(item => !item.isExpired);

      // Sorting fallback if your query setup doesn't track indexes yet
      const sortedList = list.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });

      setNotifications(sortedList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ---------------- CART COUNT ----------------
  useEffect(() => {
    if (!currentUser) return;

    const q = collection(db, 'Carts', currentUser.uid, 'items');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCartCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ---------------- MARK AS READ ----------------
  const markAsRead = async (notifId) => {
    try {
      const notifDoc = doc(db, "User_Notifications_Product", notifId);

      await updateDoc(notifDoc, {
        read: true,
        readAt: serverTimestamp(),
      });

    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleNotificationPress = (item) => {
    markAsRead(item.id);
    setSelectedNotification(item);
    setModalVisible(true);
  };

  const formatPeso = (amount) => {
    return Number(amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    });
  };

  // ---------------- TIMESTAMP FORMATTER ----------------
  const formatTimeAgo = (createdAtField) => {
    if (!createdAtField) return "";
    
    // Handles conversion if firestore Timestamp or native JS date string/object
    const date = createdAtField.toDate ? createdAtField.toDate() : new Date(createdAtField);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleAccept = (item) => {
    setModalVisible(false);

    const formattedItem = {
      id: item.id,                        
      productId: item.productId || "",    
      productName: item.productName || item.title || "Product",
      category: item.category || "",
      imageBase64: item.imageBase64 || "",
      
      bidAmount: item.bidAmount || 0,
      quantity: item.quantity || 1,
      totalAmount: item.totalAmount || 0,
      basePrice: item.basePrice || 0,
      
      vendorId: item.vendorId || "",
      vendorBusinessName: item.vendorBusinessName || "",
      vendorEmail: item.vendorEmail || "",
      vendorProfileImage: item.vendorProfileImage || "",

      premiumServices: item.premiumServices || [],
      source: "notification",
    };

    navigation.navigate("CheckedOutBidding", {
      selectedItems: [formattedItem],
      notificationIds: [item.id],
      grandTotal: item.totalAmount || 0,
    });
  };

  // ---------------- FIXED IMAGE RESOLVER (WITH ORDER FALLBACK) ----------------
  const getProductImage = (item) => {
    if (item?.imageUrl) return { uri: item.imageUrl };
    if (item?.productImage) return { uri: item.productImage };

    if (Array.isArray(item?.items) && item.items[0]?.productImage) {
      return { uri: item.items[0].productImage };
    }

    if (item?.imageBase64) {
      return {
        uri: item.imageBase64.startsWith("data:")
          ? item.imageBase64
          : `data:image/jpeg;base64,${item.imageBase64}`
      };
    }

    return require("../../../assets/Trash.png");
  };

  // ---------------- RENDER ITEM ----------------
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notifItem, item.read && { opacity: 0.6 }]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.85}
    >
      <Image
        source={getProductImage(item)}
        style={styles.productImage}
      />

      <View style={styles.notifInfo}>
        <View style={styles.notifHeaderRow}>
          <Text
            style={[
              styles.productName,
              item.read && { color: "#94A3B8" }
            ]}
            numberOfLines={1}
          >
            {item.productName || item.title || "Order Update"}
          </Text>

          {!item.read && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        {item.vendorBusinessName && (
          <Text style={styles.vendorName}>
            {item.vendorBusinessName}
          </Text>
        )}

        <Text numberOfLines={2} style={styles.message}>
          {item.message || `Your order status update for ${item.productName || 'items'}`}
        </Text>

        <View style={styles.metaRow}>
          {item.totalAmount !== undefined && item.totalAmount > 0 ? (
            <Text style={styles.amount}>
              {formatPeso(item.totalAmount)}
            </Text>
          ) : <View />}
          
          {item.createdAt && (
            <Text style={styles.timestampText}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
{/* HEADER */}
<View style={styles.header}>
  <View>
    <Text style={styles.headerTitle}>Notifications</Text>
    <Text style={styles.headerSubtitle}>
      Stay updated with your bidding activity
    </Text>
  </View>

  <View style={styles.headerRight}>
    {/* MESSAGE BUTTON */}
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={() => navigation.navigate("InboxScreenUser")}
    >
      <Image
        source={MessageIcon}
        style={styles.headerIcon}
        resizeMode="contain"
      />
    </TouchableOpacity>

    {/* CART BUTTON */}
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={() => navigation.navigate("CartShop")}
    >
      <Image
        source={BasketIcon}
        style={styles.headerIcon}
        resizeMode="contain"
      />

      {cartCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>
            {cartCount > 99 ? "99+" : cartCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
</View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyWrap}>
            <Image source={NoOrderImg} style={styles.emptyImg} />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySubText}>
              No new notifications right now.
            </Text>
          </View>
        )}
      />

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotification && (
              <>
                <Image
                  source={getProductImage(selectedNotification)}
                  style={styles.modalImage}
                />

                <Text style={styles.modalTitle}>
                  {selectedNotification.productName || selectedNotification.title || "Notification"}
                </Text>

                {selectedNotification.vendorBusinessName && (
                  <Text style={styles.modalVendor}>
                    {selectedNotification.vendorBusinessName}
                  </Text>
                )}

                {selectedNotification.createdAt && (
                  <Text style={styles.modalTimestamp}>
                    {formatTimeAgo(selectedNotification.createdAt)}
                  </Text>
                )}

                <Text style={styles.modalMessage}>
                  {selectedNotification.message}
                </Text>

                {selectedNotification.totalAmount !== undefined && selectedNotification.totalAmount > 0 && (
                  <Text style={styles.modalAmount}>
                    {formatPeso(selectedNotification.totalAmount)}
                  </Text>
                )}

                <View style={styles.modalActions}>
                  {selectedNotification.bidAmount ? (
                    <TouchableOpacity
                      style={[styles.modalButton, styles.acceptButton]}
                      onPress={() => handleAccept(selectedNotification)}
                    >
                      <Text style={styles.modalButtonText}>Accept Bid</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, !selectedNotification.bidAmount && { flex: 1 }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF",},
  centered: { flex: 1, justifyContent: "center", alignItems: "center", },
  listContent: { padding: 16 },
  notifItem: { flexDirection: "row", padding: 12, backgroundColor: "#F8FAFC", borderRadius: 16, marginBottom: 12, alignItems: "center" },
  productImage: { width: 60, height: 60, borderRadius: 12, marginRight: 12, backgroundColor: '#E2E8F0' },
  notifInfo: { flex: 1 },
  notifHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productName: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  newBadge: { backgroundColor: "#3B82F6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  vendorName: { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: "500" },
  message: { fontSize: 14, color: "#475569", marginTop: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  amount: { fontSize: 14, fontWeight: "700", color: "#1E3A8A" },
  timestampText: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  emptyWrap: { alignItems: "center", justifyContent: "center", marginTop: 100 },
  emptyImg: { width: 120, height: 120, resizeMode: "contain" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginTop: 16 },
  emptySubText: { fontSize: 14, color: "#94A3B8", marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, alignItems: "center" },
  modalImage: { width: 140, height: 140, borderRadius: 16, marginBottom: 16, backgroundColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  modalVendor: { fontSize: 14, color: "#64748B", marginTop: 4, fontWeight: "600" },
  modalTimestamp: { fontSize: 12, color: "#94A3B8", marginTop: 4, fontWeight: "500" },
  modalMessage: { fontSize: 15, color: "#475569", textAlign: "center", marginTop: 12, lineHeight: 20 },
  modalAmount: { fontSize: 22, fontWeight: "900", color: "#1E3A8A", marginTop: 16 },
  modalActions: { flexDirection: "row", marginTop: 24, gap: 12, width: "100%" },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  acceptButton: { backgroundColor: "#1E3A8A" },
  cancelButton: { backgroundColor: "#F1F5F9" },
  modalButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  cancelButtonText: { color: "#475569", fontWeight: "700", fontSize: 15 },
  header: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingHorizontal: 20,
  paddingTop: 18,
  paddingBottom: 14,
  backgroundColor: "#FFFFFF",
  borderBottomWidth: 1,
  borderBottomColor: "#F1F5F9",
  marginTop: 30
},

headerTitle: {
  fontSize: 28,
  fontWeight: "900",
  color: "#0F172A",
},

headerSubtitle: {
  fontSize: 13,
  color: "#64748B",
  marginTop: 2,
  fontWeight: "500",
},

headerRight: {
  flexDirection: "row",
  alignItems: "center",
},

headerIconBtn: {
  width: 46,
  height: 46,
  borderRadius: 14,
  backgroundColor: "#F8FAFC",
  justifyContent: "center",
  alignItems: "center",
  marginLeft: 12,
  position: "relative",
  borderWidth: 1,
  borderColor: "#E2E8F0",
},

headerIcon: {
  width: 22,
  height: 22,
},

cartBadge: {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: "#EF4444",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 5,
},

cartBadgeText: {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "800",
},
});

export default UserNotificationsBidding;