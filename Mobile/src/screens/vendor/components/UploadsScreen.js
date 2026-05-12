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
import { db, auth} from "../../../firebase";

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
        <Text style={styles.headerTitle}>My Products</Text>
        <Text style={styles.headerCount}>{filtered.length} Items</Text>
      </View>

      {/* Search + Date */}
      <View style={styles.searchDateContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search product..."
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={styles.datePickerWrapper}>
          <Picker
            selectedValue={dateFilter}
            onValueChange={setDateFilter}
            style={styles.datePicker}
          >
            <Picker.Item label="All" value="All" />
            <Picker.Item label="Today" value="Today" />
            <Picker.Item label="Yesterday" value="Yesterday" />
          </Picker>
        </View>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(item) => item.name}
        style={styles.categoryList}
        renderItem={({ item }) => {
          const isSelected = item.name === selectedCategory;
          return (
            <TouchableOpacity
              style={[styles.categoryBtn, isSelected && styles.categoryBtnActive]}
              onPress={() => setSelectedCategory(item.name)}
            >
              <Image source={item.icon} style={styles.categoryIcon} />
              <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Product List */}
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Image
            source={require("../../../../assets/no-order.png")}
            style={styles.noProductsImage}
          />
          <Text style={{ color: "#6b7280", marginTop: 10 }}>No products found.</Text>
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
        />
      )}

      {/* Floating Menu */}
      {modalVisible && (
        <Animated.View style={styles.actionMenu}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setModalVisible(false);
              setShowCreateProductModal(true);
            }}
          >
            <Text style={styles.actionText}>🛍️ Create Product</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
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
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#1e3a8a",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    elevation: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerCount: { fontSize: 14, fontWeight: "600", color: "#E0E7FF" },
  searchDateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, fontSize: 14, color: "#111" },
  datePickerWrapper: {
    width: 120,
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    overflow: "hidden",
    elevation: 2,
    marginLeft: 8,
  },
  datePicker: { height: 40, width: "100%", color: "#111", fontSize: 14, textAlignVertical: "center" },
  categoryList: { width: "100%", maxHeight: 35, marginVertical: 10, marginLeft: 8 },
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
  },
  categoryBtnActive: { backgroundColor: "#1e3a8a" },
  categoryIcon: { width: 20, height: 20, resizeMode: "contain", marginRight: 6 },
  categoryText: { fontSize: 14, color: "#111", fontWeight: "500" },
  categoryTextActive: { color: "#fff", fontWeight: "700" },
  list: { paddingHorizontal: 8, paddingBottom: 20 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 15,
    backgroundColor: "#1e3a8a",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  actionMenu: {
    position: "absolute",
    bottom: 100,
    right: 25,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    zIndex: 20,
    width: 220,
  },
  actionButton: { paddingVertical: 10 },
  actionText: { fontSize: 16, color: "#000", fontWeight: "500" },
floatingModalOverlay: {
  flex: 1,
  backgroundColor: "rgba(15,23,42,0.45)",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 16,
  paddingVertical: 22,
},
  floatingModalContentWrapper: {
    width: "100%",
    alignItems: "center",
  },
  floatingModalContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 390,
    maxHeight: "92%",
    minHeight: 560,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    flexDirection: "column",
  },
  modalGrabber: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    marginBottom: 12,
  },
  modalHeaderRow: {
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginBottom: 12,
  },
  modalBody: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  
  noProductsImage: {
    width: 150,
    height: 150,
    resizeMode: "contain",
  },
});
