// src/screens/Users/NotificationModal.js
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
  Alert,
  Dimensions,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db } from "../../firebase";
import { Feather } from "@expo/vector-icons";

import NoOrderImg from '../../../assets/no-order.png';

const { height, width } = Dimensions.get("window");

export default function NotificationModal({ visible, onClose, navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // ---------------- REALTIME NOTIFICATIONS SYSTEM ----------------
  useEffect(() => {
    if (!currentUser || !visible) return;

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
  }, [currentUser, visible]);

  useEffect(() => {
    if (selectedNotification) {
      const updatedItem = notifications.find(n => n.id === selectedNotification.id);
      if (updatedItem) {
        setSelectedNotification(updatedItem);
      }
    }
  }, [notifications]);

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
    setDetailModalVisible(true);
  };

  const formatPeso = (amount) => {
    return "₱" + Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // ---------------- UPDATED TIME AGO FORMATTER (FULL WORDS) ----------------
  const formatTimeAgo = (createdAtField) => {
    if (!createdAtField) return "";
    
    const date = createdAtField.toDate ? createdAtField.toDate() : new Date(createdAtField.seconds * 1000 || createdAtField);
    const now = new Date();
    const diffMs = now - date;
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    
    // Minutes handling
    if (diffMins < 60) {
      return diffMins === 1 ? "1 minute ago" : `${diffMins} minutes ago`;
    }
    
    // Hours handling
    if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    }
    
    // Days handling
    if (diffDays < 7) {
      return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
    }
    
    // Fallback to exact calendar date if older than a week
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  };

  const handleAccept = async (item) => {
    const attempts = item.acceptAttempts || 0;
    if (attempts >= 2) {
      Alert.alert("Notice", "Another customer has taken this order.");
      return;
    }

    try {
      const targetCollection = item._collectionSource || "User_Notifications_Bidding";
      const notifDoc = doc(db, targetCollection, item.id);

      await updateDoc(notifDoc, { acceptAttempts: increment(1) });

      setDetailModalVisible(false);
      onClose();

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
      console.error(err);
      Alert.alert("Connection Error", "Could not complete action.");
    }
  };

  const getProductImage = (item) => {
    if (item?.imageUrl) return { uri: item.imageUrl };
    if (item?.productImage) return { uri: item.productImage };
    if (Array.isArray(item?.items) && item.items[0]?.productImage) {
      return { uri: item.items[0].productImage };
    }
    if (item?.imageBase64) {
      return { uri: item.imageBase64.startsWith("data:") ? item.imageBase64 : `data:image/jpeg;base64,${item.imageBase64}` };
    }
    return require("../../../assets/Trash.png");
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notifItem, item.read && styles.readNotifItem]} 
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.75}
    >
      <Image source={getProductImage(item)} style={styles.productImage}/>
      <View style={styles.notifInfo}>
        <View style={styles.notifHeaderRow}>
          <Text style={[styles.productName, item.read && styles.readText]} numberOfLines={1}>
            {item.productName || item.title || "Order Update"}
          </Text>
          {!item.read && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
        </View>
        <Text numberOfLines={1} style={[styles.message, item.read && styles.readTextSub]}>
          {item.acceptAttempts >= 2 ? "Another customer has taken this order." : (item.message || "Status update")}
        </Text>
        <View style={styles.metaRow}>
          {item.totalAmount > 0 && <Text style={styles.amount}>{formatPeso(item.totalAmount)}</Text>}
          <Text style={styles.timestampText}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const isBidNotification = selectedNotification?.type === "BID_WINNER" || selectedNotification?.bidAmount;
  const isOrderTaken = selectedNotification?.acceptAttempts >= 2;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlayContainer} activeOpacity={1} onPress={onClose}>
        
        <View style={styles.dropdownWrapper}>
          <View style={styles.dropdownArrow} />
          
          <View style={styles.dropdownContent} onStartShouldSetResponder={() => true}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Notifications</Text>
              {notifications.length > 0 && !loading && (
                <Text style={styles.countIndicator}>{notifications.filter(n => !n.read).length} unread</Text>
              )}
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }}/>
            ) : (
              <FlatList 
                data={notifications} 
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                style={styles.listMaxConstraints}
                showsVerticalScrollIndicator={true}
                ListEmptyComponent={() => (
                  <View style={styles.emptyWrap}>
                    <Image source={NoOrderImg} style={styles.emptyImg}/>
                    <Text style={styles.emptyTitle}>All caught up!</Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>

      </TouchableOpacity>

      <Modal visible={detailModalVisible} transparent={true} animationType="fade" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNotification && (
              <>
                <Image source={getProductImage(selectedNotification)} style={[styles.modalImage, isOrderTaken && { opacity: 0.5 }]}/>
                <Text style={styles.modalTitle}>{selectedNotification.productName || selectedNotification.title}</Text>
                {selectedNotification.vendorBusinessName && <Text style={styles.modalVendor}>{selectedNotification.vendorBusinessName}</Text>}
                
                <Text style={styles.modalMessage}>
                  {isOrderTaken ? "Another customer has taken this order." : selectedNotification.message}
                </Text>

                {selectedNotification.totalAmount > 0 && (
                  <Text style={styles.modalAmount}>{formatPeso(selectedNotification.totalAmount)}</Text>
                )}

                <View style={styles.modalActions}>
                  {isBidNotification && (
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.acceptButton, isOrderTaken && styles.disabledButton]} 
                      onPress={() => handleAccept(selectedNotification)}
                      disabled={isOrderTaken}
                    >
                      <Text style={styles.modalButtonText}>{isOrderTaken ? "Order Taken" : "Accept Bid"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton, (!isBidNotification || isOrderTaken) && { flex: 1 }]} 
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
  },
  dropdownWrapper: {
    position: "absolute",
    top: 65, 
    right: 20, 
    width: 320, 
    alignItems: 'flex-end',
  },
  dropdownArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFFFFF",
    marginRight: 13, 
  },
  dropdownContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FAFAFA"
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  countIndicator: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20
  },
  listMaxConstraints: {
    maxHeight: 360, 
  },
  notifItem: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    backgroundColor: "#F8FAFC", 
    alignItems: "center",
  },
  readNotifItem: {
    backgroundColor: "#FFFFFF",
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    marginRight: 12,
  },
  notifInfo: {
    flex: 1,
    justifyContent: "center",
  },
  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 4,
  },
  readText: {
    fontWeight: "500",
    color: "#475569",
  },
  newBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },
  message: {
    fontSize: 12,
    color: "#334155",
    marginTop: 2,
    fontWeight: "600",
  },
  readTextSub: {
    color: "#64748B",
    fontWeight: "400",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  amount: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  timestampText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "500",
    marginLeft: "auto",
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyImg: {
    width: 60,
    height: 60,
    resizeMode: "contain",
    opacity: 0.6,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    width: width * 0.85,
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  modalImage: {
    width: width * 0.45,
    height: width * 0.45,
    borderRadius: 16,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  modalVendor: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "700",
    marginTop: 2,
  },
  modalMessage: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginVertical: 12,
    lineHeight: 20,
  },
  modalAmount: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2563EB",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: "#2563EB",
  },
  disabledButton: {
    backgroundColor: "#CBD5E1",
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelButtonText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
  },
});