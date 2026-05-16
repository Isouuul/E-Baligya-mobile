// src/screens/Users/BuyNowCheckedOut.js
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
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import * as FileSystem from 'expo-file-system';
import Toast from 'react-native-toast-message';
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
import WarningIcon from '../../../assets/warning.png';

// ----------------- Base64Image Component -----------------
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    if (!base64) return;
    const saveToFile = async () => {
      const fileUri = FileSystem.cacheDirectory + `${productId || Date.now()}.jpg`;
      try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLocalUri(fileUri);
      } catch (err) {
        console.error('Error saving base64 image:', err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri) return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
      <Feather name="image" size={24} color="#94A3B8" />
    </View>
  );

  return <Image source={{ uri: localUri }} style={style} />;
};

export default function BuyNowCheckedOut() {
  const navigation = useNavigation();
  const route = useRoute();

  // Unified fallback layer matching either "product" or "checkoutData" keys
  const product = useMemo(() => {
    return route.params?.product || route.params?.checkoutData || null;
  }, [route.params]);

  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const SHIPPING_FEE = 50;
  const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Real-time listener for active address
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

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
      console.error('Error fetching address:', error);
      setLoadingAddress(false);
    });

    return unsubscribe;
  }, []);

  // Sync address changes when returning from Selection Screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.selectedAddress) {
        setAddress(route.params.selectedAddress);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedAddress]);

  // Derived price calculation
  const subtotal = useMemo(() => {
    if (!product) return 0;
    const base = Number(product.basePrice || 0);
    const services = (product.selectedServices || []).reduce((sum, s) => sum + Number(s.price || 0), 0);
    return (base + services) * (product.quantity || 1);
  }, [product]);

  const totalAmount = useMemo(() => {
    return subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);
  }, [subtotal, deliveryMethod]);

  if (!product) {
    return (
      <View style={styles.center}>
        <Image source={WarningIcon} style={{ width: 80, height: 80, opacity: 0.6 }} resizeMode="contain" />
        <Text style={styles.emptyTitle}>Nothing to checkout</Text>
        <TouchableOpacity
          style={styles.browseButtonPremium}
          onPress={() => navigation.navigate('ConsumerTabs', { screen: 'Product' })}
          activeOpacity={0.9}
        >
          <Text style={styles.browseTextPremium}>Go Back Shopping</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCheckout = async () => {
    if (loadingCheckout) return;

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

    setLoadingCheckout(true);
    try {
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
        orderNumber: generateOrderNumber(),
        userId: user.uid,
        userFirstName: userData.firstName,
        userLastName: userData.lastName,
        userProfileImage: userData.profileImage,
        items: [{
          productId: product.productId || product.id || product.docId || '',
          productName: product.productName || '',
          productImage: product.productImage || null,
          quantity: product.quantity || 1,
          basePrice: Number(product.basePrice || 0),
          services: product.selectedServices || [],
          uploadedBy: product.uploadedBy || null,
          category: product.category || 'Uncategorized',
        }],
        deliveryMethod,
        shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
        subtotal,
        totalAmount,
        paymentMethod,
        leaveNote: leaveNote || '',
        address: deliveryMethod === 'Delivery' ? address : null,
        status: 'Pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Orders'), orderData);
      Toast.show({
        type: 'success',
        text1: 'Order Placed Successfully',
        text2: 'Your request has been sent to the vendor!',
        visibilityTime: 5000,
      });

      setTimeout(() => {
        navigation.navigate('ConsumerTabs', { screen: 'Product' });
      }, 1200);
    } catch (error) {
      console.error("CHECKOUT ERROR: ", error);
      Toast.show({
        type: 'error',
        text1: 'Checkout Failed',
        text2: 'Something went wrong. Please try again.',
        visibilityTime: 5000,
      });
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Elegant Header */}
      <View style={styles.headerPremium}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonCircle} activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitlePremium}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Delivery Address Card */}
        <View style={styles.sectionCardPremium}>
          <View style={styles.sectionHeaderPremium}>
            <View style={styles.titleIconRow}>
              <Feather name="map-pin" size={16} color="#0F172A" />
              <Text style={styles.sectionTitlePremium}>Delivery Address</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddressSelection', { from: 'BuyNowCheckedOut' })}
              style={styles.editButton}
              activeOpacity={0.7}
            >
              <Text style={styles.editButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.addressBox}>
            {loadingAddress ? (
              <ActivityIndicator size="small" color="#0F172A" style={{ marginVertical: 8 }} />
            ) : address ? (
              <View>
                <Text style={styles.addressName}>{address.fullName}</Text>
                <Text style={styles.addressPhone}>{address.contactNumber}</Text>
                <Text style={styles.addressText}>{address.fullAddress}</Text>
              </View>
            ) : (
              <Text style={styles.emptyTextNote}>No active address found. Tap 'Change' to add one.</Text>
            )}
          </View>
        </View>

        {/* Vendor & Product Details */}
        <View style={styles.vendorGroup}>
          <View style={styles.vendorHeader}>
            <Feather name="shopping-bag" size={14} color="#64748B" />
            <Text style={styles.vendorNameText}>{product.uploadedBy?.businessName || product.uploadedBy?.marketName || 'Unknown Vendor'}</Text>
          </View>

          <View style={styles.itemCardPremium}>
            <View style={styles.productRow}>
              {product.productImage ? (
                product.productImage.startsWith('data:image') ? (
                  <Base64Image base64={product.productImage} productId={product.productId || product.id} style={styles.productImagePremium} />
                ) : (
                  <Image source={{ uri: product.productImage }} style={styles.productImagePremium} />
                )
              ) : (
                <View style={styles.placeholderImagePremium}>
                  <Feather name="box" size={24} color="#CBD5E1" />
                </View>
              )}
              
              <View style={styles.productDetailsPremium}>
                <View>
                  <Text style={styles.productTextPremium} numberOfLines={2}>{product.productName}</Text>
                  
                  {product.category && (
                    <View style={styles.tagRow}>
                      <View style={styles.categoryBadgePremium}>
                        <Text style={styles.categoryBadgeTextPremium}>{product.category}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {product.selectedServices?.length > 0 && (
                  <View style={styles.serviceContainer}>
                    {product.selectedServices.map((s, i) => (
                      <View key={i} style={styles.serviceItemRow}>
                        <Feather name="plus" size={10} color="#64748B" />
                        <Text style={styles.serviceTextPremium}>{s.label} (+₱{Number(s.price || 0).toLocaleString()})</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                <View style={styles.qtyPriceRowPremium}>
                  <Text style={styles.qtyTextPremium}>Qty: {product.quantity || 1}kg</Text>
                  <Text style={styles.itemTotalPremium}>₱ {Number(product.basePrice || 0).toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Payment & Delivery Options */}
        <View style={styles.sectionCardPremium}>
          <Text style={styles.sectionTitlePremium}>Shipping Method</Text>
          <View style={styles.optionGrid}>
            <TouchableOpacity 
              style={[styles.optionPill, deliveryMethod === 'Delivery' && styles.optionPillActive]}
              onPress={() => setDeliveryMethod('Delivery')}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionPillText, deliveryMethod === 'Delivery' && styles.optionPillTextActive]}>Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.optionPill, deliveryMethod === 'Pickup' && styles.optionPillActive]}
              onPress={() => setDeliveryMethod('Pickup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionPillText, deliveryMethod === 'Pickup' && styles.optionPillTextActive]}>Pickup</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerPremium} />
            
          <Text style={[styles.sectionTitlePremium, { marginBottom: 12 }]}>Payment Method</Text>

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

        {/* Order Instructions */}
        <View style={styles.sectionCardPremium}>
          <Text style={styles.sectionTitlePremium}>Order Instructions</Text>
          <TextInput
            style={styles.premiumInput}
            placeholder="Add special instructions or preferences..."
            placeholderTextColor="#94A3B8"
            value={leaveNote}
            onChangeText={setLeaveNote}
            multiline
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCardPremium}>
          <Text style={styles.summaryTitlePremium}>Order Summary</Text>
          <View style={styles.summaryRowPremium}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>₱ {subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRowPremium}>
            <Text style={styles.summaryLabel}>Shipping Fee</Text>
            <Text style={styles.summaryValue}>₱ {deliveryMethod === 'Delivery' ? SHIPPING_FEE.toFixed(2) : '0.00'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRowPremium}>
            <Text style={styles.totalLabelPremium}>Total Amount</Text>
            <Text style={styles.totalValuePremium}>₱ {totalAmount.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Persistent Action Footer */}
      <View style={styles.footerPremium}>
        <View>
          <Text style={styles.footerTotalLabel}>Grand Total</Text>
          <Text style={styles.footerTotalValue}>₱ {totalAmount.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButtonPremium, loadingCheckout && { opacity: 0.8 }]}
          onPress={handleCheckout}
          disabled={loadingCheckout}
          activeOpacity={0.9}
        >
          {loadingCheckout ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.checkoutTextPremium}>Place Order</Text>
              <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingBottom: 140, paddingTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' },
  
  // Header
  headerPremium: {
    height: 60,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerTitlePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },

  // Sections
  sectionCardPremium: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeaderPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  titleIconRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitlePremium: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  editButton: { backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1,  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  editButtonText: { color: '#3b82f6', fontSize: 11, fontWeight: '700' },
  addressBox: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  addressName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  addressPhone: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  addressText: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  emptyTextNote: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginVertical: 4 },

  // Vendor & Items Layout
  vendorGroup: { marginHorizontal: 16, marginBottom: 16 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 4 },
  vendorNameText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemCardPremium: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1.5, 
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  productRow: { flexDirection: 'row' },
  productImagePremium: { width: 90, height: 90, borderRadius: 14 },
  placeholderImagePremium: { width: 90, height: 90, borderRadius: 14, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  productDetailsPremium: { flex: 1, marginLeft: 16, justifyContent: 'space-between' },
  productTextPremium: { fontSize: 15, fontWeight: '700', color: '#0F172A', lineHeight: 20 },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  categoryBadgePremium: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryBadgeTextPremium: { fontSize: 10, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  serviceContainer: { marginTop: 6, gap: 4 },
  serviceItemRow: { flexDirection: 'row', alignItems: 'center' },
  serviceTextPremium: { fontSize: 11, color: '#64748B', fontWeight: '500', marginLeft: 4 },
  qtyPriceRowPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  qtyTextPremium: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  itemTotalPremium: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  // Pill & Toggle Styles
  optionGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  optionPill: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  optionPillActive: {   backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1.5},
  optionPillText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  optionPillTextActive: { color: '#3b82f6', fontWeight: '700' },
  dividerPremium: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  paymentMethodSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconCircleSlate: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  paymentMainText: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginLeft: 12 },
  premiumInput: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginTop: 12, height: 80, fontSize: 13, color: '#0F172A', borderWidth: 1, borderColor: '#F1F5F9', textAlignVertical: 'top' },

  // Summary Card
  summaryCardPremium: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    backgroundColor: '#FFFFFF', 
    borderRadius: 20,          
    borderWidth: 1.5,
    borderColor: '#F1F5F9',    
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  summaryTitlePremium: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRowPremium: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  summaryDivider: { height: 1.5, backgroundColor: '#F1F5F9', marginVertical: 12, borderStyle: 'dashed' },
  totalLabelPremium: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  totalValuePremium: { fontSize: 18, fontWeight: '900', color: '#0F172A' },

  // Premium Sticky Footer
  footerPremium: {
    position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 32,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9',
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: -4 }, shadowRadius: 12, elevation: 8
  },
  footerTotalLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotalValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  checkoutButtonPremium: {
       backgroundColor: '#eff6ff',
    borderColor: '#3b82f6', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 99, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0F172A', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4
  },
  checkoutTextPremium: { color: '#3b82f6', fontSize: 14, fontWeight: '800', marginRight: 6 },

  // Empty State Fallback
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748B', marginTop: 12 },
  browseButtonPremium: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 99, marginTop: 24 },
  browseTextPremium: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    iconCircleGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  paymentMainText: { fontSize: 14, fontWeight: '600', color: '#14532D' },
  paymentSubText: { fontSize: 11, color: '#166534' },
    paymentMethodSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DCFCE7' },

});