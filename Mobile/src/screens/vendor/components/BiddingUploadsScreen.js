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
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import EditProductBiddingFormModal from "./EditProductBiddingFormModal";
import CreateProductBiddingForm from "./CreateProductBiddingForm";
import ProductBiddingCard from "./ProductBiddingCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
const [editModalVisible, setEditModalVisible] = useState(false);
const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  const slideAnim = useState(new Animated.Value(0))[0];
const handleEdit = (product) => {
  setSelectedProduct(product);
  setEditModalVisible(true);
};
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

  // FAB animation (kept as-is)
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: modalVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [modalVisible]);

  // Filter products
  const filtered = products
    .filter((p) =>
      (p.name || "").toLowerCase().includes(search.toLowerCase())
    )
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bidding Products</Text>
          <Text style={styles.headerSubtitle}>
            Manage your active ebaligya auctions
          </Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.headerCount}>{filtered.length} Items</Text>
        </View>
      </View>

      {/* Search + Filter */}
      <View style={styles.searchDateContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search auctions..."
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
          >
            <Picker.Item label="🗓️ All" value="All" />
            <Picker.Item label="🗓️ Today" value="Today" />
            <Picker.Item label="🗓️ Yesterday" value="Yesterday" />
          </Picker>
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoryContainer}>
        <FlatList
          data={categories}
          numColumns={5}
          keyExtractor={(item) => item.name}
          columnWrapperStyle={styles.categoryListContent}
          renderItem={({ item }) => {
            const isSelected = item.name === selectedCategory;

            return (
              <TouchableOpacity
                style={styles.categoryItem}
                onPress={() => setSelectedCategory(item.name)}
              >
                <View
                  style={[
                    styles.categoryIconBox,
                    isSelected && styles.categoryIconBoxActive,
                  ]}
                >
                  <Image
                    source={item.icon}
                    style={styles.categoryIcon}
                  />
                </View>

                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextActive,
                  ]}
                >
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
          <Text style={styles.noProductsText}>
            No bidding items found matching criteria
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
renderItem={({ item }) => (
  <ProductBiddingCard
    product={item}
    onEdit={handleEdit}
  />
)}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Floating Action Menu */}
      {modalVisible && (
        <Animated.View style={styles.actionMenu}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setModalVisible(false);
              setShowCreateProductModal(true);
            }}
          >
            <Text style={styles.actionText}>
              🛍️ Create New Auction
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(!modalVisible)}
      >
        <Text style={styles.fabText}>
          {modalVisible ? "✕" : "＋"}
        </Text>
      </TouchableOpacity>

      {/* ✅ CONNECTED CREATE FORM MODAL */}
      {showCreateProductModal && (
        <CreateProductBiddingForm
          onCancel={() => setShowCreateProductModal(false)}
          onSubmit={() => setShowCreateProductModal(false)}
        />
      )}
      {editModalVisible && selectedProduct && (
  <EditProductBiddingFormModal
    visible={editModalVisible}
    existingBidding={selectedProduct}
    onCancel={() => setEditModalVisible(false)}
    onSubmit={() => {
      setEditModalVisible(false);
      setSelectedProduct(null);
    }}
  />
)}

      
    </View>
    
  );
};



export default BiddingUploadsScreen;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  badge: { backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerCount: { fontSize: 13, fontWeight: "700", color: "#4f46e5" },
  searchDateContainer: { flexDirection: "row", paddingHorizontal: 16, marginTop: 16, alignItems: "center", gap: 10 },
  searchBar: { flex: 1, flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, alignItems: "center", height: 50, borderWidth: 1, borderColor: "#e2e8f0" },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#0f172a", fontWeight: "500" },
  datePickerWrapper: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", width: 130, height: 50, justifyContent: "center", overflow: "hidden" },
  datePicker: { width: "100%", marginLeft: 5 },
  pickerItem: { fontSize: 14, fontWeight: "600" },
  categoryContainer: { marginVertical: 14},
  categoryListContent: { paddingHorizontal: 16, gap: 12, justifyContent: "space-between" },
  categoryItem: { flexDirection: "column", alignItems: "center", flex: 1 },
  categoryItemActive: {},
  categoryIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  categoryIconBoxActive: {     backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',},
  categoryIcon: { width: 26, height: 26, resizeMode: "contain" },
  categoryIconActive: {  },
  categoryText: { fontSize: 12, fontWeight: "600", color: "#64748b", textAlign: "center" },
  categoryTextActive: { color: "#3b82f6" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 },
  noProductsImage: { width: 140, height: 140, resizeMode: "contain", marginBottom: 16, opacity: 0.8 },
  noProductsText: { fontSize: 15, fontWeight: "600", color: "#94a3b8" },
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: "#4f46e5", justifyContent: "center", alignItems: "center", elevation: 8, shadowColor: "#4f46e5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  fabText: { color: "#fff", fontSize: 24, fontWeight: "600" },
  actionMenu: { position: "absolute", bottom: 90, right: 24, backgroundColor: "#fff", borderRadius: 16, padding: 6, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.15, shadowRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  actionButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  actionText: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  floatingModalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" },
  modalDismissOverlay: { ...StyleSheet.absoluteFillObject },
  floatingModalContent: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: SCREEN_HEIGHT * 0.85, paddingBottom: 20 },
  modalGrabber: { width: 40, height: 5, backgroundColor: "#cbd5e1", borderRadius: 3, alignSelf: "center", marginTop: 12, marginBottom: 10 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  closeModalButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  closeModalText: { fontSize: 14, color: "#64748b", fontWeight: "bold" },
  modalDivider: { height: 1, backgroundColor: "#f1f5f9" },
  modalScroll: { paddingHorizontal: 24, paddingTop: 16 }
});

