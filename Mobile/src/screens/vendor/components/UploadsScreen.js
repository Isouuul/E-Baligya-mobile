import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../../firebase";

import CreateProductForm from "./CreateProductForm";
import EditProductForm from "./EditProductForm";
import ProductCard from "./ProductCard";

// Categories array
const categories = [
  { name: "All", icon: require("../../../../assets/all.png") },
  { name: "Fish", icon: require("../../../../assets/Fish.png") },
  { name: "Mollusk", icon: require("../../../../assets/mollusk.png") },
  { name: "Crustacean", icon: require("../../../../assets/Crustacean.png") },
  { name: "Trend", icon: require("../../../../assets/Trend.png") },
];

const UploadsScreen = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [modalVisible, setModalVisible] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const slideAnim = useState(new Animated.Value(0))[0];

  // Fetch products
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "Products"), (snapshot) => {
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
          <Text style={styles.headerTitle}>My Products</Text>
          <Text style={styles.headerSubtitle}>Manage your ebaligya listings</Text>
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
            placeholder="Search product..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.datePickerWrapper}>
          <Picker
            selectedValue={dateFilter}
            onValueChange={setDateFilter}
            style={styles.datePicker}
            dropdownIconColor="#0f172a"
          >
            <Picker.Item label="All" value="All" color="#0f172a" style={styles.pickerItem} />
            <Picker.Item label="Today" value="Today" color="#0f172a" style={styles.pickerItem} />
            <Picker.Item label="Yesterday" value="Yesterday" color="#0f172a" style={styles.pickerItem} />
          </Picker>
        </View>
      </View>

      {/* Category Filter - RESTORED ORIGINAL UI LAYOUT */}
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
                style={styles.categoryItem}
                onPress={() => setSelectedCategory(item.name)}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconWrapper, isSelected && styles.categoryIconWrapperActive]}>
                  <Image source={item.icon} style={styles.categoryIcon} />
                </View>
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
          <Text style={styles.noProductsText}>No products found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => {
                setEditingProduct(item);
                setShowEditProductModal(true);
              }}
            />
          )}
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
            <Text style={styles.actionText}>🛍️  Create Product</Text>
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
              <Text style={styles.modalSubtitle}>Add a fresh product listing</Text>
            </View>
            <View style={styles.modalDivider} />
            <View style={styles.modalBody}>
              <CreateProductForm onSubmit={() => setShowCreateProductModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        visible={showEditProductModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProductModal(false)}
      >
        <TouchableOpacity
          style={styles.floatingModalOverlay}
          activeOpacity={1}
          onPressOut={() => setShowEditProductModal(false)}
        >
          <View style={styles.floatingModalContentWrapper}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.floatingModalContent}>
                <View style={styles.modalGrabber} />
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>Edit Product</Text>
                  <Text style={styles.modalSubtitle}>Update your product details</Text>
                </View>
                <View style={styles.modalDivider} />
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={{ flex: 1 }}
                  >
                    <EditProductForm
                      existingProduct={editingProduct}
                      onCancel={() => setShowEditProductModal(false)}
                    />
                  </KeyboardAvoidingView>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default UploadsScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafafa" 
  },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    paddingBottom: 60
  },
  header: {
    backgroundColor: "#0f172a", // Premium dark theme
    paddingTop: Platform.OS === "ios" ? 60 : 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  headerTitle: { 
    fontSize: 26, 
    fontWeight: "800", 
    color: "#ffffff",
    letterSpacing: -0.5
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "400"
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  headerCount: { 
    fontSize: 12, 
    fontWeight: "600", 
    color: "#ffffff",
    letterSpacing: 0.2
  },
  searchDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: -20, // Overlap effect
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  searchInput: { 
    flex: 1, 
    height: "100%",
    fontSize: 14, 
    color: "#0f172a",
    fontWeight: "500"
  },
  datePickerWrapper: {
    width: 120,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    height: 52,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    marginLeft: 12,
    elevation: 3,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  datePicker: { 
    width: "100%", 
    color: "#0f172a",
    backgroundColor: "transparent"
  },
  pickerItem: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
  },
  
  /* Original Category UX Architecture Restored */
  categoryContainer: {
    maxHeight: 75, // Safely accommodates the dynamic sizing without clipping text
    marginVertical: 12,
  },
  categoryListContent: {
    paddingHorizontal: 20,
    alignItems: "center"
  },
  categoryItem: {
    alignItems: "center",
    marginRight: 20,
    paddingBottom: 2,
  },
  categoryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    marginBottom: 6,
    marginLeft: 5,
    elevation: 2,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  categoryIconWrapperActive: {
    backgroundColor: "#f1f5f9",
    borderColor: "#0f172a",
  },
  categoryIcon: { 
    width: 24, 
    height: 24, 
    resizeMode: "contain" 
  },
  categoryText: { 
    fontSize: 12, 
    color: "#64748b", 
    fontWeight: "600" 
  },
  categoryTextActive: { 
    color: "#0f172a", 
    fontWeight: "700" 
  },

  list: { 
    paddingHorizontal: 20, 
    paddingBottom: 110 
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#0f172a",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    zIndex: 99,
  },
  fabText: { 
    color: "#ffffff", 
    fontSize: 26, 
    fontWeight: "300",
    marginTop: -2
  },
  actionMenu: {
    position: "absolute",
    bottom: 104,
    right: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    elevation: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    zIndex: 100,
    width: 210,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  actionButton: { 
    paddingVertical: 4 
  },
  actionText: { 
    fontSize: 14, 
    color: "#0f172a", 
    fontWeight: "600" 
  },
  floatingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end", 
  },
  floatingModalContentWrapper: {
    width: "100%",
  },
  floatingModalContent: {
    backgroundColor: "#ffffff",
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 24,
  },
  modalGrabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#e2e8f0",
    marginBottom: 20,
  },
  modalHeaderRow: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "400",
    color: "#64748b",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginBottom: 20,
  },
  modalBody: {
    minHeight: 320,
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  noProductsImage: {
    width: 140,
    height: 140,
    resizeMode: "contain",
    opacity: 0.6
  },
  noProductsText: {
    color: "#64748b", 
    marginTop: 16,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: -0.1
  }
});