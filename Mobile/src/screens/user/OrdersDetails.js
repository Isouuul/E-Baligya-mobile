import React, { useEffect, useState } from 'react';
import { 
  View, Text, StatusBar, FlatList, ActivityIndicator, StyleSheet, 
  SafeAreaView, TouchableOpacity, Image, TextInput, Dimensions,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { 
  collection, query, where, onSnapshot, doc, 
  setDoc, serverTimestamp, getDocs 
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const STATUSES = ['Pending', 'Preparing', 'To Deliver', 'Complete', 'Cancelled'];
const statusColors = {
  Pending: '#F59E0B',
  Preparing: '#3B82F6',
  'To Deliver': '#10B981',
  'To Pickup': '#8B5CF6',
  Complete: '#6366F1',
  Cancelled: '#EF4444',
};

const OrdersDetails = () => {
  const [orders, setOrders] = useState([]);
  const [toDeliverOrders, setToDeliverOrders] = useState([]);
  const [toPickupOrders, setToPickupOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratings, setRatings] = useState({}); 
  const [submittingRating, setSubmittingRating] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({ title: '', message: '', type: 'info' });

  const navigation = useNavigation();
  const userId = auth.currentUser?.uid;

  // --- Logic (Unchanged) ---
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
    const q = query(collection(db, 'To_Pickup_Orders'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, snapshot => {
      setToPickupOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const handleStarPress = (orderId, value) => {
    setRatings(prev => ({ ...prev, [orderId]: { ...prev[orderId], stars: value } }));
  };

  const handleFeedbackChange = (orderId, text) => {
    setRatings(prev => ({ ...prev, [orderId]: { ...prev[orderId], feedback: text } }));
  };

  const showSileo = (config) => {
    setSileoConfig({ ...config });
    setSileoVisible(true);
  };

  const handleSubmitRating = async (order) => {
    const currentRating = ratings[order.id]?.stars || 0;
    const currentFeedback = ratings[order.id]?.feedback || '';

    if (currentRating === 0) {
      showSileo({ title: 'Wait!', message: 'Please select a star rating.', type: 'warning' });
      return;
    }

    setSubmittingRating(true);
    try {
      const reviewId = `review_${order.id}`;
      const currentUser = auth.currentUser;
      const uniqueVendorUids = [...new Set(order.items.map(item => item.uploadedBy.uid))];

      const reviewData = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: currentUser.uid,
        userName: `${order.userFirstName || ''} ${order.userLastName || ''}`.trim() || 'Customer',
        userProfileImage: order.userProfileImage || null, 
        rating: currentRating,
        feedback: currentFeedback,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'Reviews', reviewId), { ...reviewData, vendorIds: uniqueVendorUids });

      const ratingPromises = uniqueVendorUids.map(async (vUid) => {
        const vendorQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", vUid));
        const vendorSnap = await getDocs(vendorQuery);
        if (!vendorSnap.empty) {
          const vendorDocId = vendorSnap.docs[0].id;
          return setDoc(doc(db, 'ApprovedVendors', vendorDocId, 'Rating', reviewId), reviewData);
        }
      });

      await Promise.all(ratingPromises);
      await setDoc(doc(db, 'Completed_Orders', order.id), { isRated: true }, { merge: true });

      showSileo({ title: 'Thank you!', message: 'Your feedback helps our fishery community grow.', type: 'success' });
    } catch (error) {
      showSileo({ title: 'Error', message: 'Failed to submit rating.', type: 'error' });
    } finally {
      setSubmittingRating(false);
    }
  };

  const sourceOrders =
    activeStatus === 'To Deliver'
      ? toDeliverOrders
      : activeStatus === 'To Pickup'
      ? toPickupOrders
      : activeStatus === 'Complete'
      ? completedOrders
      : orders;
      
  const filteredOrders = sourceOrders.filter(o => {
    const matchesStatus =
      activeStatus === 'To Deliver' ||
      activeStatus === 'To Pickup' ||
      activeStatus === 'Complete'
        ? true
        : o.status === activeStatus;

    const matchesSearch = searchQuery === '' || o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusCount = (status) => {
    if (status === 'To Deliver') return toDeliverOrders.length;
    if (status === 'To Pickup') return toPickupOrders.length;
    if (status === 'Complete') return completedOrders.length;
    return orders.filter(o => o.status === status).length;
  };

  // --- UI Rendering ---
  const renderOrderItem = ({ item }) => {
    const total = (item.items || []).reduce((sum, i) => sum + (Number(i.basePrice || 0) * (i.quantity || 1)), 0);

    return (
      <View style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <View>
            <View style={styles.orderIdContainer}>
              <Text style={styles.orderNumberValue}>#{item.orderNumber}</Text>
            </View>
            <Text style={styles.orderDateText}>{new Date(item.createdAt?.seconds * 1000).toLocaleDateString() || 'Recently'}</Text>
            {item.deliveryMethod === 'Pickup' && (
                <View style={styles.pickupBadge}>
                  <Text style={styles.pickupBadgeText}>PICKUP</Text>
                </View>
              )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[item.status] }]} />
            <Text style={[styles.statusBadgeText, { color: statusColors[item.status] }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.itemsContainer}>
          {item.items.map((i, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Image source={i.productImage ? { uri: i.productImage } : null} style={styles.itemImage} />
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={styles.itemName} numberOfLines={1}>{i.productName}</Text>
                
                <Text style={styles.itemDetails}>Qty: {i.quantity} × ₱{Number(i.basePrice).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('ViewOrderDetails', { order: item })}
            style={styles.detailsBtn}
          >
            <Text style={styles.detailsBtnText}>View Details</Text>
            <Ionicons name="arrow-forward" size={14} color="#1E3A8A" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          
          <View style={{ alignItems: 'flex-end' }}>
          
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₱{total.toLocaleString()}</Text>
            
          </View>
        </View>

        {activeStatus === 'Complete' && (
          <View style={styles.ratingWrapper}>
            {item.isRated ? (
              <View style={styles.ratedContainer}>
<Ionicons name="ribbon" size={20} color="#10B981" />
                <Text style={styles.ratedText}>Review Submitted</Text>
              </View>
            ) : (
              <View style={styles.ratingBox}>
                <Text style={styles.ratingTitle}>How was your order?</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map(num => (
                    <TouchableOpacity key={num} onPress={() => handleStarPress(item.id, num)} activeOpacity={0.7}>
                      <Ionicons 
                        name={(ratings[item.id]?.stars || 0) >= num ? 'star' : 'star-outline'} 
                        size={32} 
                        color={(ratings[item.id]?.stars || 0) >= num ? '#F59E0B' : '#CBD5E1'} 
                        style={{ marginHorizontal: 4 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.feedbackInput}
                  placeholder="Share your experience (optional)..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={ratings[item.id]?.feedback || ''}
                  onChangeText={(text) => handleFeedbackChange(item.id, text)}
                />
                <TouchableOpacity 
                  style={[styles.submitBtn, { opacity: submittingRating ? 0.7 : 1 }]} 
                  onPress={() => handleSubmitRating(item)}
                  disabled={submittingRating}
                >
                  {submittingRating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit Review</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity style={styles.headerActionBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#1E3A8A" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <View style={styles.searchInner}>
          <Ionicons name="search-outline" size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Order ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.tabContainer}>
        <FlatList
          data={STATUSES}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 5 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tabItem, activeStatus === item && styles.activeTabItem]}
              onPress={() => setActiveStatus(item)}
            >
              <Text style={[styles.tabText, activeStatus === item && styles.activeTabText]}>
                {item}
              </Text>
              {getStatusCount(item) > 0 && (
                <View style={[styles.countBadge, activeStatus === item ? styles.activeCountBadge : styles.inactiveCountBadge]}>
                  <Text style={[styles.countText, activeStatus === item && styles.activeCountText]}>{getStatusCount(item)}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={item => item}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={60} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyText}>No {activeStatus} orders</Text>
              <Text style={styles.emptySubText}>Try switching tabs or check back later.</Text>
            </View>
          )}
        />
      )}

      {/* SILEO MODAL (Simplified) */}
      {sileoVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIcon, { backgroundColor: sileoConfig.type === 'success' ? '#DCFCE7' : '#FEE2E2' }]}>
              <Ionicons 
                name={sileoConfig.type === 'success' ? "checkmark-circle" : "alert-circle"} 
                size={40} 
                color={sileoConfig.type === 'success' ? "#10B981" : "#EF4444"} 
              />
            </View>
            <Text style={styles.modalTitle}>{sileoConfig.title}</Text>
            <Text style={styles.modalMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setSileoVisible(false)}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#fff',
    marginTop: 30
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1E3A8A', letterSpacing: -0.5 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerActionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  
  searchWrapper: { paddingHorizontal: 16, marginVertical: 12 },
  searchInner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1E293B' },

  tabContainer: { marginBottom: 10 },
  tabItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 18, 
    paddingVertical: 10, 
    borderRadius: 25, 
    marginRight: 10, 
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  activeTabItem: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#fff' },
  countBadge: { marginLeft: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  activeCountBadge: { backgroundColor: 'rgba(255,255,255,0.2)' },
  inactiveCountBadge: { backgroundColor: '#F1F5F9' },
  countText: { fontSize: 11, fontWeight: '800' },
  activeCountText: { color: '#fff' },

  orderCard: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#F1F5F9', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 10, 
    elevation: 3 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  orderIdContainer: { flexDirection: 'row', alignItems: 'center' },
  orderNumberValue: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  orderDateText: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  pickupBadge: { marginLeft: 8, backgroundColor: '#F3E8FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, width: 60,height: 20, alignItems: 'center', justifyContent: 'center', marginTop: 5, marginLeft: -2 },
  pickupBadgeText: { color: '#7C3AED', fontWeight: '800', fontSize: 10 },

  itemsContainer: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F1F5F9', paddingVertical: 12, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  itemImage: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F8FAFC' },
  itemName: { fontSize: 15, fontWeight: '700', color: '#334155', marginLeft: 15 },
  itemDetails: { fontSize: 13, color: '#64748B', marginLeft: 15, marginTop: 3 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#EFF6FF' },
  detailsBtnText: { fontSize: 13, fontWeight: '700', color: '#1E3A8A' },
  totalLabel: { fontSize: 11, color: '#94A3B8', textAlign: 'right', fontWeight: '600' },
  totalValue: { fontSize: 19, fontWeight: '900', color: '#1E3A8A' },

  ratingWrapper: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  ratingBox: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  ratingTitle: { fontSize: 15, fontWeight: '800', color: '#1E3A8A', textAlign: 'center', marginBottom: 12 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15 },
  feedbackInput: { backgroundColor: '#fff', borderRadius: 12, padding: 12, fontSize: 14, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', minHeight: 70, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#1E3A8A', paddingVertical: 12, borderRadius: 12, marginTop: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ratedContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  ratedText: { color: '#10B981', fontWeight: '800', marginLeft: 8, fontSize: 14 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { fontSize: 18, color: '#1E293B', fontWeight: '800', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 25, alignItems: 'center' },
  modalIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  modalMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalBtn: { backgroundColor: '#1E3A8A', width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});

export default OrdersDetails;