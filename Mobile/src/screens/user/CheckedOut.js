import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  StatusBar,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import Toast from 'react-native-toast-message';
import MapView, { Marker } from 'react-native-maps'; 

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';

export default function CheckedOut() {
  const navigation = useNavigation();
  const route = useRoute();
  
  // Account for both incoming parameters profiles safely
  const selectedItems = useMemo(() => {
    if (route.params?.cartItems) return route.params.cartItems; // Came from CartShop
    if (route.params?.product) return [route.params.product];    // Came from Buy Now direct
    return [];
  }, [route.params]);

  const checkoutOrigin = route.params?.origin || 'direct'; // 'cart' or 'direct'

  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); // State for success modal

  const SHIPPING_FEE = 50;

  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);

  const generateOrderNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${timestamp}-${random}`;
  };

  useEffect(() => {
    const fetchAddress = () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const addressesRef = collection(db, 'Users-Address', user.uid, 'addresses');
        const q = query(addressesRef, where('status', '==', 'active'));
        const unsubscribe = onSnapshot(q, snapshot => {
          if (!snapshot.empty) {
            const docData = snapshot.docs[0].data();
            setAddress({
              id: snapshot.docs[0].id,
              fullName: `${docData.firstName || ''} ${docData.lastName || ''}`.trim(),
              fullAddress: `${docData.streetName || ''}, ${docData.barangay || ''}, ${docData.city || ''}, ${docData.province || ''}, ${docData.region || ''}`,
              contactNumber: docData.phoneNumber || '',
              latitude: docData.latitude || null,
              longitude: docData.longitude || null,
            });
          } else {
            const allQ = query(addressesRef);
            onSnapshot(allQ, allSnapshot => {
              if (!allSnapshot.empty) {
                const docData = allSnapshot.docs[0].data();
                setAddress({
                  id: allSnapshot.docs[0].id,
                  fullName: `${docData.firstName || ''} ${docData.lastName || ''}`.trim(),
                  fullAddress: `${docData.streetName || ''}, ${docData.barangay || ''}, ${docData.city || ''}, ${docData.province || ''}, ${docData.region || ''}`,
                  contactNumber: docData.phoneNumber || '',
                  latitude: docData.latitude || null,
                  longitude: docData.longitude || null,
                });
              } else {
                setAddress(null);
              }
            });
          }
          setLoadingAddress(false);
        }, error => {
          console.error('Error fetching address:', error);
          setLoadingAddress(false);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching address:', error);
        setLoadingAddress(false);
      }
    };
    fetchAddress();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.selectedAddress) {
        setAddress(route.params.selectedAddress);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedAddress]);

  const groupedItems = useMemo(() => {
    const groups = {};
    selectedItems.forEach(item => {
      const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
      if (!groups[businessName]) groups[businessName] = [];
      groups[businessName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [selectedItems]);

  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      if (item.totalPrice) return sum + Number(item.totalPrice);
      
      const base = Number(item.basePrice || 0);
      const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + servicesTotal) * (item.quantity || 1);
    }, 0);
  }, [selectedItems]);

  const totalAmount = subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);

  // Switch dynamic payment values securely depending on delivery configurations
  const handleDeliveryMethodChange = (method) => {
    setDeliveryMethod(method);
    if (method === 'Pickup') {
      setPaymentMethod('Pay-On-Pickup');
    } else {
      setPaymentMethod('Cash-On-Delivery');
    }
  };

  const renderItemCard = item => {
    const displayPrice = item.totalPrice 
      ? item.totalPrice 
      : (Number(item.basePrice || 0) + (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0)) * (item.quantity || 1);

    return (
      <View key={item.cartItemId || item.id || item.productId} style={styles.itemCardPremium}>
        <View style={styles.productRow}>
          {item.productImage ? (
            <Image source={{ uri: item.productImage }} style={styles.productImagePremium} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderImagePremium}>
              <Feather name="box" size={24} color="#CBD5E1" />
            </View>
          )}
          <View style={styles.productDetailsPremium}>
            <Text style={styles.productTextPremium} numberOfLines={1}>{item.productName}</Text>
            <View style={styles.tagRow}>
              {item.category && (
                <View style={styles.categoryBadgePremium}>
                  <Text style={styles.categoryBadgeTextPremium}>{item.category.toUpperCase()}</Text>
                </View>
              )}
            </View>

            {item.selectedServices && item.selectedServices.length > 0 && (
              <View style={styles.serviceContainer}>
                {item.selectedServices.map((s, index) => (
                  <View key={index} style={styles.serviceItem}>
                    <Ionicons name="add-circle-outline" size={12} color="#64748B" />
                    <Text style={styles.serviceTextPremium}> {s.label} (₱{Number(s.price).toFixed(2)})</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.qtyPriceRowPremium}>
              <Text style={styles.qtyTextPremium}>Quantity: {item.quantity}kg</Text>
              <Text style={styles.itemTotalPremium}>₱{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    const user = auth.currentUser;
    if (!user) return;

    if (deliveryMethod === 'Delivery' && !address) {
      Toast.show({
        type: 'error',
        text1: 'Address Required',
        text2: 'Please select a delivery address to proceed.',
        visibilityTime: 5000,
      });
      return;
    }

    const orderNumber = generateOrderNumber();

    try {
      setIsSubmitting(true);
      const userRef = doc(db, 'Users', user.uid);
      const userSnap = await getDoc(userRef);
      let userData = {};
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        userData = {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          profileImage: data.profileImage || null,
        };
      }

      const orderData = {
        orderNumber,
        userId: user.uid,
        userFirstName: userData.firstName,
        userLastName: userData.lastName,
        userProfileImage: userData.profileImage,
        items: selectedItems.map(item => ({
          productId: item.productId || item.id,
          productName: item.productName,
          productImage: item.productImage || null,
          category: item.category || 'Uncategorized',
          quantity: item.quantity,
          basePrice: item.basePrice,
          services: item.selectedServices || [],
          uploadedBy: item.uploadedBy || null,
          totalPrice: item.totalPrice || null,
          Phone: item.vendorPhone || item.uploadedBy?.phone || '',
        })),
        deliveryMethod,
        shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
        subtotal,
        totalAmount,
        paymentMethod,
        leaveNote: leaveNote || '',
        address: deliveryMethod === 'Delivery' ? { ...address } : null,
        status: 'Pending',
        createdAt: serverTimestamp(),
      };

      // 1. Save order to Firestore
      await addDoc(collection(db, 'Orders'), orderData);

      // 2. Trigger Vendor Notifications for Cart Items
      const uniqueVendorIds = new Set();
      const notificationPromises = [];

      selectedItems.forEach(item => {
        const vendorId = item.uploadedBy?.uid || item.uploadedBy;
        
        if (vendorId && !uniqueVendorIds.has(vendorId)) {
          uniqueVendorIds.add(vendorId);

          const vendorNotificationData = {
            vendorId: vendorId,
            userId: user.uid,
            userFullName: `${userData.firstName} ${userData.lastName}`.trim(),
            userProfileImage: userData.profileImage,
            orderNumber: orderNumber,
            type: 'product_purchased',
            title: 'New Cart Order Received!',
            message: `${userData.firstName || 'A user'} has checked out items from your shop inventory.`,
            isRead: false,
            createdAt: serverTimestamp()
          };

          notificationPromises.push(
            addDoc(collection(db, 'Vendor_Notifications_Product'), vendorNotificationData)
          );
        }
      });

      if (notificationPromises.length > 0) {
        await Promise.all(notificationPromises);
      }

      // 3. Clear from cart collection ONLY if order originated from CartShop screen
      if (checkoutOrigin === 'cart') {
        const cartCollection = collection(db, 'Carts', user.uid, 'items');
        
        await Promise.all(
          selectedItems.map(item => {
            if (item.cartItemId) {
              return deleteDoc(doc(cartCollection, item.cartItemId));
            }
            return Promise.resolve();
          })
        );
      }

      // Open the Success Modal
      setShowSuccessModal(true);

    } catch (error) {
      console.error("Order processing failed: ", error);
      Toast.show({
        type: 'error',
        text1: 'Order failed',
        text2: 'Failed to place order. Please try again.',
        visibilityTime: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    navigation.navigate('ConsumerTabs', { screen: 'Product' });
  };

  if (selectedItems.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="basket-outline" size={80} color="#94A3B8" style={{ opacity: 0.5 }} />
        <Text style={styles.emptyTitle}>Basket is empty</Text>
        <Text style={styles.emptySubtitle}>You haven't selected any items yet.</Text>
        <TouchableOpacity
          style={styles.browseButtonPremium}
          onPress={() => navigation.navigate('ConsumerTabs', { screen: 'Product' })}
        >
          <Text style={styles.browseTextPremium}>Go Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Premium Header */}
      <View style={styles.headerPremium}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonCircle}>
          <Feather name="chevron-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitlePremium}>Finalize Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Address Card */}
        <View style={styles.sectionCardPremium}>
          <View style={styles.sectionHeaderPremium}>
            <View style={styles.titleIconRow}>
              <Feather name="map-pin" size={18} color="#0F172A" />
              <Text style={styles.sectionTitlePremium}>Delivery Address</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddressSelection', { from: 'CheckedOut' })}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addressBox}>
            {loadingAddress ? (
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : address ? (
              <View>
                <Text style={styles.addressName}>{address.fullName}</Text>
                <Text style={styles.addressPhone}><Feather name="phone" size={12} /> {address.contactNumber}</Text>
                <Text style={styles.addressText}>{address.fullAddress}</Text>
                
                {/* Embedded Static Map View Preview */}
                {address.latitude && address.longitude && (
                  <View style={styles.mapContainer}>
                    <MapView
                      style={styles.mapPreview}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      initialRegion={{
                        latitude: Number(address.latitude),
                        longitude: Number(address.longitude),
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                    >
                      <Marker
                        coordinate={{
                          latitude: Number(address.latitude),
                          longitude: Number(address.longitude),
                        }}
                        pinColor="#3b82f6"
                      />
                    </MapView>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.emptyTextNote}>No active address found. Please select one.</Text>
            )}
          </View>
        </View>

        {/* Order Items Grouped by Shop/Vendor */}
        {groupedItems.map(group => (
          <View key={group.shopName} style={styles.vendorGroup}>
            <View style={styles.vendorHeader}>
              <Feather name="shopping-bag" size={16} color="#64748B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.vendorNameText}>{group.shopName}</Text>
                {group.items[0]?.uploadedBy?.phone && (
                  <Text style={styles.vendorPhoneText}>
                    <Feather name="phone" size={10} /> {group.items[0].uploadedBy.phone}
                  </Text>
                )}
              </View>
            </View>
            {group.items.map(item => renderItemCard(item))}
          </View>
        ))}

        {/* Delivery & Payment Container */}
        <View style={styles.sectionCardPremium}>
          <Text style={styles.sectionTitlePremium}>Payment & Shipping</Text>

          <View style={styles.optionGrid}>
            <TouchableOpacity
              style={[styles.optionPill, deliveryMethod === 'Delivery' && styles.optionPillActive]}
              onPress={() => handleDeliveryMethodChange('Delivery')}
            >
              <Text style={[styles.optionPillText, deliveryMethod === 'Delivery' && styles.optionPillTextActive]}>Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionPill, deliveryMethod === 'Pickup' && styles.optionPillActive]}
              onPress={() => handleDeliveryMethodChange('Pickup')}
            >
              <Text style={[styles.optionPillText, deliveryMethod === 'Pickup' && styles.optionPillTextActive]}> Store Pickup</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerPremium} />

          {/* Conditional Payment Method rendering logic */}
          {deliveryMethod === 'Delivery' ? (
            <TouchableOpacity
              style={styles.paymentMethodSelector}
              onPress={() => setPaymentMethod('Cash-On-Delivery')}
            >
              <View style={styles.row}>
                <View style={styles.iconCircleGreen}>
                  <MaterialCommunityIcons name="cash-multiple" size={20} color="#10B981" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.paymentMainText}>Cash on Delivery</Text>
                  <Text style={styles.paymentSubText}>Pay when you receive the items</Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </TouchableOpacity>
          ) : (
            <View style={[styles.paymentMethodSelector, styles.paymentPickupSelector]}>
              <View style={styles.row}>
                <View style={styles.iconCircleBlue}>
                  <MaterialCommunityIcons name="storefront-outline" size={20} color="#3b82f6" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.paymentMainTextBlue}>Pay at Counter</Text>
                  <Text style={styles.paymentSubTextBlue}>Settle your payment directly at the store</Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
            </View>
          )}
        </View>

        {/* Note Card */}
        <View style={styles.sectionCardPremium}>
          <Text style={styles.sectionTitlePremium}>Order Instructions</Text>
          <TextInput
            style={styles.premiumInput}
            placeholder="E.g. Please leave the parcel at the gate..."
            placeholderTextColor="#94A3B8"
            value={leaveNote}
            onChangeText={setLeaveNote}
            multiline
          />
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCardPremium}>
          <Text style={styles.summaryTitlePremium}>Summary</Text>
          <View style={styles.summaryRowPremium}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryRowPremium}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱{deliveryMethod === 'Delivery' ? SHIPPING_FEE.toFixed(2) : '0.00'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRowPremium}>
            <Text style={styles.totalLabelPremium}>Total Amount</Text>
            <Text style={styles.totalValuePremium}>₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modern Action Footer */}
      <View style={styles.footerPremium}>
        <View>
          <Text style={styles.footerTotalLabel}>Grand Total</Text>
          <Text style={styles.footerTotalValue}>₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButtonPremium, isSubmitting && styles.checkoutButtonDisabled]}
          activeOpacity={0.8}
          disabled={isSubmitting}
          onPress={handlePlaceOrder}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <>
              <Text style={styles.checkoutTextPremium}>Place Order</Text>
              <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Emphasized Premium Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={44} color="#10B981" />
            </View>
            
            <Text style={styles.modalTitle}>Order Placed!</Text>
            <Text style={styles.modalSubtitle}>
              Your fresh order has been posted successfully and is waiting vendor confirmation.
            </Text>

            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={handleCloseSuccessModal}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FAFAFA', marginTop: 35},
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  browseButtonPremium: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  browseTextPremium: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  headerPremium: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButtonCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitlePremium: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 16, paddingBottom: 110 },
  sectionCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionHeaderPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titleIconRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitlePremium: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
  editButton: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderRadius: 6, borderWidth: 0.5},
  editButtonText: { color: '#0EA5E9', fontSize: 13, fontWeight: '600' },
  addressBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  addressName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  addressPhone: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  addressText: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  emptyTextNote: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },
  vendorGroup: { marginBottom: 16 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  vendorNameText: { fontSize: 13, fontWeight: '600', color: '#64748B', marginLeft: 6 },
  vendorPhoneText: { fontSize: 11, color: '#94A3B8', marginLeft: 6, marginTop: 2 },
  vendorPhoneText: { fontSize: 11, color: '#94A3B8', marginLeft: 6, marginTop: 2 },
  itemCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  productRow: { flexDirection: 'row' },
  productImagePremium: { width: 70, height: 70, borderRadius: 10 },
  placeholderImagePremium: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  productDetailsPremium: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  productTextPremium: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  tagRow: { flexDirection: 'row', marginTop: 2 },
  categoryBadgePremium: { backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryBadgeTextPremium: { fontSize: 9, fontWeight: '700', color: '#0EA5E9' },
  serviceContainer: { marginVertical: 4 },
  serviceItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  serviceTextPremium: { fontSize: 11, color: '#64748B' },
  qtyPriceRowPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  qtyTextPremium: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  itemTotalPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  optionGrid: { flexDirection: 'row', gap: 10, marginBottom: 14, marginTop: 8 },
  optionPill: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  optionPillActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6', borderWidth: 1 },
  optionPillText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  optionPillTextActive: { color: '#FFFFFF' },
  dividerPremium: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  paymentMethodSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DCFCE7' },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconCircleGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  paymentMainText: { fontSize: 14, fontWeight: '600', color: '#14532D' },
  paymentSubText: { fontSize: 11, color: '#166534' },
  premiumInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, height: 80, textAlignVertical: 'top', fontSize: 13, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  summaryCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  summaryTitlePremium: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  summaryRowPremium: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  totalLabelPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  totalValuePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  footerPremium: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 5 },
  footerTotalLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  footerTotalValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  checkoutButtonPremium: { flexDirection: 'row', backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 0.5, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center', gap: 6 },
  checkoutButtonDisabled: { opacity: 0.6 },
  checkoutTextPremium: { color: '#3b82f6', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', width: '100%', maxWidth: 340, borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 10, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalButton: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 0.5, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalButtonText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  
  // Custom Map Container Styles
  mapContainer: {
    height: 120,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapPreview: {
    ...StyleSheet.absoluteFillObject,
  },

  // Custom Store Pickup Payment Styles
  paymentPickupSelector: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  iconCircleBlue: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMainTextBlue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  paymentSubTextBlue: {
    fontSize: 11,
    color: '#1e40af',
  },
});