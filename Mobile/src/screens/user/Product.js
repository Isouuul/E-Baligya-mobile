import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import NoOrderImg from '../../../assets/no-order.png';
import BasketIcon from '../../../assets/basket.png';
import MessageIcon from '../../../assets/message.png';
import * as FileSystem from "expo-file-system";

const { width } = Dimensions.get('window');
const ITEMS_PER_PAGE = 16;

// MARKET OPTIONS DATA
const marketOptions = [
  { name: 'All Markets', latitude: 0, longitude: 0 }, 
  { name: 'Bacolod Central Market', latitude: 10.66761, longitude: 122.94719 },
  { name: 'Libertad Public Market', latitude: 10.66012, longitude: 122.94971 },
  { name: 'Bacolod North (Burgos) Market', latitude: 10.66891, longitude: 122.95498 },
  { name: 'Sum-ag Public Market', latitude: 10.60353, longitude: 122.92110 },
  { name: 'Granada Public Market', latitude: 10.66576, longitude: 123.03425 },
  { name: 'Mansilingan Public Market', latitude: 10.63160, longitude: 122.97520 },
  { name: 'Villamonte Public Market', latitude: 10.66879, longitude: 122.96470 },
  { name: 'North Capitol Road (Pala-Pala Market)', latitude: 10.66369, longitude: 122.93918 },
];

/* ---------------------------
   IMAGE BASE64 HANDLER
----------------------------*/
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
        console.error(err);
      }
    };
    saveToFile();
  }, [base64]);

  if (!localUri) {
    return <View style={[style, { backgroundColor: '#f1f5f9' }]} />;
  }
  return <Image source={{ uri: localUri }} style={style} />;
};

