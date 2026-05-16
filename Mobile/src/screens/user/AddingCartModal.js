// src/screens/Users/AddingCartModal.js

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

// ==========================================
// PREMIUM LOCAL IMAGE CACHE COMPONENT
// ==========================================
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    const saveToFile = async () => {
      if (!base64) return;
      try {
        const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setLocalUri(fileUri);
      } catch (err) {
        console.log('Image Error:', err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <Feather name="image" size={24} color="#94A3B8" />
      </View>
    );
  }

  return <Image source={{ uri: localUri }} style={style} />;
};

// ==========================================
// MAIN PREMIUM COMPONENT
// ==========================================
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

  const enabledServices = useMemo(() => {
    if (!product?.services) return [];
    return Object.entries(product.services)
      .filter(([_, service]) => service.enabled)
      .map(([key, service]) => ({ key, ...service }));
  }, [product]);

  useEffect(() => {
    if (!visible) {
      setQuantity(1);
      setLoading(false);
      setSelectedServices([]);
    }
  }, [visible]);

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

  const toggleService = (service) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const exists = selectedServices.some(s => s.key === service.key);
    if (exists) {
      setSelectedServices(selectedServices.filter(s => s.key !== service.key));
    } else {
      setSelectedServices([...selectedServices, { key: service.key, label: service.label, price: service.price }]);
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
      setQuantity(prev => Math.max(1, prev - 1));
    }
  };

  const totalPrice = useMemo(() => {
    const basePrice = parseFloat(product?.basePrice) || 0;
    const servicesPrice = selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
    return (basePrice + servicesPrice) * quantity;
  }, [product, selectedServices, quantity]);

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
          totalPrice: (existingData.totalPrice || 0) + totalPrice,
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
          totalPrice,
          uploadedBy: product.uploadedBy || null,
          createdAt: serverTimestamp(),
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessAnimation();
      onAddToCart && onAddToCart();
    } catch (err) {
      console.log(err);
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

          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.categoryLabel}>{product.category?.toUpperCase()}</Text>
              <Text style={styles.productName}>{product.productName}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* HERO HERO PRODUCT IMAGE & INFO */}
            <View style={styles.heroSection}>
              <Base64Image base64={product.imageBase64} productId={product.id} style={styles.productImage} />
              
              <View style={styles.priceContainer}>
                <View style={styles.priceRow}>
                  <Text style={styles.unitPrice}>₱{parseFloat(product.basePrice).toLocaleString()}</Text>
                  <Text style={styles.unitType}>/ kg</Text>
                </View>
                <Text style={styles.stockText}>{maxQuantity}kg left in stock</Text>
              </View>
            </View>

            {/* QUANTITY PICKER CONTROLLER */}
            <View style={styles.quantitySection}>
              <Text style={styles.sectionHeading}>Select Quantity</Text>
              <View style={styles.qtyControlContainer}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity('dec')}>
                  <Feather name="minus" size={18} color="#3B82F6" />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{quantity} <Text style={styles.qtyWeightLabel}>kg</Text></Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity('inc')}>
                  <Feather name="plus" size={18} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </View>

            {/* PREMIUM EXTRA SERVICES LIST */}
            {enabledServices.length > 0 && (
              <View style={styles.servicesSection}>
                <Text style={styles.sectionHeading}>Add-on Services</Text>
                {enabledServices.map((service, idx) => {
                  const isSelected = selectedServices.some(s => s.key === service.key);
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                      onPress={() => toggleService(service)}
                    >
                      <View style={styles.serviceLeft}>
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </View>
                        <Text style={[styles.serviceLabel, isSelected && styles.serviceTextActive]}>
                          {service.label}
                        </Text>
                      </View>
                      <Text style={[styles.servicePrice, isSelected && styles.serviceTextActive]}>
                        +₱{parseFloat(service.price).toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* PREMIUM FOOTER */}
          <View style={styles.footer}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Price</Text>
              <Text style={styles.totalAmount}>₱{totalPrice.toLocaleString()}</Text>
            </View>

            <TouchableOpacity
              style={[styles.premiumButton, loading && styles.buttonDisabled]}
              onPress={handleAddToCart}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#3B82F6" />
              ) : (
                <Text style={styles.premiumButtonText}>Add to Cart</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* RE-DESIGNED MINIMALIST SUCCESS MODAL */}
        {successVisible && (
          <View style={styles.successOverlay}>
            <Animated.View style={[styles.successCard, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
              <View style={styles.successIconCircle}>
                <Ionicons name="cart" size={28} color="#3B82F6" />
              </View>
              <Text style={styles.successTitle}>Added to Basket</Text>
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ==========================================
// CUSTOM STYLES (PREMIUM MINIMALIST)
// ==========================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.40)', // Sophisticated dark backdrop blur effect
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: screenHeight * 0.85,
    paddingBottom: 34,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 20,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  productImage: {
    width: 85,
    height: 85,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceContainer: {
    marginLeft: 18,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  unitPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitType: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '500',
  },
  stockText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  quantitySection: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  qtyControlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 6,
    alignSelf: 'flex-start',
  },
  qtyBtn: {
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  qtyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 24,
  },
  qtyWeightLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  servicesSection: {
    marginBottom: 16,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  serviceCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  serviceTextActive: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  premiumButton: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    borderWidth: 1.5,
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  premiumButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '700',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 24,
    paddingHorizontal: 36,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
});