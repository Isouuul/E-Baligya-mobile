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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';
import * as FileSystem from 'expo-file-system';
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
import WarningIcon from '../../../assets/warning.png';

// ----------------- Base64Image Component -----------------
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    if (!base64) return;
    let isMounted = true;

    const saveToFile = async () => {
      const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
      try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (isMounted) {
          setLocalUri(fileUri);
        }
      } catch (err) {
        console.error('Error saving base64 image:', err);
      }
    };

    saveToFile();
    return () => {
      isMounted = false;
    };
  }, [base64, productId]);

  if (!localUri) return (
    <View style={[style, styles.imagePlaceholderContainer]}>
      <Feather name="image" size={24} color="#94A3B8" />
    </View>
  );

  return <Image source={{ uri: localUri }} style={style} />;
};

export default function CheckedOutBidding() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const selectedItems = route.params?.selectedItems || [];

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

  // Group items by vendor
  const groupedItems = useMemo(() => {
    const groups = {};
    selectedItems.forEach(item => {
      const businessName = item.uploadedBy?.businessName || 'Unknown Vendor';
      if (!groups[businessName]) groups[businessName] = [];
      groups[businessName].push(item);
    });
    return Object.entries(groups).map(([shopName, items]) => ({ shopName, items }));
  }, [selectedItems]);

  // Derived price calculation across items array
  const subtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const base = Number(item.basePrice || 0);
      const variationPrice = Number(item.selectedVariationPrice || 0);
      const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + variationPrice + servicesTotal) * (item.quantity || 1);
    }, 0);
  }, [selectedItems]);

  const totalAmount = useMemo(() => {
    return subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);
  }, [subtotal, deliveryMethod]);

  if (selectedItems.length === 0) {
    return (
      <View style={styles.center}>
        <Image source={WarningIcon} style={styles.warningIconLayout} resizeMode="contain" />
        <Text style={styles.emptyTitle}>No items selected for checkout</Text>
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
      let userData = { firstName: '', lastName: '', profileImage: null };
      
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
        items: selectedItems.map(item => ({
          productId: item.productId || item.id,
          productName: item.productName,
          productImage: item.productImage || null,
          category: item.category || 'Uncategorized',
          quantity: item.quantity || 1,
          basePrice: Number(item.basePrice || 0),
          selectedVariation: item.selectedVariation || null,
          selectedVariationPrice: Number(item.selectedVariationPrice || 0),
          services: item.selectedServices || [],
          uploadedBy: item.uploadedBy || null,
        })),
        deliveryMethod,
        shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
        subtotal,
        totalAmount,
        paymentMethod,
        leaveNote: leaveNote.trim(),
        address: deliveryMethod === 'Delivery' ? address : null,
        status: 'Pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Orders'), orderData);

      // Clean up cart items if applicable
      const cartItemsToDelete = selectedItems.filter(item => item.source !== 'notification');
      if (cartItemsToDelete.length > 0) {
        const cartCollection = collection(db, 'Carts', user.uid, 'items');
        await Promise.all(
          cartItemsToDelete.map(item => deleteDoc(doc(cartCollection, item.id)))
        );
      }

      // Clean up active notifications configurations
      const notificationIds = route.params?.notificationIds || [];
      if (notificationIds.length > 0) {
        await Promise.all(
          notificationIds.map(id => deleteDoc(doc(db, "User_Notifications_Bidding", id)))
        );
      }

      Toast.show({
        type: 'success',
        text1: 'Order Placed Successfully',
        text2: 'Your request has been sent to the vendors!',
        visibilityTime: 5000,
      });

      setTimeout(() => {
        navigation.navigate('ConsumerTabs', { screen: 'Product' });
      }, 1200);
    } catch (error) {
      console.error('Multi-item checkout runtime error:', error);
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

  const renderItemCard = (item) => {
    const base = Number(item.basePrice || 0);
    const variationPrice = Number(item.selectedVariationPrice || 0);
    const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
    const itemTotal = (base + variationPrice + servicesTotal) * (item.quantity || 1);

    return (
      <View key={item.id} style={styles.itemCardPremium}>
        <View style={styles.productRow}>
          {item.productImage ? (
            item.productImage.startsWith('data:image') ? (
              <Base64Image base64={item.productImage} productId={item.id} style={styles.productImagePremium} />
            ) : (
              <Image source={{ uri: item.productImage }} style={styles.productImagePremium} />
            )
          ) : (
            <View style={styles.placeholderImagePremium}>
              <Feather name="box" size={24} color="#CBD5E1" />
            </View>
          )}
          
          <View style={styles.productDetailsPremium}>
            <View>
              <Text style={styles.productTextPremium} numberOfLines={2}>{item.productName}</Text>
              
              {item.selectedVariation && (
                <Text style={styles.detailText}>Variant: <Text style={{ fontWeight: '700', color: '#475569' }}>{item.selectedVariation}</Text></Text>
              )}

              {item.category && (
                <View style={styles.tagRow}>
                  <View style={styles.categoryBadgePremium}>
                    <Text style={styles.categoryBadgeTextPremium}>{item.category}</Text>
                  </View>
                </View>
              )}
            </View>

            {item.selectedServices?.length > 0 && (
              <View style={styles.serviceContainer}>
                {item.selectedServices.map((s, i) => (
                  <View key={i} style={styles.serviceItemRow}>
                    <Feather name="plus" size={10} color="#64748B" />
                    <Text style={styles.serviceTextPremium}>{s.label} (+₱{s.price})</Text>
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.qtyPriceRowPremium}>
              <Text style={styles.qtyTextPremium}>Qty: {item.quantity || 1}</Text>
              <Text style={styles.itemTotalPremium}>₱{itemTotal.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Elegant Header */}
      <View style={styles.headerPremium}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonCircle} activeOpacity={0.7}>
          <Feather name="chevron-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitlePremium}>Finalize Order</Text>
        <View style={{ width: 36 }} />
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
              onPress={() => navigation.navigate('AddressSelection', { from: 'CheckedOut' })}
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

        {/* Grouped items by vendor */}
        {groupedItems.map(group => {
          const shopImage = group.items[0].uploadedBy?.profileImage || null;
          return (
            <View key={group.shopName} style={styles.vendorGroup}>
              <View style={styles.vendorHeader}>
                {shopImage ? (
                  <Image source={{ uri: shopImage }} style={styles.vendorImagePremium} />
                ) : (
                  <View style={styles.vendorPlaceholderCircle}>
                    <Feather name="shopping-bag" size={12} color="#64748B" />
                  </View>
                )}
                <Text style={styles.vendorNameText}>{group.shopName}</Text>
              </View>
              {group.items.map(item => renderItemCard(item))}
            </View>
          );
        })}

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
          <TouchableOpacity style={styles.paymentMethodSelector} activeOpacity={0.9}>
            <View style={styles.row}>
              <View style={styles.iconCircleSlate}>
                <MaterialCommunityIcons name="cash-multiple" size={18} color="#0F172A" />
              </View>
              <Text style={styles.paymentMainText}>Cash on Delivery</Text>
            </View>
            <Ionicons name="checkmark-circle" size={22} color="#0F172A" />
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
            <Text style={styles.summaryLabel}>Subtotal ({selectedItems.length} items)</Text>
            <Text style={styles.summaryValue}>₱{subtotal.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryRowPremium}>
            <Text style={styles.summaryLabel}>Shipping Fee</Text>
            <Text style={styles.summaryValue}>₱{deliveryMethod === 'Delivery' ? SHIPPING_FEE.toFixed(2) : '0.00'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRowPremium}>
            <Text style={styles.totalLabelPremium}>Total Amount</Text>
            <Text style={styles.totalValuePremium}>₱{totalAmount.toLocaleString()}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Persistent Action Footer */}
      <View style={[styles.footerPremium, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View>
          <Text style={styles.footerTotalLabel}>Grand Total</Text>
          <Text style={styles.footerTotalValue}>₱{totalAmount.toLocaleString()}</Text>
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
              <Text style={styles.checkoutTextPremium}>Confirm Checkout</Text>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  scrollContent: { paddingBottom: 160, paddingTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' },
  warningIconLayout: { width: 80, height: 80, opacity: 0.6 },
  imagePlaceholderContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  
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
  editButton: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  editButtonText: { color: '#0F172A', fontSize: 11, fontWeight: '700' },
  addressBox: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  addressName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  addressPhone: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  addressText: { fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 18 },
  emptyTextNote: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginVertical: 4 },

  // Vendor & Items Layout
  vendorGroup: { marginHorizontal: 16, marginBottom: 16 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 4 },
  vendorImagePremium: { width: 24, height: 24, borderRadius: 12, marginRight: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  vendorPlaceholderCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  vendorNameText: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemCardPremium: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1.5, 
    borderColor: '#F1F5F9',
    marginBottom: 8,
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
  detailText: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '500' },
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
  optionPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  optionPillText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  optionPillTextActive: { color: '#FFFFFF', fontWeight: '700' },
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
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8
  },
  footerTotalLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerTotalValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  checkoutButtonPremium: {
    backgroundColor: '#0F172A', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 99, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#0F172A', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4
  },
  checkoutTextPremium: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginRight: 6 },

  // Empty State Fallback
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#64748B', marginTop: 12 },
  browseButtonPremium: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 99, marginTop: 24 },
  browseTextPremium: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});