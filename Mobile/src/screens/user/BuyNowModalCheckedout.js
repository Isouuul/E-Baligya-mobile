// src/screens/Users/BuyNowModalCheckedout.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import * as FileSystem from 'expo-file-system';
import Toast from 'react-native-toast-message';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);
  useEffect(() => {
    if (!base64) return;
    const saveToFile = async () => {
      const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
      try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, { encoding: FileSystem.EncodingType.Base64 });
        setLocalUri(fileUri);
      } catch (err) { console.error(err); }
    };
    saveToFile();
  }, [base64]);

  if (!localUri) return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
      <Feather name="image" size={20} color="#94A3B8" />
    </View>
  );
  return <Image source={{ uri: localUri }} style={style} />;
};

export default function BuyNowModalCheckedout() {
  const route = useRoute();
  const navigation = useNavigation();

  // Keep original parameters profile safely
  const { checkoutItem, visible } = route.params || {};

  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const SHIPPING_FEE = 50;
  const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoadingAddress(false);
      return;
    }

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
        setAddress(null);
      }
      setLoadingAddress(false);
    }, error => {
      console.error(error);
      setLoadingAddress(false);
    });

    return unsubscribe;
  }, [visible]);

  const subtotal = useMemo(() => {
    if (!checkoutItem) return 0;
    const base = Number(checkoutItem.basePrice || 0);
    const services = (checkoutItem.selectedServices || []).reduce((sum, s) => sum + Number(s.price || 0), 0);
    return (base + services) * (checkoutItem.quantity || 1);
  }, [checkoutItem]);

  const totalAmount = useMemo(() => {
    return subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);
  }, [subtotal, deliveryMethod]);

  // Sync payment selection parameters relative to chosen shipping workflows
  const handleDeliveryMethodChange = (method) => {
    setDeliveryMethod(method);
    if (method === 'Pickup') {
      setPaymentMethod('Pay-On-Pickup');
    } else {
      setPaymentMethod('Cash-On-Delivery');
    }
  };

// Inside src/screens/Users/BuyNowModalCheckedout.js

