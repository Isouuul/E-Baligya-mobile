import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, Timestamp, setDoc, deleteDoc, where } from 'firebase/firestore';
import { useNavigation, useFocusEffect } from "@react-navigation/native";

// Asset Imports
import NoOrderImg from '../../../assets/no-order.png';
import BasketIcon from '../../../assets/basket.png';
import MessageIcon from '../../../assets/message.png';
import FishIcon from '../../../assets/Fish.png';
import MolluskIcon from '../../../assets/mollusk.png';
import CrustaceanIcon from '../../../assets/Crustacean.png';
import TrendIcon from '../../../assets/Trend.png';
import AllIcon from '../../../assets/all.png';

const { width } = Dimensions.get('window');

// --- Sub-Component: Animated Bidding Card ---
function AnimatedBiddingCard({ item, index, navigation }) {
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [isExpired, setIsExpired] = useState(false);
  
  // A listing is explicitly disabled if marked disabled, or if it is restricted by an admin strike
  const isDisabled = item.isDisabled || item.status === 'restricted';

useEffect(() => {
  let filtered = biddingProducts.filter(p => {
    // Hide restricted products
    if (p.status === 'restricted') return false;

    // Hide products with 0kg or less
    if ((p.remainingQuantity || 0) <= 0) return false;

    const matchesCat =
      category === "All" || p.category === category;

    const matchesSearch =
      p.productName
        ?.toLowerCase()
        .includes(searchText.toLowerCase());

    return matchesCat && matchesSearch;
  });

  setFilteredBidding(filtered);
}, [category, searchText, biddingProducts]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 450, delay: index * 50, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, delay: index * 50, useNativeDriver: true }),
    ]).start();

    // Use overallAuctionEndsAt or endTime for the overall auction countdown (HH:MM:SS format)
    const endTimestamp = item.overallAuctionEndsAt || item.endTime;
    if (!endTimestamp) return;

    const calculateTimer = () => {
      const now = new Date().getTime();
      const end = endTimestamp.seconds 
        ? new Date(endTimestamp.seconds * 1000).getTime() 
        : new Date(endTimestamp).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('ENDED');
        setIsExpired(true);
        return false;
      }

      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
      setIsExpired(false);
      return true;
    };

    calculateTimer();
    const timer = setInterval(calculateTimer, 1000);

    return () => clearInterval(timer);
  }, [item.overallAuctionEndsAt, item.endTime, index]);

  const formatPrice = (p) => `₱${Number(p || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <Animated.View style={{ transform: [{ translateX: slideAnim }], opacity: fadeAnim }}>
      <TouchableOpacity
        activeOpacity={isDisabled ? 0.5 : 0.9}
        style={[styles.cardContainer, isDisabled && styles.cardContainerDisabled]}
        onPress={() => !isDisabled && navigation.navigate('ViewBiddingProduct', { productId: item.id })}
        disabled={isDisabled}
      >
        <View style={[styles.imageWrapper, isDisabled && styles.imageWrapperDisabled]}>
          {item.imageBase64 ? (
            <Image source={{ uri: item.imageBase64 }} style={[styles.cardImage, isDisabled && styles.cardImageDisabled]} />
          ) : (
            <View style={[styles.cardImage, styles.noImagePlaceholder]}>
              <Ionicons name="image-outline" size={32} color="#cbd5e1" />
            </View>
          )}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category || 'General'}</Text>
          </View>
          
          {isDisabled ? (
            <View style={styles.disabledOverlay}>
              <Ionicons name="lock-closed-outline" size={32} color="#fff" />
              <Text style={styles.disabledText}>
                {item.status === 'restricted' ? 'Unavailable' : 'Bidding Closed'}
              </Text>
            </View>
          ) : (
            <View style={[styles.timerBadge, isExpired && styles.timerExpired]}>
              <Ionicons name="time-outline" size={12} color={isExpired ? "#ef4444" : "#f59e0b"} />
              <Text style={[styles.timerText, isExpired && { color: "#ef4444" }]}>{timeLeft}</Text>
            </View>
          )}
        </View>

        <View style={[styles.detailsWrapper, isDisabled && styles.detailsWrapperDisabled]}>
          <View style={styles.titleRow}>
            <Text style={[styles.productTitle, isDisabled && styles.productTitleDisabled]} numberOfLines={1}>{item.productName}</Text>
            <View style={[styles.stockBadge, isDisabled && styles.stockBadgeDisabled]}>
              <Text style={[styles.stockText, isDisabled && styles.stockTextDisabled]}>{item.remainingQuantity || 0}kg left</Text>
            </View>
          </View>

          <View style={styles.pricingSection}>
            <View>
              <Text style={styles.label}>Starting at</Text>
              <Text style={styles.mainPrice}>{formatPrice(item.basePrice || item.startingPrice)}<Text style={styles.unitText}>/kg</Text></Text>
            </View>
            {item.currentHighestBid && (
              <View style={styles.highestBidContainer}>
                <Text style={styles.labelHighest}>Current Highest</Text>
                <Text style={styles.highestPriceText}>{formatPrice(item.currentHighestBid)}</Text>
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            <View style={styles.vendorInfo}>
              {item.uploadedBy?.vendorProfileImage ? (
                <Image source={{ uri: item.uploadedBy.vendorProfileImage }} style={styles.vendorAvatar} />
              ) : (
                <Ionicons name="storefront-outline" size={14} color="#64748b" style={{ marginRight: 4 }} />
              )}
              <Text style={styles.vendorName} numberOfLines={1}>
                {item.uploadedBy?.businessName || 'Unknown Vendor'}
              </Text>
            </View>
            <View style={[styles.bidButton, isDisabled && styles.bidButtonDisabled]}>
              <Text style={[styles.bidButtonText, isDisabled && styles.bidButtonTextDisabled]}>
                {item.status === 'restricted' ? 'Banned' : isDisabled ? 'Closed' : 'View Deal'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- Main Screen Component ---
export default function BiddingProductScreen() {
  const navigation = useNavigation();
  const [biddingProducts, setBiddingProducts] = useState([]);
  const [filteredBidding, setFilteredBidding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('All');
  const [cartItems, setCartItems] = useState([]);

  const categories = [
    { name: 'All', icon: AllIcon },
    { name: 'Fish', icon: FishIcon },
    { name: 'Mollusk', icon: MolluskIcon },
    { name: 'Crustacean', icon: CrustaceanIcon },
    { name: 'Trend', icon: TrendIcon },
  ];

  const fetchCartItems = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const snapshot = await getDocs(collection(db, 'Carts', uid, 'items'));
    setCartItems(snapshot.docs.map(doc => doc.data()));
  };

  useFocusEffect(useCallback(() => { fetchCartItems(); }, []));

  useEffect(() => {
    // Realtime query pulls documents, ordering them by descending creation times
    const q = query(collection(db, 'Bidding_Products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBiddingProducts(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = biddingProducts.filter(p => {
      // Security Check: Completely exclude items blocked by compliance enforcement scripts
      if (p.status === 'restricted') return false;

      const matchesCat = category === "All" || p.category === category;
      const matchesSearch = p.productName?.toLowerCase().includes(searchText.toLowerCase());
      
      return matchesCat && matchesSearch;
    });
    setFilteredBidding(filtered);
  }, [category, searchText, biddingProducts]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden={false} barStyle="dark-content" />
      
      <SafeAreaView style={styles.headerSafe}>
        <View style={styles.headerTop}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search biddings..."
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => navigation.navigate('CartShop')} style={styles.iconCircle}>
              <Image source={BasketIcon} style={styles.customHeaderIcon} />
              {cartItems.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartItems.length > 99 ? '99+' : cartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("InboxScreenUser")} style={[styles.iconCircle, { marginLeft: 12 }]}>
              <Image source={MessageIcon} style={styles.customHeaderIcon} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catList}>
          {categories.map((cat, i) => {
            const isActive = category === parseInt(cat.name) || category === cat.name;
            return (
              <TouchableOpacity key={i} onPress={() => setCategory(cat.name)} style={styles.catItem} activeOpacity={0.8}>
                <View style={[styles.catIconWrapper, isActive && styles.catIconWrapperActive]}>
                  <Image source={cat.icon} style={styles.catIcon} />
                </View>
                <Text style={[styles.catText, isActive && styles.catTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      <FlatList
        data={filteredBidding}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <AnimatedBiddingCard item={item} index={index} navigation={navigation} />
        )}
        contentContainerStyle={styles.flatListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Image source={NoOrderImg} style={styles.noDataImage} />
            <Text style={styles.emptyText}>No active biddings found</Text>
          </View>
        }
      />
    </View>
  );
}

// Keeping original placeholder references for stylesheet stability
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', marginTop: 35},
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSafe: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#1e293b', fontSize: 15 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', marginLeft: 16 },
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
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  catList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  catItem: { alignItems: 'center', marginRight: 20 },
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

  },   catIconWrapperActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  catIcon: { width: 28, height: 28, resizeMode: 'contain' },
  catText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  catTextActive: { color: '#0284c7', fontWeight: '600' },
  flatListContent: { padding: 16, paddingBottom: 30 },
  cardContainer: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  cardContainerDisabled: { borderColor: '#cbd5e1', opacity: 0.85 },
  imageWrapper: { height: 180, position: 'relative', width: '100%' },
  imageWrapperDisabled: { backgroundColor: '#f1f5f9' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardImageDisabled: { opacity: 0.4 },
  noImagePlaceholder: { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  categoryBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(15, 23, 42, 0.65)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  timerBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  timerExpired: { backgroundColor: '#fef2f2' },
  timerText: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginLeft: 4 },
  disabledOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center' },
  disabledText: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },
  detailsWrapper: { padding: 16 },
  detailsWrapperDisabled: { backgroundColor: '#fafafa' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  productTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  productTitleDisabled: { color: '#94a3b8' },
  stockBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockBadgeDisabled: { backgroundColor: '#f1f5f9' },
  stockText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  stockTextDisabled: { color: '#94a3b8' },
  pricingSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', tracking: 0.5, marginBottom: 2 },
  mainPrice: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  unitText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  highestBidContainer: { alignItems: 'flex-end' },
  labelHighest: { fontSize: 11, color: '#0284c7', textTransform: 'uppercase', fontWeight: '600', marginBottom: 2 },
  highestPriceText: { fontSize: 18, fontWeight: '800', color: '#0284c7' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vendorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  vendorAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 6 },
  vendorName: { fontSize: 13, color: '#475569', fontWeight: '500', flex: 1 },
  bidButton: { backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  bidButtonDisabled: { backgroundColor: '#e2e8f0' },
  bidButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bidButtonTextDisabled: { color: '#94a3b8' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  noDataImage: { width: 140, height: 140, resizeMode: 'contain', marginBottom: 16 },
  emptyText: { fontSize: 15, color: '#64748b', fontWeight: '500' }
});