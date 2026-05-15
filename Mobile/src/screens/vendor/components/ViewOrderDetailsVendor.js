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
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from '../../../firebase';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 200;

const getStatusBadgeStyle = status => {
  switch (status) {
    case 'Pending':
      return { backgroundColor: '#FFF7ED', color: '#C2410C', icon: 'clock-outline' };
    case 'Preparing':
      return { backgroundColor: '#EFF6FF', color: '#1D4ED8', icon: 'silverware-clean' };
    case 'ToDeliver':
      return { backgroundColor: '#F5F3FF', color: '#6D28D9', icon: 'moped' };
    case 'Completed':
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

  const groupedItems = useMemo(() => {
    const groups = {};
    order.items.forEach(item => {
      const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
      if (!groups[businessName]) groups[businessName] = [];
      groups[businessName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [order.items]);

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

    return (
      <View key={item.productId} style={styles.itemCardNew}>
        <View style={styles.productRow}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.productImageNew} />
          ) : (
            <View style={styles.placeholderImageNew}>
              <Ionicons name="image-outline" size={24} color="#CBD5E1" />
            </View>
          )}
          <View style={styles.productDetailsNew}>
            <View>
              <Text style={styles.productTextNew} numberOfLines={1}>{item.productName}</Text>
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Order Details</Text>
          <Text style={styles.headerSubtitle}>#{order.orderNumber}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {/* Status Section */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadgeGlobal, { backgroundColor: getStatusBadgeStyle(order.status).backgroundColor }]}>
            <MaterialCommunityIcons 
              name={getStatusBadgeStyle(order.status).icon} 
              size={18} 
              color={getStatusBadgeStyle(order.status).color} 
            />
            <Text style={[styles.statusTextGlobal, { color: getStatusBadgeStyle(order.status).color }]}>
              {order.status}
            </Text>
          </View>
          <Text style={styles.orderDateText}>Placed on {new Date().toLocaleDateString()}</Text>
        </View>

        {/* Delivery Card */}
        {order.address && (
          <View style={styles.cardWrapper}>
            <View style={styles.cardHeader}>
              <Feather name="map-pin" size={18} color="#6366F1" />
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
                >
                  <Marker coordinate={{ latitude: order.address.latitude, longitude: order.address.longitude }} />
                </MapView>
              </View>
            )}
          </View>
        )}

        {/* Grouped Items */}
        {groupedItems.map(group => (
          <View key={group.shopName} style={styles.vendorSection}>
            <View style={styles.vendorHeader}>
              <MaterialCommunityIcons name="storefront-outline" size={20} color="#64748B" />
              <Text style={styles.shopNameNew}>{group.shopName}</Text>
            </View>
            {group.items.map(item => renderItemCard(item))}
          </View>
        ))}

        {/* Summary Card */}
        <View style={styles.cardWrapper}>
          <Text style={styles.cardTitleSummary}>Payment Summary</Text> 
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₱{order.subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱{order.shippingFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₱{order.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          disabled={isCancelling}
          style={[styles.cancelButton, isCancelling && { opacity: 0.7 }]}
          onPress={handleCancelOrder}
          activeOpacity={0.8}
        >
          {isCancelling ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <>
              <Feather name="x-circle" size={18} color="#EF4444" style={{marginRight: 8}} />
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FBFBFE' 
  },
  header: {
    height: Platform.OS === 'ios' ? 110 : 70,
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: { 
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500'
  },
  headerSpacer: { width: 40 },

  statusSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
  },
  statusBadgeGlobal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusTextGlobal: {
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  orderDateText: {
    marginTop: 8,
    fontSize: 13,
    color: '#94A3B8',
  },

  cardWrapper: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    marginHorizontal: 16,
    marginTop: 16, 
    padding: 20, 
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 15, 
    shadowOffset: { width: 0, height: 5 }, 
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8
  },
  cardTitle: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#1E293B',
  },
  addressInfo: { marginBottom: 12 },
  addressNameText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  addressContactText: { fontSize: 14, color: '#64748B', marginTop: 2 },
  addressFullText: { fontSize: 14, color: '#475569', marginTop: 8, lineHeight: 20 },
  
  mapContainer: {
    height: MAP_HEIGHT,
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  map: { flex: 1 },

  vendorSection: { marginHorizontal: 16, marginTop: 24 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginLeft: 4 },
  shopNameNew: { fontSize: 14, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 },

  itemCardNew: { 
    backgroundColor: '#fff', 
    borderRadius: 18, 
    padding: 12, 
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  productRow: { flexDirection: 'row', gap: 12 },
  productImageNew: { width: 85, height: 85, borderRadius: 14 },
  placeholderImageNew: { width: 85, height: 85, borderRadius: 14, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  productDetailsNew: { flex: 1, justifyContent: 'space-between' },
  productTextNew: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  servicesContainer: { marginTop: 4 },
  serviceTextNew: { fontSize: 12, color: '#94A3B8' },
  servicePrice: { color: '#64748B', fontWeight: '600' },
  qtyPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  qtyTextNew: { fontSize: 12, fontWeight: '700', color: '#475569' },
  itemTotalNew: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  cardTitleSummary: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#64748B' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#10B981' },

  cancelButton: { 
    marginHorizontal: 16, 
    marginTop: 25, 
    borderRadius: 16, 
    paddingVertical: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row',
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cancelButtonText: { color: '#EF4444', fontSize: 15, fontWeight: '700' }
});