import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Firebase imports 
import { db, auth } from "../../../firebase"; 
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch 
} from "firebase/firestore";

export default function VendorNotificationModal({ visible, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!visible || !user) return;

    setLoading(true);

    // 1. Define queries for all target collections where this vendor is the recipient
    const biddingBidsQuery = query(
      collection(db, "Vendor_Bidding_Place_Bid"),
      where("vendorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const productQuery = query(
      collection(db, "Vendor_Notifications_Product"),
      where("vendorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    // Keep state snapshots local to track incoming data fragments per collection
    let bidsData = [];
    let productsData = [];

    // Helper function to bundle, sort, and parse arrays together seamlessly
    const combineAndEmit = () => {
      const combined = [...bidsData, ...productsData];
      
      // Sort collections globally by date (newest first)
      combined.sort((a, b) => {
        const timeA = a.rawCreatedAt?.toMillis ? a.rawCreatedAt.toMillis() : 0;
        const timeB = b.rawCreatedAt?.toMillis ? b.rawCreatedAt.toMillis() : 0;
        return timeB - timeA;
      });

      setNotifications(combined);
      setLoading(false);
    };

    // 2. Setup Real-time Listener for: Vendor_Bidding_Place_Bid
    const unsubscribeBids = onSnapshot(biddingBidsQuery, (snapshot) => {
      bidsData = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          collectionTarget: "Vendor_Bidding_Place_Bid", // Track origin for updates
          ...data,
          rawCreatedAt: data.createdAt,
          timeString: data.createdAt?.toDate 
            ? formatTime(data.createdAt.toDate()) 
            : "Just now"
        };
      });
      combineAndEmit();
    }, (err) => console.error("Error fetching Bid notifications:", err));

    // 3. Setup Real-time Listener for: Vendor_Notifications_Product (Cart & Buy Now)
    const unsubscribeProducts = onSnapshot(productQuery, (snapshot) => {
      productsData = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          collectionTarget: "Vendor_Notifications_Product", // Track origin for updates
          ...data,
          rawCreatedAt: data.createdAt,
          timeString: data.createdAt?.toDate 
            ? formatTime(data.createdAt.toDate()) 
            : "Just now"
        };
      });
      combineAndEmit();
    }, (err) => console.error("Error fetching Product notifications:", err));

    // Clean up all active listeners when modal closes or unmounts
    return () => {
      unsubscribeBids();
      unsubscribeProducts();
    };
  }, [visible]);

  // Helper function to turn dates into readable timestamp labels
  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  // Mass update handler to mark ALL structured notifications across collections as read
  const handleMarkAllRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach((noti) => {
        // Dynamically routing references using saved unique origin string
        const docRef = doc(db, noti.collectionTarget, noti.id);
        batch.update(docRef, { isRead: true });
      });

      await batch.commit();
    } catch (error) {
      console.error("Failed marking notifications read: ", error);
    }
  };

  // Single-item update handler when a vendor taps an individual item
  const handleItemPress = async (id, collectionTarget, isRead) => {
    if (isRead) return; 
    try {
      const docRef = doc(db, collectionTarget, id);
      await updateDoc(docRef, { isRead: true });
    } catch (error) {
      console.error("Error updating notification status:", error);
    }
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          
          <TouchableWithoutFeedback>
            <View style={styles.dropdownCard}>
              <View style={styles.arrowUp} />
              
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Notifications</Text>
                {notifications.some(n => !n.isRead) && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={styles.markReadText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loading ? (
                <View style={styles.centerState}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.centerState}>
                  <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      onPress={() => handleItemPress(item.id, item.collectionTarget, item.isRead)}
                      activeOpacity={0.7}
                      style={[styles.notiItem, !item.isRead && styles.notiUnread]}
                    >
                      <View style={styles.notiIconWrapper}>
                        <Ionicons 
                          name={
                            item.type === 'bid_accepted' 
                              ? "trophy-outline" 
                              : !item.isRead ? "ellipse" : "mail-open-outline"
                          } 
                          size={item.type === 'bid_accepted' ? 14 : 10} 
                          color={!item.isRead ? "#3b82f6" : "#94a3b8"} 
                        />
                      </View>
                      <View style={styles.notiContent}>
                        <Text style={[styles.notiTitle, !item.isRead && styles.notiTitleUnread]}>
                          {item.title}
                        </Text>
                        <Text style={styles.notiBody} numberOfLines={2}>
                          {item.message}
                        </Text>
                        <Text style={styles.notiOrderNumber}>
                          Order: {item.orderNumber}
                        </Text>
                        <Text style={styles.notiTime}>{item.timeString}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableWithoutFeedback>

        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  dropdownCard: {
    position: "absolute",
    top: 95,
    right: 16,
    width: 320,
    maxHeight: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    paddingVertical: 10,
  },
  arrowUp: {
    position: "absolute",
    top: -8,
    right: 22,
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#fff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  markReadText: { fontSize: 12, color: "#3b82f6", fontWeight: "600" },
  
  notiItem: {
    flexDirection: "row",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  notiUnread: { backgroundColor: "#eff6ff" },
  notiIconWrapper: { marginRight: 10, marginTop: 4, width: 16, alignItems: 'center' },
  notiContent: { flex: 1 },
  notiTitle: { fontSize: 13, color: "#475569", fontWeight: "500" },
  notiTitleUnread: { color: "#1e293b", fontWeight: "700" },
  notiBody: { fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 16 },
  notiOrderNumber: { fontSize: 11, color: "#3b82f6", fontWeight: "600", marginTop: 2 },
  notiTime: { fontSize: 10, color: "#94a3b8", marginTop: 4 },
  
  centerState: { padding: 40, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#94a3b8", fontSize: 13 },
});