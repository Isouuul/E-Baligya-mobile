// src/screens/Users/CheckedOut.js
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
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import Toast from 'react-native-toast-message';

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
  const selectedItems = route.params?.selectedItems || [];
  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const base = Number(item.basePrice || 0);
      const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + servicesTotal) * (item.quantity || 1);
    }, 0);
  }, [selectedItems]);

  const totalAmount = subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);

  const renderItemCard = item => {
    const base = Number(item.basePrice || 0);
    const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
    const itemTotal = (base + servicesTotal) * (item.quantity || 1);

    return (
      <View key={item.id} style={styles.itemCardPremium}>
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
              <Text style={styles.qtyTextPremium}>Quantity: {item.quantity}</Text>
              <Text style={styles.itemTotalPremium}>₱{itemTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
            </View>
          </View>
        </View>
      </View>
    );
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
              <ActivityIndicator size="small" color="#0F172A" />
            ) : address ? (
              <View>
                <Text style={styles.addressName}>{address.fullName}</Text>
                <Text style={styles.addressPhone}><Feather name="phone" size={12} /> {address.contactNumber}</Text>
                <Text style={styles.addressText}>{address.fullAddress}</Text>
              </View>
            ) : (
              <Text style={styles.emptyTextNote}>No active address found. Please select one.</Text>
            )}
          </View>
        </View>

        {/* Order Items */}
        {groupedItems.map(group => (
          <View key={group.shopName} style={styles.vendorGroup}>
            <View style={styles.vendorHeader}>
              <Feather name="shopping-bag" size={16} color="#64748B" />
              <Text style={styles.vendorNameText}>{group.shopName}</Text>
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
                onPress={() => setDeliveryMethod('Delivery')}
              >
                <Text style={[styles.optionPillText, deliveryMethod === 'Delivery' && styles.optionPillTextActive]}>Standard Delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.optionPill, deliveryMethod === 'Pickup' && styles.optionPillActive]}
                onPress={() => setDeliveryMethod('Pickup')}
              >
                <Text style={[styles.optionPillText, deliveryMethod === 'Pickup' && styles.optionPillTextActive]}>Store Pickup</Text>
              </TouchableOpacity>
           </View>

           <View style={styles.dividerPremium} />

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
            <Text style={styles.summaryValue}>₱{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
          <View style={styles.summaryRowPremium}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>₱{deliveryMethod === 'Delivery' ? SHIPPING_FEE.toFixed(2) : '0.00'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRowPremium}>
            <Text style={styles.totalLabelPremium}>Total Amount</Text>
            <Text style={styles.totalValuePremium}>₱{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modern Action Footer */}
      <View style={styles.footerPremium}>
        <View>
          <Text style={styles.footerTotalLabel}>Grand Total</Text>
          <Text style={styles.footerTotalValue}>₱{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButtonPremium, isSubmitting && styles.checkoutButtonDisabled]}
          activeOpacity={0.8}
          disabled={isSubmitting}
          onPress={async () => {
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
                  productId: item.productId,
                  productName: item.productName,
                  productImage: item.productImage || null,
                  category: item.category || 'Uncategorized',
                  quantity: item.quantity,
                  basePrice: item.basePrice,
                  services: item.selectedServices || [],
                  uploadedBy: item.uploadedBy || null,
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

              await addDoc(collection(db, 'Orders'), orderData);
              const cartCollection = collection(db, 'Carts', user.uid, 'items');
              await Promise.all(selectedItems.map(item => deleteDoc(doc(cartCollection, item.id))));

              Toast.show({
                type: 'success',
                text1: 'Order placed',
                text2: 'Your order has been placed successfully.',
                visibilityTime: 5000,
              });

              setTimeout(() => {
                navigation.navigate('ConsumerTabs', { screen: 'Product' });
              }, 1200);
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: 'Order failed',
                text2: 'Failed to place order. Please try again.',
                visibilityTime: 5000,
              });
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.checkoutTextPremium}>Place Order</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  // Header
  headerPremium: {
    height: 64,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitlePremium: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  // Sections
  sectionCardPremium: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeaderPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titleIconRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitlePremium: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
  editButton: { backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  editButtonText: { color: '#0F172A', fontSize: 12, fontWeight: '700' },

  // Address
  addressBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 },
  addressName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  addressPhone: { fontSize: 13, color: '#64748B', marginTop: 2 },
  addressText: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },

  // Items
  vendorGroup: { marginHorizontal: 16, marginTop: 16 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingLeft: 4 },
  vendorNameText: { fontSize: 12, fontWeight: '700', color: '#64748B', marginLeft: 8, textTransform: 'uppercase' },
  itemCardPremium: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  productRow: { flexDirection: 'row' },
  productImagePremium: { width: 70, height: 70, borderRadius: 12 },
  placeholderImagePremium: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  productDetailsPremium: { flex: 1, marginLeft: 12 },
  productTextPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  categoryBadgePremium: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 },
  categoryBadgeTextPremium: { fontSize: 9, fontWeight: '700', color: '#475569' },
  serviceContainer: { marginTop: 6, gap: 2 },
  serviceItem: { flexDirection: 'row', alignItems: 'center' },
  serviceTextPremium: { fontSize: 11, color: '#64748B' },
  qtyPriceRowPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
  qtyTextPremium: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  itemTotalPremium: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

  // Options
  optionGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  optionPill: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  optionPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  optionPillText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  optionPillTextActive: { color: '#fff' },
  dividerPremium: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  paymentMethodSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 4 },
  iconCircleGreen: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  paymentMainText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  paymentSubText: { fontSize: 12, color: '#64748B' },
  premiumInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 10, height: 80, fontSize: 13, color: '#0F172A' },

  // Summary
summaryCardPremium: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#FFFFFF', // Luxurious pure white background
    borderRadius: 20,           // Smooth organic corners
    borderWidth: 1.5,
    borderColor: '#F1F5F9',     // Ultra-thin metallic slate boundary
    
    // Smooth premium drop shadows
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },  summaryTitlePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  summaryRowPremium: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#64748B' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  summaryDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12, borderStyle: 'dashed' },
  totalLabelPremium: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  totalValuePremium: { fontSize: 20, fontWeight: '900', color: '#0F172A' },

  // Footer
  footerPremium: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  footerTotalLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  footerTotalValue: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  checkoutButtonPremium: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    opacity: 0.8,
  },
  checkoutTextPremium: { color: '#fff', fontSize: 15, fontWeight: '800', marginRight: 8 },

  // Empty State
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  browseButtonPremium: { backgroundColor: '#0F172A', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  browseTextPremium: { color: '#fff', fontWeight: '700' },
});