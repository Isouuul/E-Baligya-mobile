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
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, Timestamp, setDoc, deleteDoc } from 'firebase/firestore';
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
  const [isDisabled, setIsDisabled] = useState(item.isDisabled || false);

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
              <Text style={styles.disabledText}>Bidding Closed</Text>
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
              <Text style={[styles.bidButtonText, isDisabled && styles.bidButtonTextDisabled]}>{isDisabled ? 'Closed' : 'View Deal'}</Text>
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
      const matchesCat = category === "All" || p.category === category;
      const matchesSearch = p.productName?.toLowerCase().includes(searchText.toLowerCase());
      // Show all products, including disabled ones (they'll appear grayed out)
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

            <TouchableOpacity onPress={() => navigation.navigate("InboxScreen")} style={[styles.iconCircle, { marginLeft: 12 }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerSafe: { backgroundColor: '#fff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, marginTop: 35 },
  searchWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 12, paddingHorizontal: 12, height: 45 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1e293b' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  iconCircle: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  customHeaderIcon: { width: 24, height: 24, resizeMode: 'contain' },
  badge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  catList: { paddingHorizontal: 16, paddingBottom: 14, alignItems: 'center' },
  catItem: { alignItems: 'center', marginRight: 20, paddingBottom: 2 },
  catIconWrapper: { width: 45, height: 45, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 6, marginLeft: 5 },
  catIconWrapperActive: { backgroundColor: '#eff6ff', borderColor: '#1e3a8a' },
  catIcon: { width: 25, height: 25, resizeMode: 'contain' },
  catText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  catTextActive: { color: '#1e3a8a', fontWeight: '700' },
  flatListContent: { padding: 16 },
  cardContainer: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 3, shadowOpacity: 0.1 },
  imageWrapper: { height: 180, width: '100%' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  noImagePlaceholder: { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  categoryBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  categoryText: { fontSize: 11, fontWeight: 'bold', color: '#1e3a8a' },
  timerBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  timerText: { color: '#1e3a8a', fontSize: 12, fontWeight: '900', marginLeft: 4 },
  timerExpired: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  imageWrapperDisabled: { opacity: 0.5 },
  cardImageDisabled: { opacity: 0.6 },
  cardContainerDisabled: { opacity: 0.7 },
  disabledOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  disabledText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  detailsWrapper: { padding: 16 },
  detailsWrapperDisabled: { opacity: 0.6 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', flex: 1 },
  productTitleDisabled: { color: '#94a3b8' },
  stockBadge: { backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stockBadgeDisabled: { backgroundColor: '#f1f5f9' },
  stockText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  stockTextDisabled: { color: '#94a3b8' },
  pricingSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, backgroundColor: '#f8fafc', padding: 10, borderRadius: 12 },
  label: { fontSize: 11, color: '#64748b' },
  mainPrice: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  unitText: { fontSize: 12, color: '#94a3b8' },
  highestBidContainer: { alignItems: 'flex-end' },
  labelHighest: { fontSize: 10, color: '#ef4444', fontWeight: '700', textTransform: 'uppercase' },
  highestPriceText: { fontSize: 18, fontWeight: 'bold', color: '#ef4444' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  vendorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  vendorAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  vendorName: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  bidButton: { backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  bidButtonDisabled: { backgroundColor: '#cbd5e1' },
  bidButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  bidButtonTextDisabled: { color: '#94a3b8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  noDataImage: { width: 150, height: 150, marginBottom: 20 },
  emptyText: { color: '#94a3b8', fontSize: 16 },
});