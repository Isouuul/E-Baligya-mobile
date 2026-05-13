// src/screens/Users/ViewProduct.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  StatusBar,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { useRoute, useNavigation } from '@react-navigation/native';
import ReportModal from '../user/ReportModal';
import WarningIcon from '../../../assets/Warning1.png';
import BasketIcon from '../../../assets/basket.png';

const { width } = Dimensions.get('window');

export default function ViewProduct() {
  const route = useRoute();
  const navigation = useNavigation();
  const { productId } = route.params;

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [reportVisible, setReportVisible] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [vendorProfileImage, setVendorProfileImage] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const scaleAnim = useState(new Animated.Value(0))[0];

  // Dynamic state for real-time freshness text/countdown
  const [freshnessStatusText, setFreshnessStatusText] = useState('Checking freshness...');
  const [freshnessStatusColor, setFreshnessStatusColor] = useState('#64748B'); 
  const [isExpired, setIsExpired] = useState(false);

  // Logic Preserved: Load User
  useEffect(() => {
    const loadUser = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const ref = doc(db, "Users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) setUserData(snap.data());
    };
    loadUser();
  }, []);

  // Logic Preserved: Fetch Product
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'Products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct(docSnap.data());
        } else {
          Alert.alert('Error', 'Product not found');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  // Logic Preserved: Vendor Info & Follow Status
  useEffect(() => {
    const fetchVendorData = async () => {
      if (!product?.uploadedBy?.uid) return;
      try {
        const vendorQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', product.uploadedBy.uid));
        const vendorSnap = await getDocs(vendorQuery);
        if (!vendorSnap.empty) {
          const vendorDoc = vendorSnap.docs[0];
          setVendorProfileImage(vendorDoc.data().profileImage);
          const followersRef = collection(db, 'ApprovedVendors', vendorDoc.id, 'followers');
          const followersSnap = await getDocs(followersRef);
          setFollowersCount(followersSnap.size);
          
          const user = auth.currentUser;
          if (user) {
            const followerRef = doc(db, "ApprovedVendors", vendorDoc.id, "followers", user.uid);
            const fSnap = await getDoc(followerRef);
            setIsFollowing(fSnap.exists());
          }
        }
      } catch (err) { console.log(err); }
    };
    fetchVendorData();
  }, [product]);

  // Decoupled Freshness and Shelf Life Evaluation Loop
  useEffect(() => {
    if (!product) return;

    const checkFreshnessClock = () => {
      const freshnessDb = product?.uploadedBy?.freshness || 'Unknown';

      if (freshnessDb.toLowerCase() === 'rotten') {
        setFreshnessStatusText('Expired / Not Fresh (Spoiled Initial Scan)');
        setFreshnessStatusColor('#EF4444'); 
        setIsExpired(true);
        return;
      }

      const now = new Date().getTime();
      const warningTime = product.warningTime?.toDate ? product.warningTime.toDate().getTime() : null;
      const expiryTime = product.expiryTime?.toDate ? product.expiryTime.toDate().getTime() : null;

      if (!warningTime || !expiryTime) {
        setFreshnessStatusText(`Freshness: ${freshnessDb}`);
        setFreshnessStatusColor('#0EA5E9'); 
        setIsExpired(false);
        return;
      }

      if (now >= expiryTime) {
        setFreshnessStatusText('Expired / Not Fresh');
        setFreshnessStatusColor('#EF4444'); 
        setIsExpired(true);
      } else if (now >= warningTime) {
        const timeLeftMs = expiryTime - now;
        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        setFreshnessStatusText(`Almost not fresh (${hoursLeft}h ${minsLeft}m left)`);
        setFreshnessStatusColor('#F59E0B'); 
        setIsExpired(false);
      } else {
        const timeLeftMs = warningTime - now;
        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
        setFreshnessStatusText(`Fresh (Degrading in ${hoursLeft}h ${minsLeft}m)`);
        setFreshnessStatusColor('#10B981'); 
        setIsExpired(false);
      }
    };

    checkFreshnessClock();
    const interval = setInterval(checkFreshnessClock, 60000); 

    return () => clearInterval(interval);
  }, [product]);

  const basePrice = product?.basePrice || 0;

  const servicePrice = useMemo(() => {
    if (!Array.isArray(selectedServices)) return 0;
    return selectedServices.reduce((total, key) => total + (product?.services?.[key]?.price || 0), 0);
  }, [selectedServices, product]);

  const totalPrice = useMemo(() => (basePrice + servicePrice) * quantity, [basePrice, servicePrice, quantity]);

  const handleFollow = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return Alert.alert("Error", "You must be logged in");
      const vendorQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", product.uploadedBy.uid));
      const vendorSnap = await getDocs(vendorQuery);
      if (vendorSnap.empty) return;
      const vendorDocId = vendorSnap.docs[0].id;
      const followerRef = doc(db, "ApprovedVendors", vendorDocId, "followers", user.uid);
      if (!isFollowing) {
        await setDoc(followerRef, { 
          followerId: user.uid, 
          followerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`,
          followedAt: new Date() 
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      } else {
        await deleteDoc(followerRef);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
      }
    } catch (err) { Alert.alert("Error", "Action failed"); }
  };

  const getCartPayload = () => {
    return {
      id: productId,
      userId: auth.currentUser.uid,
      productId,
      uploadedBy: product.uploadedBy,
      productName: product.productName,
      basePrice: basePrice,
      productImage: productImageURI,
      category: product.category || 'Uncategorized',
      selectedServices: selectedServices.map(key => ({
        label: product.services[key].label,
        price: product.services[key].price,
      })),
      quantity,
      totalPrice,
      createdAt: serverTimestamp(),
    };
  };

  const handleAddToCart = async () => {
    if (isExpired) {
      return Alert.alert('Quality Restriction', 'Cannot buy this listing. The seafood is no longer fresh.');
    }
    try {
      await addDoc(collection(db, 'Carts', auth.currentUser.uid, 'items'), getCartPayload());
      showSuccessModal();
    } catch (err) { Alert.alert('Error', 'Failed to add to cart'); }
  };

  const handleBuyNow = async () => {
    if (isExpired) {
      return Alert.alert('Quality Restriction', 'Cannot buy this listing. The seafood is no longer fresh.');
    }
    try {
      const checkoutPayload = getCartPayload();
      // Navigate directly to checkout with product data
      navigation.navigate('BuyNowCheckedOut', { product: checkoutPayload });
    } catch (err) {
      Alert.alert('Error', 'Failed to initialize direct purchase');
    }
  };

  const showSuccessModal = () => {
    setSuccessModalVisible(true);
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(scaleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSuccessModalVisible(false));
    }, 2000);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;
  if (!product) return null;

  const enabledServices = product.services ? Object.entries(product.services).filter(([_, s]) => s.enabled).map(([key, s]) => ({ key, ...s })) : [];
  const productImageURI = product.imageBase64 ? (product.imageBase64.startsWith('data:image') ? product.imageBase64 : `data:image/jpeg;base64,${product.imageBase64}`) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* PREMIUM HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerCircleBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Product Details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerCircleBtn} onPress={() => setReportVisible(true)}>
             <Image source={WarningIcon} style={styles.headerAssetIcon} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerCircleBtn, {marginLeft: 12}]} onPress={() => navigation.navigate('CartShop')}>
             <Image source={BasketIcon} style={styles.headerAssetIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* IMAGE SECTION WITH GRADIENT OVERLAYS */}
        <View style={styles.imageWrapper}>
          {productImageURI ? (
            <Image source={{ uri: productImageURI }} style={styles.mainProductImage} resizeMode="cover" />
          ) : (
            <View style={styles.noImagePlaceholder}>
              <MaterialCommunityIcons name="image-off" size={60} color="#94A3B8" />
            </View>
          )}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{product.category ? product.category.toUpperCase() : 'FISH'}</Text>
          </View>
        </View>

        <View style={styles.contentSection}>
          {/* PREMIUM QUALITY CONTROL BANNER */}
          <View style={[styles.qualityBanner, { borderColor: freshnessStatusColor + '40', backgroundColor: freshnessStatusColor + '08' }]}>
            <View style={[styles.qualityStatusBadge, { backgroundColor: freshnessStatusColor }]}>
              <Text style={styles.qualityStatusBadgeText}>
                {product?.uploadedBy?.freshness || 'Unknown'}
              </Text>
            </View>
            <View style={styles.qualityInfoWrapper}>
              <Text style={styles.qualityBannerHeader}>Quality Evaluation</Text>
              <Text style={[styles.qualityCountdownText, { color: freshnessStatusColor }]}>
                {freshnessStatusText}
              </Text>
            </View>
          </View>

          {/* PRODUCT MAIN DETAILS */}
          <View style={styles.productMainInfoCard}>
            <Text style={styles.mainProductName}>{product.productName}</Text>
            <View style={styles.priceRow}>
              <View style={styles.priceUnitWrapper}>
                <Text style={styles.mainPrice}>₱{basePrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
                <Text style={styles.perUnit}>/kg</Text>
              </View>
              <View style={[styles.stockBadge, isExpired ? styles.stockExpired : styles.stockAvailable]}>
                <View style={[styles.stockDot, isExpired ? styles.dotExpired : styles.dotAvailable]} />
                <Text style={[styles.stockText, isExpired ? styles.textExpired : styles.textAvailable]}>
                  {isExpired ? 'Spoiled' : 'In Stock'}
                </Text>
              </View>
            </View>
          </View>

          {/* VENDOR CARD */}
          <View style={styles.vendorCard}>
            <View style={styles.vendorTop}>
              {vendorProfileImage ? (
                <Image source={{ uri: vendorProfileImage }} style={styles.vendorImg} />
              ) : (
                <View style={styles.vendorInitial}><Text style={styles.initialText}>{product.uploadedBy?.businessName?.[0] || 'V'}</Text></View>
              )}
              <View style={styles.vendorInfo}>
                <Text style={styles.vBusinessName} numberOfLines={1}>{product.uploadedBy?.businessName || 'Unknown Vendor'}</Text>
                <Text style={styles.vFollowers}>{followersCount} followers</Text>
              </View>
              <TouchableOpacity onPress={handleFollow} style={[styles.followActionBtn, isFollowing && styles.followedBtn]}>
                <Text style={[styles.followActionText, isFollowing && styles.followedText]}>{isFollowing ? "Following" : "Follow"}</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.vendorActions}>
              <TouchableOpacity onPress={() => navigation.navigate('ViewShop', { vendorId: product.uploadedBy?.uid })} style={styles.vSecondaryBtn}>
                <MaterialCommunityIcons name="store-outline" size={18} color="#0F172A" />
                <Text style={styles.vSecondaryText}>View Store</Text>
              </TouchableOpacity>
<TouchableOpacity 
  onPress={() => navigation.navigate('ChatScreen', { 
    vendorId: product.uploadedBy?.uid,
    productPreview: {
      productId,
      name: product.productName,
      price: basePrice,
      image: productImageURI,
    }
  })} 
  style={styles.vSecondaryBtn}
>                <MaterialCommunityIcons name="message-text-outline" size={18} color="#0F172A" />
                <Text style={styles.vSecondaryText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DESCRIPTION */}
          {product.description ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Product Details</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          ) : null}

          {/* SERVICES */}
          {enabledServices.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Customize Service</Text>
              {enabledServices.map((s, i) => {
                const isSelected = selectedServices.includes(s.key);
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.serviceRow, isSelected && styles.serviceRowActive]}
                    onPress={() => setSelectedServices(prev => isSelected ? prev.filter(k => k !== s.key) : [...prev, s.key])}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={22} color={isSelected ? "#0F172A" : "#94A3B8"} />
                    <Text style={[styles.serviceLabel, isSelected && styles.serviceLabelActive]}>{s.label}</Text>
                    <Text style={styles.servicePrice}>+₱{s.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* QUANTITY CARD */}
          <View style={styles.quantityCard}>
            <Text style={styles.sectionTitle}>Quantity (kg)</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyCircle} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
                <Ionicons name="remove" size={18} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.qtyDisplay}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyCircle} onPress={() => setQuantity(q => q + 1)}>
                <Ionicons name="add" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* DOUBLE-BUTTON PREMIUM ACTION BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalAmount}>₱{totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.cartMainBtn, isExpired && styles.disabledBtn]} 
            onPress={handleAddToCart}
            disabled={isExpired}
            activeOpacity={0.8}
          >
            <Image source={BasketIcon} style={[styles.cartMainAssetIcon, isExpired && { tintColor: '#94A3B8' }]} resizeMode="contain" />
            <Text style={[styles.cartMainText, isExpired && { color: '#94A3B8' }]}>Add to Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.buyNowBtn, isExpired && styles.disabledBtn]} 
            onPress={handleBuyNow}
            disabled={isExpired}
            activeOpacity={0.8}
          >
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} productId={productId} productName={product.productName} product={product} />

      {successModalVisible && (
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            <Text style={styles.modalTitle}>Added to Basket</Text>
            <Text style={styles.modalSub}>Your items are waiting for you in your cart.</Text>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
        marginTop: 35

  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'System',
    textAlign: 'center',
    flex: 1,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAssetIcon: {
    width: 18,
    height: 18,
  },
  imageWrapper: {
    width: '100%',
    height: width * 0.85,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  mainProductImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backdropFilter: 'blur(4px)',
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  qualityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  qualityStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  qualityStatusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  qualityInfoWrapper: {
    flex: 1,
  },
  qualityBannerHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  qualityCountdownText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  productMainInfoCard: {
    marginBottom: 20,
  },
  mainProductName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceUnitWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  mainPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  perUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748B',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  stockAvailable: {
    backgroundColor: '#DCFCE7',
  },
  stockExpired: {
    backgroundColor: '#FEE2E2',
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotAvailable: {
    backgroundColor: '#22C55E',
  },
  dotExpired: {
    backgroundColor: '#EF4444',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textAvailable: {
    color: '#15803D',
  },
  textExpired: {
    color: '#B91C1C',
  },
  vendorCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  vendorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  vendorImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  vendorInitial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  vendorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vBusinessName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  vFollowers: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  followActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0F172A',
  },
  followedBtn: {
    backgroundColor: '#F1F5F9',
  },
  followActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followedText: {
    color: '#475569',
  },
  vendorActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 12,
  },
  vSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  vSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  serviceRowActive: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  serviceLabel: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    marginLeft: 10,
  },
  serviceLabelActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  quantityCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  qtyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyDisplay: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 20,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cartMainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  cartMainAssetIcon: {
    width: 16,
    height: 16,
  },
  cartMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  buyNowBtn: {
    flex: 1.3,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buyNowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledBtn: {
    backgroundColor: '#F1F5F9',
    shadowOpacity: 0,
    elevation: 0,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: width * 0.8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});