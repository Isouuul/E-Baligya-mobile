// src/screens/Users/ViewProduct.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Dimensions,
  FlatList
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons'; // Added Feather for icon parity
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
  deleteDoc,
  updateDoc, increment, onSnapshot, limit
} from "firebase/firestore";
import { useRoute, useNavigation } from '@react-navigation/native';
import ReportModal from '../user/ReportModal';
import WarningIcon from '../../../assets/Warning1.png';
import BasketIcon from '../../../assets/basket.png';
import BuyNowModal from './BuyNowModal'; // Integrated your home screen buy now modal framework

const { width } = Dimensions.get('window');

export default function ViewProduct() {
  const route = useRoute();
  const navigation = useNavigation();
  const { productId } = route.params;
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
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
  const [cartCount, setCartCount] = useState(0);

  // Home Screen Modal integration states for suggestions
  const [buyNowModalVisible, setBuyNowModalVisible] = useState(false);
  const [buyNowProduct, setBuyNowProduct] = useState(null);

  // States for the suggestions engine
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const maxQuantity = product?.quantityKg ?? 0;
  const basePrice = product?.basePrice || 0;
  const productImageURI = product?.imageBase64 ? (product.imageBase64.startsWith('data:image') ? product.imageBase64 : `data:image/jpeg;base64,${product.imageBase64}`) : null;

  const [freshnessStatusText, setFreshnessStatusText] = useState('Checking freshness...');
  const [freshnessStatusColor, setFreshnessStatusColor] = useState('#64748B');
  const [isExpired, setIsExpired] = useState(false);

  // Helper function cloned from HomeScreen to evaluate product decay timeline on suggestions
  const getProductStatus = (prod) => {
    if (prod.status && prod.status.toLowerCase() === 'restricted') return 'restricted';
    if (!prod.warningTime || !prod.expiryTime) return 'fresh';
    try {
      const now = new Date();
      const warning = typeof prod.warningTime.toDate === 'function' ? prod.warningTime.toDate() : new Date(prod.warningTime);
      const expiry = typeof prod.expiryTime.toDate === 'function' ? prod.expiryTime.toDate() : new Date(prod.expiryTime);
      if (now >= expiry) return 'expired';
      if (now >= warning) return 'warning'; 
    } catch (e) {
      console.error("Error parsing timestamps: ", e);
    }
    return 'fresh';
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const cartRef = collection(db, 'Carts', user.uid, 'items');
    const unsubscribe = onSnapshot(cartRef, (snapshot) => {
      let total = 0;
      snapshot.forEach(doc => {
        total += doc.data().quantity || 1;
      });
      setCartCount(total);
    });

    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'Products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProduct(data);
          if ((data?.quantityKg ?? 0) === 0) {
            setQuantity(0);
          }
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
    setSelectedServices([]);
    setQuantity(1);
  }, [productId]);

  // Query engine matching HomeScreen data safety standards
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!product?.category) return;
      try {
        setLoadingSuggestions(true);
        const productsRef = collection(db, 'Products');
        const q = query(productsRef, where('category', '==', product.category), limit(8));
        const snap = await getDocs(q);
        const items = [];
        snap.forEach((doc) => {
          if (doc.id !== productId) {
            const data = doc.data();
            // Apply compliance criteria filters directly from HomeScreen
            const lifeStatus = getProductStatus({ id: doc.id, ...data });
            if (lifeStatus !== 'restricted' && lifeStatus !== 'expired') {
              items.push({ id: doc.id, ...data });
            }
          }
        });
        setSuggestions(items);
      } catch (e) {
        console.log("Suggestions load error:", e);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [product, productId]);

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

  const servicePrice = useMemo(() => {
    if (!Array.isArray(selectedServices) || !product?.premiumServices) return 0;
    return selectedServices.reduce((total, serviceId) => {
      const targetService = product.premiumServices.find(s => s.id === serviceId);
      return total + (targetService?.price || 0);
    }, 0);
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
    const formattedServices = Array.isArray(selectedServices) && product?.premiumServices
      ? selectedServices
          .map((serviceId) => {
            const service = product.premiumServices.find(s => s.id === serviceId);
            if (!service) return null;
            return {
              key: service.id,
              label: service.label,
              price: service.price,
            };
          })
          .filter(Boolean)
      : [];

    return {
      id: productId,
      userId: auth.currentUser.uid,
      productId,
      uploadedBy: product.uploadedBy,
      productName: product.productName,
      basePrice: basePrice,
      productImage: productImageURI,
      category: product.category || 'Uncategorized',
      selectedServices: formattedServices,
      quantity,
      totalPrice,
      createdAt: serverTimestamp(),
    };
  };

  const handleAddToCart = async () => {
    if (addingToCart) return;
    setAddingToCart(true);

    try {
      if (isExpired) {
        return Alert.alert('Quality Restriction', 'Cannot buy this listing. The seafood is no longer fresh.');
      }

      if (quantity > maxQuantity || maxQuantity === 0) {
        return Alert.alert("Not enough stock", `Only ${maxQuantity} kg available.`);
      }

      const cartRef = collection(db, 'Carts', auth.currentUser.uid, 'items');
      const q = query(cartRef, where('productId', '==', productId));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const existingDoc = snap.docs[0];
        await updateDoc(existingDoc.ref, {
          quantity: increment(quantity),
          totalPrice: increment(totalPrice),
        });
      } else {
        await addDoc(cartRef, getCartPayload());
      }

      showSuccessModal();

    } catch (err) {
      Alert.alert('Error', 'Failed to add to cart');
      console.log(err);
    } fillAll: {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (buyingNow) return;
    setBuyingNow(true);

    try {
      if (isExpired) {
        return Alert.alert('Quality Restriction', 'Cannot buy this listing. The seafood is no longer fresh.');
      }

      if (quantity > maxQuantity || maxQuantity === 0) {
        return Alert.alert("Not enough stock", `Only ${maxQuantity} kg available.`);
      }

      const checkoutPayload = getCartPayload();
      navigation.navigate('BuyNowCheckedOut', { product: checkoutPayload });

    } catch (err) {
      Alert.alert('Error', 'Failed to initialize direct purchase');
    } finally {
      setBuyingNow(false);
    }
  };

  const showSuccessModal = () => {
    setSuccessModalVisible(true);
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(scaleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSuccessModalVisible(false));
    }, 2000);
  };

  const handleSuggestionBuyNow = (prod) => {
    setBuyNowProduct(prod);
    setBuyNowModalVisible(true);
  };

  // IDENTICAL RENDER CARD: Built with exact architecture matching AnimatedProductCard from HomeScreen
  const AnimatedSuggestionCard = ({ item, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 400, 
        delay: index * 80, 
        useNativeDriver: true 
      }).start();
    }, [index]);

    const timelineStatus = getProductStatus(item);

    return (
      <Animated.View style={[styles.productCard, { opacity: fadeAnim }]}>
        <TouchableOpacity 
           activeOpacity={0.9} 
           onPress={() => navigation.push('ViewProduct', { productId: item.id })}
           style={styles.cardInteractiveArea}
        >
          <View style={styles.imageContainer}>
            {item.imageBase64 ? (
              <Image source={{ uri: item.imageBase64 }} style={styles.productImage} />
            ) : (
              <View style={styles.noImageBox}>
                <Feather name="image" size={24} color="#94A3B8" />
              </View>
            )}
            
            {timelineStatus === 'warning' ? (
              <View style={[styles.cardBadge, styles.warningBadge]}>
                <Text style={[styles.cardBadgeText, styles.warningBadgeText]}>NEAR EXPIRY</Text>
              </View>
            ) : (
              item.category && (
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeText}>{item.category.toUpperCase()}</Text>
                </View>
              )
            )}
          </View>
          
          <View style={styles.cardContent}>
            <Text style={styles.productName} numberOfLines={1}>{item.productName || item.name}</Text>
            
            <View style={styles.cardBottomMeta}>
              <View style={styles.priceRow}>
                <Text style={styles.currency}>₱</Text>
                <Text style={styles.productPrice}>{Number(item.basePrice || item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              {typeof item.quantityKg !== 'undefined' && (
                <Text style={styles.stockText}>{item.quantityKg} kg left</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.buyBtn} 
          activeOpacity={0.85}
          onPress={() => handleSuggestionBuyNow(item)}
        >
          <Text style={styles.buyBtnText}>Buy Now</Text>
          <Feather name="arrow-right" size={13} color="#3B82F6" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;
  if (!product) return null;

  const finalPremiumServices = Array.isArray(product?.premiumServices) ? product.premiumServices : [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER SECTION */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerCircleBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Product Details</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerCircleBtn} onPress={() => setReportVisible(true)}>
            <Image source={WarningIcon} style={styles.headerAssetIcon} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerCircleBtn, { marginLeft: 12 }]}
            onPress={() => navigation.navigate('CartShop')}
          >
            <Image source={BasketIcon} style={styles.headerAssetIcon} resizeMode="contain" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* IMAGE FRAME */}
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
          {/* QUALITY EVALUATION EVAL BANNER */}
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

          {/* MAIN BLOCK METADATA */}
          <View style={styles.productMainInfoCard}>
            <Text style={styles.mainProductName}>{product.productName}</Text>
            <View style={styles.mainPriceRow}>
              <View style={styles.priceUnitWrapper}>
                <Text style={styles.mainPrice}>₱{basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                <Text style={styles.perUnit}>/kg</Text>
              </View>
              <View style={[styles.stockStatusBadge, isExpired ? styles.stockExpired : styles.stockAvailable]}>
                <View style={[styles.stockDot, isExpired ? styles.dotExpired : styles.dotAvailable]} />
                <Text style={[styles.stockBadgeText, isExpired ? styles.textExpired : styles.textAvailable]}>
                  {isExpired ? 'Spoiled' : `${product?.quantityKg ?? 0} kg available`}
                </Text>
              </View>
            </View>
          </View>

          {/* MERCHANT DATA VENDOR CARD */}
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
              >
                <MaterialCommunityIcons name="message-text-outline" size={18} color="#0F172A" />
                <Text style={styles.vSecondaryText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PRODUCT DESCRIPTION */}
          {product.description ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Product Details</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          ) : null}

          {/* PREMIUM OPTIONAL SERVICES */}
          {finalPremiumServices.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Customize Service</Text>
              {finalPremiumServices.map((s, i) => {
                const isSelected = selectedServices.includes(s.id);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.serviceRow, isSelected && styles.serviceRowActive]}
                    onPress={() =>
                      setSelectedServices(prev => {
                        if (prev.includes(s.id)) return prev.filter(id => id !== s.id);
                        return [...prev, s.id];
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={22} color="#3b82f6" />
                    <Text style={[styles.serviceLabel, isSelected && styles.serviceLabelActive]}>{s.label}</Text>
                    <Text style={styles.servicePrice}>+₱{s.price}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* QUANTITY CHANGER CARD */}
          <View style={styles.quantityCard}>
            <Text style={styles.sectionTitle}>Quantity (kg)</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyCircle} onPress={() => setQuantity(q => Math.max(maxQuantity > 0 ? 1 : 0, q - 1))}>
                <Ionicons name="remove" size={18} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.qtyDisplay}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyCircle} onPress={() => setQuantity(q => Math.min(maxQuantity, q + 1))}>
                <Ionicons name="add" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* SUGGESTION HORIZONTAL SLIDER CAROUSEL SECTION */}
          {suggestions.length > 0 && (
            <View style={styles.cardSection}>
              <View style={styles.suggestionHeaderRow}>
                <Text style={styles.suggestionSectionTitle}>You May Also Like</Text>
              </View>
              {loadingSuggestions ? (
                <ActivityIndicator size="small" color="#0F172A" style={{ marginVertical: 20 }} />
              ) : (
                <FlatList
                  data={suggestions}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingLeft: 4, paddingRight: 5 }}
                  renderItem={({ item, index }) => <AnimatedSuggestionCard item={item} index={index} />}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CORE CONTROL ACTION BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Grand Total</Text>
          <Text style={styles.totalAmount}>₱{totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.cartMainBtn, isExpired && styles.disabledBtn]}
            onPress={handleAddToCart}
            disabled={isExpired || addingToCart}
          >
            {addingToCart ? <ActivityIndicator color="#0F172A" /> : (
              <>
                <Image source={BasketIcon} style={styles.cartMainAssetIcon} />
                <Text style={styles.cartMainText}>Add to Cart</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.buyNowBtn, isExpired && styles.disabledBtn]}
            onPress={handleBuyNow}
            disabled={isExpired || buyingNow}
          >
            {buyingNow ? <ActivityIndicator color="#3b82f6" /> : <Text style={styles.buyNowText}>Buy Now</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ReportModal visible={reportVisible} onClose={() => setReportVisible(false)} productId={productId} productName={product.productName} product={product} />

      <BuyNowModal visible={buyNowModalVisible} onClose={() => setBuyNowModalVisible(false)} product={buyNowProduct} />

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
  // Base Screen Styles
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  customHeader: { marginTop: 35, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1, marginLeft: 12 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerAssetIcon: { width: 20, height: 20 },
  cartBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  imageWrapper: { width: width, height: 260, backgroundColor: '#F1F5F9' },
  mainProductImage: { width: '100%', height: '100%' },
  noImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  categoryBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(15, 23, 42, 0.75)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  categoryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  contentSection: { padding: 16 },
  qualityBanner: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16, alignItems: 'center' },
  qualityStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  qualityStatusBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  qualityInfoWrapper: { marginLeft: 12, flex: 1 },
  qualityBannerHeader: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  qualityCountdownText: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  productMainInfoCard: { marginBottom: 16 },
  mainProductName: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  mainPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceUnitWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  mainPrice: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  perUnit: { fontSize: 14, color: '#64748B', marginLeft: 2, fontWeight: '500' },
  stockStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  stockAvailable: { backgroundColor: '#F0FDF4' },
  stockExpired: { backgroundColor: '#FEF2F2' },
  stockDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  dotAvailable: { backgroundColor: '#22C55E' },
  dotExpired: { backgroundColor: '#EF4444' },
  stockBadgeText: { fontSize: 12, fontWeight: '600' },
  textAvailable: { color: '#15803D' },
  textExpired: { color: '#B91C1C' },
  vendorCard: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  vendorTop: { flexDirection: 'row', alignItems: 'center' },
  vendorImg: { width: 44, height: 44, borderRadius: 22 },
  vendorInitial: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E3A8A', justifyContent: 'center', alignItems: 'center' },
  initialText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  vendorInfo: { flex: 1, marginLeft: 12 },
  vBusinessName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  vFollowers: { fontSize: 12, color: '#64748B', marginTop: 1 },
  followActionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 1 },
  followedBtn: { backgroundColor: '#eff6ff' },
  followActionText: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  followedText: { color: '#3b82f6' },
  vendorActions: { flexDirection: 'row', marginTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
  vSecondaryBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 36 },
  vSecondaryText: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginLeft: 6 },
  sectionCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  descriptionText: { fontSize: 14, color: '#334155', lineHeight: 22 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  serviceRowActive: { backgroundColor: '#F0F7FF', borderRadius: 8, paddingHorizontal: 8, borderColor: '#3b82f6' },
  serviceLabel: { flex: 1, fontSize: 14, color: '#334155', marginLeft: 10 },
  serviceLabelActive: { fontWeight: '600', color: '#1E40AF' },
  servicePrice: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  quantityCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  qtyDisplay: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginHorizontal: 14 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalContainer: { flex: 1 },
  totalLabel: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  totalAmount: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  actionsContainer: { flexDirection: 'row', flex: 2, justifyContent: 'flex-end' },
  cartMainBtn: { flex: 1, height: 48, backgroundColor: '#F1F5F9', borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  cartMainAssetIcon: { width: 18, height: 18, marginRight: 6 },
  cartMainText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  buyNowBtn: { flex: 1, height: 48, backgroundColor: '#eff6ff', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buyNowText: { fontSize: 14, fontWeight: '700', color: '#3b82f6' },
  disabledBtn: { backgroundColor: '#94A3B8', opacity: 0.5 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, alignItems: 'center', width: '80%', maxWidth: 320 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 12, marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', textAlign: 'center' },

  // HOMESCREEN CAROUSEL DESIGN SYNC STYLES
  cardSection: { marginTop: 10, marginBottom: 10 },
  suggestionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  suggestionSectionTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginLeft: 4 },
  productCard: { width: 165, backgroundColor: "#FFFFFF", borderRadius: 16, marginRight: 14, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2, marginBottom: 8, marginTop: 4 },
  cardInteractiveArea: { flex: 1 },
  imageContainer: { width: "100%", height: 120, backgroundColor: "#F1F5F9", position: "relative" },
  productImage: { width: "100%", height: "100%", resizeMode: "cover" },
  noImageBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  cardBadge: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(15, 23, 42, 0.75)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  warningBadge: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5" },
  warningBadgeText: { color: "#EF4444" },
  cardContent: { padding: 12 },
  productName: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  cardBottomMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "center" },
  currency: { fontSize: 12, fontWeight: "700", color: "#0F172A", marginRight: 1 },
  productPrice: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  stockText: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingVertical: 10, backgroundColor: "#FAFAFA" },
  buyBtnText: { fontSize: 12, fontWeight: "700", color: "#3B82F6" }
});
