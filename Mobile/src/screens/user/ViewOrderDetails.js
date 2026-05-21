// src/screens/Users/ViewOrderDetails.js
import React, { useMemo, useState } from 'react';
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
import { doc, writeBatch } from "firebase/firestore";
import { db } from '../../firebase';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 180;

const DEFAULT_LATITUDE = 10.7202; 
const DEFAULT_LONGITUDE = 122.5621;

const getStatusConfig = status => {
  switch (status) {
    case 'Pending':
      return { label: 'Pending', color: '#C2410C', bg: '#FFF7ED', icon: 'clock-outline' };
    case 'Preparing':
      return { label: 'Preparing', color: '#1D4ED8', bg: '#EFF6FF', icon: 'silverware-clean' };
    case 'ToDeliver':
    case 'To Deliver':
      return { label: 'Out for Delivery', color: '#6D28D9', bg: '#F5F3FF', icon: 'moped' };
    case 'Completed':
    case 'Complete':
      return { label: 'Completed', color: '#047857', bg: '#ECFDF5', icon: 'check-decagram' };
    case 'Cancelled':
      return { label: 'Cancelled', color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle-outline' };
    default:
      return { label: status, color: '#475569', bg: '#F8FAFC', icon: 'help-circle-outline' };
  }
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  const dateObj = typeof timestamp.toDate === 'function' 
    ? timestamp.toDate() 
    : new Date(timestamp);
    
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }
  
  return dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function ViewOrderDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const order = route.params?.order;
  const [isCancelling, setIsCancelling] = useState(false);

  const statusConfig = useMemo(() => getStatusConfig(order?.status), [order?.status]);

  const relativeOrderTime = useMemo(() => {
    return formatRelativeTime(order?.createdAt);
  }, [order?.createdAt]);

  const isPickupOrder = useMemo(() => {
    const method = (order?.deliveryMethod || '').toLowerCase();
    return method === 'pickup' || order?.shippingFee === 0;
  }, [order?.deliveryMethod, order?.shippingFee]);

  const groupedItems = useMemo(() => {
    const groups = {};
    if (order && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const businessName = item.uploadedBy?.businessName || item.businessName || 'Unknown Vendor';
        if (!groups[businessName]) groups[businessName] = [];
        groups[businessName].push(item);
      });
    }
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [order?.items]);

  /* 
    🛠️ UPDATED PARSER:
    Explicitly extracts 'phone', 'businessType', and 'marketName' 
    directly from your ApprovedVendors profile layout.
  */
  const addressPayload = useMemo(() => {
    if (!order) return { title: 'Address Location', details: 'No location details available.', lat: DEFAULT_LATITUDE, lng: DEFAULT_LONGITUDE };

    if (isPickupOrder) {
      const typicalItem = order.items?.[0] || {};
      const vendorInfo = typicalItem.uploadedBy || typicalItem;

      // Extract your custom field parameters
      const street = vendorInfo.streetName || '';
      const brgy = vendorInfo.selectedBarangay || '';
      const city = vendorInfo.selectedCity || '';
      const prov = vendorInfo.selectedProvince || '';
      
      const phoneNum = vendorInfo.phone || "No contact listed";
      const bizType = vendorInfo.businessType ? ` (${vendorInfo.businessType})` : '';
      const market = vendorInfo.marketName ? ` [${vendorInfo.marketName}]` : '';

      const fullStoreAddress = [street, brgy, city, prov].filter(Boolean).join(', ') || vendorInfo.fullAddress;

      return {
        title: "Store Pickup Address",
        name: `${vendorInfo.businessName || "Vendor Storefront"}${bizType}`,
        contact: `Phone: ${phoneNum}`,
        details: fullStoreAddress ? `${fullStoreAddress}${market}`.trim() : "Proceed to vendor location to collect.",
        lat: Number(vendorInfo.latitude || order.latitude || DEFAULT_LATITUDE),
        lng: Number(vendorInfo.longitude || order.longitude || DEFAULT_LONGITUDE)
      };
    } else {
      const addr = order.address || {};
      return {
        title: "Delivery Destination Address",
        name: addr.fullName || "Recipient Name",
        contact: addr.contactNumber ? `Phone: ${addr.contactNumber}` : "No contact number listed",
        details: addr.fullAddress || (typeof order.address === 'string' ? order.address : "No delivery coordinates provided."),
        lat: Number(addr.latitude || order.latitude || DEFAULT_LATITUDE),
        lng: Number(addr.longitude || order.longitude || DEFAULT_LONGITUDE)
      };
    }
  }, [order, isPickupOrder]);

  const handleCancelOrder = async () => {
    if (isCancelling) return;
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const batch = writeBatch(db);
              const orderRef = doc(db, "Orders", order.id);
              const cancelRef = doc(db, "CancelledOrders", order.id);
              
              batch.set(cancelRef, {
                ...order,
                cancelledAt: new Date(),
                status: 'Cancelled'
              });
              batch.delete(orderRef);
              
              await batch.commit();
              Alert.alert("Success", "Your order has been cancelled.");
              navigation.goBack();
            } catch (error) {
              console.error(error);
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
    const variationPrice = Number(item.selectedVariationPrice || 0);
    const servicesTotal = (item.services || []).reduce((a, s) => a + Number(s.price || 0), 0);
    const itemTotal = (base + variationPrice + servicesTotal) * (item.quantity || 1);
    const itemCategory = item.category || item.productCategory || 'Product';

    return (
      <View key={item.productId || Math.random().toString()} style={styles.itemCardNew}>
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
              <View style={styles.categoryBadgeContainer}>
                <Text style={styles.categoryBadgeText}>{itemCategory.toUpperCase()}</Text>
              </View>

              <Text style={styles.productTextNew} numberOfLines={1}>{item.productName}</Text>
              
              <View style={styles.variationRow}>
                <Ionicons name="pricetag-outline" size={11} color="#64748B" />
                <Text style={styles.variationText}>{item.selectedVariation || 'Standard'}</Text>
              </View>

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
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerReferenceRow}>
            <Text style={styles.headerTitle}>Order Details</Text>
            
            {isPickupOrder ? (
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
          <Text style={styles.headerSubtitle}>#{order.orderNumber || 'No Identifier'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.statusSection}>
          <View style={[styles.statusBadgeGlobal, { backgroundColor: statusConfig.bg }]}>
            <MaterialCommunityIcons name={statusConfig.icon} size={16} color={statusConfig.color} />
            <Text style={[styles.statusTextGlobal, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <Text style={styles.orderDateText}>Ordered {relativeOrderTime}</Text>
        </View>

        {/* MAP & ADDRESS COMPONENT */}
        <View style={styles.cardWrapper}>
          <View style={styles.cardHeader}>
            <View style={styles.headerIconContainer}>
              <Feather name={isPickupOrder ? "home" : "map-pin"} size={16} color="#1E3A8A" />
            </View>
            <Text style={styles.cardTitle}>{addressPayload.title}</Text>
          </View>
          
          <View style={styles.addressInfo}>
            <Text style={styles.addressNameText}>{addressPayload.name}</Text>
            <Text style={styles.addressContactText}>{addressPayload.contact}</Text>
            <Text style={styles.addressFullText}>{addressPayload.details}</Text>
          </View>
          
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={{
                latitude: addressPayload.lat,
                longitude: addressPayload.lng,
                latitudeDelta: 0.006,
                longitudeDelta: 0.006,
              }}
              scrollEnabled={true}
              zoomEnabled={true}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker 
                coordinate={{ latitude: addressPayload.lat, longitude: addressPayload.lng }}
                title={addressPayload.name}
              />
            </MapView>
          </View>
        </View>

        <Text style={styles.listLabel}>Your Order Items</Text>
        {groupedItems.map(group => (
          <View key={group.shopName} style={styles.vendorSection}>
            <View style={styles.vendorHeader}>
              <MaterialCommunityIcons name="storefront-outline" size={16} color="#475569" />
              <Text style={styles.shopNameNew}>{group.shopName}</Text>
            </View>
            {group.items.map(item => renderItemCard(item))}
          </View>
        ))}

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
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>₱{(order.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
        </View>

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
    marginTop: Platform.OS === 'ios' ? 0 : 25
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
    fontWeight: '600',
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
  addressContactText: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '600' },
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
  listLabel: { marginHorizontal: 18, marginTop: 24, fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
  vendorSection: { marginHorizontal: 16, marginTop: 12 },
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
    backgroundColor: '#F1F5F9',
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
    color: '#475569',
    letterSpacing: 0.5,
  },
  cancelButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '700' }
});