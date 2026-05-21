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
  StatusBar,
  Modal
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import * as FileSystem from 'expo-file-system';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'; // Imported native map modules
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

  return <Image source={{ uri: localUri }} style={style} resizeMode="cover" />;
};

export default function BuyNowCheckedOut() {
  const navigation = useNavigation();
  const route = useRoute();

  const product = useMemo(() => {
    return route.params?.product || route.params?.checkoutData || null;
  }, [route.params]);

  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    visible: false,
    type: 'success', 
    title: '',
    message: '',
    onClose: null
  });

  const SHIPPING_FEE = 50;
  const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const showAlertModal = (type, title, message, onClose = null, autoCloseDuration = 0) => {
    setModalConfig({ visible: true, type, title, message, onClose });
    
    if (autoCloseDuration > 0) {
      setTimeout(() => {
        setModalConfig(prev => {
          if (prev.visible) {
            if (onClose) onClose();
            return { ...prev, visible: false };
          }
          return prev;
        });
      }, autoCloseDuration);
    }
  };

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

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.selectedAddress) {
        setAddress(route.params.selectedAddress);
      }
    });
    return unsubscribe;
  }, [navigation, route.params?.selectedAddress]);

  const subtotal = useMemo(() => {
    if (!product) return 0;
    const base = Number(product.basePrice || 0);
    const services = (product.selectedServices || []).reduce((sum, s) => sum + Number(s.price || 0), 0);
    return (base + services) * (product.quantity || 1);
  }, [product]);

  const totalAmount = useMemo(() => {
    return subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);
  }, [subtotal, deliveryMethod]);

  const handleDeliveryMethodChange = (method) => {
    setDeliveryMethod(method);
    if (method === 'Pickup') {
      setPaymentMethod('Pay-On-Pickup');
    } else {
      setPaymentMethod('Cash-On-Delivery');
    }
  };

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
      showAlertModal('error', 'Address Required', 'Please select a delivery address to proceed.');
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

      const generatedOrderNumber = generateOrderNumber();

      const orderData = {
        orderNumber: generatedOrderNumber,
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
          Phone: product.vendorPhone || product.uploadedBy?.phone || '',
          category: product.category || 'Uncategorized',
        }],
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

      const vendorId = product.uploadedBy?.uid || product.uploadedBy; 
      if (vendorId) {
        const vendorNotificationData = {
          vendorId: vendorId,
          userId: user.uid,
          userFullName: `${userData.firstName} ${userData.lastName}`.trim(),
          userProfileImage: userData.profileImage,
          orderNumber: generatedOrderNumber,
          type: 'product_purchased',
          title: 'New Order Received!',
          message: `${userData.firstName || 'A user'} has purchased your product: "${product.productName || 'Item'}".`,
          isRead: false,
          createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'Vendor_Notifications_Product'), vendorNotificationData);
      }
      
      showAlertModal(
        'success',
        'Order Placed Successfully',
        'Your request has been successfully sent to the vendor!',
        () => {
          navigation.navigate('ConsumerTabs', { screen: 'Product' });
        },
        2500
      );

    } catch (error) {
      console.error("CHECKOUT ERROR: ", error);
      showAlertModal('error', 'Checkout Failed', 'Something went wrong on our end. Please try again.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.headerPremium}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonCircle} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitlePremium}>Finalize Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Delivery Address Card with True React Native Map */}
        <View style={styles.sectionCardPremium}>
          <View style={styles.sectionHeaderPremium}>
            <View style={styles.titleIconRow}>
              <Feather name="map-pin" size={18} color="#0F172A" />
              <Text style={styles.sectionTitlePremium}>
                {deliveryMethod === 'Pickup' ? 'Store Pickup Location' : 'Delivery Address'}
              </Text>
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
              <ActivityIndicator size="small" color="#3b82f6" />
            ) : address ? (
              <View>
                <Text style={styles.addressName}>{address.fullName}</Text>
                <Text style={styles.addressPhone}><Feather name="phone" size={12} /> {address.contactNumber}</Text>
                <Text style={styles.addressText}>{address.fullAddress}</Text>
                
                {/* Native Map Preview Container (Visible on both Store Pickup & Delivery layout states) */}
                <View style={styles.mapPreviewContainer}>
                  {address.latitude && address.longitude ? (
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={styles.actualMapStyle}
                      initialRegion={{
                        latitude: Number(address.latitude),
                        longitude: Number(address.longitude),
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                      region={{
                        latitude: Number(address.latitude),
                        longitude: Number(address.longitude),
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker
                        coordinate={{
                          latitude: Number(address.latitude),
                          longitude: Number(address.longitude),
                        }}
                      />
                    </MapView>
                  ) : (
                    <View style={styles.mapNoCoordinatesBox}>
                      <Feather name="map" size={20} color="#94A3B8" style={{ marginBottom: 4 }} />
                      <Text style={styles.mapNoCoordinatesText}>No map coordinates pinned to this profile</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyTextNote}>No active address found. Please select one.</Text>
            )}
          </View>
        </View>

        {/* Vendor & Product Details */}
        <View style={styles.vendorGroup}>
          <View style={styles.vendorHeader}>
            <Feather name="shopping-bag" size={16} color="#64748B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.vendorNameText}>{product.uploadedBy?.businessName || product.uploadedBy?.marketName || 'Unknown Vendor'}</Text>
              {product.uploadedBy?.phone && (
                <Text style={styles.vendorPhoneText}>
                  <Feather name="phone" size={10} /> {product.uploadedBy.phone}
                </Text>
              )}
            </View>
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
                <Text style={styles.productTextPremium} numberOfLines={1}>{product.productName}</Text>
                
                <View style={styles.tagRow}>
                  {product.category && (
                    <View style={styles.categoryBadgePremium}>
                      <Text style={styles.categoryBadgeTextPremium}>{product.category.toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                {product.selectedServices && product.selectedServices.length > 0 && (
                  <View style={styles.serviceContainer}>
                    {product.selectedServices.map((s, index) => (
                      <View key={index} style={styles.serviceItem}>
                        <Ionicons name="add-circle-outline" size={12} color="#64748B" />
                        <Text style={styles.serviceTextPremium}> {s.label} (₱{Number(s.price || 0).toFixed(2)})</Text>
                      </View>
                    ))}
                  </View>
                )}
                
                <View style={styles.qtyPriceRowPremium}>
                  <Text style={styles.qtyTextPremium}>Quantity: {product.quantity || 1}kg</Text>
                  <Text style={styles.itemTotalPremium}>₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Payment & Delivery Options */}
        <View style={styles.sectionCardPremium}>
          <Text style={styles.sectionTitlePremium}>Payment & Shipping</Text>
          
          <View style={styles.optionGrid}>
            <TouchableOpacity 
              style={[styles.optionPill, deliveryMethod === 'Delivery' && styles.optionPillActive]}
              onPress={() => handleDeliveryMethodChange('Delivery')}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionPillText, deliveryMethod === 'Delivery' && styles.optionPillTextActive]}>Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.optionPill, deliveryMethod === 'Pickup' && styles.optionPillActive]}
              onPress={() => handleDeliveryMethodChange('Pickup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionPillText, deliveryMethod === 'Pickup' && styles.optionPillTextActive]}>Store Pickup</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerPremium} />
            
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

        {/* Order Instructions */}
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

      {/* Persistent Action Footer */}
      <View style={styles.footerPremium}>
        <View>
          <Text style={styles.footerTotalLabel}>Grand Total</Text>
          <Text style={styles.footerTotalValue}>₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButtonPremium, loadingCheckout && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={loadingCheckout}
          activeOpacity={0.8}
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

      {/* Sileo Premium Modal */}
      <Modal
        visible={modalConfig.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (modalConfig.onClose) modalConfig.onClose();
          setModalConfig(prev => ({ ...prev, visible: false }));
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sileoModalContainer}>
            <View style={[
              styles.modalIconWrapper, 
              modalConfig.type === 'success' ? styles.modalIconSuccess : styles.modalIconError
            ]}>
              <Feather 
                name={modalConfig.type === 'success' ? "check" : "alert-circle"} 
                size={28} 
                color={modalConfig.type === 'success' ? "#10B981" : "#EF4444"} 
              />
            </View>
            
            <Text style={styles.modalTitle}>{modalConfig.title}</Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            
            <TouchableOpacity 
              style={[
                styles.modalActionButton,
                modalConfig.type === 'success' ? styles.modalActionSuccess : styles.modalActionError
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (modalConfig.onClose) modalConfig.onClose();
                setModalConfig(prev => ({ ...prev, visible: false }));
              }}
            >
              <Text style={[
                styles.modalActionText,
                modalConfig.type === 'success' ? styles.modalActionTextSuccess : styles.modalActionTextError
              ]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#FAFAFA', marginTop: 35 },
  scrollContent: { padding: 16, paddingBottom: 110 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  
  // Header
  headerPremium: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  backButtonCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#F8FAFC', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  headerTitlePremium: { fontSize: 18, fontWeight: '700', color: '#0F172A' },

  // Address Section
  sectionCardPremium: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#F1F5F9' 
  },
  sectionHeaderPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titleIconRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitlePremium: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
  editButton: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderRadius: 6, borderWidth: 0.5 },
  editButtonText: { color: '#0EA5E9', fontSize: 13, fontWeight: '600' },
  addressBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  addressName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  addressPhone: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  addressText: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 10 },
  emptyTextNote: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 8 },

  // Native Map View Container Styles
  mapPreviewContainer: { height: 130, width: '100%', borderRadius: 12, marginTop: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  actualMapStyle: { flex: 1 },
  mapNoCoordinatesBox: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  mapNoCoordinatesText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  // Vendor & Items Layout
  vendorGroup: { marginBottom: 16 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  vendorNameText: { fontSize: 13, fontWeight: '600', color: '#64748B', marginLeft: 6 },
  vendorPhoneText: { fontSize: 11, color: '#94A3B8', marginLeft: 6, marginTop: 2 },
  vendorPhoneText: { fontSize: 11, color: '#94A3B8', marginLeft: 6, marginTop: 2 },
  itemCardPremium: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 14, 
    padding: 12, 
    marginBottom: 8, 
    borderWidth: 1, 
    borderColor: '#F1F5F9' 
  },
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

  // Option Grid
  optionGrid: { flexDirection: 'row', gap: 10, marginBottom: 14, marginTop: 8 },
  optionPill: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  optionPillActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6', borderWidth: 1 },
  optionPillText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  optionPillTextActive: { color: '#FFFFFF' },
  dividerPremium: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  premiumInput: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    padding: 12, 
    height: 80, 
    textAlignVertical: 'top', 
    fontSize: 13, 
    color: '#1E293B', 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },

  // Payment Selection Fields
  paymentMethodSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#F0FDF4', 
    padding: 12, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#DCFCE7' 
  },
  iconCircleGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  paymentMainText: { fontSize: 14, fontWeight: '600', color: '#14532D' },
  paymentSubText: { fontSize: 11, color: '#166534' },
  paymentPickupSelector: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  iconCircleBlue: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  paymentMainTextBlue: { fontSize: 14, fontWeight: '600', color: '#1e3a8a' },
  paymentSubTextBlue: { fontSize: 11, color: '#1e40af' },

  // Pricing Layouts
  summaryCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  summaryTitlePremium: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  summaryRowPremium: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 },
  totalLabelPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  totalValuePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },

  // Footer Actions
  footerPremium: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: -4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8, 
    elevation: 5 
  },
  footerTotalLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  footerTotalValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  checkoutButtonPremium: { 
    flexDirection: 'row', 
    backgroundColor: '#eff6ff', 
    borderColor: '#3b82f6', 
    borderWidth: 0.5, 
    paddingHorizontal: 24, 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center', 
    gap: 6 
  },
  checkoutButtonDisabled: { opacity: 0.6 },
  checkoutTextPremium: { color: '#3b82f6', fontSize: 14, fontWeight: '700' },

  // Fallbacks
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 4 },
  browseButtonPremium: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  browseTextPremium: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  // Sileo Sheet Overlay
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sileoModalContainer: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  modalIconWrapper: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalIconSuccess: { backgroundColor: '#DCFCE7' },
  modalIconError: { backgroundColor: '#FCE8E6' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalActionButton: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalActionSuccess: { backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 0.5 },
  modalActionError: { backgroundColor: '#FCE8E6', borderColor: '#EF4444', borderWidth: 0.5 },
  modalActionText: { fontSize: 15, fontWeight: '600' },
  modalActionTextSuccess: { color: '#3b82f6' },
  modalActionTextError: { color: '#EF4444' }
});