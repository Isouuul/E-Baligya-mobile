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
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
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

export default function BuyNowModalCheckedout({ visible, onClose, checkoutData, onAddressSelectRequested }) {
  const [paymentMethod, setPaymentMethod] = useState('Cash-On-Delivery');
  const [deliveryMethod, setDeliveryMethod] = useState('Delivery');
  const [leaveNote, setLeaveNote] = useState('');
  const [address, setAddress] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const SHIPPING_FEE = 50;
  const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  useEffect(() => {
    if (!visible) return;
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
    if (!checkoutData) return 0;
    const base = Number(checkoutData.basePrice || 0);
    const services = (checkoutData.selectedServices || []).reduce((sum, s) => sum + Number(s.price || 0), 0);
    return (base + services) * (checkoutData.quantity || 1);
  }, [checkoutData]);

  const totalAmount = useMemo(() => {
    return subtotal + (deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0);
  }, [subtotal, deliveryMethod]);

  const handleCheckout = async () => {
    if (loadingCheckout || !checkoutData) return;
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

      const orderData = {
        orderNumber: generateOrderNumber(),
        userId: user.uid,
        userFirstName: userData.firstName || '',
        userLastName: userData.lastName || '',
        userProfileImage: userData.profileImage || null,
        items: [{
          productId: checkoutData.id || checkoutData.docId,
          productName: checkoutData.productName,
          productImage: checkoutData.productImage || checkoutData.imageBase64 || null,
          quantity: checkoutData.quantity || 1,
          basePrice: checkoutData.basePrice,
          services: checkoutData.selectedServices || [],
          uploadedBy: checkoutData.uploadedBy || null,
          category: checkoutData.category || 'Uncategorized',
        }],
        deliveryMethod,
        shippingFee: deliveryMethod === 'Delivery' ? SHIPPING_FEE : 0,
        subtotal,
        totalAmount,
        paymentMethod,
        leaveNote,
        address: deliveryMethod === 'Delivery' ? address : null,
        status: 'Pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Orders'), orderData);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Order Placed Successfully!' });
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Checkout Failed', text2: 'Please verify entry values.' });
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.dragHandle} />
          
          <View style={styles.headerPremium}>
            <TouchableOpacity onPress={onClose} style={styles.backButtonCircle}>
              <Feather name="arrow-left" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitlePremium}>Finalize Checkout</Text>
            <View style={{ width: 36 }} />
          </View>

          {checkoutData && (
            <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Address Section */}
                <View style={styles.sectionCardPremium}>
                  <View style={styles.sectionHeaderPremium}>
                    <View style={styles.titleIconRow}>
                      <Feather name="map-pin" size={16} color="#0F172A" />
                      <Text style={styles.sectionTitlePremium}>Delivery Address</Text>
                    </View>
                    <TouchableOpacity onPress={onAddressSelectRequested} style={styles.editButton}>
                      <Text style={styles.editButtonText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.addressBox}>
                    {loadingAddress ? (
                      <ActivityIndicator size="small" color="#0F172A" />
                    ) : address ? (
                      <View>
                        <Text style={styles.addressName}>{address.fullName}</Text>
                        <Text style={styles.addressText}>{address.fullAddress}</Text>
                      </View>
                    ) : (
                      <Text style={styles.emptyTextNote}>No active address found.</Text>
                    )}
                  </View>
                </View>

                {/* Item Details */}
                <View style={styles.vendorGroup}>
                  <Text style={styles.vendorNameText}>{checkoutData.uploadedBy?.businessName || 'Merchant Shop'}</Text>
                  <View style={styles.itemCardPremium}>
                    <View style={styles.productRow}>
                      <Base64Image base64={checkoutData.imageBase64 || checkoutData.productImage} productId={checkoutData.id} style={styles.productImagePremium} />
                      <View style={styles.productDetailsPremium}>
                        <Text style={styles.productTextPremium}>{checkoutData.productName}</Text>
                        {checkoutData.selectedServices?.map((s, i) => (
                          <Text key={i} style={styles.serviceText}>+ {s.label} (₱{s.price})</Text>
                        ))}
                        <View style={styles.qtyPriceRowPremium}>
                          <Text style={styles.qtyTextPremium}>Qty: {checkoutData.quantity}kg</Text>
                          <Text style={styles.itemTotalPremium}>₱{subtotal.toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Methods Toggle Grid */}
                <View style={styles.sectionCardPremium}>
                  <Text style={styles.sectionTitlePremium}>Shipping Method</Text>
                  <View style={styles.optionGrid}>
                    <TouchableOpacity style={[styles.optionPill, deliveryMethod === 'Delivery' && styles.optionPillActive]} onPress={() => setDeliveryMethod('Delivery')}>
                      <Text style={[styles.optionPillText, deliveryMethod === 'Delivery' && styles.optionPillTextActive]}>Delivery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.optionPill, deliveryMethod === 'Pickup' && styles.optionPillActive]} onPress={() => setDeliveryMethod('Pickup')}>
                      <Text style={[styles.optionPillText, deliveryMethod === 'Pickup' && styles.optionPillTextActive]}>Pickup</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Order Notes input */}
                <View style={styles.sectionCardPremium}>
                  <Text style={styles.sectionTitlePremium}>Instructions</Text>
                  <TextInput style={styles.premiumInput} placeholder="Leave a note for the vendor..." value={leaveNote} onChangeText={setLeaveNote} multiline />
                </View>

                {/* Calculation breakdown */}
                <View style={styles.summaryCardPremium}>
                  <View style={styles.summaryRowPremium}><Text>Subtotal</Text><Text>₱{subtotal.toLocaleString()}</Text></View>
                  <View style={styles.summaryRowPremium}><Text>Shipping</Text><Text>₱{deliveryMethod === 'Delivery' ? SHIPPING_FEE.toFixed(2) : '0.00'}</Text></View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRowPremium}><Text style={styles.totalLabelPremium}>Total</Text><Text style={styles.totalValuePremium}>₱{totalAmount.toLocaleString()}</Text></View>
                </View>
              </ScrollView>

              <View style={styles.footerPremium}>
                <View><Text style={styles.footerTotalLabel}>Total Pay</Text><Text style={styles.footerTotalValue}>₱{totalAmount.toLocaleString()}</Text></View>
                <TouchableOpacity style={styles.checkoutButtonPremium} onPress={handleCheckout} disabled={loadingCheckout}>
                  {loadingCheckout ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutTextPremium}>Place Order</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  modalContainer: { height: SCREEN_HEIGHT * 0.85, backgroundColor: '#FAFAFA', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  dragHandle: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: '#CBD5E1', alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  scrollContent: { paddingBottom: 140, paddingTop: 8 },
  headerPremium: { height: 56, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
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
  addressText: { fontSize: 12, color: '#475569', marginTop: 4 },
  emptyTextNote: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  vendorGroup: { marginHorizontal: 16, marginBottom: 16 },
  vendorNameText: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 },
  itemCardPremium: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: '#F1F5F9' },
  productRow: { flexDirection: 'row' },
  productImagePremium: { width: 80, height: 80, borderRadius: 12 },
  productDetailsPremium: { flex: 1, marginLeft: 16, justifyContent: 'space-between' },
  productTextPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  serviceText: { fontSize: 11, color: '#64748B', marginTop: 2 },
  qtyPriceRowPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  qtyTextPremium: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  itemTotalPremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  optionGrid: { flexDirection: 'row', gap: 10, marginTop: 8 },
  optionPill: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  optionPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  optionPillText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  optionPillTextActive: { color: '#FFF', fontWeight: '700' },
  premiumInput: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, height: 64, fontSize: 13, color: '#0F172A', textAlignVertical: 'top', marginTop: 8 },
  summaryCardPremium: { marginHorizontal: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#F1F5F9' },
  summaryRowPremium: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 8, borderStyle: 'dashed' },
  totalLabelPremium: { fontWeight: '700' },
  totalValuePremium: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  footerPremium: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerTotalLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  footerTotalValue: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  checkoutButtonPremium: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 99 },
  checkoutTextPremium: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }
});