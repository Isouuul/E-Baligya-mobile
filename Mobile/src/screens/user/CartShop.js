// src/screens/Users/CartShop.js
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  StatusBar,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

export default function CartShop() {
  const navigation = useNavigation();
  const user = auth.currentUser;
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const opacityRefs = useRef({});

  useEffect(() => { fetchCartItems(); }, []);

  const fetchCartItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'Carts', user.uid, 'items'));
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setCartItems(data);

      const newRefs = {};
      data.forEach(item => (newRefs[item.id] = new Animated.Value(1)));
      opacityRefs.current = newRefs;
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load cart items.');
    } finally { setLoading(false); }
  };

  const groupedItems = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const vendorKey = item.uploadedBy?.email;
      if (!vendorKey) return;

      if (!groups[vendorKey]) {
        groups[vendorKey] = {
          vendorEmail: vendorKey,
          businessName: item.uploadedBy?.businessName || 'Unknown Vendor',
          items: [],
        };
      }
      groups[vendorKey].items.push(item);
    });
    return Object.values(groups);
  }, [cartItems]);

  const toggleSelectItem = id =>
    setSelectedItems(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));

  const toggleSelectShop = shopItems => {
    const shopItemIds = shopItems.map(i => i.id);
    const allSelected = shopItemIds.every(id => selectedItems.includes(id));
    setSelectedItems(prev =>
      allSelected
        ? prev.filter(id => !shopItemIds.includes(id))
        : [...prev, ...shopItemIds.filter(id => !prev.includes(id))]
    );
  };

  const updateQuantity = async (item, newQty) => {
    if (newQty < 1) return;
    try {
      await updateDoc(doc(db, 'Carts', user.uid, 'items', item.id), { quantity: newQty });
      setCartItems(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: newQty } : i)));
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update quantity.');
    }
  };

  const removeItem = item => {
    Animated.timing(opacityRefs.current[item.id], { toValue: 0, duration: 300, useNativeDriver: true })
      .start(async () => {
        try {
          await deleteDoc(doc(db, 'Carts', user.uid, 'items', item.id));
          setCartItems(prev => prev.filter(i => i.id !== item.id));
          setSelectedItems(prev => prev.filter(id => id !== item.id));
        } catch (err) {
          console.error(err);
          Alert.alert('Error', 'Failed to remove item.');
        }
      });
  };

  const removeShop = shopItems => {
    const animations = shopItems.map(item =>
      Animated.timing(opacityRefs.current[item.id], { toValue: 0, duration: 200, useNativeDriver: true })
    );
    Animated.stagger(50, animations).start(async () => {
      try {
        await Promise.all(shopItems.map(item => deleteDoc(doc(db, 'Carts', user.uid, 'items', item.id))));
        const shopItemIds = shopItems.map(i => i.id);
        setCartItems(prev => prev.filter(i => !shopItemIds.includes(i.id)));
        setSelectedItems(prev => prev.filter(id => !shopItemIds.includes(id)));
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to remove shop items.');
      }
    });
  };

  const selectedTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      if (!selectedItems.includes(item.id)) return sum;
      const base = Number(item.basePrice || 0);
      const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
      return sum + (base + servicesTotal) * (item.quantity || 1);
    }, 0);
  }, [selectedItems, cartItems]);

  const handleCheckout = () => {
    if (!selectedItems.length) return Alert.alert('Notice', 'Please select items to checkout.');
    navigation.navigate('CheckedOut', { selectedItems: cartItems.filter(i => selectedItems.includes(i.id)) });
  };

  const renderItemCard = item => {
    const isSelected = selectedItems.includes(item.id);
    const base = Number(item.basePrice || 0);
    const servicesTotal = (item.selectedServices || []).reduce((a, s) => a + Number(s.price || 0), 0);
    const itemTotal = (base + servicesTotal) * (item.quantity || 1);

    return (
      <Swipeable key={item.id} renderRightActions={() => renderRightActions(item)}>
        <Animated.View
          style={[
            styles.itemCard,
            isSelected && styles.itemSelected,
            { opacity: opacityRefs.current[item.id] },
          ]}
        >
          <View style={styles.productRow}>
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => toggleSelectItem(item.id)}>
              <Ionicons 
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} 
                size={22} 
                color={isSelected ? '#0F172A' : '#94A3B8'} 
              />
            </TouchableOpacity>

            {item.productImage ? (
              <Image source={{ uri: item.productImage }} style={styles.productImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={24} color="#94A3B8" />
              </View>
            )}

            <View style={styles.productDetails}>
              <Text style={styles.productText} numberOfLines={1}>{item.productName}</Text>
              
              <View style={styles.badgeRow}>
                {item.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.category.toUpperCase()}</Text>
                  </View>
                )}
                {item.selectedServices && item.selectedServices.length > 0 && (
                  <Text style={styles.servicesCountText}>
                    • {item.selectedServices.length} custom service(s)
                  </Text>
                )}
              </View>

              <View style={styles.priceQtyRow}>
                <Text style={styles.itemTotal}>₱{itemTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
                
                <View style={styles.qtyContainer}>
                  <TouchableOpacity onPress={() => updateQuantity(item, item.quantity - 1)} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={14} color="#0F172A" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(item, item.quantity + 1)} style={styles.qtyBtn}>
                    <Ionicons name="add" size={14} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </Swipeable>
    );
  };

  const renderRightActions = item => (
    <TouchableOpacity style={styles.deleteSwipeBtn} onPress={() => removeItem(item)}>
      <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>My Basket</Text>
        <View style={styles.iconCircle}>
           <Ionicons name="basket-outline" size={20} color="#0F172A" />
        </View>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="basket-outline" size={54} color="#94A3B8" />
          </View>
          <Text style={styles.emptyText}>Your basket is empty</Text>
          <Text style={styles.emptySubText}>Looks like you haven't added any seafood selections yet.</Text>
          <TouchableOpacity 
            style={styles.browseBtn} 
            onPress={() => navigation.navigate('ConsumerTabs')}
          >
            <Text style={styles.browseBtnText}>Explore Market</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groupedItems}
          keyExtractor={group => group.vendorEmail}
          contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => {
            const shopAllSelected = group.items.every(i => selectedItems.includes(i.id));
            return (
              <View key={group.vendorEmail} style={styles.shopBlock}>
                <View style={styles.shopHeader}>
                  <TouchableOpacity onPress={() => toggleSelectShop(group.items)} style={styles.selectAllButton}>
                    <Ionicons 
                      name={shopAllSelected ? 'checkmark-circle' : 'ellipse-outline'} 
                      size={22} 
                      color={shopAllSelected ? '#0F172A' : '#94A3B8'} 
                    />
                    <View style={styles.shopInfo}>
                        <MaterialCommunityIcons name="storefront-outline" size={18} color="#475569" style={{marginLeft: 8}} />
                        <Text style={styles.selectAllText}>{group.businessName}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeShop(group.items)} style={styles.shopDeleteButton}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                {group.items.map(item => renderItemCard(item))}
              </View>
            );
          }}
        />
      )}

      {cartItems.length > 0 && (
        <View style={styles.bottomFooter}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Grand Total ({selectedItems.length} Selected)</Text>
            <Text style={styles.totalAmount}>₱{selectedTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.checkoutButton, !selectedItems.length && styles.disabledBtn]} 
            onPress={handleCheckout} 
            disabled={!selectedItems.length}
            activeOpacity={0.8}
          >
            <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{marginLeft: 6}} />
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    fontFamily: 'System',
    textAlign: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  browseBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shopBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
  },
  shopDeleteButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
  },
  itemSelected: {
    backgroundColor: '#F8FAFC',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    paddingVertical: 12,
    paddingRight: 10,
  },
  productImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  placeholderImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    height: 68,
  },
  productText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  servicesCountText: {
    fontSize: 11,
    color: '#64748B',
  },
  priceQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 10,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 16,
    textAlign: 'center',
  },
  deleteSwipeBtn: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 68,
    height: 68,
    borderRadius: 12,
    marginLeft: 12,
  },
  bottomFooter: {
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
  checkoutButton: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
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
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
});