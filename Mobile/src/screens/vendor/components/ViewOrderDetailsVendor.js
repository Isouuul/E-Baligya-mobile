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
  Linking, 
  Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from '../../../firebase';

const { width } = Dimensions.get('window');
const MAP_HEIGHT = 180;

const getStatusBadgeStyle = status => {
  switch (status) {
    case 'Pending':
      return { backgroundColor: '#FEF3C7', color: '#D97706' }; // Soft Amber
    case 'Preparing':
      return { backgroundColor: '#DBEAFE', color: '#2563EB' }; // Soft Blue
    case 'ToDeliver':
      return { backgroundColor: '#F5F3FF', color: '#7C3AED' }; // Soft Violet
    case 'Completed':
      return { backgroundColor: '#D1FAE5', color: '#059669' }; // Soft Emerald
    case 'Cancelled':
      return { backgroundColor: '#FEE2E2', color: '#DC2626' }; // Soft Red
    default:
      return { backgroundColor: '#F1F5F9', color: '#475569' }; // Soft Slate
  }
};

export default function ViewOrderDetailsVendor() {
  const navigation = useNavigation();
  const route = useRoute();
  const order = route.params?.order;
  const [isCancelling, setIsCancelling] = useState(false);

  // Group items by vendor
  const groupedItems = useMemo(() => {
    const groups = {};
    order.items.forEach(item => {
      const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
      if (!groups[businessName]) groups[businessName] = [];
      groups[businessName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [order.items]);

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
              <Ionicons name="image-outline" size={28} color="#94A3B8" />
            </View>
          )}
          <View style={styles.productDetailsNew}>
            <Text style={styles.productTextNew} numberOfLines={2}>{item.productName}</Text>

            {item.services && item.services.length > 0 && (
              <View style={styles.servicesContainer}>
                <Text style={styles.serviceHeader}>Additional Services:</Text>
                {item.services.map((s, idx) => (
                  <Text key={idx} style={styles.serviceTextNew}>
                    • {s.label} <Text style={styles.servicePrice}>(+₱{Number(s.price).toFixed(2)})</Text>
                  </Text>
                ))}
              </View>
            )}
            
            <View style={styles.qtyPriceRow}>
              <Text style={styles.qtyTextNew}>Qty: <Text style={styles.qtyHighlight}>{item.quantity}</Text></Text>
              <Text style={styles.itemTotalNew}>₱{itemTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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

              // Copy order data to CancelledOrders
              await setDoc(doc(db, "CancelledOrders", order.id), {
                ...order,
                cancelledAt: new Date(),
              });

              // Delete original order
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

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        
        {/* Progress Tracker Flag */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <View style={[styles.statusBadgeGlobal, getStatusBadgeStyle(order.status)]}>
            <View style={[styles.statusIndicatorDot, { backgroundColor: getStatusBadgeStyle(order.status).color }]} />
            <Text style={[styles.statusTextGlobal, { color: getStatusBadgeStyle(order.status).color }]}>
              {order.status}
            </Text>
          </View>
        </View>

        {/* Address Card */}
        {order.address && (
          <View style={styles.addressWrapper}>
            <View style={styles.addressTitleRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color="#0F172A" />
              </View>
              <Text style={styles.sectionTitleNew}>Delivery Destination</Text>
            </View>
            
            <View style={styles.addressDetailsContainer}>
              <Text style={styles.addressNameText}>{order.address.fullName}</Text>
              <Text style={styles.addressContactText}>📞 {order.address.contactNumber}</Text>
              <Text style={styles.addressFullText}>{order.address.fullAddress}</Text>
              
              {order.address.latitude && order.address.longitude && (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: order.address.latitude,
                      longitude: order.address.longitude,
                      latitudeDelta: 0.008,
                      longitudeDelta: 0.008,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: order.address.latitude,
                        longitude: order.address.longitude,
                      }}
                      title="Delivery Location"
                    />
                  </MapView>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Grouped Items */}
        {groupedItems.map(group => {
          const shopImage = group.items[0].uploadedBy?.profileImage || null;
          return (
            <View key={group.shopName} style={styles.vendorContainer}>
              <View style={styles.vendorHeaderNew}>
                {shopImage ? (
                  <Image source={{ uri: shopImage }} style={styles.vendorImageNew} />
                ) : (
                  <View style={styles.vendorPlaceholderNew}>
                    <Ionicons name="business" size={16} color="#64748B" />
                  </View>
                )}
                <Text style={styles.shopNameNew}>{group.shopName}</Text>
              </View>

              {group.items.map(item => renderItemCard(item))}
            </View>
          );
        })}

        {/* Order Summary Card */}
        <View style={styles.orderSummaryNew}>
          <Text style={styles.summaryTitleNew}>Bill Details</Text> 
          
          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Order ID</Text>
            <Text style={styles.orderNumberText}>#{order.orderNumber}</Text>
          </View>
          
          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Items Subtotal</Text>
            <Text style={styles.summaryValue}>₱{order.subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryRowNew}>
            <Text style={styles.summaryLabel}>Delivery Partner Fee</Text>
            <Text style={styles.shippingValue}>₱{order.shippingFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={[styles.summaryRowNew, { marginTop: 12 }]}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>₱{order.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          disabled={isCancelling}
          style={[
            styles.cancelButton, 
            { backgroundColor: isCancelling ? '#FDA4AF' : '#FFEBEB' }
          ]}
          onPress={handleCancelOrder}
          activeOpacity={0.8}
        >
          {isCancelling ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Order Request</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  
  // Premium Clean Header
  header: {
    height: Platform.OS === 'ios' ? 90 : 60,
    paddingTop: Platform.OS === 'ios' ? 30 : 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginTop: 35
  },
  backButton: { 
    padding: 8,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // Global Status Tracker
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadgeGlobal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusTextGlobal: {
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
  },

  // Address Card
  addressWrapper: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    marginHorizontal: 16,
    marginTop: 16, 
    padding: 16, 
    shadowColor: '#0F172A', 
    shadowOpacity: 0.04, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  addressTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  iconCircle: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginRight: 8,
  },
  sectionTitleNew: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  addressDetailsContainer: { 
    marginTop: 4 
  },
  addressNameText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#1E293B' 
  },
  addressContactText: { 
    fontSize: 13, 
    color: '#64748B', 
    marginTop: 4,
    fontWeight: '500',
  },
  addressFullText: { 
    fontSize: 13, 
    color: '#475569', 
    lineHeight: 18, 
    marginTop: 6 
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  map: { 
    width: '100%', 
    height: MAP_HEIGHT, 
  },

  // Vendor Header Section
  vendorContainer: { 
    marginHorizontal: 16, 
    marginTop: 20 
  },
  vendorHeaderNew: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10,
    marginLeft: 4,
  },
  vendorImageNew: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    marginRight: 10 
  },
  vendorPlaceholderNew: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#F1F5F9', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  shopNameNew: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#0F172A',
    letterSpacing: -0.1,
  },

  // Premium Item Card
  itemCardNew: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 10, 
    shadowColor: '#0F172A', 
    shadowOpacity: 0.03, 
    shadowRadius: 6, 
    shadowOffset: { width: 0, height: 3 }, 
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  productRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  productImageNew: { 
    width: 76, 
    height: 76, 
    borderRadius: 12 
  },
  placeholderImageNew: { 
    width: 76, 
    height: 76, 
    borderRadius: 12, 
    backgroundColor: '#F1F5F9', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  productDetailsNew: { 
    flex: 1,
    justifyContent: 'space-between',
  },
  productTextNew: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#0F172A',
    lineHeight: 18,
  },
  servicesContainer: { 
    marginTop: 6,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#E2E8F0',
  },
  serviceHeader: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#475569',
    marginBottom: 2,
  },
  serviceTextNew: { 
    fontSize: 11, 
    color: '#64748B', 
    marginTop: 1 
  },
  servicePrice: {
    fontWeight: '700',
    color: '#1E293B',
  },
  qtyPriceRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  qtyTextNew: { 
    fontSize: 13, 
    color: '#64748B',
    fontWeight: '500',
  },
  qtyHighlight: {
    fontWeight: '800',
    color: '#0F172A',
  },
  itemTotalNew: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#0F172A' 
  },

  // Receipt Style Order Summary
  orderSummaryNew: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 16, 
    marginTop: 16, 
    marginBottom: 20, 
    shadowColor: '#0F172A', 
    shadowOpacity: 0.04, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 }, 
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  summaryTitleNew: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#0F172A',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  summaryRowNew: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginVertical: 4 
  },
  summaryLabel: { 
    fontSize: 13, 
    color: '#64748B',
    fontWeight: '500',
  },
  orderNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  summaryValue: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#1E293B' 
  },
  shippingValue: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#1E293B' 
  },
  divider: { 
    height: 1, 
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  totalLabel: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#0F172A' 
  },
  totalValue: { 
    fontSize: 18, 
    fontWeight: '900', 
    color: '#059669' // Premium Emerald Green
  },

  // Premium Cancellation Trigger Button
  cancelButton: { 
    marginHorizontal: 16, 
    marginBottom: 24, 
    borderRadius: 14, 
    paddingVertical: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  cancelButtonText: { 
    color: '#EF4444', 
    fontSize: 14, 
    fontWeight: '800',
    letterSpacing: -0.1,
  }
});