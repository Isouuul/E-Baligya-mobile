// src/screens/Users/BuyNowModal.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth } from '../../firebase';
import BasketIcon from '../../../assets/basket.png';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';

const { height: screenHeight } = Dimensions.get('window');

// ----------------- Base64Image Component -----------------
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = React.useState(null);

  React.useEffect(() => {
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
        console.error('Error saving base64 image:', err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri)
    return (
      <View style={[style, styles.noImage]}>
        <Feather name="image" size={28} color="#94A3B8" />
      </View>
    );

  return <Image source={{ uri: localUri }} style={style} />;
};

export default function BuyNowModal({ visible, onClose, product }) {
  const navigation = useNavigation();

  const [quantity, setQuantity] = useState(1);
  const [selectedServices, setSelectedServices] = useState([]);

  // Memoize enabled services
  const enabledServices = useMemo(() => {
    if (!product?.services) return [];
    return Object.keys(product.services)
      .map((key) => product.services[key])
      .filter((s) => s.enabled);
  }, [product]);

  const toggleService = (label) => {
    if (selectedServices.some((s) => s.label === label)) {
      setSelectedServices(selectedServices.filter((s) => s.label !== label));
    } else {
      const serviceObj = enabledServices.find((s) => s.label === label);
      if (serviceObj) {
        setSelectedServices([
          ...selectedServices,
          { label: serviceObj.label, price: serviceObj.price },
        ]);
      }
    }
  };

  // Compute pricing
  const baseTotal = useMemo(() => {
    return (product?.basePrice || 0) * quantity;
  }, [product, quantity]);

  const servicesTotal = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [selectedServices]);

  const grandTotal = useMemo(() => {
    return (baseTotal + servicesTotal).toFixed(2);
  }, [baseTotal, servicesTotal]);

  const handleBuyNow = async () => {
    if (!auth.currentUser) {
      Alert.alert('Login Required', 'Please login first to continue your purchase.');
      return;
    }

    try {
      const productForCheckout = {
        id: product.id,
        productName: product.productName,
        productImage: product.imageBase64 || null,
        category: product.category || 'Uncategorized',
        basePrice: parseFloat(product.basePrice),
        selectedServices,
        quantity,
        uploadedBy: {
          uid: product.uploadedBy.uid,
          businessName: product.uploadedBy.businessName,
          email: product.uploadedBy.email,
          profileImage: product.uploadedBy.profileImage || null,
        },
      };

      navigation.navigate('BuyNowCheckedOut', { product: productForCheckout });
      onClose();
    } catch (error) {
      console.log('BuyNow error:', error);
      Alert.alert('Error', 'Failed to complete purchase.');
    }
  };

  if (!product) return null;

  return (
    <Modal animationType="slide" visible={visible} transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.dismissOverlay} activeOpacity={1} onPress={onClose} />
        
        <View style={styles.bottomSheetContainer}>
          {/* Decorative Drag Handle */}
          <View style={styles.grabber} />

          {/* Premium Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Confirm Order</Text>
              <Text style={styles.modalSubtitle}>Customize your experience</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Elegant Hero Card */}
            <View style={styles.productMainCard}>
              {product.imageBase64 ? (
                <Base64Image
                  base64={product.imageBase64}
                  productId={product.id}
                  style={styles.productImage}
                />
              ) : (
                <View style={[styles.productImage, styles.noImage]}>
                  <Feather name="box" size={28} color="#94A3B8" />
                </View>
              )}

              <View style={styles.productInfoSide}>
                <View>
                  <Text style={styles.productName} numberOfLines={2}>{product.productName}</Text>
                  <Text style={styles.productPrice}>₱ {product.basePrice.toLocaleString()}</Text>
                </View>
                
                {/* Clean, Tactile Counter */}
                <View style={styles.qtyRowContainer}>
                  <Text style={styles.qtyLabel}>Quantity</Text>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyCircle}
                      onPress={() => setQuantity((prev) => Math.max(prev - 1, 1))}
                      activeOpacity={0.6}
                    >
                      <Feather name="minus" size={14} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyCircle}
                      onPress={() => setQuantity((prev) => prev + 1)}
                      activeOpacity={0.6}
                    >
                      <Feather name="plus" size={14} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Premium Services List */}
            {enabledServices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Feather name="plus-circle" size={16} color="#0F172A" />
                  <Text style={styles.sectionTitle}>Add-on Services</Text>
                </View>
                {enabledServices.map((s, idx) => {
                  const isSelected = selectedServices.some((sel) => sel.label === s.label);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.serviceRow,
                        isSelected && styles.activeService,
                      ]}
                      onPress={() => toggleService(s.label)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.row}>
                        <View style={[
                          styles.checkSquare,
                          isSelected && styles.checkSquareActive
                        ]}>
                          {isSelected && <Feather name="check" size={12} color="#fff" />}
                        </View>
                        <Text style={[styles.serviceLabel, isSelected && styles.activeServiceLabel]}>
                          {s.label}
                        </Text>
                      </View>
                      <Text style={[styles.servicePrice, isSelected && styles.activeServicePrice]}>
                        +₱{s.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Sticky Footer & Price Breakdown */}
          <View style={styles.footer}>
            <View style={styles.breakdownContainer}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Subtotal ({quantity} {quantity === 1 ? 'item' : 'items'})</Text>
                <Text style={styles.breakdownValue}>₱ {baseTotal.toLocaleString()}</Text>
              </View>
              {servicesTotal > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Services</Text>
                  <Text style={styles.breakdownValue}>+₱ {servicesTotal.toLocaleString()}</Text>
                </View>
              )}
            </View>

            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalAmount}>₱ {parseFloat(grandTotal).toLocaleString()}</Text>
              </View>
              
              <TouchableOpacity style={styles.primaryBuyBtn} onPress={handleBuyNow} activeOpacity={0.9}>
                <Image source={BasketIcon} style={styles.buyIcon} />
                <Text style={styles.buyBtnText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', // Smoother, lighter overlay blur effect
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    maxHeight: screenHeight * 0.8,
    // Soft, premium drop shadows
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 20,
  },
  grabber: {
    width: 36,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 99,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 99,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  productMainCard: {
    flexDirection: 'row',
    marginBottom: 28,
    backgroundColor: '#F8FAFC', // Subtle card container
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  productInfoSide: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  qtyRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  qtyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qtyCircle: {
    width: 24,
    height: 24,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  activeService: {
    borderColor: '#0F172A', // Crisp dark alignment for select states
    backgroundColor: '#F8FAFC',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkSquareActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  activeServiceLabel: {
    color: '#0F172A',
    fontWeight: '700',
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeServicePrice: {
    color: '#0F172A',
    fontWeight: '700',
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  breakdownContainer: {
    marginBottom: 16,
    gap: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  primaryBuyBtn: {
    flexDirection: 'row',
    backgroundColor: '#0F172A', // Sleek dark aesthetic
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 99, // Pill design
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  buyIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
    tintColor: '#FFFFFF',
  },
  buyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});