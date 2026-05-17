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
// 4. CHOOSE WINNER & PUSH NOTIFICATION PAYLOAD
  const handleConfirmNotification = async () => {
    if (!selectedBidder || processingConfirm) return;
    setProcessingConfirm(true);
    try {
      const payload = {
        read: false,
        createdAt: serverTimestamp(),
        type: "BID_WINNER",
        userId: selectedBidder.userId,
        userName: selectedBidder.userName,
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
        bidAmount: selectedBidder.bidAmount,
        quantity: selectedBidder.quantity,
        totalAmount: selectedBidder.totalAmount,
        vendorId: bidding.uploadedBy?.uid || "",
        vendorBusinessName: bidding.uploadedBy?.businessName || "",
        vendorEmail: bidding.uploadedBy?.email || "",
        vendorProfileImage: bidding.uploadedBy?.vendorProfileImage || "",
        message: `🎉 You won the bid for ${bidding.productName}! Total: ₱${selectedBidder.totalAmount}`
      };

      await addDoc(collection(db, "User_Notifications_Bidding"), payload);

      setSuccessMessage(`Deal locked! ${selectedBidder.userName} has been notified.`);
      setShowSuccessModal(true);
      setConfirmModalVisible(false);
    } catch (err) {
      console.error("Acceptance processing error: ", err);
      setConfirmModalVisible(false);
      triggerNotification("Could not lock deal. Please verify connection and parameters.", "error");
    } finally {
      // FIX: Reset both the modal loader AND the item list spinner loader here
      setProcessingConfirm(false);
      setProcessingBidderId(null); 
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
                  <Ionicons name="trophy" size={10} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={styles.bestText}>LEADER</Text>
                </View>
              )}
            </View>
            <Text style={styles.bidMetaText}>
              {item.quantity}kg <Text style={styles.dotDivider}>•</Text> {formatPeso(item.bidAmount)}/kg
            </Text>
            <Text style={styles.totalPriceText}>
              Payout: <Text style={styles.payoutAmount}>{formatPeso(item.totalAmount)}</Text>
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
              <ActivityIndicator color={isTopBid ? "#fff" : "#4f46e5"} size="small" />
            ) : (
              <Text style={[styles.acceptBtnLabel, !isTopBid && { color: "#4f46e5" }]}>
                Accept
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.bidTimeText}>
            <Ionicons name="time-outline" size={11} color="#94a3b8" /> {formatBidTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.master}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" transparent={false} />

      {/* PREMIUM TOP SLIDING NOTIFICATION TOAST BANNER */}
      <Animated.View style={[
        styles.notificationBanner, 
        notification.type === "success" ? styles.notificationSuccess : styles.notificationError,
        { transform: [{ translateY: notificationY }] }
      ]}>
        <Ionicons 
          name={notification.type === "success" ? "checkmark-circle" : "alert-circle"} 
          size={20} 
          color={notification.type === "success" ? "#10b981" : "#ef4444"} 
        />
        <Text style={styles.notificationText} numberOfLines={2}>{notification.message}</Text>
      </Animated.View>

      {/* Elegant Nav Header */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>Bidding Dashboard</Text>
          <View style={[styles.totalTimerRow, isAuctionOver ? styles.timerEndedBg : styles.timerActiveBg]}>
            <Ionicons name="hourglass-outline" size={12} color={isAuctionOver ? "#ef4444" : "#f59e0b"} style={{ marginRight: 4 }} />
            <Text style={[styles.totalTimerSub, isAuctionOver ? styles.timerTextEnded : styles.timerTextActive]}>
              {isAuctionOver ? "Auction Ended" : timeLeft}
            </Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Visual Image Header */}
            <View style={styles.imageBox}>
              <Image source={{ uri: bidding.imageBase64 }} style={styles.heroImg} />
              <View style={styles.overlayPills}>
                <View style={[styles.timerPill, isAuctionOver && styles.urgentPill]}>
                  <View style={[styles.pulseDot, isAuctionOver ? { backgroundColor: "#ef4444" } : { backgroundColor: "#10b981" }]} />
                  <Text style={[styles.timerLabel, isAuctionOver && { color: "#ef4444" }]}>
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
                <View style={styles.badgeCount}>
                  <Text style={styles.revenueValue}>{bidders.length} Bids Tracked</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.leaderboardHeader}>
              <Ionicons name="trending-up" size={16} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={styles.leaderboardTitle}>Bidders Ranking</Text>
            </View>
          </View>
        }
        data={bidders}
        keyExtractor={(item) => item.id}
        renderItem={renderBidItem}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="file-tray-outline" size={40} color="#94a3b8" />
              </View>
              <Text style={styles.emptyMsg}>No competitive bids uploaded yet.</Text>
            </View>
          )
        }
      />

      {/* Premium Detached Confirmation Dialog Overlay */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContent}>
            <View style={styles.handle} />
            <View style={styles.alertIconHeader}>
              <Ionicons name="checkbox-outline" size={32} color="#4f46e5" />
            </View>
            <Text style={styles.sheetTitle}>Lock in Deal?</Text>
            <Text style={styles.sheetMessage}>
              Are you sure you want to sell to <Text style={{ fontWeight: "700", color: "#0f172a" }}>{selectedBidder?.userName}</Text>? 
              This will deduct <Text style={{ fontWeight: "700", color: "#4f46e5" }}>{selectedBidder?.quantity}kg</Text> from your available auction inventory.
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
               <Ionicons name="checkmark-circle" size={46} color="#fff" />
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
  master: { flex: 1, backgroundColor: "#f8fafc", marginTop: 35 },
  
  // --- CUSTOM INLINE TOAST ARCHITECTURE STYLES ---
  notificationBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 16,
    right: 16,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  notificationSuccess: {
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  notificationError: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  notificationText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  navTitleContainer: { alignItems: "center", flex: 1 },
  navTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", letterSpacing: -0.3 },
  totalTimerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 20 
  },
  timerActiveBg: { backgroundColor: "#fef3c7" },
  timerEndedBg: { backgroundColor: "#fee2e2" },
  totalTimerSub: { fontSize: 12, fontWeight: "600" },
  timerTextActive: { color: "#d97706" },
  timerTextEnded: { color: "#ef4444" },
  navBtn: { padding: 4, marginLeft: -4 },
  
  imageBox: { width: width, height: 260, position: "relative" },
  heroImg: { width: "100%", height: "100%", contentTransform: "cover" },
  overlayPills: { position: "absolute", bottom: 16, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  timerPill: { 
    backgroundColor: "#ffffff", 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    flexDirection: "row", 
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  urgentPill: { backgroundColor: "#fee2e2" },
  timerLabel: { fontWeight: "700", color: "#10b981", fontSize: 11, letterSpacing: 0.3 },
  stockPill: { backgroundColor: "#0f172a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  stockLabel: { color: "#ffffff", fontWeight: "600", fontSize: 11 },
  
  detailsBox: { padding: 24, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  pNameText: { fontSize: 24, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  revenueBox: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  revenueLabel: { color: "#64748b", fontSize: 14, fontWeight: "500" },
  badgeCount: { backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  revenueValue: { fontWeight: "600", color: "#334155", fontSize: 13 },
  
  leaderboardHeader: { flexDirection: "row", alignItems: "center", marginLeft: 20, marginTop: 24, marginBottom: 8 },
  leaderboardTitle: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  
  bidCard: { marginHorizontal: 16, marginTop: 12, backgroundColor: "#ffffff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  topBidHighlight: { borderColor: "#c7d2fe", backgroundColor: "#f5f3ff", shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
  bidMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nameContainer: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  bidderNameText: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  bestBadge: { backgroundColor: "#4f46e5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8, flexDirection: "row", alignItems: "center" },
  bestText: { color: "#ffffff", fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  bidMetaText: { fontSize: 14, color: "#64748b", fontWeight: "400" },
  dotDivider: { color: "#cbd5e1", marginHorizontal: 2 },
  totalPriceText: { fontSize: 14, fontWeight: "500", color: "#475569", marginTop: 6 },
  payoutAmount: { color: "#4f46e5", fontWeight: "700" },
  acceptBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  acceptBtnPrimary: { backgroundColor: "#4f46e5" },
  acceptBtnSecondary: { backgroundColor: "#f1f5f9" },
  acceptBtnLabel: { fontSize: 14, fontWeight: "600", color: "#ffffff" },
  cardFooter: { borderTopWidth: 1, borderTopColor: "#f1f5f9", marginTop: 12, paddingTop: 8 },
  bidTimeText: { fontSize: 11, color: "#94a3b8", fontWeight: "500", textAlign: "right" },
  
  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyMsg: { color: "#64748b", fontSize: 15, fontWeight: "500", textAlign: "center" },
  
  sheetOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.3)", justifyContent: "flex-end" },
  sheetContent: { backgroundColor: "#ffffff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  handle: { width: 36, height: 5, backgroundColor: "#e2e8f0", alignSelf: "center", borderRadius: 3, marginBottom: 24 },
  alertIconHeader: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#e0e7ff", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 10, letterSpacing: -0.5 },
  sheetMessage: { color: "#475569", fontSize: 15, lineHeight: 22, marginBottom: 28 },
  sheetActions: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  btnCancel: { flex: 1, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#f1f5f9" },
  btnCancelLabel: { color: "#64748b", fontWeight: "600", fontSize: 15 },
  btnConfirm: { flex: 2, backgroundColor: "#4f46e5", paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnConfirmLabel: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  
  successOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "center", alignItems: "center" },
  successCard: { width: "85%", backgroundColor: "#ffffff", borderRadius: 28, padding: 32, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 10 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#10b981", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  successHeadline: { fontSize: 24, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  successSubline: { textAlign: "center", color: "#475569", marginTop: 10, lineHeight: 22, fontSize: 15 },
  successCloseBtn: { marginTop: 28, backgroundColor: "#0f172a", width: "100%", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  successCloseLabel: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
});