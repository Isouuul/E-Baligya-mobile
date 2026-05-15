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
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { auth, db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as FileSystem from "expo-file-system";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// Optimized Base64Image
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    const saveToFile = async () => {
      if (!base64) return;
      const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
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
  }, [base64]);

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

  // Success Animation Values
  const successScale = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const enabledServices = useMemo(() => {
    if (!product?.services) return [];
    return Object.keys(product.services)
      .map(key => product.services[key])
      .filter(s => s.enabled);
  }, [product]);

  useEffect(() => {
    if (!visible) {
      setQuantity(1);
      setSelectedServices([]);
      setLoading(false);
    }
  }, [visible]);

  const showSuccessAnimation = () => {
    setSuccessVisible(true);
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setSuccessVisible(false);
        successScale.setValue(0.7); // Reset
        onClose();
      });
    }, 1800);
  };

  const toggleService = (label) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedServices.some(s => s.label === label)) {
      setSelectedServices(selectedServices.filter(s => s.label !== label));
    } else {
      const serviceObj = enabledServices.find(s => s.label === label);
      if (serviceObj) {
        setSelectedServices([...selectedServices, { label: serviceObj.label, price: serviceObj.price }]);
      }
    }
  };

  const updateQuantity = (type) => {
    Haptics.selectionAsync();
    if (type === 'inc') setQuantity(prev => prev + 1);
    else setQuantity(prev => Math.max(prev - 1, 1));
  };

  const totalPrice = () => {
    const basePrice = parseFloat(product?.basePrice) || 0;
    const servicesPrice = selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
    return ((basePrice * quantity) + servicesPrice).toFixed(2);
  };

  const handleAddToCart = async () => {
    setLoading(true);
    try {
      const cartData = {
        userId: auth.currentUser?.uid || 'guest',
        productId: product.id,
        productName: product.productName,
        basePrice: parseFloat(product.basePrice),
        selectedServices,
        quantity,
        totalPrice: parseFloat(totalPrice()),
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'Carts', auth.currentUser.uid, 'items'), cartData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setLoading(false);
      showSuccessAnimation();
      onAddToCart && onAddToCart();
    } catch (err) {
      setLoading(false);
      alert('Failed to add product.');
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
            <Text style={styles.categoryLabel}>{product.category}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.productRow}>
              <Base64Image base64={product.imageBase64} productId={product.id} style={styles.productImage} />
              <View style={styles.priceInfo}>
                <Text style={styles.productName}>{product.productName}</Text>
                <View style={styles.unitPriceRow}>
                  <Text style={styles.unitPrice}>₱{parseFloat(product.basePrice).toLocaleString()}</Text>
                  <View style={styles.kgBadge}>
                    <Text style={styles.kgBadgeText}>/ per KG</Text>
                  </View>
                </View>
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
                <Text style={styles.sectionTitle}>Select Services</Text>
                {enabledServices.map((s, idx) => {
                  const isSelected = selectedServices.some(sel => sel.label === s.label);
                  return (
                    <TouchableOpacity 
                      key={idx} 
                      activeOpacity={0.7}
                      style={[styles.serviceRow, isSelected && styles.serviceRowActive]} 
                      onPress={() => toggleService(s.label)}
                    >
                      <View style={styles.serviceInfo}>
                         <View style={[styles.radio, isSelected && styles.radioActive]}>
                           {isSelected && <View style={styles.radioInner} />}
                         </View>
                         <Text style={[styles.serviceLabel, isSelected && styles.textActive]}>{s.label}</Text>
                      </View>
                      <Text style={[styles.servicePrice, isSelected && styles.textActive]}>+₱{s.price}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalSub}>Total Amount</Text>
              <Text style={styles.totalAmount}>₱{parseFloat(totalPrice()).toLocaleString()}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.buttonDisabled]} 
              onPress={handleAddToCart}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* CENTERED SUCCESS CARD */}
        {successVisible && (
          <View style={styles.successOverlay}>
            <Animated.View 
              style={[
                styles.successCard, 
                { opacity: successOpacity, transform: [{ scale: successScale }] }
              ]}
            >
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={40} color="#FFF" />
              </View>
              <Text style={styles.successTitle}>Added to Cart</Text>
              <Text style={styles.successSub}>Your item is ready for checkout</Text>
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
  dismissArea: { ...StyleSheet.absoluteFillObject },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: screenHeight * 0.8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 20,
  },
  dragHandle: {
    width: 38,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  categoryLabel: { fontSize: 12, fontWeight: '800', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24 },
  productRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  productImage: { width: 70, height: 70, borderRadius: 16, backgroundColor: '#F1F5F9' },
  priceInfo: { flex: 1, marginLeft: 16 },
  productName: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  unitPriceRow: { flexDirection: 'row', alignItems: 'center' },
  unitPrice: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  kgBadge: { marginLeft: 8, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  kgBadgeText: { fontSize: 10, color: '#64748B', fontWeight: '700' },
  miniQtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  miniQtyBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  miniQtyText: { paddingHorizontal: 12, fontSize: 16, fontWeight: '800', color: '#1E293B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 8, backgroundColor: '#F8FAFC' },
  serviceRowActive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  serviceInfo: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  radioActive: { borderColor: '#3B82F6' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
  serviceLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  servicePrice: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  textActive: { color: '#1E40AF' },
  footer: { flexDirection: 'row', paddingHorizontal: 24, paddingTop: 20, alignItems: 'center', borderTopWidth: 1, borderColor: '#F1F5F9' },
  totalBlock: { flex: 1 },
  totalSub: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  totalAmount: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  primaryButton: { backgroundColor: '#EFF6FF', height: 56, paddingHorizontal: 32, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3B82F6' },
  primaryButtonText: { color: '#2563EB', fontSize: 16, fontWeight: '800' },
  
  /* SUCCESS CARD STYLES */
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  successCard: {
    width: screenWidth * 0.75,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 30,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  noImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
});