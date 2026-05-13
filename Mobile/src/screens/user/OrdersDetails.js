import React, { useEffect, useState } from 'react';
import { 
  View, Text, StatusBar, FlatList, ActivityIndicator, StyleSheet, 
  SafeAreaView, TouchableOpacity, Image, TextInput, ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { 
  collection, query, where, onSnapshot, doc, 
  setDoc, deleteDoc, serverTimestamp, getDocs // Add getDocs here
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const STATUSES = ['Pending', 'Preparing', 'To Deliver', 'Complete', 'Cancelled'];

const statusColors = {
  Pending: '#F59E0B',
  Preparing: '#3B82F6',
  'To Deliver': '#10B981',
  Complete: '#6366F1',
  Cancelled: '#EF4444',
};

const statusImages = {
  Pending: require('../../../assets/Pending.png'),
  Preparing: require('../../../assets/Preparing.png'),
  'To Deliver': require('../../../assets/ToDeliver.png'),
  Complete: require('../../../assets/Complete.png'),
  Cancelled: require('../../../assets/Complete.png'),
};

const OrdersDetails = () => {
  const [orders, setOrders] = useState([]);
  const [toDeliverOrders, setToDeliverOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sileo Modal State
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '', message: '', type: 'info', confirmText: 'OK', cancelText: null, onConfirm: null,
  });

  const [submittingRating, setSubmittingRating] = useState(false);
// highlighted 
  const [ratings, setRatings] = useState({}); 

  const handleStarPress = (orderId, value) => {
  setRatings(prev => ({
    ...prev,
    [orderId]: {
      ...prev[orderId],
      stars: value
    }
  }));
};

const handleFeedbackChange = (orderId, text) => {
  setRatings(prev => ({
    ...prev,
    [orderId]: {
      ...prev[orderId],
      feedback: text
    }
  }));
};

  const navigation = useNavigation();
  const userId = auth.currentUser?.uid;

  const showSileo = (config) => {
    setSileoConfig({ ...config });
    setSileoVisible(true);
  };

  const handleSileoConfirm = async () => {
    const action = sileoConfig.onConfirm;
    setSileoVisible(false);
    if (typeof action === 'function') await action();
  };

  // Real-time Listeners
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'Orders'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'To_Deliver_Orders'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setToDeliverOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'Completed_Orders'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setCompletedOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [userId]);

const handleSubmitRating = async (order) => {
  const currentRating = ratings[order.id]?.stars || 0;
  const currentFeedback = ratings[order.id]?.feedback || '';

  if (currentRating === 0) {
    showSileo({ 
      title: 'Wait!', 
      message: 'Please select a star rating.', 
      type: 'warning' 
    });
    return;
  }

  setSubmittingRating(true);

  try {
    const reviewId = `review_${order.id}`;
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error("User not authenticated");

    // 1. Get unique vendor UIDs from the order items
    const uniqueVendorUids = [...new Set(order.items.map(item => item.uploadedBy.uid))];

    // 2. Build the review data using the name fields from your Order document
    const reviewData = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: currentUser.uid,
      // Pulling from the names you saved during checkout
      userName: `${order.userFirstName || ''} ${order.userLastName || ''}`.trim() || 'Customer',
      userProfileImage: order.userProfileImage || null, 
      rating: currentRating,
      feedback: currentFeedback,
      createdAt: serverTimestamp(),
    };

    // 3. Save to the main Reviews collection
    await setDoc(doc(db, 'Reviews', reviewId), {
      ...reviewData,
      vendorIds: uniqueVendorUids
    });

    // 4. Save to each Vendor's specific Rating subcollection
    const ratingPromises = uniqueVendorUids.map(async (vUid) => {
      // Find the document ID in ApprovedVendors that matches this userId (vUid)
      const vendorQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", vUid));
      const vendorSnap = await getDocs(vendorQuery);
      
      if (!vendorSnap.empty) {
        const vendorDocId = vendorSnap.docs[0].id;
        const vendorRatingRef = doc(db, 'ApprovedVendors', vendorDocId, 'Rating', reviewId);
        return setDoc(vendorRatingRef, reviewData);
      }
    });

    await Promise.all(ratingPromises);

    // 5. Update status in Completed_Orders (or wherever you track rated status)
    const orderRef = doc(db, 'Completed_Orders', order.id);
    await setDoc(orderRef, { isRated: true }, { merge: true });

    showSileo({
      title: 'Thank you!',
      message: 'Your feedback helps our fishery community grow.',
      type: 'success',
    });

  } catch (error) {
    console.error("Error submitting rating: ", error);
    showSileo({ 
      title: 'Error', 
      message: 'Failed to submit rating. Please try again.', 
      type: 'error' 
    });
  } finally {
    setSubmittingRating(false);
  }
};

  const sourceOrders = activeStatus === 'To Deliver' ? toDeliverOrders : activeStatus === 'Complete' ? completedOrders : orders;
  const filteredOrders = sourceOrders.filter(o => {
    const matchesStatus = activeStatus === 'To Deliver' || activeStatus === 'Complete' ? true : o.status === activeStatus;
    const matchesSearch = searchQuery === '' || o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusCount = (status) => {
    if (status === 'To Deliver') return toDeliverOrders.length;
    if (status === 'Complete') return completedOrders.length;
    return orders.filter(o => o.status === status).length;
  };

  const renderOrderItem = ({ item }) => {
    const total = (item.items || []).reduce((sum, i) => sum + (Number(i.basePrice || 0) * (i.quantity || 1)), 0);

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={() => navigation.navigate('ViewOrderDetails', { order: item })}
          style={styles.orderHeader}
        >
          <View>
            <Text style={styles.orderNumberLabel}>Order Number</Text>
            <Text style={styles.orderNumberValue}>#{item.orderNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
            <Text style={[styles.statusBadgeText, { color: statusColors[item.status] }]}>{item.status}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {item.items.map((i, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Image source={i.productImage ? { uri: i.productImage } : null} style={styles.itemImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{i.productName}</Text>
              <Text style={styles.itemQty}>Qty: {i.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>₱{Number(i.basePrice).toLocaleString()}</Text>
          </View>
        ))}

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₱{total.toLocaleString()}</Text>
          </View>
        </View>

        {/* PREMIUM RATING SECTION */}
        {activeStatus === 'Complete' && (
          item.isRated ? (
            <View style={styles.ratedContainer}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.ratedText}>Shop Rated Successfully</Text>
            </View>
          ) : (
            <View style={styles.ratingSection}>
              <View style={styles.divider} />
              <Text style={styles.ratingTitle}>Rate your experience</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map(num => (
                  <TouchableOpacity key={num} onPress={() => handleStarPress(item.id, num)}>
                    <Ionicons 
                      name={(ratings[item.id]?.stars || 0) >= num ? 'star' : 'star-outline'} 
                      size={30} 
                      color={(ratings[item.id]?.stars || 0) >= num ? '#F59E0B' : '#CBD5E1'} 
                      style={{ marginHorizontal: 4 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
<TextInput
  style={styles.feedbackInput}
  placeholder="How was the quality of the fish? (Optional)"
  placeholderTextColor="#94A3B8"
  multiline
  value={ratings[item.id]?.feedback || ''}
  onChangeText={(text) => handleFeedbackChange(item.id, text)}
/>
              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={() => handleSubmitRating(item)}
                disabled={submittingRating}
              >
                {submittingRating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Review</Text>}
              </TouchableOpacity>
            </View>
          )
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>My Orders</Text>
        <View style={styles.iconCircle}>
           <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#1E3A8A" />
        </View>
      </View>

      {/* SEARCH */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94A3B8" style={{marginLeft: 12}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your orders..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* STATUS TABS */}
      <View>
        <FlatList
          data={STATUSES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item}
          contentContainerStyle={styles.statusListContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.statusItem}
              activeOpacity={0.8}
              onPress={() => setActiveStatus(item)}
            >
              <View style={[styles.statusIconWrapper, activeStatus === item && styles.statusIconWrapperActive]}>
                <Image source={statusImages[item]} style={styles.statusIcon} />
              </View>
              <Text style={[styles.statusTabText, activeStatus === item && styles.statusTabTextActive]}>{item}</Text>
              <View style={[styles.countBadge, activeStatus === item ? styles.activeCountBadge : styles.inactiveCountBadge]}>
                <Text style={[styles.countText, activeStatus === item && styles.activeCountText]}>{getStatusCount(item)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ORDERS LIST */}
      <FlatList
        data={filteredOrders}
        keyExtractor={item => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant" size={80} color="#E2E8F0" />
            <Text style={styles.emptyText}>No {activeStatus} orders found</Text>
          </View>
        )}
      />

      {/* SILEO MODAL (Implementation from your code) */}
      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View style={[styles.sileoIconCircle, styles[`sileo${sileoConfig.type.charAt(0).toUpperCase() + sileoConfig.type.slice(1)}Circle`]]}>
              <Text style={styles.sileoIcon}>{sileoConfig.type === 'success' ? '✓' : '!'}</Text>
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoConfirm}>
              <Text style={styles.sileoButtonText}>{sileoConfig.confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12,     marginTop: 35},
  headerTitleText: { fontSize: 18, fontWeight: '700', color: '#1E3A8A' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  searchSection: { paddingHorizontal: 16, marginBottom: 12 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, elevation: 1 },
  searchInput: { flex: 1, padding: 12, fontSize: 14, color: '#1E293B' },
  statusListContent: { paddingHorizontal: 16, paddingVertical: 12 },
  statusItem: { alignItems: 'center', marginRight: 16 },
  statusIconWrapper: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 6 },
  statusIconWrapperActive: { backgroundColor: '#eff6ff', borderColor: '#1E3A8A' },
  statusIcon: { width: 24, height: 24, resizeMode: 'contain' },
  statusTabText: { fontSize: 12, color: '#64748B', fontWeight: '600', textAlign: 'center' },
  statusTabTextActive: { color: '#1E3A8A', fontWeight: '700' },
  countBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#F1F5F9' },
  activeCountBadge: { backgroundColor: 'rgba(30, 58, 138, 0.2)' },
  inactiveCountBadge: { backgroundColor: '#F1F5F9' },
  countText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  activeCountText: { color: '#1E3A8A' },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumberLabel: { fontSize: 12, color: '#94A3B8' },
  orderNumberValue: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#F1F5F9', marginRight: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  itemQty: { fontSize: 12, color: '#64748B' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 12, color: '#64748B' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },
  ratingSection: { marginTop: 10 },
  ratingTitle: { fontSize: 14, fontWeight: '700', color: '#334155', textAlign: 'center', marginBottom: 10 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  feedbackInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 14, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', minHeight: 60, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1E3A8A', paddingVertical: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700' },
  ratedContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, backgroundColor: '#F0FDF4', padding: 10, borderRadius: 12 },
  ratedText: { color: '#10B981', fontWeight: '700', marginLeft: 8 },
  sileoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  sileoModal: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 25, alignItems: 'center' },
  sileoIconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  sileoSuccessCircle: { backgroundColor: '#DCFCE7' },
  sileoInfoCircle: { backgroundColor: '#E0F2FE' },
  sileoWarningCircle: { backgroundColor: '#FEF3C7' },
  sileoErrorCircle: { backgroundColor: '#FEE2E2' },
  sileoIcon: { fontSize: 30, fontWeight: '700' },
  sileoTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  sileoMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  sileoButton: { backgroundColor: '#1E3A8A', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  sileoButtonText: { color: '#fff', fontWeight: '700' }
});

export default OrdersDetails;