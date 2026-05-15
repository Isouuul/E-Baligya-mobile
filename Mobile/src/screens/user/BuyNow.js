// src/screens/Users/BuyNowModal.js
import React, { useState, useMemo, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { auth } from '../../firebase';
import BasketIcon from '../../../assets/basket.png';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

const { height: screenHeight } = Dimensions.get('window');

// ----------------- Base64Image Component -----------------
const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    const saveToFile = async () => {
      if (!base64) return;

      const fileUri =
        FileSystem.cacheDirectory + `buy_now_${productId}.jpg`;

      try {
        const cleanBase64 = base64.replace(
          /^data:image\/\w+;base64,/,
          ''
        );

        await FileSystem.writeAsStringAsync(
          fileUri,
          cleanBase64,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );

        setLocalUri(fileUri);
      } catch (err) {
        console.log('Base64 Error:', err);
      }
    };

    saveToFile();
  }, [base64]);

  if (!localUri) {
    return (
      <View style={[style, styles.noImage]}>
        <Feather name="image" size={24} color="#94A3B8" />
      </View>
    );
  }

  return <Image source={{ uri: localUri }} style={style} />;
};

export default function BuyNowModal({
  visible,
  onClose,
  product,
}) {
  const navigation = useNavigation();

  const [quantity, setQuantity] = useState(1);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------------- RESET ----------------
  useEffect(() => {
    if (!visible) {
      setQuantity(1);
      setSelectedServices([]);
      setLoading(false);
    }
  }, [visible]);

  // ---------------- SERVICES ----------------
  const enabledServices = useMemo(() => {
    if (!product?.services) return [];

    return Object.keys(product.services)
      .map((key) => product.services[key])
      .filter((service) => service.enabled);
  }, [product]);

  const toggleService = (label) => {
    Haptics.selectionAsync();

    const alreadySelected = selectedServices.some(
      (service) => service.label === label
    );

    if (alreadySelected) {
      setSelectedServices((prev) =>
        prev.filter((service) => service.label !== label)
      );
    } else {
      const serviceObj = enabledServices.find(
        (service) => service.label === label
      );

      if (serviceObj) {
        setSelectedServices((prev) => [
          ...prev,
          {
            label: serviceObj.label,
            price: Number(serviceObj.price || 0),
          },
        ]);
      }
    }
  };

  // ---------------- QUANTITY ----------------
  const updateQuantity = (type) => {
    Haptics.selectionAsync();

    if (type === 'inc') {
      setQuantity((prev) => prev + 1);
    } else {
      setQuantity((prev) => Math.max(prev - 1, 1));
    }
  };

  // ---------------- TOTALS ----------------
  const baseTotal = useMemo(() => {
    return (Number(product?.basePrice || 0)) * quantity;
  }, [product, quantity]);

  const servicesTotal = useMemo(() => {
    return selectedServices.reduce(
      (sum, service) => sum + Number(service.price || 0),
      0
    );
  }, [selectedServices]);

  const grandTotal = useMemo(() => {
    return baseTotal + servicesTotal;
  }, [baseTotal, servicesTotal]);

  // ---------------- BUY NOW ----------------
  const handleBuyNow = async () => {
    if (!auth.currentUser) {
      Alert.alert(
        'Login Required',
        'Please login first.'
      );
      return;
    }

    if (!product) return;

    try {
      setLoading(true);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );

      // THIS STRUCTURE MATCHES YOUR ORDER SYSTEM
      const checkoutItem = {
        productId: product.id,
        productName: product.productName,
        productImage:
          product.imageBase64 ||
          product.productImage ||
          null,

        category:
          product.category || 'Uncategorized',

        quantity,

        basePrice: Number(product.basePrice || 0),

        selectedServices: selectedServices || [],

        uploadedBy: {
          uid: product?.uploadedBy?.uid || null,
          marketName:
            product?.uploadedBy?.marketName || '',
          businessName:
            product?.uploadedBy?.businessName || '',
          email:
            product?.uploadedBy?.email || '',
          profileImage:
            product?.uploadedBy?.profileImage || null,
        },
      };

      // NAVIGATE TO CHECKOUT
      navigation.navigate(
        'BuyNowModalCheckedOut',
        {
          checkoutData: checkoutItem,
        }
      );

      onClose();
    } catch (error) {
      console.log('BUY NOW ERROR:', error);

      Alert.alert(
        'Checkout Failed',
        'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.dismissOverlay}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.bottomSheetContainer}>
          {/* HANDLE */}
          <View style={styles.grabber} />

          {/* HEADER */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                Buy Now
              </Text>

              <Text style={styles.modalSubtitle}>
                Confirm your purchase
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
            >
              <Ionicons
                name="close"
                size={18}
                color="#475569"
              />
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* PRODUCT */}
            <View style={styles.productMainCard}>
              {product.imageBase64 ? (
                <Base64Image
                  base64={product.imageBase64}
                  productId={product.id}
                  style={styles.productImage}
                />
              ) : (
                <View
                  style={[
                    styles.productImage,
                    styles.noImage,
                  ]}
                >
                  <Feather
                    name="box"
                    size={28}
                    color="#94A3B8"
                  />
                </View>
              )}

              <View style={styles.productInfoSide}>
                <View>
                  <Text
                    style={styles.productName}
                    numberOfLines={2}
                  >
                    {product.productName}
                  </Text>

                  <Text style={styles.productPrice}>
                    ₱
                    {Number(
                      product.basePrice || 0
                    ).toLocaleString()}
                  </Text>
                </View>

                {/* QUANTITY */}
                <View style={styles.qtyRowContainer}>
                  <Text style={styles.qtyLabel}>
                    Quantity
                  </Text>

                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyCircle}
                      onPress={() =>
                        updateQuantity('dec')
                      }
                    >
                      <Feather
                        name="minus"
                        size={14}
                        color="#0F172A"
                      />
                    </TouchableOpacity>

                    <Text style={styles.qtyValue}>
                      {quantity}
                    </Text>

                    <TouchableOpacity
                      style={styles.qtyCircle}
                      onPress={() =>
                        updateQuantity('inc')
                      }
                    >
                      <Feather
                        name="plus"
                        size={14}
                        color="#0F172A"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* SERVICES */}
            {enabledServices.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Feather
                    name="plus-circle"
                    size={16}
                    color="#0F172A"
                  />

                  <Text style={styles.sectionTitle}>
                    Add-on Services
                  </Text>
                </View>

                {enabledServices.map((service, idx) => {
                  const isSelected =
                    selectedServices.some(
                      (selected) =>
                        selected.label ===
                        service.label
                    );

                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.8}
                      style={[
                        styles.serviceRow,
                        isSelected &&
                          styles.activeService,
                      ]}
                      onPress={() =>
                        toggleService(service.label)
                      }
                    >
                      <View style={styles.row}>
                        <View
                          style={[
                            styles.checkSquare,
                            isSelected &&
                              styles.checkSquareActive,
                          ]}
                        >
                          {isSelected && (
                            <Feather
                              name="check"
                              size={12}
                              color="#fff"
                            />
                          )}
                        </View>

                        <Text
                          style={[
                            styles.serviceLabel,
                            isSelected &&
                              styles.activeServiceLabel,
                          ]}
                        >
                          {service.label}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.servicePrice,
                          isSelected &&
                            styles.activeServicePrice,
                        ]}
                      >
                        +₱{service.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* FOOTER */}
          <View style={styles.footer}>
            <View style={styles.breakdownContainer}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Subtotal ({quantity})
                </Text>

                <Text style={styles.breakdownValue}>
                  ₱{baseTotal.toLocaleString()}
                </Text>
              </View>

              {servicesTotal > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Services
                  </Text>

                  <Text style={styles.breakdownValue}>
                    +₱{servicesTotal.toLocaleString()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.totalLabel}>
                  Grand Total
                </Text>

                <Text style={styles.totalAmount}>
                  ₱{grandTotal.toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBuyBtn,
                  loading && {
                    opacity: 0.7,
                  },
                ]}
                onPress={handleBuyNow}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Image
                      source={BasketIcon}
                      style={styles.buyIcon}
                    />

                    <Text style={styles.buyBtnText}>
                      Checkout
                    </Text>
                  </>
                )}
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
    backgroundColor: 'rgba(15,23,42,0.45)',
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
    borderBottomColor: '#F1F5F9',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },

  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  closeBtn: {
    backgroundColor: '#F1F5F9',
    padding: 8,
    borderRadius: 99,
  },

  scrollContent: {
    padding: 24,
    paddingBottom: 30,
  },

  productMainCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 24,
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
  },

  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },

  qtyRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },

  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },

  activeService: {
    borderColor: '#0F172A',
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
  },

  servicePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },

  activeServicePrice: {
    color: '#0F172A',
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },

  breakdownContainer: {
    marginBottom: 16,
    gap: 6,
  },

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  breakdownLabel: {
    fontSize: 13,
    color: '#64748B',
  },

  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },

  totalAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },

  primaryBuyBtn: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
  },

  buyIcon: {
    width: 16,
    height: 16,
    tintColor: '#FFFFFF',
    marginRight: 8,
  },

  buyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});