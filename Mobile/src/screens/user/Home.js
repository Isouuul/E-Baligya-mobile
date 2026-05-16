// src/screens/Users/HomeScreen.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  RefreshControl,
  Animated,
  SafeAreaView,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import Swiper from "react-native-swiper";
import * as Location from "expo-location";
import { auth, db } from "../../firebase";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import BuyNowModal from "./BuyNow";

import BasketIcon from '../../../assets/basket.png';
import MessageIcon from '../../../assets/message.png';

const { width } = Dimensions.get("window");
const ITEMS_PER_PAGE = 4;

export default function Home({ navigation }) {
  const [firstName, setFirstName] = useState("User");
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState("Locating...");
  const [products, setProducts] = useState([]);
  const [trendFish, setTrendFish] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [trendPage, setTrendPage] = useState(1);
  const [buyNowModalVisible, setBuyNowModalVisible] = useState(false);
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  const categories = [
    { name: "All", icon: require("../../../assets/all.png") },
    { name: "Fish", icon: require("../../../assets/Fish.png") },
    { name: "Mollusk", icon: require("../../../assets/mollusk.png") },
    { name: "Crustacean", icon: require("../../../assets/Crustacean.png") },
    { name: "Trend", icon: require("../../../assets/Trend.png") },
  ];

  const promos = [
    { id: 1, text: "Premium Catch of the Day", sub: "Fresh from the deep sea", image: require("../../../assets/slid-1.jpg") },
    { id: 2, text: "Sustainable Seafood", sub: "Directly to your doorstep", image: require("../../../assets/slid-2.jpg") },
    { id: 3, text: "Gourmet Selections", sub: "Chef-approved quality", image: require("../../../assets/slid-3.jpg") },
  ];

  const shuffleArray = (array) => {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Real-time Cart Badge Logic
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const q = collection(db, 'Carts', uid, 'items');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCartCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchFirstName = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const q = query(collection(db, "Users"), where("uid", "==", uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setFirstName(userData.firstName || "User");
        }
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    fetchFirstName();
  }, []);

  useEffect(() => {
    let sub;
    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setAddress("Location Disabled"); return; }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        async (loc) => {
          const [geo] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          setAddress(geo ? `${geo.city || geo.subregion || geo.district}` : "Unknown Location");
        }
      );
    };
    startTracking();
    return () => sub?.remove();
  }, []);

  const fetchAllData = async () => {
    try {
      const qProducts = query(collection(db, "Products"));
      const snapshotProducts = await getDocs(qProducts);
      const listProducts = snapshotProducts.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(shuffleArray(listProducts));
      const listTrend = listProducts.filter((i) => i.category === "Trend");
      setTrendFish(shuffleArray(listTrend));
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchAllData(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchAllData(); };

  const handleBuyNow = (product) => {
    setBuyNowProduct(product);
    setBuyNowModalVisible(true);
  };

  const AnimatedProductCard = ({ item, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
    }, []);

    return (
      <Animated.View style={[styles.productCard, { opacity: fadeAnim }]}>
        <TouchableOpacity 
           activeOpacity={0.9} 
           onPress={() => navigation.navigate('ViewProduct', { productId: item.id })}
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
            {item.category && (
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{item.category.toUpperCase()}</Text>
              </View>
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
          onPress={() => handleBuyNow(item)}
        >
          <Text style={styles.buyBtnText}>Buy Now</Text>
          <Feather name="arrow-right" size={13} color="#3B82F6" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const getPaginatedData = (data, page) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  };

  const renderSection = (data, type, title) => {
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const page = type === "trending" ? trendPage : productPage;
    const paginatedData = getPaginatedData(data, page);

    return (
      <View style={styles.cardSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.navigate("Product", { selectedCategory: type === "trending" ? "Trend" : null })}
            style={styles.seeAllButton}
          >
            <Text style={styles.seeAllText}>See All</Text>
            <Feather name="chevron-right" size={16} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {paginatedData.length > 0 ? (
          <FlatList
            data={paginatedData}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingLeft: 20, paddingRight: 5 }}
            renderItem={({ item, index }) => <AnimatedProductCard item={item} index={index} />}
          />
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No premium items found</Text>
          </View>
        )}

        {totalPages > 1 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity 
                style={[styles.pageDot, page === 1 && styles.pageDotActive]} 
                onPress={() => type === "trending" ? setTrendPage(1) : setProductPage(1)} 
            />
            <TouchableOpacity 
                style={[styles.pageDot, page === 2 && styles.pageDotActive]} 
                onPress={() => type === "trending" ? setTrendPage(2) : setProductPage(2)} 
            />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FCFCFC" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* PREMIUM HEADER */}
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.helloText}>Welcome back,</Text>
            <Text style={styles.nameText}>{firstName}</Text>
            <View style={styles.locRow}>
                <Feather name="map-pin" size={12} color="#2563EB" />
                <Text style={styles.locationText}>{address}</Text>
            </View>
          </View>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CartShop')} 
              style={styles.iconCircle}
              activeOpacity={0.8}
            >
              <Image source={BasketIcon} style={styles.customHeaderIcon} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.navigate("InboxScreenUser")} 
              style={[styles.iconCircle, { marginLeft: 12 }]}
              activeOpacity={0.8}
            >
              <Image source={MessageIcon} style={styles.customHeaderIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor="#0F172A"
            colors={["#0F172A"]}
          />
        }
      >
        <View style={{ height: 15 }} />

        {/* FILTERS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {categories.map((category) => (
            <TouchableOpacity 
              key={category.name} 
              activeOpacity={0.8}
              style={styles.filterItem}
              onPress={() => navigation.navigate("Product", { selectedCategory: category.name })}
            >
              <View style={styles.filterIconWrapper}>
                <Image source={category.icon} style={styles.filterIcon} />
              </View>
              <Text style={styles.filterText}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SLIDER */}
        <View style={styles.sliderContainer}>
          <Swiper 
            autoplay 
            height={180} 
            dotStyle={styles.swiperDot}
            activeDotStyle={styles.swiperDotActive}
          >
            {promos.map((p) => (
              <View key={p.id} style={styles.slide}>
                <Image source={p.image} style={styles.slideImg} />
                <View style={styles.promoOverlay}>
                  <Text style={styles.promoTitle}>{p.text}</Text>
                  <Text style={styles.promoSub}>{p.sub}</Text>
                </View>
              </View>
            ))}
          </Swiper>
        </View>

        {renderSection(products, "product", "Fresh Market")}
        <View style={{ height: 15 }} />
        {renderSection(trendFish, "trending", "Seasonal Favorites")}
        <View style={{ height: 40 }} />
      </ScrollView>

      <BuyNowModal
        visible={buyNowModalVisible}
        onClose={() => setBuyNowModalVisible(false)}
        product={buyNowProduct}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: '#FCFCFC', marginTop: 30},
  headerSafe: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginTop: 35 },
  topHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingBottom: 16, 
    paddingTop: 10
  },
  helloText: { fontSize: 12, color: "#64748B", fontWeight: "500", textTransform: 'uppercase', letterSpacing: 0.8 },
  nameText: { fontSize: 24, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5, marginTop: 1 },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { marginLeft: 4, fontSize: 12, color: "#2563EB", fontWeight: '700' },
  headerIcons: { flexDirection: "row", alignItems: 'center' },
  iconCircle: { 
    width: 46, 
    height: 46, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  customHeaderIcon: { width: 22, height: 22, resizeMode: 'contain' },
  badge: { 
    minWidth: 18, 
    height: 18, 
    borderRadius: 9, 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#EF4444', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 4, 
    borderWidth: 1.5, 
    borderColor: '#FFF' 
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  filterContainer: { paddingHorizontal: 16, marginBottom: 24 },
  filterItem: { alignItems: 'center', marginRight: 20, paddingBottom: 2 },
  filterIconWrapper: { width: 45, height: 45, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 6, marginLeft: 5 },
  filterIcon: { width: 25, height: 25, resizeMode: 'contain' },
  filterText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  sliderContainer: { 
    marginHorizontal: 20, 
    height: 180, 
    borderRadius: 20, 
    overflow: "hidden", 
    marginBottom: 28, 
    backgroundColor: '#0F172A',
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, 
    shadowRadius: 16,
    elevation: 5 
  },
  slide: { flex: 1 },
  slideImg: { width: "100%", height: "100%", resizeMode: 'cover', opacity: 0.85 },
  promoOverlay: { 
    position: "absolute", 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 20, 
    backgroundColor: 'rgba(15, 23, 42, 0.65)' 
  },
  promoTitle: { fontSize: 20, fontWeight: "900", color: "#FFF", letterSpacing: -0.3 },
  promoSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "500" },
  swiperDot: { backgroundColor: 'rgba(255,255,255,0.3)', width: 6, height: 6, borderRadius: 3, marginHorizontal: 3 },
  swiperDotActive: { backgroundColor: '#FFF', width: 18, height: 6, borderRadius: 3, marginHorizontal: 3 },

  cardSection: { marginBottom: 12 },
  sectionHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginBottom: 14 
  },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  seeAllButton: { flexDirection: 'row', alignItems: 'center' },
  seeAllText: { color: "#2563EB", fontWeight: "800", fontSize: 13, marginRight: 2 },

  productCard: { 
    backgroundColor: "#FFF", 
    borderRadius: 20, 
    width: 170, 
    marginRight: 14, 
    marginBottom: 12, 
    shadowColor: '#0F172A', 
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04, 
    shadowRadius: 10, 
    elevation: 2, 
    borderColor: '#F1F5F9', 
    borderWidth: 1,
    overflow: 'hidden'
  },
  cardInteractiveArea: { flex: 1 },
  imageContainer: { width: '100%', height: 130, position: 'relative' },
  productImage: { width: "100%", height: "100%", borderTopLeftRadius: 19, borderTopRightRadius: 19 },
  noImageBox: { 
    width: "100%", 
    height: "100%", 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#F8FAFC", 
    borderTopLeftRadius: 19, 
    borderTopRightRadius: 19 
  },
  cardBadge: { 
    position: 'absolute', 
    top: 8, 
    left: 8, 
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 0.5,    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  cardBadgeText: { fontSize: 8, fontWeight: '900', color: '#3b82f6', letterSpacing: 0.5 },
  cardContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  productName: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  cardBottomMeta: { marginTop: 4, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  currency: { fontSize: 11, fontWeight: '800', color: '#2563EB', marginRight: 1 },
  productPrice: { color: "#2563EB", fontSize: 16, fontWeight: "900" },
  stockText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  buyBtn: { 
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 0.5,
    marginHorizontal: 10, 
    marginBottom: 10, 
    paddingVertical: 9, 
    borderRadius: 12, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center'
  },
  buyBtnText: { color: '#3b82f6', fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },

  paginationRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  pageDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E2E8F0' },
  pageDotActive: { width: 15, backgroundColor: '#0F172A' },

  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 }
});