/* ---------------------------
   PRODUCT CARD
----------------------------*/
function AnimatedProductCard({ item, index, navigation, status }) {
  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        delay: index * 35,
        useNativeDriver: true
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        delay: index * 35,
        useNativeDriver: true
      }),
    ]).start();
  }, []);

  const hasStock = item.quantityKg > 0;
  
  // Adjusted to fallback gracefully if nested property isn't built yet
  const displayMarketName = item.uploadedBy?.marketName || item.marketName || "Unknown Market";

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.95}
        onPress={() => navigation.navigate('ViewProduct', { productId: item.id })}
      >
        <View style={styles.imageWrapper}>
          {item.imageBase64 ? (
            <Base64Image base64={item.imageBase64} productId={item.id} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.noImage]}>
              <Ionicons name="image-outline" size={32} color="#94a3b8" />
            </View>
          )}

          <View style={styles.badgeOverlayContainer}>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            )}

            {status === 'warning' && (
              <View style={styles.warningBadge}>
                <Ionicons name="time-outline" size={11} color="#d97706" style={{ marginRight: 2 }} />
                <Text style={styles.warningText}>Almost Fresh</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.productName}
          </Text>

          {/* MARKET TAG STYLED PROPERLY */}
          <View style={styles.marketTagContainer}>
            <Ionicons name="location-outline" size={12} color="#64748b" style={{ marginRight: 2 }} />
            <Text style={styles.marketTagText} numberOfLines={1}>
              {displayMarketName}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.currency}>₱</Text>
              <Text style={styles.productPrice}>{item.basePrice}</Text>
              <Text style={styles.unit}>/kg</Text>
            </View>

            <View style={[styles.stockStatus, hasStock ? styles.stockIn : styles.stockOut]}>
              <View style={[styles.statusDot, { backgroundColor: hasStock ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.stockText, { color: hasStock ? '#047857' : '#b91c1c' }]}>
                {hasStock ? `${item.quantityKg} kg` : 'Sold Out'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ---------------------------
   STATUS LOGIC
----------------------------*/
const getProductStatus = (product) => {
  if (!product.warningTime || !product.expiryTime) return 'fresh';
  const now = new Date();
  const warning = product.warningTime.toDate();
  const expiry = product.expiryTime.toDate();
  if (now >= expiry) return 'expired';
  if (now >= warning) return 'warning';
  return 'fresh';
};

/* ---------------------------
   MAIN SCREEN
----------------------------*/
export default function Product() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialCategory = route.params?.selectedCategory || "All";

  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [selectedMarket, setSelectedMarket] = useState('All Markets'); 
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [cartItems, setCartItems] = useState([]);

  const categories = [
    { name: "All", icon: require("../../../assets/all.png") },
    { name: "Fish", icon: require("../../../assets/Fish.png") },
    { name: "Mollusk", icon: require("../../../assets/mollusk.png") },
    { name: "Crustacean", icon: require("../../../assets/Crustacean.png") },
    { name: "Trend", icon: require("../../../assets/Trend.png") },
  ];

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, 'Products'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      let list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        };
      });

      setProducts(list);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchCartItems = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const snapshot = await getDocs(collection(db, 'Carts', uid, 'items'));
      setCartItems(snapshot.docs.map(doc => doc.data()));
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCartItems();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCartItems();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    await fetchCartItems();
    setRefreshing(false);
  };

  /* ---------------------------
      FILTER LOGIC UPDATE
  ----------------------------*/
  useEffect(() => {
    let filtered = products.filter(p => {
      const status = getProductStatus(p);

      // Remove expired products
      if (status === 'expired') return false;

      const matchesCat = category === "All" || p.category === category;
      const matchesSearch = p.productName?.toLowerCase().includes(searchText.toLowerCase());
      
      // Fixed market matching condition to point securely to uploadedBy.marketName nested schema
      const itemMarketName = p.uploadedBy?.marketName || p.marketName || '';
      const matchesMarket =
        selectedMarket === "All Markets" ||
        itemMarketName.toLowerCase() === selectedMarket.toLowerCase();

      return matchesCat && matchesSearch && matchesMarket;
    });

    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [category, searchText, selectedMarket, products]);

  const paginatedProducts = filteredProducts.slice(0, currentPage * ITEMS_PER_PAGE);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <SafeAreaView style={styles.headerSafe}>
        {/* TOP BAR: SEARCH & UTILITY ICON ACTIONS */}
        <View style={styles.headerTop}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search fresh seafood..."
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('CartShop')} 
              style={styles.iconCircle}
              activeOpacity={0.7}
            >
              <Image source={BasketIcon} style={styles.customHeaderIcon} />
              {cartItems.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cartItems.length > 99 ? '99+' : cartItems.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => navigation.navigate("InboxScreenUser")} 
              style={[styles.iconCircle, { marginLeft: 10 }]}
              activeOpacity={0.7}
            >
              <Image source={MessageIcon} style={styles.customHeaderIcon} />
            </TouchableOpacity>
          </View>
        </View>



        {/* ELEGANT SCROLLABLE CATEGORIES LIST */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.catList}
        >
          {categories.map((cat, i) => {
            const isActive = category === cat.name;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setCategory(cat.name)}
                activeOpacity={0.8}
                style={[styles.catItem, isActive && styles.catItemActive]}
              >
                <View style={[styles.catIconWrapper, isActive && styles.catIconWrapperActive]}>
                  <Image source={cat.icon} style={styles.catIcon} />
                </View>
                <Text style={[styles.catText, isActive && styles.catTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

                {/* HORIZONTAL MARKET FILTER SCROLL */}
        <View style={styles.marketFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.marketScrollContent}
          >
            {marketOptions.map((market, index) => {
              const isMarketActive = selectedMarket === market.name;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedMarket(market.name)}
                  style={[
                    styles.marketChip,
                    isMarketActive && styles.marketChipActive
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={market.name === 'All Markets' ? "business-outline" : "location-outline"} 
                    size={14} 
                    color={isMarketActive ? '#ffffff' : '#64748b'} 
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.marketChipText, isMarketActive && styles.marketChipTextActive]}>
                    {market.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* PRODUCTS DISPLAY GRID */}
      <FlatList
        data={paginatedProducts}
        renderItem={({ item, index }) => (
          <AnimatedProductCard
            item={item}
            index={index}
            navigation={navigation}
            status={getProductStatus(item)}
          />
        )}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Image source={NoOrderImg} style={styles.emptyImg} />
            <Text style={styles.emptyTitle}>No Catch Found</Text>
            <Text style={styles.emptySub}>We couldn't find any listings matching your search.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerSafe: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    marginTop: 35
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 0,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  customHeaderIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  marketFilterContainer: {
    paddingVertical: 6,
  },
  marketScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  marketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  marketChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  marketChipText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  marketChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  marketTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  marketTagText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
  },
  catList: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    alignItems: 'center',
  },
  catItem: {
    alignItems: 'center',
    marginRight: 20,
    paddingBottom: 2,
  },
  catIconWrapper: {
    width: 45,
    height: 45,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    marginBottom: 6,
    marginLeft: 5,
  },
  catIconWrapperActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  catIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
  },
  catText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  catTextActive: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  listContent: {
    padding: 10,
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    backgroundColor: '#ffffff',
    width: (width - 28) / 2,
    marginVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  imageWrapper: {
    width: '100%',
    height: 135,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeOverlayContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  warningText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
  },
  productDetails: {
    padding: 12,
  },
  productName: {
    fontWeight: '700',
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontWeight: '700',
    fontSize: 13,
    color: '#0f172a',
    marginRight: 1,
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '850',
    color: '#0f172a',
  },
  unit: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  stockStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockIn: {
    backgroundColor: '#ecfdf5',
  },
  stockOut: {
    backgroundColor: '#fef2f2',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyImg: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    opacity: 0.8,
    marginBottom: 16,
  }, 
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});