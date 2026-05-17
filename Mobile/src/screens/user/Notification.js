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
  Platform,
  Alert,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  increment,
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

  // ---------------- REALTIME NOTIFICATIONS (UNIFIED) ----------------
  useEffect(() => {
    if (!currentUser) return;

    const biddingRef = collection(db, "User_Notifications_Bidding");
    const biddingQuery = query(biddingRef, where("userId", "==", currentUser.uid));

    const regularRef = collection(db, "User_Notifications_Product");
    const regularQuery = query(regularRef, where("userId", "==", currentUser.uid));

    let biddingNotifs = [];
    let regularNotifs = [];

    const mergeAndSortNotifications = () => {
      const combined = [...biddingNotifs, ...regularNotifs];
      
      return combined.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
        return timeB - timeA;
      });
    };

    const unsubscribeBidding = onSnapshot(biddingQuery, (snapshot) => {
      biddingNotifs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        _collectionSource: "User_Notifications_Bidding",
        ...docSnap.data(),
      }));
      setNotifications(mergeAndSortNotifications());
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bidding notifications:", error);
    });

    const unsubscribeRegular = onSnapshot(regularQuery, (snapshot) => {
      regularNotifs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        _collectionSource: "User_Notifications_Product",
        ...docSnap.data(),
      }));
      setNotifications(mergeAndSortNotifications());
      setLoading(false);
    }, (error) => {
      console.error("Error fetching standard product notifications:", error);
    });

    return () => {
      unsubscribeBidding();
      unsubscribeRegular();
    };
  }, [currentUser]);

  // Keep selected item payload state synced up with the unified realtime notification array updates
  useEffect(() => {
    if (selectedNotification) {
      const updatedItem = notifications.find(n => n.id === selectedNotification.id);
      if (updatedItem) {
        setSelectedNotification(updatedItem);
      }
    }
  }, [notifications]);

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
  const markAsRead = async (item) => {
    try {
      const targetCollection = item._collectionSource || "User_Notifications_Bidding";
      const notifDoc = doc(db, targetCollection, item.id);

      await updateDoc(notifDoc, {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleNotificationPress = (item) => {
    markAsRead(item);
    setSelectedNotification(item);
    setModalVisible(true);
  };

  const formatPeso = (amount) => {
    return "₱" + Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // ---------------- TIMESTAMP FORMATTER ----------------
  const formatTimeAgo = (createdAtField) => {
    if (!createdAtField) return "";
    
    const date = createdAtField.toDate ? createdAtField.toDate() : new Date(createdAtField.seconds * 1000 || createdAtField);
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

  // ---------------- ACCEPT BID METHOD WITH ATTEMPTS LIMIT ----------------
  const handleAccept = async (item) => {
    // Current click amount (default to 0 if field doesn't exist yet in firestore document)
    const attempts = item.acceptAttempts || 0;

    // Check if user has already consumed their allowed 2 attempts
    if (attempts >= 2) {
      Alert.alert("Notice", "Another customer has taken this order.");
      return;
    }

    try {
      const targetCollection = item._collectionSource || "User_Notifications_Bidding";
      const notifDoc = doc(db, targetCollection, item.id);

      // Persist the attempt locally and in Firebase right away
      await updateDoc(notifDoc, {
        acceptAttempts: increment(1)
      });

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
        productType: "Bidding",
      };

      navigation.navigate("CheckedOutBidding", {
        selectedItems: [formattedItem],
        notificationIds: [item.id],
        grandTotal: item.totalAmount || 0,
      });

    } catch (err) {
      console.error("Error updating accept attempts: ", err);
      Alert.alert("Connection Error", "Could not complete action. Please check your internet connection.");
    }
  };

  // ---------------- IMAGE RESOLVER ----------------
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
      style={[styles.notifItem, item.read && styles.readNotifItem]}
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
            style={[styles.productName, item.read && styles.readText]}
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

        <Text numberOfLines={2} style={[styles.message, item.read && styles.readTextSub]}>
          {item.acceptAttempts >= 2 ? "Another customer has taken this order." : (item.message || `Your order status update for ${item.productName || 'items'}`)}
        </Text>

        <View style={styles.metaRow}>
          {item.totalAmount !== undefined && item.totalAmount > 0 ? (
            <Text style={[styles.amount, item.acceptAttempts >= 2 && styles.disabledText]}>
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

  // Helper properties to structure the conditional modal render
  const isBidNotification = selectedNotification?.type === "BID_WINNER" || selectedNotification?.bidAmount;
  const isOrderTaken = selectedNotification?.acceptAttempts >= 2;

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

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
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
      )}

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotification && (
              <>
                <Image
                  source={getProductImage(selectedNotification)}
                  style={[styles.modalImage, isOrderTaken && { opacity: 0.5 }]}
                />

                <Text style={[styles.modalTitle, isOrderTaken && styles.disabledText]}>
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

                <Text style={[styles.modalMessage, isOrderTaken && styles.takenMessageText]}>
                  {isOrderTaken 
                    ? "Another customer has taken this order." 
                    : selectedNotification.message
                  }
                </Text>

                {selectedNotification.totalAmount !== undefined && selectedNotification.totalAmount > 0 && (
                  <Text style={[styles.modalAmount, isOrderTaken && styles.disabledText]}>
                    {formatPeso(selectedNotification.totalAmount)}
                  </Text>
                )}

                <View style={styles.modalActions}>
                  {isBidNotification && (
                    <TouchableOpacity
                      style={[
                        styles.modalButton, 
                        styles.acceptButton, 
                        isOrderTaken && styles.disabledButton
                      ]}
                      onPress={() => handleAccept(selectedNotification)}
                      disabled={isOrderTaken}
                    >
                      <Text style={styles.modalButtonText}>
                        {isOrderTaken ? "Order Taken" : "Accept Bid"}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.modalButton, 
                      styles.cancelButton, 
                      (!isBidNotification || isOrderTaken) && { flex: 1 }
                    ]}
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
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  listContent: { padding: 16, paddingBottom: 40 },
  notifItem: { 
    flex: 1,
    flexDirection: "row", 
    padding: 16, 
    backgroundColor: "#F8FAFC", 
    borderRadius: 16, 
    marginBottom: 12, 
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  readNotifItem: {
    backgroundColor: "#ffffff",
    borderColor: "#f1f5f9",
    opacity: 0.75
  },
  productImage: { width: 64, height: 64, borderRadius: 12, marginRight: 14, backgroundColor: '#E2E8F0' },
  notifInfo: { flex: 1 },
  notifHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productName: { fontSize: 16, fontWeight: "700", color: "#0f172a", letterSpacing: -0.3 },
  readText: { color: "#64748b" },
  readTextSub: { color: "#94a3b8" },
  newBadge: { backgroundColor: "#4f46e5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  vendorName: { fontSize: 13, color: "#4f46e5", marginTop: 2, fontWeight: "600" },
  message: { fontSize: 14, color: "#334155", marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  amount: { fontSize: 14, fontWeight: "700", color: "#4f46e5" },
  timestampText: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  emptyWrap: { alignItems: "center", justifyContent: "center", marginTop: 100, paddingHorizontal: 40 },
  emptyImg: { width: 140, height: 140, resizeMode: "contain" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 16 },
  emptySubText: { fontSize: 14, color: "#94A3B8", marginTop: 6, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "85%", backgroundColor: "#FFFFFF", borderRadius: 28, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 },
  modalImage: { width: 140, height: 140, borderRadius: 20, marginBottom: 16, backgroundColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0F172A", textAlign: "center", letterSpacing: -0.3 },
  modalVendor: { fontSize: 14, color: "#4f46e5", marginTop: 4, fontWeight: "600" },
  modalTimestamp: { fontSize: 12, color: "#94A3B8", marginTop: 4, fontWeight: "500" },
  modalMessage: { fontSize: 15, color: "#475569", textAlign: "center", marginTop: 12, lineHeight: 22 },
  modalAmount: { fontSize: 24, fontWeight: "800", color: "#4f46e5", marginTop: 16 },
  modalActions: { flexDirection: "row", marginTop: 24, gap: 12, width: "100%" },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  acceptButton: { backgroundColor: "#4f46e5" },
  cancelButton: { backgroundColor: "#F1F5F9" },
  modalButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  cancelButtonText: { color: "#475569", fontWeight: "600", fontSize: 15 },
  disabledButton: { backgroundColor: "#CBD5E1" },
  disabledText: { color: "#94A3B8", textDecorationLine: "line-through" },
  takenMessageText: { color: "#EF4444", fontWeight: "600" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 40,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: "500" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    position: "relative",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerIcon: { width: 20, height: 20 },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
});

export default UserNotificationsBidding;