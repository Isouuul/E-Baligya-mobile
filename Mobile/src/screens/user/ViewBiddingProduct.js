import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  runTransaction, 
  getDoc
} from 'firebase/firestore';

const ViewBiddingProduct = ({ route, navigation }) => {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentBids, setRecentBids] = useState([]);
  
  const [bidAmount, setBidAmount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [minQtyPerBid, setMinQtyPerBid] = useState(1);
  
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [isExpired, setIsExpired] = useState(false);

  // Animated value for price pulse effect
  const priceScale = useRef(new Animated.Value(1)).current;

  const getIncrementAmount = (price) => {
    const priceValue = parseFloat(price) || 0;
    if (priceValue < 500) {
      return 20;
    } else if (priceValue < 1000) {
      return 50;
    } else {
      return 100;
    }
  };

  const pulsePrice = () => {
    Animated.sequence([
      Animated.timing(priceScale, { toValue: 1.08, duration: 100, useNativeDriver: true }),
      Animated.timing(priceScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  // 1. LISTEN TO PRODUCT AND COMPETITIVE BIDS (REAL-TIME)
  useEffect(() => {
    const unsubProduct = onSnapshot(doc(db, 'Bidding_Products', productId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Trigger pulse if the highest bid increases
        if (product && data.currentHighestBid !== product.currentHighestBid) {
          pulsePrice();
        }

        setProduct({ id: docSnap.id, ...data });
        
        const minQty = data.minQtyPerBid ? parseInt(data.minQtyPerBid, 10) : 1;
        setMinQtyPerBid(minQty);
        setQuantity(minQty); // Set active counter starting point safely
        
        // Auto-set initial bid field to current highest + increment
        if (!bidAmount) {
          const baseOrHighest = data.currentHighestBid || data.basePrice;
          const increment = getIncrementAmount(baseOrHighest);
          const nextBid = data.currentHighestBid ? data.currentHighestBid + increment : data.basePrice;
          setBidAmount(nextBid.toString());
        }
      } else {
        Alert.alert("Error", "Product no longer available.");
        navigation.goBack();
      }
      setLoading(false);
    });

    const bidsRef = collection(db, 'RequestBidding', productId, 'Bids');
    const q = query(bidsRef, orderBy('bidAmount', 'desc'), limit(15));
    const unsubBids = onSnapshot(q, (snap) => {
      const bids = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecentBids(bids);
    });

    return () => { unsubProduct(); unsubBids(); };
  }, [productId, product?.currentHighestBid]);

  // 2. LIVE COUNTDOWN TIMER (Points to overallAuctionEndsAt)
  useEffect(() => {
    if (!product?.overallAuctionEndsAt) return;

    const calculateTimer = () => {
      const now = new Date().getTime();
      const end = product.overallAuctionEndsAt.toDate().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("ENDED");
        setIsExpired(true);
        return false;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
      setIsExpired(false);
      return true;
    };

    calculateTimer();
    const interval = setInterval(calculateTimer, 1000);

    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active") calculateTimer();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [product?.overallAuctionEndsAt]);

  const calculateTotal = () => {
    const pricePerKg = parseFloat(bidAmount) || 0;
    return (pricePerKg * quantity);
  };

  // 3. SECURE BID PLACEMENT TRANSACTION
// PLACE BID
  const handlePlaceBid = async () => {
    const bidValue = parseFloat(bidAmount);

    if (isNaN(bidValue) || bidValue <= 0) {
      return Alert.alert("Invalid Entry", "Please enter a valid bid.");
    }

    if (isExpired) {
      return Alert.alert("Bidding Closed", "Auction has ended.");
    }

    if (quantity < minQtyPerBid) {
      return Alert.alert("Minimum Quantity", `Minimum is ${minQtyPerBid}kg.`);
    }

    try {
      const userRef = doc(db, 'Users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw "User profile missing.";
      }

      const userData = userSnap.data();
      const fullName = `${userData.firstName} ${userData.lastName}`;
      const userRole = userData.role || 'Consumer';

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'Bidding_Products', productId);
        const pSnap = await transaction.get(productRef);

        if (!pSnap.exists()) throw "Product not found.";

        const currentData = pSnap.data();

        const currentHighest = currentData.currentHighestBid || 0;
        const basePrice = currentData.basePrice || 0;

        const priceToCheck = currentHighest > 0 ? currentHighest : basePrice;
        const increment = getIncrementAmount(priceToCheck);

        const minValidBid = currentHighest > 0
          ? currentHighest + increment
          : basePrice;

        // ✅ STOCK CHECK (FIXED LOCATION)
        if (currentData.remainingQuantity < quantity) {
          throw `Only ${currentData.remainingQuantity}kg remaining.`;
        }

        if (bidValue < minValidBid) {
          throw `Minimum bid is ₱${minValidBid}/kg`;
        }

        transaction.update(productRef, {
          currentHighestBid: bidValue,
          lastBidderId: auth.currentUser.uid,
          lastBidderName: fullName,
          lastBidTime: serverTimestamp(),
        });

        const newBidRef = doc(collection(db, 'RequestBidding', productId, 'Bids'));

        transaction.set(newBidRef, {
          userId: auth.currentUser.uid,
          userName: fullName,
          userRole,

          bidAmount: bidValue,
          quantity,
          totalAmount: Number((bidValue * quantity).toFixed(2)),
          createdAt: serverTimestamp(),

          productId,

          productSnapshot: {
            productName: currentData.productName,
            category: currentData.category,
            imageBase64: currentData.imageBase64,
            basePrice: currentData.basePrice,
            bidType: currentData.bidType,
            remainingQuantity: currentData.remainingQuantity,
            minQtyPerBid: currentData.minQtyPerBid || 1,
            overallAuctionEndsAt: currentData.overallAuctionEndsAt,
            premiumServices: currentData.premiumServices || []
          },

          vendorSnapshot: {
            uid: currentData.uploadedBy?.uid || "",
            email: currentData.uploadedBy?.email || "",
            businessName: currentData.uploadedBy?.businessName || "",
            vendorProfileImage: currentData.uploadedBy?.vendorProfileImage || ""
          }
        });
      });

      Alert.alert("Success", "Bid placed successfully!");
      setBidAmount('');

    } catch (e) {
      console.log("Bid error:", e);
      Alert.alert("Bid Rejected", e.toString());
    }
  };

  if (loading) {
    return (
      <View style={[styles.masterContainer, styles.centered]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.masterContainer, styles.centered]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={styles.masterContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.imageBase64 }} style={styles.mainImage} />
          <View style={styles.imageOverlayGradient} />
          <TouchableOpacity style={styles.backFab} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.timerRow}>
            <View style={styles.batchBadge}>
              <View style={styles.batchDot} />
              <Text style={styles.batchText}>LIVE AUCTION</Text>
            </View>
            <View style={[styles.countdownContainer, isExpired && styles.countdownUrgent]}>
              <Ionicons name="time" size={14} color={isExpired ? "#ef4444" : "#38bdf8"} />
              <Text style={[styles.countdownText, isExpired && { color: '#ef4444' }]}>
                {timeLeft}
              </Text>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.categoryText}>{product.category}</Text>
              {product.bidType && (
                <Text style={[styles.categoryText, { marginLeft: 8, color: '#f59e0b' }]}>
                  • {product.bidType}
                </Text>
              )}
            </View>
            <Text style={styles.stockText}>{product.remainingQuantity}kg Available</Text>
          </View>
          
          <Text style={styles.productName}>{product.productName}</Text>
          <Text style={styles.vendorText}>Vendor: {product.uploadedBy?.businessName}</Text>

          {/* Premium Overview Metrics Cards */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>STARTING BASE</Text>
              <Text style={styles.metricValue}>₱{product.basePrice}/kg</Text>
            </View>
            <View style={[styles.metricBlock, styles.metricBorderLeft]}>
              <Text style={styles.metricLabel}>CURRENT LEADER</Text>
              <Animated.Text style={[styles.metricValue, styles.metricAccent, { transform: [{ scale: priceScale }] }]}>
                ₱{product.currentHighestBid || product.basePrice}/kg
              </Animated.Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Pricing inputs fields */}
          <View style={styles.horizontalInputRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Order Qty</Text>
              <View style={styles.qtyContainer}>
                <TouchableOpacity onPress={() => setQuantity(q => Math.max(minQtyPerBid, q - 1))} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={16} color="#94a3b8" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity onPress={() => setQuantity(q => Math.min(product.remainingQuantity, q + 1))} style={styles.qtyBtn}>
                  <Ionicons name="add" size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1.4, marginLeft: 16 }]}>
              <Text style={styles.inputLabel}>Your Bid (₱/kg)</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.currency}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  keyboardType="numeric"
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  placeholderTextColor="#475569"
                />
              </View>
            </View>
          </View>

          {/* Active Leaders list section */}
          <View style={styles.leaderboardHeaderRow}>
            <Text style={styles.sectionTitle}>Live Leaderboard</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveIndicatorText}>Realtime Sync</Text>
            </View>
          </View>

          {recentBids.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="gavel" size={28} color="#334155" style={{ marginBottom: 6 }} />
              <Text style={styles.emptyText}>No competitive offers submitted yet.</Text>
            </View>
          ) : (
            recentBids.map((bid, i) => {
              const isLead = i === 0;
              const qty = parseFloat(bid.quantity) || 0;
              const pricePerKg = parseFloat(bid.bidAmount) || 0;
              const calculatedTotal = bid.totalAmount || (qty * pricePerKg);

              return (
                <View key={bid.id} style={[styles.bidCard, isLead && styles.leadBidHighlight]}>
                  <View style={[styles.rankNum, isLead && styles.rankNumLead]}>
                    <Text style={[styles.rankText, isLead && { color: '#38bdf8' }]}>
                      {isLead ? "👑" : `#${i + 1}`}
                    </Text>
                  </View>
                  
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.bidderName}>{bid.userName}</Text>
                    <Text style={styles.bidBreakdownText}>
                      {qty.toLocaleString()}kg × ₱{pricePerKg.toLocaleString()}/kg
                    </Text>
                  </View>
                  
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.bidTotalValue, isLead && { color: '#38bdf8' }]}>
                      ₱{calculatedTotal.toLocaleString()}
                    </Text>
                    <Text style={styles.bidSubText}>
                      ₱{pricePerKg.toLocaleString()}/kg
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Payout total sticky actions bottom bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarContent}>
          <View>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalPrice}>₱{calculateTotal().toLocaleString()}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.confirmBtn, isExpired && { backgroundColor: '#1e293b' }]} 
            onPress={handlePlaceBid} 
            disabled={isExpired}
          >
            <Text style={[styles.confirmText, isExpired && { color: '#475569' }]}>
              {isExpired ? "Bidding Closed" : "Place Bid"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ViewBiddingProduct;
const styles = StyleSheet.create({
  masterContainer: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  centered: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  imageContainer: { 
    position: 'relative',
    backgroundColor: '#f1f5f9'
  },
  mainImage: { 
    width: '100%', 
    height: 320, 
    resizeMode: 'cover' 
  },
  imageOverlayGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    opacity: 0.9
  },
  backFab: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 45, 
    left: 20, 
    backgroundColor: 'rgba(15, 23, 42, 0.75)', 
    width: 38,
    height: 38,
    borderRadius: 19, 
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  contentCard: { 
    paddingHorizontal: 20, 
    paddingTop: 16,
    backgroundColor: '#ffffff'
  },
  timerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  batchBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(16, 185, 129, 0.08)', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)'
  },
  batchDot: { 
    width: 6, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#10b981', 
    marginRight: 6 
  },
  batchText: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#10b981', 
    letterSpacing: 0.5 
  },
  countdownContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(14, 165, 233, 0.06)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.12)'
  },
  countdownUrgent: { 
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.15)'
  },
  countdownText: { 
    marginLeft: 6, 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#0284c7', 
    fontVariant: ['tabular-nums']
  },
  rowBetween: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 4
  },
  categoryText: { 
    color: '#64748b', 
    fontWeight: '600', 
    fontSize: 11, 
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  stockText: { 
    color: '#10b981', 
    fontWeight: '600', 
    fontSize: 13 
  },
  productName: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: '#0f172a', 
    marginTop: 2,
    letterSpacing: -0.3
  },
  vendorText: { 
    fontSize: 14, 
    color: '#475569',
    marginTop: 2,
    marginBottom: 20
  },
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center'
  },
  metricBorderLeft: {
    borderLeftWidth: 1,
    borderColor: '#e2e8f0'
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    fontVariant: ['tabular-nums']
  },
  metricAccent: {
    color: '#0284c7'
  },
  divider: { 
    height: 1, 
    backgroundColor: '#e2e8f0', 
    marginVertical: 20 
  },
  horizontalInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24
  },
  inputGroup: { 
    flexDirection: 'column' 
  },
  inputLabel: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#475569', 
    marginBottom: 8 
  },
  qtyContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#f8fafc', 
    borderRadius: 10, 
    height: 48, 
    borderWidth: 1, 
    borderColor: '#e2e8f0',
    paddingHorizontal: 8
  },
  qtyBtn: { 
    width: 32, 
    height: 32, 
    backgroundColor: '#e2e8f0', 
    borderRadius: 6, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  qtyText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a',
    fontVariant: ['tabular-nums']
  },
  priceContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    borderRadius: 10, 
    paddingHorizontal: 16, 
    height: 48, 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  currency: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#0284c7', 
    marginRight: 6 
  },
  priceInput: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a',
    padding: 0
  },
  leaderboardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0f172a',
    letterSpacing: -0.2
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284c7',
    marginRight: 6
  },
  liveIndicatorText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed'
  },
  emptyText: { 
    fontSize: 13,
    color: '#64748b', 
    textAlign: 'center' 
  },
  bidCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  leadBidHighlight: { 
    borderColor: 'rgba(14, 165, 233, 0.3)', 
    backgroundColor: 'rgba(14, 165, 233, 0.04)' 
  },
  rankNum: { 
    width: 32, 
    height: 32, 
    borderRadius: 8, 
    backgroundColor: '#e2e8f0', 
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  rankNumLead: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: '#0284c7'
  },
  rankText: { 
    color: '#475569', 
    fontWeight: '700', 
    fontSize: 12 
  },
  bidderName: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1e293b' 
  },
  bidBreakdownText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontVariant: ['tabular-nums']
  },
  bidTotalValue: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#0f172a',
    fontVariant: ['tabular-nums']
  },
  bidSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
    fontVariant: ['tabular-nums']
  },
  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    borderTopWidth: 1, 
    borderTopColor: '#e2e8f0', 
    paddingBottom: Platform.OS === 'ios' ? 34 : 16 
  },
  bottomBarContent: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20, 
    paddingTop: 16
  },
  totalLabel: { 
    fontSize: 10, 
    color: '#64748b', 
    fontWeight: '700', 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  totalPrice: { 
    fontSize: 22, 
    fontWeight: '700', 
    color: '#0f172a',
    fontVariant: ['tabular-nums']
  },
  confirmBtn: { 
    backgroundColor: '#0284c7', 
    paddingHorizontal: 24, 
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  confirmText: { 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 15 
  }
});