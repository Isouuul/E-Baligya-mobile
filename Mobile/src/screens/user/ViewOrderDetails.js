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
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from '../../firebase';

const { width } = Dimensions.get('window');

const getStatusConfig = status => {
  switch (status) {
    case 'Pending':
      return { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', icon: 'clock-outline' };
    case 'Preparing':
      return { label: 'Preparing', color: '#3B82F6', bg: '#DBEAFE', icon: 'silverware-clean' };
    case 'ToDeliver':
      return { label: 'Out for Delivery', color: '#8B5CF6', bg: '#EDE9FE', icon: 'truck-delivery-outline' };
    case 'Completed':
      return { label: 'Completed', color: '#10B981', bg: '#D1FAE5', icon: 'check-circle-outline' };
    case 'Cancelled':
      return { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' };
    default:
      return { label: status, color: '#6B7280', bg: '#F3F4F6', icon: 'help-circle-outline' };
  }
};

export default function ViewOrderDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const order = route.params?.order;
  const [isCancelling, setIsCancelling] = useState(false);

  const statusConfig = getStatusConfig(order.status);

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
          style: 'destructive',
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

    return (
      <View key={item.productId} style={styles.itemCard}>
        <View style={styles.productRow}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.productImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="fast-food-outline" size={30} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={1}>{item.productName}</Text>
            <Text style={styles.variantText}>Variant: {item.selectedVariation || 'Standard'}</Text>
            {item.services?.map((s, idx) => (
              <Text key={idx} style={styles.serviceText}>+ {s.label} (₱{Number(s.price).toFixed(2)})</Text>
            ))}
            <View style={styles.qtyPriceRow}>
              <Text style={styles.qtyText}>Qty: {item.quantity}</Text>
              <Text style={styles.itemTotal}>₱{itemTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Order Details</Text>
          <Text style={styles.headerSubtitle}>ID: {order.orderNumber}</Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Modern Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
          <MaterialCommunityIcons name={statusConfig.icon} size={24} color={statusConfig.color} />
          <Text style={[styles.statusBannerText, { color: statusConfig.color }]}>
            Order is {statusConfig.label}
          </Text>
        </View>

        {/* Delivery Address Card */}
        {order.address && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Feather name="map-pin" size={18} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Delivery Address</Text>
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressName}>{order.address.fullName}</Text>
              <Text style={styles.addressPhone}>{order.address.contactNumber}</Text>
              <Text style={styles.addressText}>{order.address.fullAddress}</Text>
              
              {order.address.latitude && (
                <View style={styles.mapWrapper}>
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
          </View>
        )}

        {/* Items List */}
        <Text style={styles.listLabel}>Your Order Items</Text>
        {groupedItems.map(group => (
          <View key={group.shopName} style={styles.vendorSection}>
            <View style={styles.vendorHeader}>
              <MaterialCommunityIcons name="storefront-outline" size={20} color="#1F2937" />
              <Text style={styles.shopName}>{group.shopName}</Text>
            </View>
            {group.items.map(item => renderItemCard(item))}
          </View>
        ))}

        {/* Financial Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₱{order.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱{order.shippingFee.toFixed(2)}</Text>
          </View>
          <View style={styles.totalDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalPrice}>₱{order.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Professional Cancel Action */}
        {order.status === 'Pending' && (
          <TouchableOpacity
            disabled={isCancelling}
            onPress={handleCancelOrder}
            style={[styles.cancelBtn, isCancelling && { opacity: 0.7 }]}
          >
            {isCancelling ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Order</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  
  // Header
  header: {
    height: 100,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  headerTextContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusBannerText: { fontSize: 15, fontWeight: '700' },

  // Cards
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  
  addressContent: {},
  addressName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  addressPhone: { fontSize: 13, color: '#6B7280', marginVertical: 2 },
  addressText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  
  mapWrapper: { height: 120, borderRadius: 12, overflow: 'hidden', marginTop: 12 },
  map: { flex: 1 },

  // Vendor & Items
  listLabel: { marginHorizontal: 16, marginTop: 24, fontSize: 14, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
  vendorSection: { marginHorizontal: 16, marginTop: 12 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  shopName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  productRow: { flexDirection: 'row', gap: 12 },
  productImage: { width: 70, height: 70, borderRadius: 12 },
  placeholderImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  productDetails: { flex: 1, justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  variantText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  serviceText: { fontSize: 11, color: '#3B82F6', marginTop: 1 },
  qtyPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  qtyText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  itemTotal: { fontSize: 15, fontWeight: '700', color: '#111827' },

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  totalDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#111827' },
  totalPrice: { fontSize: 18, fontWeight: '800', color: '#3B82F6' },

  // Buttons
  cancelBtn: {
    marginTop: 24,
    marginHorizontal: 16,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: 'transparent'
  },
  cancelBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});