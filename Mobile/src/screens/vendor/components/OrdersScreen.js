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
} from 'react-native';
import { db, auth } from '../../../firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, setDoc, runTransaction } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

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
  const statusImages = {
    Pending: require('../../../../assets/Pending.png'),
    Preparing: require('../../../../assets/Preparing.png'),
    'To Deliver': require('../../../../assets/ToDeliver.png'),
    Complete: require('../../../../assets/Complete.png'),
    Cancelled: require('../../../../assets/Complete.png'),
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#F59E0B'; // Amber
      case 'Preparing': return '#3B82F6'; // Blue
      case 'To Deliver': return '#10B981'; // Emerald
      case 'Complete': return '#6366F1'; // Indigo
      case 'Cancelled': return '#EF4444'; // Red
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
        // FIRST: All reads
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order not found');
        
        // THEN: All writes
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
      showSileo({
        title: 'Decline Failed',
        message: error.message || 'Failed to decline order.',
        type: 'error',
      });
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
        // FIRST: Check if already moved
        const deliverSnap = await transaction.get(deliverRef);
        if (deliverSnap.exists()) {
          throw new Error("Order already moved.");
        }

        // Read product snapshots - only for items that exist in Products collection
        // (Bidding items won't have Products entries, so we skip inventory deduction for them)
        const productSnapshots = [];
        for (const item of order.items) {
          const productRef = doc(db, 'Products', item.productId);
          const productSnap = await transaction.get(productRef);
          // Only process if product exists in Products collection
          if (productSnap.exists()) {
            productSnapshots.push({ ref: productRef, snap: productSnap, item });
          }
          // Skip inventory deduction for bidding items (they don't have Products entries)
        }

        // Update inventory for existing products only
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

      await updateDoc(orderRef, {
        status: 'Preparing'
      });

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
        // FIRST: All reads
        const completeSnap = await transaction.get(completeRef);
        if (completeSnap.exists()) {
          throw new Error("Order already completed.");
        }

        const deliverSnap = await transaction.get(deliverRef);
        if (!deliverSnap.exists()) {
          throw new Error("Order not found in To Deliver.");
        }

        // THEN: All writes
        transaction.set(completeRef, {
          ...order,
          status: 'Complete',
          completedAt: new Date()
        });
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
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderIDLabel}>ORDER ID</Text>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {item.items.map((i, idx) => (
          <View key={idx} style={styles.itemRow}>
            {i.productImage ? (
              <Image source={{ uri: i.productImage }} style={styles.itemImage} />
            ) : (
              <View style={styles.itemImagePlaceholder} />
            )}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={styles.itemName} numberOfLines={1}>{i.productName}</Text>
              <Text style={styles.itemQty}>Quantity: <Text style={{fontWeight: '700', color: '#1E293B'}}>{i.quantity}</Text></Text>
              {i.selectedVariation && (
                <Text style={styles.itemSub}>🏷️ {i.selectedVariation}</Text>
              )}
              {i.services?.length > 0 && (
                <Text style={styles.itemSub}>⚙️ {i.services.map(s => s.label || s.name).join(', ')}</Text>
              )}
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <View>
             <Text style={styles.totalLabel}>TOTAL REVENUE</Text>
             <Text style={styles.totalAmount}>₱{total.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
          
          <View style={styles.actionContainer}>
            {item.status === 'Pending' && (
              <>
                <TouchableOpacity
                  style={[
                    styles.btnSecondary,
                    { opacity: processing === item.id ? 0.5 : 1 }
                  ]}
                  disabled={processing === item.id}
                  onPress={() => confirmDeclineOrder(item)}
                >
                  {processing === item.id ? (
                    <ActivityIndicator color="#EF4444" size="small" />
                  ) : (
                    <Text style={styles.btnSecondaryText}>Decline</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnPrimary,
                    { opacity: processing === item.id ? 0.5 : 1 }
                  ]}
                  disabled={processing === item.id}
                  onPress={() => handleAcceptOrder(item)}
                >
                  {processing === item.id ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>Accept</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {item.status === 'Preparing' && (
              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  { backgroundColor: '#10B981', opacity: processing === item.id ? 0.5 : 1 }
                ]}
                disabled={processing === item.id}
                onPress={() => handleDeliverOrder(item)}
              >
                {processing === item.id ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Ship Order</Text>
                )}
              </TouchableOpacity>
            )}

            {item.status === 'To Deliver' && (
              <TouchableOpacity
                style={[
                  styles.btnPrimary,
                  { backgroundColor: '#6366F1', opacity: processing === item.id ? 0.5 : 1 }
                ]}
                disabled={processing === item.id}
                onPress={() => handleCompleteOrder(item)}
              >
                {processing === item.id ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Mark Delivered</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0F172A" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.screenTitle}>Manage Orders</Text>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search Order ID or Product..."
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
              <Text style={[styles.tabText, activeStatus === item && styles.activeTabText]}>
                {item}
              </Text>
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIllustration}>📦</Text>
            <Text style={styles.emptyText}>No orders found in this category.</Text>
          </View>
        }
      />

      {/* Sileo Modal for Confirmations */}
      <Modal
        visible={sileoVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleSileoClose}
      >
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === 'success'
                  ? styles.sileoSuccess
                  : sileoConfig.type === 'warning'
                    ? styles.sileoWarning
                    : styles.sileoError,
              ]}
            >
              <Text style={styles.sileoIconText}>
                {sileoConfig.type === 'success' ? '✓' : sileoConfig.type === 'warning' ? '!' : '✕'}
              </Text>
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
    paddingTop: 16, 
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 16, letterSpacing: -0.5 },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 8,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
  },

  tabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
  },
  tabsContainer: { paddingHorizontal: 16 },
  tab: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 99, 
    marginRight: 8, 
    backgroundColor: '#F1F5F9',
  },
  activeTab: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 1 },
  tabText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  activeTabText: { color: '#000' },
  
  countBadge: { marginLeft: 8, backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  activeCountBadge: { backgroundColor: '#3b82f6' },
  countText: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
  activeCountText: { color: '#fff' },
  
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderIDLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '800', letterSpacing: 1 },
  orderNumber: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontWeight: '800', fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
  
  itemRow: { flexDirection: 'row', marginVertical: 4 },
  itemImage: { width: 64, height: 64, borderRadius: 12, marginRight: 14, backgroundColor: '#F1F5F9' },
  itemImagePlaceholder: { width: 64, height: 64, borderRadius: 12, marginRight: 14, backgroundColor: '#E2E8F0' },
  itemName: { fontWeight: '700', fontSize: 15, color: '#1E293B', marginBottom: 2 },
  itemQty: { fontSize: 13, color: '#64748B', marginTop: 1 },
  itemSub: { fontSize: 12, color: '#64748B', marginTop: 3 },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '800', letterSpacing: 1 },
  totalAmount: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  
  actionContainer: { flexDirection: 'row', gap: 8 },
  btnPrimary: { backgroundColor: '#3B82F6', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnSecondary: { backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12 },
  btnSecondaryText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyIllustration: { fontSize: 50, marginBottom: 12 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 15, fontWeight: '600' },

  // Sileo Modal Styles
  sileoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sileoModal: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  sileoIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sileoSuccess: { backgroundColor: '#10B981' },
  sileoWarning: { backgroundColor: '#F59E0B' },
  sileoError: { backgroundColor: '#EF4444' },
  sileoIconText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sileoTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  sileoMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  sileoButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  sileoButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});