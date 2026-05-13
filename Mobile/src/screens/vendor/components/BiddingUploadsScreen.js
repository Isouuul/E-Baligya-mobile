import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Animated,
  Modal,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";

import CreateProductBiddingForm from "./CreateProductBiddingForm";
import ProductBiddingCard from "./ProductBiddingCard";
import VendorTabNavigator from "../navigation/VendorTabNavigator";

// Categories array
const categories = [
  { name: "All", icon: require("../../../../assets/all.png") },
  { name: "Fish", icon: require("../../../../assets/Fish.png") },
  { name: "Mollusk", icon: require("../../../../assets/mollusk.png") },
  { name: "Crustacean", icon: require("../../../../assets/Crustacean.png") },
  { name: "Trend", icon: require("../../../../assets/Trend.png") },
];

const BiddingUploadsScreen = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [modalVisible, setModalVisible] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  const slideAnim = useState(new Animated.Value(0))[0];

  // Fetch products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "Bidding_Products"), (snapshot) => {
      setProducts(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          name: doc.data().name || doc.data().productName || "Unnamed Product",
        }))
      );
    });
    return unsub;
  }, []);

  // FAB animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: modalVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [modalVisible]);

  // Filter products
  const filtered = products
    .filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase()))
    .filter((p) => {
      if (dateFilter === "All") return true;
      if (!p.createdAt) return true;
      const date = p.createdAt.toDate?.() || new Date(p.createdAt);
      const now = new Date();
      const days = (now - date) / (1000 * 60 * 60 * 24);
      if (dateFilter === "Today") return days < 1;
      if (dateFilter === "Yesterday") return days >= 1 && days < 2;
      return true;
    })
    .filter((p) => {
      if (selectedCategory === "All") return true;
      return p.category === selectedCategory;
    });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bidding Products</Text>
          <Text style={styles.headerSubtitle}>Manage your active ebaligya auctions</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.headerCount}>{filtered.length} Items</Text>
        </View>
      </View>

      {/* Search + Date */}
      <View style={styles.searchDateContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search auctions..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.datePickerWrapper}>
          <Picker
            selectedValue={dateFilter}
            onValueChange={setDateFilter}
            style={styles.datePicker}
            dropdownIconColor="#1e3a8a"
          >
            <Picker.Item label="All" value="All" color="#111827" style={styles.pickerItem} />
            <Picker.Item label="Today" value="Today" color="#111827" style={styles.pickerItem} />
            <Picker.Item label="Yesterday" value="Yesterday" color="#111827" style={styles.pickerItem} />
          </Picker>
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.categoryListContent}
          renderItem={({ item }) => {
            const isSelected = item.name === selectedCategory;
            return (
              <TouchableOpacity
                style={[styles.categoryBtn, isSelected && styles.categoryBtnActive]}
                onPress={() => setSelectedCategory(item.name)}
                activeOpacity={0.8}
              >
                <Image source={item.icon} style={[styles.categoryIcon, isSelected && { tintColor: '#fff' }]} />
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Product List */}
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Image
            source={require("../../../../assets/no-order.png")}
            style={styles.noProductsImage}
          />
          <Text style={styles.noProductsText}>No bidding items found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ProductBiddingCard product={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Menu */}
      {modalVisible && (
        <Animated.View style={styles.actionMenu}>
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={() => {
              setModalVisible(false);
              setShowCreateProductModal(true);
            }}
          >
            <Text style={styles.actionText}>🛍️  Create Product</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => setModalVisible(!modalVisible)}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Create Product Modal */}
      <Modal
        visible={showCreateProductModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateProductModal(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <View style={styles.floatingModalContent}>
            <View style={styles.modalGrabber} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Create Product</Text>
              <Text style={styles.modalSubtitle}>Add a fresh auction listing</Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              <CreateProductBiddingForm onSubmit={() => setShowCreateProductModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BiddingUploadsScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    paddingBottom: 60
  },
  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#ffffff",
    letterSpacing: 0.3
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#93c5fd",
    marginTop: 2,
    fontWeight: "500"
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
  },
  headerCount: { 
    fontSize: 13, 
    fontWeight: "700", 
    color: "#ffffff" 
  },
  searchDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchInput: { 
    flex: 1, 
    height: "100%",
    fontSize: 14, 
    color: "#111827",
    fontWeight: "500"
  },
  datePickerWrapper: {
    width: 125,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
    height: 46,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    marginLeft: 10,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  datePicker: { 
    width: "100%", 
    color: "#111827",
    backgroundColor: 'transparent'
  },
  pickerItem: {
    fontSize: 14,
    color: "#111827",
  },
  categoryContainer: {
    maxHeight: 45,
    marginVertical: 12,
  },
  categoryListContent: {
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    backgroundColor: "#ffffff",
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryBtnActive: { 
    backgroundColor: "#1e3a8a",
    borderColor: "#1e3a8a",
  },
  categoryIcon: { 
    width: 18, 
    height: 18, 
    resizeMode: "contain", 
    marginRight: 6 
  },
  categoryText: { 
    fontSize: 13, 
    color: "#4b5563", 
    fontWeight: "600" 
  },
  categoryTextActive: { 
    color: "#ffffff", 
    fontWeight: "700" 
  },
  list: { 
    paddingHorizontal: 16, 
    paddingBottom: 100 
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "#1e3a8a",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 99,
  },
  fabText: { 
    color: "#ffffff", 
    fontSize: 24, 
    fontWeight: "300",
    marginTop: -2
  },
  actionMenu: {
    position: "absolute",
    bottom: 92,
    right: 20,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    zIndex: 100,
    width: 200,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  actionButton: { 
    paddingVertical: 6 
  },
  actionText: { 
    fontSize: 14, 
    color: "#111827", 
    fontWeight: "600" 
  },
  floatingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  floatingModalContent: {
    backgroundColor: "#ffffff",
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 24,
  },
  modalGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: "#cbd5e1",
    marginBottom: 16,
  },
  modalHeaderRow: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginBottom: 16,
  },
  modalBody: {
    minHeight: 320,
  },
  noProductsImage: {
    width: 120,
    height: 120,
    resizeMode: "contain",
    opacity: 0.8
  },
  noProductsText: {
    color: "#6b7280", 
    marginTop: 14,
    fontSize: 15,
    fontWeight: "500"
  }
});