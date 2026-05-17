// VendorOrdersScreen.js
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
import { Ionicons } from '@expo/vector-icons'; 
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function VendorOrdersScreen() {
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]); 
  const [toDeliverOrders, setToDeliverOrders] = useState([]);
  const [toPickupOrders, setToPickupOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState(null);
  const [activeDateFilter, setActiveDateFilter] = useState('All');
  
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

  const STATUSES = [
    'Pending',
    'Preparing',
    'To Deliver',
    'To Pickup',
    'Complete',
    'Cancelled'
  ];

  const DATE_FILTERS = ['All', 'Today', 'Yesterday', 'Last Week', 'Last Month'];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#F59E0B'; 
      case 'Preparing': return '#3B82F6'; 
      case 'To Deliver': return '#10B981';
      case 'To Pickup': return '#8B5CF6'; 
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
    if (!vendorId) return;
    const ref = collection(db, 'To_Deliver_Orders');
    const q = query(ref, orderBy('createdAt', 'desc'));
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
      setToDeliverOrders(vendorOrders);
    });
    return () => unsubscribe();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const ref = collection(db, 'To_Pickup_Orders');
    const q = query(ref, orderBy('createdAt', 'desc'));
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
      setToPickupOrders(vendorOrders);
    });
    return () => unsubscribe();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    const ref = collection(db, 'Completed_Orders');
    const q = query(ref, orderBy('completedAt', 'desc'));
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
      setCompletedOrders(vendorOrders);
    });
    return () => unsubscribe();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
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
      showSileo({ title: 'Error', message: 'Failed to fetch orders.', type: 'error' });
    });
    return () => unsubscribe();
  }, [vendorId]);

  const handleCancelOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const orderRef = doc(db, 'Orders', order.id);
      const cancelledRef = doc(db, 'Cancelled_Orders', order.id);
      const vendorNotifRef = doc(collection(db, 'Vendor_Notifications'));

      await runTransaction(db, async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Order not found');
        transaction.set(cancelledRef, { ...order, status: 'Cancelled', cancelledAt: new Date() });
        transaction.delete(orderRef);

        // ✅ VENDOR NOTIFICATION: Cancelled
        transaction.set(vendorNotifRef, {
          vendorId: vendorId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          title: 'Order Cancelled/Declined',
          message: `You declined and cancelled Order #${order.orderNumber}.`,
          type: 'VENDOR_ORDER_CANCELLED',
          read: false,
          createdAt: new Date(),
        });
      });
      showSileo({
        title: 'Order Declined',
        message: `Order ${order.orderNumber} has been successfully declined and cancelled.`,
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

const handleAcceptOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const orderRef = doc(db, 'Orders', order.id);
      const notifRef = doc(collection(db, 'User_Notifications_Product'));
      const vendorNotifRef = doc(collection(db, 'Vendor_Notifications'));
      
      const sampleProductImage = order.items?.[0]?.productImage || null;
      const sampleProductName = order.items?.[0]?.productName || null;

      await runTransaction(db, async (transaction) => {
        // 1. Gather all product data configurations securely within the transaction
        const productSnapshots = [];
        for (const item of order.items) {
          const isBiddingItem = item.source === 'notification' || item.productType === 'bidding';
          const targetCollection = isBiddingItem ? 'Bidding_Products' : 'Products';
          
          const productRef = doc(db, targetCollection, item.productId);
          const productSnap = await transaction.get(productRef);
          
          if (productSnap.exists()) {
            productSnapshots.push({ ref: productRef, snap: productSnap, item, isBiddingItem });
          }
        }

        // 2. Perform accurate inventory decreases right now on order acceptance
        for (const { ref, snap, item, isBiddingItem } of productSnapshots) {
          const orderQty = item.quantity || 0;

          if (isBiddingItem) {
            const currentQty = snap.data().remainingQuantity || 0;
            const newQty = currentQty - orderQty;
            if (newQty < 0) {
              throw new Error(`Insufficient auction units remaining for ${item.productName}`);
            }
            transaction.update(ref, { remainingQuantity: newQty });
          } else {
            const currentQty = snap.data().quantityKg || 0;
            const newQty = currentQty - orderQty;
            if (newQty < 0) {
              throw new Error(`Insufficient stock for ${item.productName}`);
            }
            transaction.update(ref, { quantityKg: newQty });
          }
        }

        // 3. Complete normal acceptance status modifications
        transaction.update(orderRef, { status: 'Preparing' });
        
        transaction.set(notifRef, {
          userId: order.userId,
          orderId: order.id,
          title: 'Order Accepted',
          message: `Your order #${order.orderNumber} has been accepted and is now being prepared!`,
          type: 'ORDER_ACCEPTED',
          imageUrl: sampleProductImage,
          productName: sampleProductName,
          read: false,
          createdAt: new Date(),
        });

        transaction.set(vendorNotifRef, {
          vendorId: vendorId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          title: 'Order Accepted',
          message: `You accepted Order #${order.orderNumber}. It is now in processing.`,
          type: 'VENDOR_ORDER_ACCEPTED',
          read: false,
          createdAt: new Date(),
        });
      });

      showSileo({
        title: 'Order Accepted',
        message: `Order ${order.orderNumber} is now being prepared. Stock levels updated!`,
        type: 'success',
      });
    } catch (error) {
      showSileo({ title: 'Error', message: error.message || 'Failed to accept order.', type: 'error' });
    }
    setProcessing(null);
  };

const handleDeliverOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);

    try {
      const ordersRef = doc(db, 'Orders', order.id);
      const deliverRef = doc(db, 'To_Deliver_Orders', order.id);
      const pickupRef = doc(db, 'To_Pickup_Orders', order.id);
      const vendorNotifRef = doc(collection(db, 'Vendor_Notifications'));
      
      const sampleProductImage = order.items?.[0]?.productImage || null;
      const sampleProductName = order.items?.[0]?.productName || null;

      await runTransaction(db, async (transaction) => {
        // Stock loop removed from here to prevent duplicate calculations!

        if (order.deliveryMethod === 'Delivery') {
          transaction.set(deliverRef, { ...order, status: 'To Deliver' });
          
          const notifRef = doc(collection(db, 'User_Notifications_Product'));
          transaction.set(notifRef, {
            userId: order.userId,
            orderId: order.id,
            title: 'Order Shipped Out',
            message: `Good news! Your order #${order.orderNumber} has been handed over to dispatch.`,
            type: 'ORDER_SHIPPED',
            imageUrl: sampleProductImage,
            productName: sampleProductName,
            read: false,
            createdAt: new Date(),
          });

          transaction.set(vendorNotifRef, {
            vendorId: vendorId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            title: 'Order Shipped Out',
            message: `Order #${order.orderNumber} dispatched for courier distribution.`,
            type: 'VENDOR_ORDER_SHIPPED',
            read: false,
            createdAt: new Date(),
          });
        }

        if (order.deliveryMethod === 'Pickup') {
          transaction.set(pickupRef, { ...order, status: 'To Pickup' });
          
          const notifRef = doc(collection(db, 'User_Notifications_Product'));
          transaction.set(notifRef, {
            userId: order.userId,
            orderId: order.id,
            title: 'Order Ready for Pickup',
            message: `Your order #${order.orderNumber} is now packaged and ready for pickup.`,
            type: 'ORDER_TO_PICKUP',
            deliveryMethod: 'Pickup',
            imageUrl: sampleProductImage,
            productName: sampleProductName,
            read: false,
            createdAt: new Date(),
          });

          transaction.set(vendorNotifRef, {
            vendorId: vendorId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            title: 'Ready for Pickup',
            message: `Order #${order.orderNumber} packaged and marked active for store pickup.`,
            type: 'VENDOR_ORDER_READY_PICKUP',
            read: false,
            createdAt: new Date(),
          });
        }
        transaction.delete(ordersRef);
      });

      showSileo({
        title: 'Status Updated',
        message: order.deliveryMethod === 'Pickup'
          ? `Order ${order.orderNumber} is ready! The customer has received a pickup notification.`
          : `Order ${order.orderNumber} has been handed off to dispatch and moved to shipping.`,
        type: 'success',
      });
    } catch (error) {
      showSileo({ title: 'Error', message: error.message || 'Failed to process order.', type: 'error' });
    }
    setProcessing(null);
  };

  const handleCompleteOrder = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);
    try {
      const completeRef = doc(db, 'Completed_Orders', order.id);
      const deliverRef = doc(db, 'To_Deliver_Orders', order.id);
      const vendorNotifRef = doc(collection(db, 'Vendor_Notifications'));

      await runTransaction(db, async (transaction) => {
        const completeSnap = await transaction.get(completeRef);
        if (completeSnap.exists()) throw new Error("Order already completed.");
        const deliverSnap = await transaction.get(deliverRef);
        if (!deliverSnap.exists()) throw new Error("Order not found in To Deliver.");
        
        transaction.set(completeRef, { ...order, status: 'Complete', completedAt: new Date() });
        transaction.delete(deliverRef);

        // ✅ VENDOR NOTIFICATION: Delivered & Completed
        transaction.set(vendorNotifRef, {
          vendorId: vendorId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          title: 'Order Delivered',
          message: `Order #${order.orderNumber} has been delivered and finalized.`,
          type: 'VENDOR_ORDER_COMPLETED',
          read: false,
          createdAt: new Date(),
        });
      });
      showSileo({
        title: 'Order Completed',
        message: `Order ${order.orderNumber} has been successfully delivered and finalized.`,
        type: 'success',
      });
    } catch (error) {
      showSileo({ title: 'Error', message: error.message || 'Failed to complete order.', type: 'error' });
    }
    setProcessing(null);
  };

  const handleCompletePickup = async (order) => {
    if (processing === order.id) return;
    setProcessing(order.id);

    try {
      const completeRef = doc(db, 'Completed_Orders', order.id);
      const pickupRef = doc(db, 'To_Pickup_Orders', order.id);
      const vendorNotifRef = doc(collection(db, 'Vendor_Notifications'));
      
      const sampleProductImage = order.items?.[0]?.productImage || null;
      const sampleProductName = order.items?.[0]?.productName || null;

      await runTransaction(db, async (transaction) => {
        const completeSnap = await transaction.get(completeRef);
        if (completeSnap.exists()) throw new Error('Order already completed.');

        transaction.set(completeRef, { ...order, status: 'Complete', completedAt: new Date() });
        transaction.delete(pickupRef);

        const notifRef = doc(collection(db, 'User_Notifications_Product'));
        transaction.set(notifRef, {
          userId: order.userId,
          orderId: order.id,
          title: 'Pickup Completed',
          message: 'Your pickup order has been completed successfully.',
          type: 'ORDER_COMPLETED',
          imageUrl: sampleProductImage,
          productName: sampleProductName,
          read: false,
          createdAt: new Date(),
        });

        // ✅ VENDOR NOTIFICATION: Handover Completed
        transaction.set(vendorNotifRef, {
          vendorId: vendorId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          title: 'Handover Successful',
          message: `Client collected pickup Order #${order.orderNumber}. Marked Complete.`,
          type: 'VENDOR_PICKUP_COMPLETED',
          read: false,
          createdAt: new Date(),
        });
      });

      showSileo({
        title: 'Handover Successful',
        message: `Pickup order ${order.orderNumber} has been collected by the client and marked as complete.`,
        type: 'success',
      });
    } catch (error) {
      showSileo({ title: 'Error', message: error.message || 'Failed to complete pickup.', type: 'error' });
    }
    setProcessing(null);
  };

  const getStatusCount = (status) => {
    if (status === 'To Deliver') return toDeliverOrders.length;
    if (status === 'To Pickup') return toPickupOrders.length;
    if (status === 'Complete') return completedOrders.length;
    return orders.filter(o => o.status === status).length;
  };

  const checkDateMatch = (orderDateSeconds) => {
    if (activeDateFilter === 'All') return true;
    if (!orderDateSeconds) return false;

    const orderDate = new Date(orderDateSeconds * 1000);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    if (activeDateFilter === 'Today') return orderDate >= todayStart;
    if (activeDateFilter === 'Yesterday') return orderDate >= yesterdayStart && orderDate < todayStart;
    
    if (activeDateFilter === 'Last Week') {
      const oneWeekAgo = new Date(todayStart);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return orderDate >= oneWeekAgo;
    }
    if (activeDateFilter === 'Last Month') {
      const oneMonthAgo = new Date(todayStart);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return orderDate >= oneMonthAgo;
    }
    return true;
  };

  const sourceOrders =
    activeStatus === 'To Deliver' ? toDeliverOrders
    : activeStatus === 'To Pickup' ? toPickupOrders
    : activeStatus === 'Complete' ? completedOrders
    : orders;

  const filteredOrders = sourceOrders.filter(o => {
    const matchesStatus = (activeStatus === 'To Deliver' || activeStatus === 'To Pickup' || activeStatus === 'Complete') ? true : o.status === activeStatus;
    const matchesSearch = searchQuery === '' || o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) || o.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDate = checkDateMatch(o.createdAt?.seconds);
    return matchesStatus && matchesSearch && matchesDate;
  });

  const renderOrderItem = ({ item }) => {
    const total = (Array.isArray(item.items) ? item.items : []).reduce((sum, i) => {
      const base = Number(i.basePrice || 0);
      const variation = Number(i.selectedVariationPrice || 0);
      const services = (i.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + variation + services) * (i.quantity || 1);
    }, 0);

    const isBiddingOrder = (item.items || []).some(i => i.source === 'notification' || i.productType === 'bidding');

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => navigation.navigate('ViewOrderDetailsVendor', { order: item })}
        disabled={item.status === 'Complete'}
        activeOpacity={0.9}
      >
        <View style={styles.orderHeader}>
          <View>
            <View style={styles.headerLabelRow}>
              <View style={styles.orderIdBadge}>
                <Text style={styles.orderIDLabel}>ORDER REFERENCE</Text>
              </View>
              {isBiddingOrder && (
                <View style={styles.biddingBadge}>
                  <Ionicons name="gavel" size={10} color="#1E3A8A" style={{ marginRight: 2 }} />
                  <Text style={styles.biddingBadgeText}>BIDDING</Text>
                </View>
              )}
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
                {processing === item.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnPrimaryText}>
                  {item.deliveryMethod === 'Pickup' ? 'Ready Pickup' : 'Ship Order'}
                </Text>}
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

            {item.status === 'To Pickup' && (
              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: '#8B5CF6' }]}
                disabled={processing === item.id}
                onPress={() => handleCompletePickup(item)}
              >
                {processing === item.id ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnPrimaryText}>Complete Pickup</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={false} />
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

      <View style={{ marginBottom: 5, marginTop: 10 }}>
        <FlatList
          data={DATE_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveDateFilter(item)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor: activeDateFilter === item ? '#1e3a8a' : '#e2e8f0',
              }}
            >
              <Text style={{ color: activeDateFilter === item ? '#fff' : '#475569', fontSize: 12, fontWeight: '600' }}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
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
  container: { flex: 1, backgroundColor: '#FAFAFA', marginTop: 35},
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSection: { paddingHorizontal: 16, paddingTop: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  screenTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  onlineStatus: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  onlineText: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', padding: 0 },
  tabsWrapper: { marginVertical: 10 },
  tabsContainer: { paddingHorizontal: 16, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  activeTab: { backgroundColor: '#1E3A8A' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  countBadge: { backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 6 },
  activeCountBadge: { backgroundColor: '#3B82F6' },
  countText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  activeCountText: { color: '#FFFFFF' },
  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 12 },
  headerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  orderIdBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  orderIDLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
  biddingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5, borderColor: '#BFDBFE' },
  biddingBadgeText: { fontSize: 9, fontWeight: '800', color: '#1E3A8A', letterSpacing: 0.5 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  cardContent: { paddingVertical: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemImage: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F1F5F9' },
  itemImagePlaceholder: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 2 },
  qtyContainer: { flexDirection: 'row', alignItems: 'center' },
  itemQty: { fontSize: 12, color: '#6B7280' },
  qtyHigh: { fontWeight: '700', color: '#111827' },
  itemSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  footerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  revenueBox: { flex: 1 },
  totalLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  totalAmount: { fontSize: 16, fontWeight: '800', color: '#10B981', marginTop: 2 },
  actionContainer: { flexDirection: 'row', gap: 8 },
  btnPrimary: { backgroundColor: '#1E3A8A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, justifyContent: 'center', alignItems: 'center', minWidth: 90 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnIconSecondary: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#FEE2E2', backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#475569', marginBottom: 4 },
  emptySubText: { fontSize: 13, color: '#94A3B8' },
  sileoOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sileoModal: { width: width - 48, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 10 },
  sileoIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  sileoSuccess: { backgroundColor: '#DCFCE7' },
  sileoWarning: { backgroundColor: '#FEF3C7' },
  sileoError: { backgroundColor: '#FEE2E2' },
  sileoIconText: { fontSize: 24, fontWeight: '700' },
  sileoTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  sileoMessage: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  sileoButton: { width: '100%', backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  sileoButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});