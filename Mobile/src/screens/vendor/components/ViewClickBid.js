import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../../firebase";

const { width } = Dimensions.get("window");

const ViewClickBid = ({ route, navigation }) => {
  const { bidding: initialBidding } = route.params;
  const [bidding, setBidding] = useState(initialBidding);
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Countdown timer for the live auction
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [isAuctionOver, setIsAuctionOver] = useState(false);

  // Custom Sileo-styled UI States
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedBidder, setSelectedBidder] = useState(null);

  // Loading states for button submissions
  const [processingBidderId, setProcessingBidderId] = useState(null);
  const [processingConfirm, setProcessingConfirm] = useState(false);

  // --- PREMIUM INLINE NOTIFICATION SYSTEM STATE ---
  const [notification, setNotification] = useState({ visible: false, message: "", type: "error" });
  const notificationY = useRef(new Animated.Value(-100)).current;
  const notificationTimeout = useRef(null);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  // Helper to trigger the custom banner toast
  const triggerNotification = (message, type = "error") => {
    if (notificationTimeout.current) clearTimeout(notificationTimeout.current);

    setNotification({ visible: true, message, type });

    // Slide Down smoothly
    Animated.timing(notificationY, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Auto Hide after 4 seconds
    notificationTimeout.current = setTimeout(() => {
      Animated.timing(notificationY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setNotification({ visible: false, message: "", type: "error" });
      });
    }, 4000);
  };

  const formatPeso = (amount) => {
    return "₱" + Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatBidTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // 1. SYNC PRODUCT METADATA REAL-TIME
  useEffect(() => {
    if (!initialBidding?.id) return;
    const productRef = doc(db, "Bidding_Products", initialBidding.id);
    const unsubscribe = onSnapshot(productRef, (docSnap) => {
      if (docSnap.exists()) {
        setBidding({ id: docSnap.id, ...docSnap.data() });
      }
    });
    return () => unsubscribe();
  }, [initialBidding.id]);

  // 2. LIVE COUNTDOWN TIMER (Overall End Time Only)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (bidding?.overallAuctionEndsAt) {
        const totalEnd = bidding.overallAuctionEndsAt.toDate();
        const diff = totalEnd - now;

        if (diff <= 0) {
          setTimeLeft("00:00:00");
          setIsAuctionOver(true);
          clearInterval(interval);
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(
            `${h.toString().padStart(2, "0")}h ${m
              .toString()
              .padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
          );
          setIsAuctionOver(false);
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (notificationTimeout.current) clearTimeout(notificationTimeout.current);
    };
  }, [bidding]);

  // 3. LISTEN TO BIDS REAL-TIME (Ordered by Highest bidAmount)
  useEffect(() => {
    if (!bidding?.id) return;
    const bidsRef = collection(db, "RequestBidding", bidding.id, "Bids");
    const q = query(bidsRef, orderBy("bidAmount", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBidders(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [bidding.id]);

  // 4. CHOOSE WINNER & PUSH NOTIFICATION PAYLOAD
  const handleConfirmNotification = async () => {
    if (!selectedBidder || processingConfirm) return;
    setProcessingConfirm(true);
    try {
const payload = {
  read: false,
  createdAt: serverTimestamp(),

  type: "BID_WINNER",

  // USER (bidder)
  userId: selectedBidder.userId,
  userName: selectedBidder.userName,

  // PRODUCT SNAPSHOT (IMPORTANT)
  productId: bidding.id,
  productName: bidding.productName,
  category: bidding.category,
  imageBase64: bidding.imageBase64,

  basePrice: bidding.basePrice,
  bidType: bidding.bidType,

  remainingQuantity: bidding.remainingQuantity,
  minQtyPerBid: bidding.minQtyPerBid || 1,

  overallAuctionEndsAt: bidding.overallAuctionEndsAt,

  premiumServices: bidding.premiumServices || [],

  // BID DATA
  bidAmount: selectedBidder.bidAmount,
  quantity: selectedBidder.quantity,
  totalAmount: selectedBidder.totalAmount,

  // VENDOR SNAPSHOT
  vendorId: bidding.uploadedBy?.uid || "",
  vendorBusinessName: bidding.uploadedBy?.businessName || "",
  vendorEmail: bidding.uploadedBy?.email || "",
  vendorProfileImage: bidding.uploadedBy?.vendorProfileImage || "",

  message: `🎉 You won the bid for ${bidding.productName}! Total: ₱${selectedBidder.totalAmount}`
};

      // Push document to notifications collection
      await addDoc(collection(db, "User_Notifications_Bidding"), payload);

      // // Decrement the physical stock on the original active post
      // const productRef = doc(db, "Bidding_Products", bidding.id);
      // const newQty = Math.max(0, bidding.remainingQuantity - selectedBidder.quantity);
      // await updateDoc(productRef, { remainingQuantity: newQty });

      setSuccessMessage(`Deal locked! ${selectedBidder.userName} has been notified.`);
      setShowSuccessModal(true);
      setConfirmModalVisible(false);
    } catch (err) {
      console.error("Acceptance processing error: ", err);
      setConfirmModalVisible(false);
      // Native Alert replaced with modern clean inline banner execution
      triggerNotification("Could not lock deal. Please verify connection and parameters.", "error");
    } finally {
      setProcessingConfirm(false);
    }
  };

  const renderBidItem = ({ item, index }) => {
    const isTopBid = index === 0;
    return (
      <View style={[styles.bidCard, isTopBid && styles.topBidHighlight]}>
        <View style={styles.bidMain}>
          <View style={styles.bidInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.bidderNameText}>{item.userName}</Text>
              {isTopBid && (
                <View style={styles.bestBadge}>
                  <Text style={styles.bestText}>👑 LEADER</Text>
                </View>
              )}
            </View>
            <Text style={styles.bidMetaText}>
              {item.quantity}kg • {formatPeso(item.bidAmount)}/kg
            </Text>
            <Text style={styles.totalPriceText}>
              Payout: {formatPeso(item.totalAmount)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.acceptBtn,
              isTopBid ? styles.acceptBtnPrimary : styles.acceptBtnSecondary,
              processingBidderId === item.id && { opacity: 0.7 },
            ]}
            onPress={() => {
              setSelectedBidder(item);
              setConfirmModalVisible(true);
            }}
            disabled={processingBidderId !== null}
          >
            {processingBidderId === item.id ? (
              <ActivityIndicator color={isTopBid ? "#fff" : "#1e3a8a"} size="small" />
            ) : (
              <Text style={[styles.acceptBtnLabel, !isTopBid && { color: "#1e3a8a" }]}>
                Accept
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.bidTimeText}>{formatBidTime(item.createdAt)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.master}>
      <StatusBar barStyle="dark-content" />

      {/* PREMIUM TOP SLIDING NOTIFICATION TOAST BANNER */}
      <Animated.View style={[
        styles.notificationBanner, 
        notification.type === "success" ? styles.notificationSuccess : styles.notificationError,
        { transform: [{ translateY: notificationY }] }
      ]}>
        <Ionicons 
          name={notification.type === "success" ? "checkmark-circle" : "alert-circle"} 
          size={18} 
          color={notification.type === "success" ? "#16a34a" : "#dc2626"} 
        />
        <Text style={styles.notificationText} numberOfLines={2}>{notification.message}</Text>
      </Animated.View>

      {/* Elegant Nav Header */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>Bidding Dashboard</Text>
          <View style={styles.totalTimerRow}>
            <Ionicons name="time-outline" size={13} color="#ef4444" style={{ marginRight: 3 }} />
            <Text style={styles.totalTimerSub}>
              {isAuctionOver ? "Auction Ended" : `Time Remaining: ${timeLeft}`}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Visual Glassmorphic Image Header */}
            <View style={styles.imageBox}>
              <Image source={{ uri: bidding.imageBase64 }} style={styles.heroImg} />
              <View style={styles.overlayPills}>
                <View style={[styles.timerPill, isAuctionOver && styles.urgentPill]}>
                  <Text style={[styles.timerLabel, isAuctionOver && { color: "#fff" }]}>
                    {isAuctionOver ? "EXPIRED" : "LIVE AUCTION"}
                  </Text>
                </View>
                <View style={styles.stockPill}>
                  <Text style={styles.stockLabel}>{bidding.remainingQuantity}kg Available</Text>
                </View>
              </View>
            </View>

            {/* General Overview Summary card */}
            <View style={styles.detailsBox}>
              <Text style={styles.pNameText}>{bidding.productName}</Text>
              <View style={styles.revenueBox}>
                <Text style={styles.revenueLabel}>Active Competitive Offers</Text>
                <Text style={styles.revenueValue}>{bidders.length} Bids Tracked</Text>
              </View>
            </View>
            
            <Text style={styles.leaderboardTitle}>Bidders Ranking</Text>
          </View>
        }
        data={bidders}
        keyExtractor={(item) => item.id}
        renderItem={renderBidItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="stats-chart-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyMsg}>No competitive bids uploaded yet.</Text>
            </View>
          )
        }
      />

      {/* Premium Obsidian Confirmation Dialog Overlay */}
      <Modal visible={confirmModalVisible} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContent}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Lock in Deal?</Text>
            <Text style={styles.sheetMessage}>
              Are you sure you want to sell to <Text style={{ fontWeight: "bold", color: "#0f172a" }}>{selectedBidder?.userName}</Text>? 
              This will deduct <Text style={{ fontWeight: "bold" }}>{selectedBidder?.quantity}kg</Text> from your available auction inventory.
            </Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setConfirmModalVisible(false)} disabled={processingConfirm}>
                <Text style={styles.btnCancelLabel}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btnConfirm, processingConfirm && { opacity: 0.7 }]} 
                onPress={() => {
                  setProcessingBidderId(selectedBidder?.id);
                  handleConfirmNotification();
                }}
                disabled={processingConfirm}
              >
                {processingConfirm ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnConfirmLabel}>Accept Deal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Premium Notification Sent Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
               <Ionicons name="checkmark-sharp" size={42} color="#fff" />
            </View>
            <Text style={styles.successHeadline}>Bid Confirmed</Text>
            <Text style={styles.successSubline}>{successMessage}</Text>
            <TouchableOpacity style={styles.successCloseBtn} onPress={() => setShowSuccessModal(false)}>
              <Text style={styles.successCloseLabel}>Continue Monitoring</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ViewClickBid;

const styles = StyleSheet.create({
  master: { flex: 1, backgroundColor: "#f8fafc" },
  
  // --- CUSTOM INLINE TOAST ARCHITECTURE STYLES ---
  notificationBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  notificationSuccess: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  notificationError: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  notificationText: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 10,
    flex: 1,
  },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  navTitleContainer: { alignItems: "center" },
  navTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  totalTimerRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  totalTimerSub: { fontSize: 11, color: "#ef4444", fontWeight: "700" },
  navBtn: { padding: 4 },
  imageBox: { width: width, height: 240, position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  overlayPills: { position: "absolute", bottom: 15, left: 15, right: 15, flexDirection: "row", justifyContent: "space-between" },
  timerPill: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, elevation: 4 },
  urgentPill: { backgroundColor: "#ef4444" },
  timerLabel: { fontWeight: "900", color: "#1e3a8a", fontSize: 11, letterSpacing: 0.5 },
  stockPill: { backgroundColor: "#1e3a8a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stockLabel: { color: "#fff", fontWeight: "800", fontSize: 11 },
  detailsBox: { padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  pNameText: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  revenueBox: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  revenueLabel: { color: "#64748b", fontSize: 13, fontWeight: "500" },
  revenueValue: { fontWeight: "800", color: "#1e3a8a" },
  leaderboardTitle: { fontSize: 13, fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginLeft: 20, marginTop: 20, marginBottom: 5 },
  
  bidCard: { marginHorizontal: 15, marginTop: 12, backgroundColor: "#fff", borderRadius: 16, padding: 15, borderWidth: 1, borderColor: "#e2e8f0" },
  topBidHighlight: { borderColor: "#1e3a8a", borderWidth: 2, backgroundColor: "#eff6ff" },
  bidMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameContainer: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  bidderNameText: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  bestBadge: { backgroundColor: "#1e3a8a", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8 },
  bestText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  bidMetaText: { fontSize: 13, color: "#64748b" },
  totalPriceText: { fontSize: 14, fontWeight: "800", color: "#1e3a8a", marginTop: 4 },
  acceptBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  acceptBtnPrimary: { backgroundColor: "#1e3a8a" },
  acceptBtnSecondary: { backgroundColor: "#f1f5f9" },
  acceptBtnLabel: { fontSize: 13, fontWeight: "800", color: "#fff" },
  bidTimeText: { fontSize: 10, color: "#94a3b8", marginTop: 10, textAlign: "right" },
  
  emptyState: { alignItems: "center", marginTop: 80 },
  emptyMsg: { color: "#94a3b8", marginTop: 10, fontSize: 14, fontWeight: "600" },
  
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  sheetContent: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 25, paddingVertical: 30 },
  handle: { width: 40, height: 4, backgroundColor: "#e2e8f0", alignSelf: "center", borderRadius: 2, marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 10 },
  sheetMessage: { color: "#64748b", fontSize: 14, lineHeight: 22, marginBottom: 25 },
  sheetActions: { flexDirection: "row", justifyContent: "space-between" },
  btnCancel: { flex: 1, paddingVertical: 15, alignItems: "center" },
  btnCancelLabel: { color: "#94a3b8", fontWeight: "700", fontSize: 15 },
  btnConfirm: { flex: 2, backgroundColor: "#1e3a8a", paddingVertical: 15, borderRadius: 15, alignItems: "center" },
  btnConfirmLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },
  
  successOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.75)", justifyContent: "center", alignItems: "center" },
  successCard: { width: "85%", backgroundColor: "#fff", borderRadius: 24, padding: 30, alignItems: "center" },
  successIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#1e3a8a", justifyContent: "center", alignItems: "center", marginBottom: 15 },
  successHeadline: { fontSize: 22, fontWeight: "900", color: "#0f172a", marginTop: 10 },
  successSubline: { textAlign: "center", color: "#64748b", marginTop: 8, lineHeight: 20, fontSize: 14 },
  successCloseBtn: { marginTop: 25, backgroundColor: "#0f172a", width: "100%", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  successCloseLabel: { color: "#fff", fontWeight: "800" },
});