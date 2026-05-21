import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';

import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { auth, db } from '../../firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore';

const { height: screenHeight } = Dimensions.get('window');

// Optimized Base64Image Matching BuyNow Styling
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    const saveToFile = async () => {
      if (!base64) return;
      const fileUri = FileSystem.cacheDirectory + `cart_${productId}.jpg`;
      try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLocalUri(fileUri);
      } catch (err) {
        console.error("Error saving image:", err);
      }
    };
    saveToFile();
  }, [base64, productId]);

  if (!localUri) {
    return (
      <View style={[style, styles.noImagePlaceholder]}>
        <Feather name="image" size={20} color="#94A3B8" />
      </View>
    );
  }
  return <Image source={{ uri: localUri }} style={style} />;
};

export default function AddingCartModal({
  visible,
  onClose,
  product,
  selectedServices,
  setSelectedServices,
  onAddToCart,
}) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const successScale = useRef(new Animated.Value(0.8)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const maxQuantity = product?.quantityKg || 0;

  // Uses BuyNow array formatting logic 
  const enabledServices = useMemo(() => {
    if (!product || !Array.isArray(product.premiumServices)) return [];
    return product.premiumServices;
  }, [product]);

  useEffect(() => {
    if (!visible) {
      setQuantity(1);
      setSelectedServices([]);
      setLoading(false);
    }
  }, [visible, setSelectedServices]);

  const showSuccessAnimation = () => {
    setSuccessVisible(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setSuccessVisible(false);
        successScale.setValue(0.8);
        onClose();
      });
    }, 1600);
  };

  const toggleService = (serviceId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (selectedServices.some(s => s.id === serviceId)) {
      setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
    } else {
      const serviceObj = enabledServices.find(s => s.id === serviceId);
      if (serviceObj) {
        setSelectedServices([
          ...selectedServices,
          { id: serviceObj.id, label: serviceObj.label, price: serviceObj.price }
        ]);
      }
    }
  };

  const updateQuantity = (type) => {
    Haptics.selectionAsync();
    if (type === 'inc') {
      if (quantity >= maxQuantity) {
        Alert.alert('Stock Limit', `Only ${maxQuantity}kg available`);
        return;
      }
      setQuantity(prev => prev + 1);
    } else {
      setQuantity(prev => Math.max(prev - 1, 1));
    }
  };

  const totalPrice = () => {
    const basePrice = parseFloat(product?.basePrice) || 0;
    const servicesPrice = selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
    return ((basePrice * quantity) + servicesPrice).toFixed(2);
  };

  const handleAddToCart = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (!auth.currentUser) {
        Alert.alert('Authentication Error', 'Please login first.');
        return;
      }
      if (maxQuantity === 0 || quantity > maxQuantity) {
        Alert.alert('Stock Error', 'Requested quantity is unavailable.');
        return;
      }

      const cartRef = collection(db, 'Carts', auth.currentUser.uid, 'items');
      const q = query(cartRef, where('productId', '==', product.id));
      const snapshot = await getDocs(q);

      const computedTotal = parseFloat(totalPrice());

      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        const existingData = existingDoc.data();
        const newQty = (existingData.quantity || 0) + quantity;

        if (newQty > maxQuantity) {
          Alert.alert('Stock Limit Reached', `You already have ${existingData.quantity}kg in cart.`);
          return;
        }

        await updateDoc(existingDoc.ref, {
          quantity: newQty,
          selectedServices, 
          totalPrice: (existingData.totalPrice || 0) + computedTotal,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(cartRef, {
          userId: auth.currentUser.uid,
          productId: product.id,
          productName: product.productName,
          category: product.category || 'Fish',
          productImage: product.imageBase64 || null,
          basePrice: parseFloat(product.basePrice),
          selectedServices,
          quantity,
          totalPrice: computedTotal,
          uploadedBy: product.uploadedBy || null,
          createdAt: serverTimestamp(),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessAnimation();
      onAddToCart && onAddToCart();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to add product to cart.');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.bottomSheet}>
          <View style={styles.dragHandle} />
          
          <View style={styles.header}>
            <View>
              <Text style={styles.categoryLabel}>{product.category || 'Fish'}</Text>
              <Text style={styles.productName}>{product.productName}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.productRow}>
              <Base64Image base64={product.imageBase64} productId={product.id} style={styles.productImage} />
              
              <View style={styles.priceInfo}>
                <Text style={styles.label}>Unit Price</Text>
                <View style={styles.unitPriceRow}>
                  <Text style={styles.unitPrice}>₱{parseFloat(product.basePrice).toLocaleString()}</Text>
                  <View style={styles.kgBadge}>
                    <Text style={styles.kgBadgeText}>/ KG</Text>
                  </View>
                </View>
                <Text style={styles.stockLabel}>{maxQuantity}kg available</Text>
              </View>

              <View style={styles.miniQtyContainer}>
                <TouchableOpacity style={styles.miniQtyBtn} onPress={() => updateQuantity('dec')}>
                  <Feather name="minus" size={16} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.miniQtyText}>{quantity}</Text>
                <TouchableOpacity style={styles.miniQtyBtn} onPress={() => updateQuantity('inc')}>
                  <Feather name="plus" size={16} color="#1E293B" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {enabledServices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available Add-ons</Text>
                {enabledServices.map((s) => {
                  const isSelected = selectedServices.some(sel => sel.id === s.id);
                  return (
                    <TouchableOpacity 
                      key={s.id} 
                      activeOpacity={0.7}
                      style={[styles.serviceRow, isSelected && styles.serviceRowActive]} 
                      onPress={() => toggleService(s.id)}
                    >
                      <View style={styles.serviceInfo}>
                        <View style={[styles.radio, isSelected && styles.radioActive]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.serviceLabel, isSelected && styles.textActive]}>{s.label}</Text>
                      </View>
                      <Text style={[styles.servicePrice, isSelected && styles.textActive]}>
                        +₱{parseFloat(s.price).toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalSub}>Subtotal</Text>
              <Text style={styles.totalAmount}>₱{parseFloat(totalPrice()).toLocaleString()}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]} 
              onPress={handleAddToCart}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#3b82f6" />
              ) : (
                <Text style={styles.primaryButtonText}>Add to Basket</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* SUCCESS INTERACTIVE DISPLAY OVERLAY */}
        {successVisible && (
          <View style={styles.successOverlay}>
            <Animated.View style={[styles.successCard, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
              <View style={styles.successIconCircle}>
                <Ionicons name="basket" size={28} color="#3B82F6" />
              </View>
              <Text style={styles.successTitle}>Added to Basket</Text>
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  dismissArea: { flex: 1 },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34, 
    maxHeight: screenHeight * 0.75,
  },
  dragHandle: {
    width: 32,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    pt: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5 },
  productName: { fontSize: 20, fontWeight: '700', color: '#0F172A'},
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24 },
  productRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  productImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F1F5F9' },
  priceInfo: { flex: 1, marginLeft: 15 },
  label: { fontSize: 12, color: '#94A3B8', marginBottom: 2 },
  unitPriceRow: { flexDirection: 'row', alignItems: 'baseline' },
  unitPrice: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  kgBadge: { marginLeft: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 4, borderRadius: 4 },
  kgBadgeText: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  stockLabel: { fontSize: 11, color: '#22C55E', fontWeight: '600', marginTop: 2 },
  miniQtyContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    padding: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  miniQtyBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, elevation: 1 },
  miniQtyText: { paddingHorizontal: 12, fontSize: 15, fontWeight: '700', color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 12, textTransform: 'uppercase' },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4 },
  serviceRowActive: { backgroundColor: '#eff6ff' }, 
  serviceInfo: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  radioActive: { backgroundColor: '#eff6fd', borderColor: '#3b82f6' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  serviceLabel: { fontSize: 14, fontWeight: '500', color: '#000' },
  servicePrice: { fontSize: 14, fontWeight: '600', color: '#3b82f6' },
  textActive: { color: '#3b82f6', fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  totalBlock: { flex: 1 },
  totalSub: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase' },
  totalAmount: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  primaryButton: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
    flex: 1,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  noImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});