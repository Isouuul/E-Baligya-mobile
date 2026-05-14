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

    const notifRef = collection(db, "User_Notifications_Bidding");

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

      setNotifications(list);
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
      const notifDoc = doc(db, "User_Notifications_Bidding", notifId);

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

const handleAccept = (item) => {
    setModalVisible(false);

    // 1. Structure the selected item data clearly
    const formattedItem = {
      id: item.id,                        // Notification Document ID
      productId: item.productId,          // Underlying Product Doc ID
      productName: item.productName,
      category: item.category,
      imageBase64: item.imageBase64,
      
      // Financial Data Snapshot
      bidAmount: item.bidAmount,          // The winning price per kg (₱)
      quantity: item.quantity,            // Total kg bid for by the user
      totalAmount: item.totalAmount,      // Pre-calculated total: bidAmount * quantity
      basePrice: item.basePrice,
      
      // Vendor Information Snapshot
      vendorId: item.vendorId,
      vendorBusinessName: item.vendorBusinessName,
      vendorEmail: item.vendorEmail,
      vendorProfileImage: item.vendorProfileImage,

      // Flags and Arrays
      premiumServices: item.premiumServices || [],
      source: "notification",
    };

    // 2. Route seamlessly to CheckedOutBidding with full snapshots
    navigation.navigate("CheckedOutBidding", {
      selectedItems: [formattedItem],
      notificationIds: [item.id],
      grandTotal: item.totalAmount,       // Sending total aggregate cost as top-level param if needed
    });
  };
  // ---------------- FIXED IMAGE RESOLVER ----------------
  const getProductImage = (item) => {
    if (item?.productImage) return { uri: item.productImage };

    if (item?.imageUrl) return { uri: item.imageUrl };

    if (item?.imageBase64) {
      // supports base64 OR full data uri
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
            {item.productName}
          </Text>

          {!item.read && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        <Text style={styles.vendorName}>
          {item.vendorBusinessName}
        </Text>

        <Text numberOfLines={2} style={styles.message}>
          {item.message ||
            `You won the bid for ${item.productName}. Total: ${formatPeso(item.totalAmount)}`}
        </Text>

        <Text style={styles.amount}>
          {formatPeso(item.totalAmount)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // ---------------- UI ----------------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
              No new bidding notifications right now.
            </Text>
          </View>
        )}
      />

      {/* MODAL (unchanged UI) */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotification && (
              <>
                <Image
                  source={getProductImage(selectedNotification)}
                  style={styles.modalImage}
                />

                <Text style={styles.modalTitle}>
                  {selectedNotification.productName}
                </Text>

                <Text style={styles.modalVendor}>
                  {selectedNotification.vendorBusinessName}
                </Text>

                <Text style={styles.modalMessage}>
                  {selectedNotification.message}
                </Text>

                <Text style={styles.modalAmount}>
                  {formatPeso(selectedNotification.totalAmount)}
                </Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.acceptButton]}
                    onPress={() => handleAccept(selectedNotification)}
                  >
                    <Text style={styles.modalButtonText}>Accept Bid</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
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

export default UserNotificationsBidding;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  headerSafe: { 
    backgroundColor: '#fff', 
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingTop: StatusBar.currentHeight || 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  customHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, height: 70 },
  headerSideContainer: { width: 100, flexDirection: 'row', alignItems: 'center' },
  headerRightGroup: { justifyContent: 'flex-end' },
  headerTitleWrap: { flex: 1, alignItems: "left", justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
  headerSubTitle: { fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  iconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  headerAssetIcon: { width: 22, height: 22, resizeMode: 'contain' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  listContent: { padding: 16, paddingBottom: 100 },
  notifItem: { flexDirection: "row", backgroundColor: "#fff", padding: 14, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 5 }, shadowRadius: 15, elevation: 4 },
  productImage: { width: 85, height: 85, borderRadius: 14, backgroundColor: '#F8FAFC' },
  notifInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  notifHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productName: { fontWeight: "800", fontSize: 15, color: "#1E293B", flex: 1, marginRight: 8 },
  vendorName: { fontSize: 12, color: "#64748B", marginTop: 2, fontWeight: "700" },
  message: { fontSize: 13, color: "#475569", marginTop: 5, lineHeight: 18, opacity: 0.9 },
  amount: { fontWeight: "900", color: "#1E3A8A", marginTop: 8, fontSize: 16 },
  newBadge: { backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  newBadgeText: { color: "#1E3A8A", fontWeight: "800", fontSize: 9 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.75)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 28, padding: 24, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalImage: { width: 140, height: 140, marginBottom: 20, borderRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#1E3A8A", marginBottom: 4, textAlign: "center" },
  modalVendor: { fontSize: 14, color: "#64748B", marginBottom: 15, fontWeight: "700", textTransform: 'uppercase' },
  modalMessage: { fontSize: 15, color: "#334155", textAlign: "center", marginBottom: 20, lineHeight: 22, paddingHorizontal: 10 },
  modalText: { fontSize: 14, color: "#475569", marginBottom: 6, fontWeight: '500' },
  modalAmount: { fontSize: 28, fontWeight: "900", color: "#10B981", marginTop: 10 },
  modalActions: { flexDirection: "row", marginTop: 30, gap: 12 },
  modalButton: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { backgroundColor: "#1E3A8A" },
  cancelButton: { backgroundColor: "#F1F5F9" },
  modalButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancelButtonText: { color: "#64748B", fontWeight: "800", fontSize: 15 },
  emptyWrap: { alignItems: "center", marginTop: 100, paddingHorizontal: 40 },
  emptyImg: { width: 200, height: 200, opacity: 0.7 },
  emptyTitle: { marginTop: 24, color: "#1E293B", fontSize: 19, fontWeight: "800" },
  emptySubText: { marginTop: 10, color: "#94A3B8", fontSize: 14, textAlign: 'center', lineHeight: 20 },
});