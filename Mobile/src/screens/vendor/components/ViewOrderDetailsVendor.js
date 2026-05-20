// src/screens/Users/ViewOrderDetails.js
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { doc, deleteDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../../../firebase';

// Import the specialized Vendor-to-User report modal and the local asset
import ReportUserModal from './ReportUserModal';
import AlertIcon from '../../../../assets/Alert.png';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 180;

const getStatusBadgeStyle = status => {
  switch (status) {
    case 'Pending':
      return { backgroundColor: '#FFF7ED', color: '#C2410C', icon: 'clock-outline' };
    case 'Preparing':
      return { backgroundColor: '#EFF6FF', color: '#1D4ED8', icon: 'silverware-clean' };
    case 'To Deliver':
    case 'ToDeliver':
      return { backgroundColor: '#F5F3FF', color: '#6D28D9', icon: 'moped' };
    case 'Completed':
    case 'Complete':
      return { backgroundColor: '#ECFDF5', color: '#047857', icon: 'check-decagram' };
    case 'Cancelled':
      return { backgroundColor: '#FEF2F2', color: '#B91C1C', icon: 'close-circle-outline' };
    default:
      return { backgroundColor: '#F8FAFC', color: '#475569', icon: 'help-circle-outline' };
  }
};

export default function ViewOrderDetailsVendor() {
  const navigation = useNavigation();
  const route = useRoute();
  const order = route.params?.order;
  const [isCancelling, setIsCancelling] = useState(false);

  // Layout state for report modal visibility
  const [reportVisible, setReportVisible] = useState(false);
  
  // Track if this order has already been reported to disable the button
  const [hasBeenReported, setHasBeenReported] = useState(false);
  const [checkingReport, setCheckingReport] = useState(true);

  // Check Firestore on load to verify if a report already exists for this order ID
  useEffect(() => {
    let isMounted = true;
    
    const checkExistingReport = async () => {
      if (!order?.id) return;
      try {
        const reportsRef = collection(db, "VendorToUserReports");
        const q = query(reportsRef, where("orderId", "==", order.id));
        const querySnapshot = await getDocs(q);
        
        if (isMounted) {
          // If query isn't empty, it means this order has already been reported
          setHasBeenReported(!querySnapshot.empty);
        }
      } catch (error) {
        console.error("Error checking existing reports: ", error);
      } finally {
        if (isMounted) setCheckingReport(false);
      }
    };

    checkExistingReport();
    return () => { isMounted = false; };
  }, [order?.id]);

  const groupedItems = useMemo(() => {
    const groups = {};
    if (order && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
        if (!groups[businessName]) groups[businessName] = [];
        groups[businessName].push(item);
      });
    }
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [order?.items]);

  const handleCancelOrder = async () => {
    if (isCancelling) return;
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              const orderRef = doc(db, "Orders", order.id);
              await setDoc(doc(db, "CancelledOrders", order.id), {
                ...order,
                cancelledAt: new Date(),
              });
              await deleteDoc(orderRef);
              Alert.alert("Success", "Your order has been cancelled.");
              navigation.goBack();
            } catch (error) {
              console.log(error);
              Alert.alert("Error", "Something went wrong. Try again.");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

const renderItemCard = item => {
  const base = Number(item.basePrice || 0);
  const servicesTotal = (item.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
  const itemTotal = (base + servicesTotal) * (item.quantity || 1);
  
  // Fallback to 'Product' if category doesn't exist in the document object
  const itemCategory = item.category || item.productCategory || 'Product';

  return (
    <View key={item.productId} style={styles.itemCardNew}>
      <View style={styles.productRow}>
        {item.productImage ? (
          <Image source={{ uri: item.productImage }} style={styles.productImageNew} />
        ) : (
          <View style={styles.placeholderImageNew}>
            <Ionicons name="cube-outline" size={24} color="#94A3B8" />
          </View>
        )}
        <View style={styles.productDetailsNew}>
          <View>
            {/* Premium Category Tag */}
            <View style={styles.categoryBadgeContainer}>
              <Text style={styles.categoryBadgeText}>{itemCategory.toUpperCase()}</Text>
            </View>

            <Text style={styles.productTextNew} numberOfLines={1}>{item.productName}</Text>
            
            {item.selectedVariation && (
              <View style={styles.variationRow}>
                <Ionicons name="pricetag-outline" size={11} color="#64748B" />
                <Text style={styles.variationText}>{item.selectedVariation}</Text>
              </View>
            )}

            {item.services && item.services.length > 0 && (
              <View style={styles.servicesContainer}>
                {item.services.map((s, idx) => (
                  <Text key={idx} style={styles.serviceTextNew}>
                    • {s.label} <Text style={styles.servicePrice}>(+₱{Number(s.price).toFixed(2)})</Text>
                  </Text>
                ))}
              </View>
            )}
          </View>
          
          <View style={styles.qtyPriceRow}>
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyTextNew}>× {item.quantity}</Text>
            </View>
            <Text style={styles.itemTotalNew}>₱{itemTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

  // Helper listener parameter to update current page status instantly after modal actions close
  const handleModalClose = (wasSubmitted) => {
    setReportVisible(false);
    if (wasSubmitted) {
      setHasBeenReported(true);
    }
  };

  if (!order) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  const isBiddingOrder = Array.isArray(order.items) && order.items.some(i => i.source === 'notification' || i.productType === 'bidding');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Header Layout Block */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerReferenceRow}>
            <Text style={styles.headerTitle}>Order Details</Text>
            
            {/* Store Pickup / Courier Distribution Dynamic Badge Wrapper */}
            {order.deliveryMethod === 'Pickup' ? (
              <View style={styles.pickupBadge}>
                <Ionicons name="storefront-outline" size={10} color="#1E3A8A" style={{ marginRight: 3 }} />
                <Text style={styles.pickupBadgeText}>PICKUP</Text>
              </View>
            ) : (
              <View style={styles.deliveryBadge}>
                <Ionicons name="bicycle-outline" size={11} color="#047857" style={{ marginRight: 3 }} />
                <Text style={styles.deliveryBadgeText}>DELIVERY</Text>
              </View>
            )}

            {isBiddingOrder && (
              <View style={styles.biddingBadge}>
                <Ionicons name="hammer-outline" size={10} color="#1E3A8A" style={{ marginRight: 2 }} />
                <Text style={styles.biddingBadgeText}>BIDDING</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSubtitle}>#{order.orderNumber}</Text>
        </View>
        
        {/* Dynamic Alert Icon State Management */}
        {checkingReport ? (
          <View style={styles.alertIconButtonDisabled}>
            <ActivityIndicator size="small" color="#94A3B8" />
          </View>
        ) : hasBeenReported ? (
          <View style={styles.alertIconButtonDisabled}>
            <Image source={AlertIcon} style={[styles.alertIconImage, { opacity: 0.3 }]} />
          </View>
        ) : (
          <TouchableOpacity 
            onPress={() => setReportVisible(true)} 
            style={styles.alertIconButton}
            activeOpacity={0.7}
          >
            <Image source={AlertIcon} style={styles.alertIconImage} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        
        {/* Unified Status Visual Showcase */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadgeGlobal, { backgroundColor: getStatusBadgeStyle(order.status).backgroundColor }]}>
            <MaterialCommunityIcons 
              name={getStatusBadgeStyle(order.status).icon} 
              size={16} 
              color={getStatusBadgeStyle(order.status).color} 
            />
            <Text style={[styles.statusTextGlobal, { color: getStatusBadgeStyle(order.status).color }]}>
              {order.status}
            </Text>
          </View>
          <Text style={styles.orderDateText}>Placed on {new Date().toLocaleDateString()}</Text>
        </View>

        {/* Dynamic Delivery Destination Address Block */}
        {order.address && (
          <View style={styles.cardWrapper}>
            <View style={styles.cardHeader}>
              <View style={styles.headerIconContainer}>
                <Feather name="map-pin" size={16} color="#1E3A8A" />
              </View>
              <Text style={styles.cardTitle}>Delivery Address</Text>
            </View>
            
            <View style={styles.addressInfo}>
              <Text style={styles.addressNameText}>{order.address.fullName}</Text>
              <Text style={styles.addressContactText}>{order.address.contactNumber}</Text>
              <Text style={styles.addressFullText}>{order.address.fullAddress}</Text>
            </View>
            
            {order.address.latitude && order.address.longitude && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: order.address.latitude,
                    longitude: order.address.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: order.address.latitude, longitude: order.address.longitude }} />
                </MapView>
              </View>
            )}
          </View>
        )}

        {/* Grouped Products/Items Stack */}
        {groupedItems.map(group => (
          <View key={group.shopName} style={styles.vendorSection}>
            <View style={styles.vendorHeader}>
              <MaterialCommunityIcons name="storefront-outline" size={16} color="#475569" />
              <Text style={styles.shopNameNew}>{group.shopName}</Text>
            </View>
            {group.items.map(item => renderItemCard(item))}
          </View>
        ))}

        {/* Financial Accounting Breakdown Card */}
        <View style={styles.cardWrapper}>
          <Text style={styles.cardTitleSummary}>Payment Summary</Text> 
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₱{(order.subtotal || 0).toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱{(order.shippingFee || 0).toFixed(2)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₱{(order.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
        </View>

        {/* Context-Driven Cancel Action Directive */}
        {order.status === 'Pending' && (
          <TouchableOpacity
            disabled={isCancelling}
            style={[styles.cancelButton, isCancelling && { opacity: 0.6 }]}
            onPress={handleCancelOrder}
            activeOpacity={0.8}
          >
            {isCancelling ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Feather name="x-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Declarative mount of the vendor-to-user report modal */}
      <ReportUserModal
        visible={reportVisible}
        onClose={(wasSubmitted) => handleModalClose(wasSubmitted)}
        orderId={order.id}
        orderData={order}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FAFAFA',
  },
  header: {
    height: Platform.OS === 'ios' ? 105 : 75,
    paddingTop: Platform.OS === 'ios' ? 45 : 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
        marginTop: 35

  },
  backButton: { 
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerReferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  pickupBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#EFF6FF', 
    paddingHorizontal: 6, 
    paddingVertical: 1.5, 
    borderRadius: 4, 
    borderWidth: 0.5, 
    borderColor: '#BFDBFE' 
  },
  pickupBadgeText: { 
    fontSize: 8, 
    fontWeight: '700', 
    color: '#1E3A8A' 
  },
  deliveryBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#ECFDF5', 
    paddingHorizontal: 6, 
    paddingVertical: 1.5, 
    borderRadius: 4, 
    borderWidth: 0.5, 
    borderColor: '#A7F3D0' 
  },
  deliveryBadgeText: { 
    fontSize: 8, 
    fontWeight: '700', 
    color: '#047857' 
  },
  biddingBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF7ED', 
    paddingHorizontal: 6, 
    paddingVertical: 1.5, 
    borderRadius: 4, 
    borderWidth: 0.5, 
    borderColor: '#FFEDD5' 
  },
  biddingBadgeText: { 
    fontSize: 8, 
    fontWeight: '700', 
    color: '#C2410C' 
  },
  alertIconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2'
  },
  alertIconButtonDisabled: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  alertIconImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  statusSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusBadgeGlobal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  statusTextGlobal: {
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  orderDateText: {
    marginTop: 6,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  cardWrapper: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    marginHorizontal: 16,
    marginTop: 14, 
    padding: 16, 
    shadowColor: '#0F172A', 
    shadowOpacity: 0.015, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8
  },
  headerIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#0F172A',
  },
  addressInfo: { marginBottom: 12 },
  addressNameText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  addressContactText: { fontSize: 13, color: '#64748B', marginTop: 1, fontWeight: '500' },
  addressFullText: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  mapContainer: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  map: { flex: 1 },
  vendorSection: { marginHorizontal: 16, marginTop: 20 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginLeft: 2 },
  shopNameNew: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  itemCardNew: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    padding: 12, 
    marginBottom: 10, 
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  productRow: { flexDirection: 'row', gap: 12 },
  productImageNew: { width: 75, height: 75, borderRadius: 10 },
  placeholderImageNew: { width: 75, height: 75, borderRadius: 10, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  productDetailsNew: { flex: 1, justifyContent: 'space-between' },
  productTextNew: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  variationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  variationText: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  servicesContainer: { marginTop: 3 },
  serviceTextNew: { fontSize: 11, color: '#94A3B8' },
  servicePrice: { color: '#64748B', fontWeight: '600' },
  qtyPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  qtyBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  qtyTextNew: { fontSize: 11, fontWeight: '700', color: '#475569' },
  itemTotalNew: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  cardTitleSummary: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },
  cancelButton: { 
    marginHorizontal: 16, 
    marginTop: 20, 
    borderRadius: 14, 
    paddingVertical: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row',
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  categoryBadgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9', // Subtle obsidian/slate background
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569', // Dark slate text
    letterSpacing: 0.5,
  },
  cancelButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '700' }
});