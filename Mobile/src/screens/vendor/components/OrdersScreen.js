import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { db, auth } from '../../../firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // Added for better iconography

const { width } = Dimensions.get('window');

export default function VendorOrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]); 
  const [toDeliverOrders, setToDeliverOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(null);
  
  // Sileo Modal State
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });
  const [pendingDeclineOrder, setPendingDeclineOrder] = useState(null);

  const STATUSES = ['Pending', 'Preparing', 'To Deliver', 'Complete', 'Cancelled'];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#F59E0B'; 
      case 'Preparing': return '#3B82F6'; 
      case 'To Deliver': return '#10B981'; 
      case 'Complete': return '#6366F1'; 
      case 'Cancelled': return '#EF4444'; 
      default: return '#64748B';
    }
  };

  const vendorId = auth.currentUser?.uid;

  const showSileo = ({ title, message, buttonText = 'OK', type = 'info', onPress = null }) => {
    setSileoConfig({ title, message, buttonText, type, onPress });
    setSileoVisible(true);
  };

  const handleSileoClose = () => {
    setSileoVisible(false);
    if (typeof sileoConfig.onPress === 'function') {
      sileoConfig.onPress();
    }
    setSileoConfig((prev) => ({ ...prev, onPress: null }));
  };

  useEffect(() => {
    const ref = collection(db, 'To_Deliver_Orders');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setToDeliverOrders(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const ref = collection(db, 'Completed_Orders');
    const q = query(ref, orderBy('completedAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompletedOrders(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const ordersRef = collection(db, 'Orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const vendorOrders = allOrders
        .map(order => {
          const itemsArray = Array.isArray(order.items) ? order.items : [];
          const vendorItems = itemsArray.filter(item => item.uploadedBy?.uid === vendorId);
          if (vendorItems.length > 0) return { ...order, items: vendorItems };
          return null;
        })
        .filter(Boolean);
      setOrders(vendorOrders);
      setLoading(false);
    }, error => {
      console.log(error);
      setLoading(false);
      Alert.alert('Error', 'Failed to fetch orders.');
    });
    return () => unsubscribe();
  }, [vendorId]);

  const handleCancelOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const orderRef = doc(db, 'Orders', order.id);
      const cancelledRef = doc(db, 'Cancelled_Orders', order.id);
      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order not found');
        transaction.set(cancelledRef, { ...order, status: 'Cancelled', cancelledAt: new Date() });
        transaction.delete(orderRef);
      });
      showSileo({
        title: 'Order Declined',
        message: `Order ${order.orderNumber} has been declined successfully.`,
        type: 'success',
        onPress: () => setPendingDeclineOrder(null),
      });
    } catch (error) {
      showSileo({ title: 'Decline Failed', message: error.message || 'Failed to decline order.', type: 'error' });
    }
    setProcessing(null);
  };

  const confirmDeclineOrder = (order) => {
    setPendingDeclineOrder(order);
    showSileo({
      title: 'Decline Order?',
      message: `Are you sure you want to decline order ${order.orderNumber}? This action cannot be undone.`,
      buttonText: 'Decline',
      type: 'warning',
      onPress: () => handleCancelOrder(order),
    });
  };

  const handleDeliverOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const deliverRef = doc(db, 'To_Deliver_Orders', order.id);
      const ordersRef = doc(db, 'Orders', order.id);
      await runTransaction(db, async (transaction) => {
        const deliverSnap = await transaction.get(deliverRef);
        if (deliverSnap.exists()) throw new Error("Order already moved.");
        const productSnapshots = [];
        for (const item of order.items) {
          const productRef = doc(db, 'Products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (productSnap.exists()) productSnapshots.push({ ref: productRef, snap: productSnap, item });
        }
        for (const { ref, snap, item } of productSnapshots) {
          const currentQty = snap.data().quantityKg || 0;
          const orderQty = item.quantity || 0;
          const newQty = currentQty - orderQty;
          if (newQty < 0) throw new Error(`Insufficient stock for ${item.productName}`);
          transaction.update(ref, { quantityKg: newQty });
        }
        transaction.set(deliverRef, { ...order, status: 'To Deliver' });
        transaction.delete(ordersRef);
      });
      Alert.alert('Success', `Order ${order.orderNumber} moved to To Deliver.`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to move order.');
    }
    setProcessing(null);
  };

  const handleAcceptOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const orderRef = doc(db, 'Orders', order.id);
      await updateDoc(orderRef, { status: 'Preparing' });
      Alert.alert('Accepted', `Order ${order.orderNumber} is now being prepared.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept order.');
    }
    setProcessing(null);
  };

  const handleCompleteOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const completeRef = doc(db, 'Completed_Orders', order.id);
      const deliverRef = doc(db, 'To_Deliver_Orders', order.id);
      await runTransaction(db, async (transaction) => {
        const completeSnap = await transaction.get(completeRef);
        if (completeSnap.exists()) throw new Error("Order already completed.");
        const deliverSnap = await transaction.get(deliverRef);
        if (!deliverSnap.exists()) throw new Error("Order not found in To Deliver.");
        transaction.set(completeRef, { ...order, status: 'Complete', completedAt: new Date() });
        transaction.delete(deliverRef);
      });
      Alert.alert('Completed', `Order ${order.orderNumber} has been completed.`);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to complete order.');
    }
    setProcessing(null);
  };

  const getStatusCount = (status) => {
    if (status === 'To Deliver') return toDeliverOrders.length;
    if (status === 'Complete') return completedOrders.length;
    return orders.filter(o => o.status === status).length;
  };

  const sourceOrders = activeStatus === 'To Deliver' ? toDeliverOrders : activeStatus === 'Complete' ? completedOrders : orders;
  const filteredOrders = sourceOrders.filter(o => {
    const matchesStatus = (activeStatus === 'To Deliver' || activeStatus === 'Complete') ? true : o.status === activeStatus;
    const matchesSearch = searchQuery === '' || o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || o.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const renderOrderItem = ({ item }) => {
    const total = (Array.isArray(item.items) ? item.items : []).reduce((sum, i) => {
      const base = Number(i.basePrice || 0);
      const variation = Number(i.selectedVariationPrice || 0);
      const services = (i.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + variation + services) * (i.quantity || 1);
    }, 0);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('ViewOrderDetailsVendor', { order: item })}
        disabled={item.status === 'Complete'}
        activeOpacity={0.9}
      >
        <View style={styles.orderHeader}>
          <View>
            <View style={styles.orderIdBadge}>
                <Text style={styles.orderIDLabel}>ORDER REFERENCE</Text>
            </View>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
            {item.items.map((i, idx) => (
            <View key={idx} style={styles.itemRow}>
                {i.productImage ? (
                <Image source={{ uri: i.productImage }} style={styles.itemImage} />
                ) : (
                <View style={styles.itemImagePlaceholder}>
                    <Ionicons name="cube-outline" size={24} color="#94A3B8" />
                </View>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>{i.productName}</Text>
                    <View style={styles.qtyContainer}>
                        <Text style={styles.itemQty}>Quantity: <Text style={styles.qtyHigh}>{i.quantity}</Text></Text>
                    </View>
                    {i.selectedVariation && (
                        <Text style={styles.itemSub}><Ionicons name="pricetag-outline" size={12}/> {i.selectedVariation}</Text>
                    )}
                </View>
            </View>
            ))}
        </View>

        <View style={styles.footerContainer}>
            <View style={styles.revenueBox}>
                <Text style={styles.totalLabel}>TOTAL REVENUE</Text>
                <Text style={styles.totalAmount}>₱{total.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
            </View>
          
          <View style={styles.actionContainer}>
            {item.status === 'Pending' && (
              <>
                <TouchableOpacity
                  style={styles.btnIconSecondary}
                  disabled={processing === item.id}
                  onPress={() => confirmDeclineOrder(item)}
                >
                  {processing === item.id ? <ActivityIndicator color="#EF4444" size="small" /> : <Ionicons name="close" size={20} color="#EF4444" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnPrimary}
                  disabled={processing === item.id}
                  onPress={() => handleAcceptOrder(item)}
                >
                  {processing === item.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnPrimaryText}>Accept</Text>}
                </TouchableOpacity>
              </>
            )}

            {item.status === 'Preparing' && (
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: '#10B981' }]}
                disabled={processing === item.id}
                onPress={() => handleDeliverOrder(item)}
              >
                {processing === item.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnPrimaryText}>Ship Order</Text>}
              </TouchableOpacity>
            )}

            {item.status === 'To Deliver' && (
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: '#6366F1' }]}
                disabled={processing === item.id}
                onPress={() => handleCompleteOrder(item)}
              >
                {processing === item.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnPrimaryText}>Mark Delivered</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1e3a8a" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
            <Text style={styles.screenTitle}>Orders</Text>
            <View style={styles.onlineStatus}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Live</Text>
            </View>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" style={{marginRight: 8}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order ID or product..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.tabsWrapper}>
        <FlatList
          data={STATUSES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item}
          contentContainerStyle={styles.tabsContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, activeStatus === item && styles.activeTab]}
              onPress={() => setActiveStatus(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeStatus === item && styles.activeTabText]}>{item}</Text>
              <View style={[styles.countBadge, activeStatus === item && styles.activeCountBadge]}>
                <Text style={[styles.countText, activeStatus === item && styles.activeCountText]}>{getStatusCount(item)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={item => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCircle}>
                <Ionicons name="receipt-outline" size={40} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyText}>No orders found</Text>
            <Text style={styles.emptySubText}>Check back later for new requests</Text>
          </View>
        }
      />

      <Modal visible={sileoVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleSileoClose}>
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View style={[styles.sileoIconCircle, sileoConfig.type === 'success' ? styles.sileoSuccess : sileoConfig.type === 'warning' ? styles.sileoWarning : styles.sileoError]}>
              <Text style={styles.sileoIconText}>{sileoConfig.type === 'success' ? '✓' : sileoConfig.type === 'warning' ? '!' : '✕'}</Text>
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  
  headerSection: { 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: 16,
    backgroundColor: '#1e3a8a',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  screenTitle: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 6 },
  onlineText: { fontSize: 11, fontWeight: '700', color: '#166534', textTransform: 'uppercase' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1E293B', fontWeight: '500' },

  tabsWrapper: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 14 },
  tabsContainer: { paddingHorizontal: 16 },
  tab: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    borderRadius: 12, 
    marginRight: 10, 
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  activeTab: { backgroundColor: '#eff6ff', borderColor: '#3b82f6',},
  tabText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  activeTabText: { color: '#000' },
  countBadge: { marginLeft: 8, backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  activeCountBadge: { backgroundColor: 'rgba(29, 22, 22, 0.74)' },
  countText: { fontSize: 10, color: '#000', fontWeight: 'bold' },
  activeCountText: { color: '#fff' },
  
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  orderIdBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  orderIDLabel: { fontSize: 10, color: '#64748B', fontWeight: '800', letterSpacing: 0.5 },
  orderNumber: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, marginLeft: -25, marginTop: -10},
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontWeight: '900', fontSize: 10, textTransform: 'uppercase' },
  
  cardContent: { paddingVertical: 10 },
  itemRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
  itemImage: { width: 56, height: 56, borderRadius: 16, marginRight: 14 },
  itemImagePlaceholder: { width: 56, height: 56, borderRadius: 16, marginRight: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontWeight: '800', fontSize: 16, color: '#1E293B' },
  qtyContainer: { marginTop: 2 },
  itemQty: { fontSize: 13, color: '#64748B' },
  qtyHigh: { fontWeight: '800', color: '#1E293B' },
  itemSub: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  
  footerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16, marginTop: 4 },
  revenueBox: { flex: 1 },
  totalLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '800', letterSpacing: 1 },
  totalAmount: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  
  actionContainer: { flexDirection: 'row', gap: 8 },
  btnPrimary: { backgroundColor: '#1e3a8a', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnIconSecondary: { backgroundColor: '#FEF2F2', width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#1E293B', fontSize: 18, fontWeight: '800' },
  emptySubText: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginTop: 4 },

  sileoOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  sileoModal: { width: '85%', backgroundColor: '#fff', borderRadius: 32, padding: 24, alignItems: 'center' },
  sileoIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  sileoSuccess: { backgroundColor: '#10B981' },
  sileoWarning: { backgroundColor: '#F59E0B' },
  sileoError: { backgroundColor: '#EF4444' },
  sileoIconText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  sileoTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  sileoMessage: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 22, marginBottom: 24 },
  sileoButton: { backgroundColor: '#0F172A', width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  sileoButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});