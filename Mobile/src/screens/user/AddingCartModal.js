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
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import BasketIcon from '../../../assets/basket.png';
import * as FileSystem from "expo-file-system";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// ----------------- Base64Image Component -----------------
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
        console.error("Error saving base64 image:", err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri) return (
    <View style={[style, styles.noImagePlaceholder]}>
      <Feather name="image" size={24} color="#94A3B8" />
    </View>
  );

  return <Image source={{ uri: localUri }} style={style} />;
};

export default function AddingCartModal({
  visible,
  onClose,
  product,
  selectedVariation,
  setSelectedVariation,
  selectedServices,
  setSelectedServices,
  onAddToCart,
}) {
  const [quantity, setQuantity] = useState(1);
  const [successVisible, setSuccessVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  // Memoize variations
  const variations = useMemo(() => {
    if (!product?.variations) return [];
    return Object.keys(product.variations)
      .map(key => ({ label: key, price: product.variations[key].price }))
      .sort((a, b) => parseFloat(a.label) - parseFloat(b.label));
  }, [product]);

  const enabledServices = useMemo(() => {
    if (!product?.services) return [];
    return Object.keys(product.services)
      .map(key => product.services[key])
      .filter(s => s.enabled);
  }, [product]);

  // Reset state
  useEffect(() => {
    if (!visible) {
      setQuantity(1);
      setSelectedVariation(null);
      setSelectedServices([]);
    } else if (variations.length > 0) {
      setSelectedVariation(variations[0].label);
    }
  }, [visible, variations]);

  // Success animation
  useEffect(() => {
    if (successVisible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => setSuccessVisible(false));
      }, 1500);
    }
  }, [successVisible]);

  if (!product) return null;

  const toggleService = (label) => {
    if (selectedServices.some(s => s.label === label)) {
      setSelectedServices(selectedServices.filter(s => s.label !== label));
    } else {
      const serviceObj = enabledServices.find(s => s.label === label);
      if (serviceObj)
        setSelectedServices([...selectedServices, { label: serviceObj.label, price: serviceObj.price }]);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariation) return alert('Please select a variation');
    try {
      const variationPrice = parseFloat(product.variations?.[selectedVariation]?.price) || parseFloat(product.basePrice) || 0;
      const servicesPrice = selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
      const totalPriceValue = parseFloat((variationPrice * quantity + servicesPrice).toFixed(2));

      const cartData = {
        userId: auth.currentUser?.uid || 'guest',
        productId: product.id,
        uploadedBy: {
          uid: product.uploadedBy?.uid || '',
          businessName: product.uploadedBy?.businessName || '',
          email: product.uploadedBy?.email || '',
          profileImage: product.uploadedBy?.profileImage || null,
        },
        productName: product.productName || 'Unnamed Product',
        basePrice: variationPrice,
        productImage: product.imageBase64 || null,
        category: product.category || 'Uncategorized',
        selectedVariation: selectedVariation || null,
        selectedServices: selectedServices || [],
        quantity: quantity || 1,
        totalPrice: totalPriceValue,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Carts', auth.currentUser.uid, 'items'), cartData);
      setSuccessVisible(true);
      onAddToCart && onAddToCart();
      onClose();
    } catch (err) {
      console.log(err);
      alert('Failed to add product to cart.');
    }
  };

  const totalPrice = () => {
    if (!selectedVariation) return 0;
    const variationPrice = product.variations?.[selectedVariation]?.price || product.basePrice;
    const servicesPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
    return (variationPrice * quantity + servicesPrice).toFixed(2);
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.5)" />
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
          
          <View style={styles.bottomSheet}>
            <View style={styles.dragHandle} />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Cart</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.productMainCard}>
                <View style={styles.imageWrapper}>
                  {product.imageBase64 ? (
                    <Base64Image base64={product.imageBase64} productId={product.id} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.noImagePlaceholder]}>
                      <Feather name="box" size={30} color="#94A3B8" />
                    </View>
                  )}
                  {product.category && (
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{product.category}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{product.productName}</Text>
                  <Text style={styles.basePriceText}>₱ {product.basePrice.toLocaleString()} / kg</Text>
                  
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyPicker}>
                      <TouchableOpacity style={styles.qtyAction} onPress={() => setQuantity(prev => Math.max(prev - 1, 1))}>
                        <Feather name="minus" size={16} color="#1E293B" />
                      </TouchableOpacity>
                      <Text style={styles.qtyCount}>{quantity}</Text>
                      <TouchableOpacity style={styles.qtyAction} onPress={() => setQuantity(prev => prev + 1)}>
                        <Feather name="plus" size={16} color="#1E293B" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Variations */}
              {variations.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Select Variation</Text>
                  <View style={styles.variationGrid}>
                    {variations.map((v, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.variationPill, selectedVariation === v.label && styles.activePill]}
                        onPress={() => setSelectedVariation(selectedVariation === v.label ? null : v.label)}
                      >
                        <Text style={[styles.pillLabel, selectedVariation === v.label && styles.activePillText]}>{v.label}</Text>
                        <Text style={[styles.pillPrice, selectedVariation === v.label && styles.activePillText]}>₱{v.price}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Services */}
              {enabledServices.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Optional Services</Text>
                  {enabledServices.map((s, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.serviceItem, selectedServices.some(sel => sel.label === s.label) && styles.activeServiceItem]}
                      onPress={() => toggleService(s.label)}
                    >
                      <View style={styles.row}>
                        <View style={[styles.checkbox, selectedServices.some(sel => sel.label === s.label) && styles.checkboxActive]}>
                          {selectedServices.some(sel => sel.label === s.label) && <Feather name="check" size={14} color="#fff" />}
                        </View>
                        <Text style={styles.serviceText}>{s.label}</Text>
                      </View>
                      <Text style={styles.servicePriceText}>+₱{s.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.priceContainer}>
                <Text style={styles.totalLabel}>Total Price</Text>
                <Text style={styles.totalValue}>₱ {parseFloat(totalPrice()).toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={styles.addCartBtn} onPress={handleAddToCart} activeOpacity={0.8}>
                <Image source={BasketIcon} style={styles.btnIcon} />
                <Text style={styles.btnText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {successVisible && (
        <Animated.View
          style={[
            styles.successToast,
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          <View style={styles.toastContent}>
             <View style={styles.sileoIconCircle}>
               <Text style={styles.sileoIcon}>✓</Text>
             </View>
             <Text style={styles.successToastText}>Added to Cart!</Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: screenHeight * 0.8,
    paddingBottom: 20,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  scrollContent: {
    padding: 24,
  },
  productMainCard: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  imageWrapper: {
    position: 'relative',
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
  },
  noImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  productInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  basePriceText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  qtyPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  qtyAction: {
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 1,
  },
  qtyCount: {
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  variationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variationPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    minWidth: '30%',
    alignItems: 'center',
  },
  activePill: {
    borderColor: '#1E3A8A',
    backgroundColor: '#EFF6FF',
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  pillPrice: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  activePillText: {
    color: '#1E3A8A',
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    marginBottom: 8,
  },
  activeServiceItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  serviceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  servicePriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  priceContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E3A8A',
  },
  addCartBtn: {
    flexDirection: 'row',
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
    tintColor: '#fff',
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  successToast: {
    position: 'absolute',
    top: '40%',
    left: '15%',
    right: '15%',
    zIndex: 9999,
  },
  toastContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  sileoIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sileoIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
  },
  successToastText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});