const handleCheckout = async () => {
  if (loadingCheckout || !checkoutItem) return;
  const user = auth.currentUser;
  if (!user) return;

  if (deliveryMethod === 'Delivery' && !address) {
    Toast.show({ type: 'error', text1: 'Address Required', text2: 'Please configure a delivery target.' });
    return;
  }

  setLoadingCheckout(true);
  try {
    const userSnap = await getDoc(doc(db, 'Users', user.uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    // 1. Sanitize address: ensure we don't pass complex objects
    const addressData = address ? {
      fullName: address.fullName,
      fullAddress: address.fullAddress,
      contactNumber: address.contactNumber,
      latitude: address.latitude || null,
      longitude: address.longitude || null,
    } : null;

    // 2. Build the order object with proper defaults to avoid undefined values
    const orderData = {
      orderNumber: generateOrderNumber(),
      userId: user.uid,
      userFirstName: userData.firstName || '',
      userLastName: userData.lastName || '',
      items: [{
        productId: checkoutItem.id || '',
        productName: checkoutItem.productName || '',
        productImage: checkoutItem.imageBase64 || checkoutItem.productImage || null,
        quantity: checkoutItem.quantity || 1,
        basePrice: checkoutItem.basePrice || 0,
        services: checkoutItem.selectedServices || [],
        businessName: checkoutItem.businessName || checkoutItem.uploadedBy?.businessName || '',
        Phone: checkoutItem.vendorPhone || checkoutItem.uploadedBy?.phone || '',
        category: checkoutItem.category || '',
      }],
      deliveryMethod: deliveryMethod || 'Delivery',
      shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
      subtotal: subtotal || 0,
      totalAmount: totalAmount || 0,
      paymentMethod: paymentMethod || 'Cash-On-Delivery',
      leaveNote: leaveNote || '',
      address: addressData || null,
      status: 'Pending',
      createdAt: serverTimestamp(),
    };

    // 3. Attempt the write
    await addDoc(collection(db, 'Orders'), orderData);
    setShowSuccessModal(true);
  } catch (error) {
    console.log("Checkout Error:", error); // Check your terminal for specific details
    Toast.show({ 
      type: 'error', 
      text1: 'Checkout Failed', 
      text2: 'Error occurred while saving to database.' 
    });
  } finally {
    setLoadingCheckout(false);
  }
};

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

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

      {checkoutItem && (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Address Card Container */}
            <View style={styles.sectionCardPremium}>
              <View style={styles.sectionHeaderPremium}>
                <View style={styles.titleIconRow}>
                  <Feather name="map-pin" size={18} color="#0F172A" />
                  <Text style={styles.sectionTitlePremium}>Delivery Address</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate("AddressScreen")} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.addressBox}>
                {loadingAddress ? (
                  <ActivityIndicator size="small" color="#3b82f6" />
                ) : address ? (
                  <View>
                    <Text style={styles.addressName}>{address.fullName}</Text>
                    {address.contactNumber ? (
                      <Text style={styles.addressPhone}><Feather name="phone" size={12} /> {address.contactNumber}</Text>
                    ) : null}
                    <Text style={styles.addressText}>{address.fullAddress}</Text>
                    
                    {/* Embedded Map Preview Rendering block */}
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

            {/* Item Details Card Container */}
            <View style={styles.vendorGroup}>
              <View style={styles.vendorHeader}>
                <Feather name="shopping-bag" size={16} color="#64748B" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.vendorNameText}>
                    {checkoutItem.businessName || checkoutItem.uploadedBy?.businessName || 'Merchant Shop'}
                  </Text>
                  {checkoutItem.uploadedBy?.phone && (
                    <Text style={styles.vendorPhoneText}>
                      <Feather name="phone" size={10} /> {checkoutItem.uploadedBy.phone}
                    </Text>
                  )}
                </View>
              </View>
              
              <View style={styles.itemCardPremium}>
                <View style={styles.productRow}>
                  <Base64Image base64={checkoutItem.imageBase64 || checkoutItem.productImage} productId={checkoutItem.id} style={styles.productImagePremium} />
                  <View style={styles.productDetailsPremium}>
                    <Text style={styles.productTextPremium} numberOfLines={1}>{checkoutItem.productName}</Text>
                    
                    <View style={styles.tagRow}>
                      {checkoutItem.category && (
                        <View style={styles.categoryBadgePremium}>
                          <Text style={styles.categoryBadgeTextPremium}>{checkoutItem.category.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>

                    {checkoutItem.selectedServices?.map((s, i) => (
                      <View key={i} style={styles.serviceItem}>
                        <Ionicons name="add-circle-outline" size={12} color="#64748B" />
                        <Text style={styles.serviceTextPremium}> {s.label} (₱{Number(s.price).toFixed(2)})</Text>
                      </View>
                    ))}
                    
                    <View style={styles.qtyPriceRowPremium}>
                      <Text style={styles.qtyTextPremium}>Quantity: {checkoutItem.quantity}kg</Text>
                      <Text style={styles.itemTotalPremium}>₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Payment & Shipping Combined Panel UI */}
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
                  <Text style={[styles.optionPillText, deliveryMethod === 'Pickup' && styles.optionPillTextActive]}>Store Pickup</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dividerPremium} />

              {/* Dynamic Payment Selection Panel UI */}
              {deliveryMethod === 'Delivery' ? (
                <TouchableOpacity style={styles.paymentMethodSelector} activeOpacity={1}>
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

            {/* Order Notes Container */}
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

            {/* Total Balance Breakdown Calculations Card */}
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

          {/* Persistent Screen Modern Action Footer Section */}
          <View style={styles.footerPremium}>
            <View>
              <Text style={styles.footerTotalLabel}>Grand Total</Text>
              <Text style={styles.footerTotalValue}>₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.checkoutButtonPremium, loadingCheckout && styles.checkoutButtonDisabled]} 
              activeOpacity={0.8}
              onPress={handleCheckout} 
              disabled={loadingCheckout}
            >
              {loadingCheckout ? (
                <ActivityIndicator color="#3b82f6" />
              ) : (
                <>
                  <Text style={styles.checkoutTextPremium}>Place Order</Text>
                  <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Success Modal Container popup UI */}
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
  safeContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingBottom: 140, paddingTop: 16 },
  headerPremium: { marginTop: 35,height: 60, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingTop: 10 },
  backButtonCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitlePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sectionCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 20, marginHorizontal: 16, padding: 18, marginBottom: 16, borderWidth: 1.5, borderColor: '#F1F5F9' },
  sectionHeaderPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  titleIconRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitlePremium: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginLeft: 8, textTransform: 'uppercase' },
  editButton: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  editButtonText: { color: '#0F172A', fontSize: 11, fontWeight: '700' },
  addressBox: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14 },
  addressName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  addressPhone: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2, marginBottom: 2 },
  addressText: { fontSize: 12, color: '#475569', marginTop: 4 },
  emptyTextNote: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  
  // Map Container Configurations
  mapContainer: { height: 120, width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  mapPreview: { flex: 1 },
  
  vendorGroup: { marginHorizontal: 16, marginBottom: 16 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, paddingLeft: 4 },
  vendorNameText: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  vendorPhoneText: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  itemCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: '#F1F5F9' },
  productRow: { flexDirection: 'row' },
  productImagePremium: { width: 80, height: 80, borderRadius: 12 },
  productDetailsPremium: { flex: 1, marginLeft: 16, justifyContent: 'space-between' },
  productTextPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  
  tagRow: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  categoryBadgePremium: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeTextPremium: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  
  serviceItem: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  serviceTextPremium: { fontSize: 11, color: '#64748B' },
  qtyPriceRowPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  qtyTextPremium: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  itemTotalPremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  
  optionGrid: { flexDirection: 'row', gap: 10, marginTop: 8 },
  optionPill: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  optionPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  optionPillText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  optionPillTextActive: { color: '#FFF', fontWeight: '700' },
  dividerPremium: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  
  // Payment Module Selectors Style
  row: { flexDirection: 'row', alignItems: 'center' },
  paymentMethodSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  paymentPickupSelector: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  iconCircleGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center' },
  iconCircleBlue: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  paymentMainText: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  paymentSubText: { fontSize: 11, color: '#047857', marginTop: 1 },
  paymentMainTextBlue: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
  paymentSubTextBlue: { fontSize: 11, color: '#1D4ED8', marginTop: 1 },
  
  premiumInput: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, height: 64, fontSize: 13, color: '#0F172A', textAlignVertical: 'top', marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  
  summaryCardPremium: { marginHorizontal: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#F1F5F9', marginBottom: 20 },
  summaryTitlePremium: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12, textTransform: 'uppercase' },
  summaryRowPremium: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  summaryValue: { fontSize: 13, color: '#0F172A', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8, borderStyle: 'dashed' },
  totalLabelPremium: { fontWeight: '700', fontSize: 14, color: '#0F172A' },
  totalValuePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  
  footerPremium: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerTotalLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  footerTotalValue: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  checkoutButtonPremium: { backgroundColor: '#0F172A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkoutButtonDisabled: { opacity: 0.6 },
  checkoutTextPremium: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  
  // Success Overlay Modal UI Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', elevation: 5 },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 10 },
  modalButton: { width: '100%', backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  modalButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }
});