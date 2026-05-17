import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  increment
} from "firebase/firestore";
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function CartShop() {
  const navigation = useNavigation();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tracks active selections
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  // Real-time Sync with Firestore Cart collection
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const cartRef = collection(db, 'Carts', user.uid, 'items');
    const q = query(cartRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ cartItemId: doc.id, ...doc.data() });
      });
      setCartItems(items);

      // Clean up selections if items are deleted by external actions
      setSelectedItemIds((prevSelected) => {
        const incomingIds = items.map(i => i.cartItemId);
        return prevSelected.filter(id => incomingIds.includes(id));
      });

      setLoading(false);
    }, (error) => {
      console.error("Error fetching cart items:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute Total Cost of ONLY Selected Items in Basket
  const cartSubtotal = useMemo(() => {
    return cartItems
      .filter((item) => selectedItemIds.includes(item.cartItemId))
      .reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  }, [cartItems, selectedItemIds]);

  // Group cart items dynamically by businessName
  const groupedCart = useMemo(() => {
    const groups = {};
    cartItems.forEach((item) => {
      const businessName = item.uploadedBy?.businessName || 'Independent Seller'; 
      if (!groups[businessName]) {
        groups[businessName] = [];
      }
      groups[businessName].push(item);
    });
    
    return Object.keys(groups).map((businessName) => ({
      businessName,
      items: groups[businessName],
    }));
  }, [cartItems]);

  // Derived helper to identify which business currently owns the selection 
  const currentSelectedShop = useMemo(() => {
    if (selectedItemIds.length === 0) return null;
    const firstSelected = cartItems.find(i => selectedItemIds.includes(i.cartItemId));
    return firstSelected?.uploadedBy?.businessName || 'Independent Seller';
  }, [selectedItemIds, cartItems]);

  // Toggle single item selection with single-shop constraint
  const toggleItemSelection = (item) => {
    const targetShop = item.uploadedBy?.businessName || 'Independent Seller';
    const isSelected = selectedItemIds.includes(item.cartItemId);

    if (!isSelected && currentSelectedShop && currentSelectedShop !== targetShop) {
      Alert.alert(
        "One Shop Allowed",
        `You currently have items selected from "${currentSelectedShop}". Please checkout those items first, or uncheck them to order from "${targetShop}".`
      );
      return;
    }

    setSelectedItemIds((prev) =>
      isSelected ? prev.filter((id) => id !== item.cartItemId) : [...prev, item.cartItemId]
    );
  };

  // Toggle selection for an entire business group with single-shop constraint
  const toggleShopGroupSelection = (shopGroupName, shopGroupItems) => {
    const groupItemIds = shopGroupItems.map((item) => item.cartItemId);
    const allGroupItemsSelected = groupItemIds.every((id) => selectedItemIds.includes(id));

    if (allGroupItemsSelected) {
      // De-select group safely
      setSelectedItemIds((prev) => prev.filter((id) => !groupItemIds.includes(id)));
    } else {
      // Validate single shop rule before selecting
      if (currentSelectedShop && currentSelectedShop !== shopGroupName) {
        Alert.alert(
          "One Shop Allowed",
          `You currently have items selected from "${currentSelectedShop}". Please complete that checkout first before adding items from "${shopGroupName}".`
        );
        return;
      }
      setSelectedItemIds((prev) => [...new Set([...prev, ...groupItemIds])]);
    }
  };

  // Handle Incrementing / Decrementing quantities
  const updateQuantity = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) {
      confirmDelete(item);
      return;
    }

    try {
      const itemRef = doc(db, 'Carts', auth.currentUser.uid, 'items', item.cartItemId);
      const singleUnitCost = item.totalPrice / item.quantity; 

      await updateDoc(itemRef, {
        quantity: increment(delta),
        totalPrice: increment(singleUnitCost * delta)
      });
    } catch (err) {
      Alert.alert('Error', 'Could not update quantity');
    }
  };

  // Confirm Line Item Deletion
  const confirmDelete = (item) => {
    Alert.alert(
      "Remove Item",
      `Are you sure you want to remove ${item.productName} from your cart?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: () => removeItem(item.cartItemId) 
        }
      ]
    );
  };

  const removeItem = async (itemId) => {
    try {
      const itemRef = doc(db, 'Carts', auth.currentUser.uid, 'items', itemId);
      await deleteDoc(itemRef);
    } catch (err) {
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const handleCheckoutAll = () => {
    const checkoutPayload = cartItems.filter((item) => selectedItemIds.includes(item.cartItemId));
    if (checkoutPayload.length === 0) {
      Alert.alert('Selection Required', 'Please select items from a shop to proceed.');
      return;
    }
    
    // Pass items downstream along with information reminding the user to come back for remaining products if multi-vendor exists
    navigation.navigate('CheckedOut', { 
      cartItems: checkoutPayload, 
      totalAmount: cartSubtotal, 
      origin: 'cart' 
    });
  };

  const renderCartItem = (item) => {
    const isSelected = selectedItemIds.includes(item.cartItemId);

    return (
      <View key={item.cartItemId} style={styles.cartCard}>
        {/* Radio Button Selector */}
        <TouchableOpacity 
          style={styles.radioContainer} 
          onPress={() => toggleItemSelection(item)}
        >
          <MaterialCommunityIcons 
            name={isSelected ? "checkbox-marked-circle" : "circle-outline"} 
            size={22} 
            color={isSelected ? "#0EA5E9" : "#94A3B8"} 
          />
        </TouchableOpacity>

        {/* Product Image */}
        {item.productImage ? (
          <Image source={{ uri: item.productImage }} style={styles.productImg} />
        ) : (
          <View style={styles.imgPlaceholder}>
            <MaterialCommunityIcons name="image-off" size={24} color="#94A3B8" />
          </View>
        )}

        {/* Details Wrapper */}
        <View style={styles.detailsContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productCategory}>{item.category?.toUpperCase()}</Text>
              <Text style={styles.productName} numberOfLines={1}>{item.productName}</Text>
            </View>
            <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Render Services Selected if they exist */}
          {item.selectedServices && item.selectedServices.length > 0 && (
            <View style={styles.servicesTagContainer}>
              {item.selectedServices.map((srv, idx) => (
                <View key={idx} style={styles.serviceTag}>
                  <Text style={styles.serviceTagText}>{srv.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Pricing & Control Bar */}
          <View style={styles.cardBottomRow}>
            <Text style={styles.itemPrice}>
              ₱{item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, -1)}>
                <Ionicons name="remove" size={14} color="#0F172A" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, 1)}>
                <Ionicons name="add" size={14} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // Renders each distinct Business Group
  const renderShopGroup = ({ item: shopGroup }) => {
    const groupItemIds = shopGroup.items.map((i) => i.cartItemId);
    const isGroupAllSelected = groupItemIds.every((id) => selectedItemIds.includes(id));

    return (
      <View style={styles.shopGroupContainer}>
        <View style={styles.shopHeaderRow}>
          {/* Shop level dynamic selector toggle */}
          <TouchableOpacity 
            onPress={() => toggleShopGroupSelection(shopGroup.businessName, shopGroup.items)}
            style={{ marginRight: 8 }}
          >
            <MaterialCommunityIcons 
              name={isGroupAllSelected ? "checkbox-marked-circle" : "circle-outline"} 
              size={22} 
              color={isGroupAllSelected ? "#0EA5E9" : "#94A3B8"} 
            />
          </TouchableOpacity>
          <MaterialCommunityIcons name="storefront-outline" size={20} color="#0F172A" />
          <Text style={styles.shopGroupTitle}>{shopGroup.businessName}</Text>
        </View>
        {shopGroup.items.map((item) => renderCartItem(item))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerLayout}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* STYLISH HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerCircleBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Basket</Text>
        <View style={[styles.headerCircleBtn, { opacity: 0 }]}>
          <Ionicons name="chevron-back" size={22} />
        </View>
      </View>

      {/* CART CONTENT */}
      {cartItems.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="basket-outline" size={48} color="#64748B" />
          </View>
          <Text style={styles.emptyTitle}>Your basket is empty</Text>
          <Text style={styles.emptySubtitle}>Looks like you haven't added any fresh seafood listings to your cart yet.</Text>
          <TouchableOpacity style={styles.shopNowBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.shopNowText}>Explore Market</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Top warning info badge when another vendor is blocked out */}
          {groupedCart.length > 1 && (
            <View style={styles.restrictionBadge}>
              <Ionicons name="information-circle-outline" size={16} color="#0369A1" />
              <Text style={styles.restrictionText}>
                Multi-shop orders: Please complete checkout for one shop first.
              </Text>
            </View>
          )}

          <FlatList
            data={groupedCart}
            keyExtractor={(item) => item.businessName}
            renderItem={renderShopGroup}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />

          {/* CHECKOUT SUMMARY BAR */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.totalLabel}>
                  {selectedItemIds.length > 0 ? `${currentSelectedShop}` : 'No shop selected'}
                </Text>
                <Text style={styles.totalAmount}>
                  ₱{cartSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <TouchableOpacity 
                style={[
                  styles.checkoutBtn, 
                  selectedItemIds.length === 0 && { backgroundColor: '#eff6ff' }
                ]} 
                onPress={handleCheckoutAll}
                disabled={selectedItemIds.length === 0}
              >
                <Text style={styles.checkoutText}>Proceed to Checkout</Text>
                <Ionicons name="arrow-forward" size={16} color="#3B82F6" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    marginTop: 35
  },
  centerLayout: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  customHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  restrictionBadge: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  restrictionText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  shopGroupContainer: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  shopGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 4,
  },
  cartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  radioContainer: {
    paddingRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImg: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  imgPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  productCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0EA5E9',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    paddingRight: 8,
  },
  deleteBtn: {
    padding: 4,
  },
  servicesTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 4,
  },
  serviceTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  serviceTagText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '500',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    paddingHorizontal: 10,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  shopNowBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shopNowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  checkoutBtn: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6', 
    borderWidth: 0.5, paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '700',
  },
});