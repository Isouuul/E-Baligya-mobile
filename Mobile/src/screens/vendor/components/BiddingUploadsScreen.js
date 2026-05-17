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
// 1. ADDED doc AND deleteDoc TO THE FIRESTORE IMPORTS
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  const slideAnim = useState(new Animated.Value(0))[0];
  
  const handleEdit = (product) => {
    setSelectedProduct(product);
    setEditModalVisible(true);
  };

  // Fetch products & auto-delete 0kg entries
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "Bidding_Products"), (snapshot) => {
      const fetchedProducts = [];

      snapshot.docs.forEach((document) => {
        const data = document.data();
        
        // Normalize checking for variations of 0 weight (e.g., 0, "0", "0kg", "0 kg")
        const rawWeight = data.weight !== undefined ? String(data.weight).toLowerCase().trim() : "";
        const isZeroWeight = rawWeight === "0" || rawWeight === "0kg" || rawWeight === "0 kg";

        if (isZeroWeight) {
          // 2. AUTOMATIC DELETION: If weight is 0, delete directly from Firestore
          const docRef = doc(db, "Bidding_Products", document.id);
          deleteDoc(docRef).catch((error) => {
            console.error("Error auto-deleting 0kg product: ", error);
          });
        } else {
          // If weight is normal, push it into the active listing array
          fetchedProducts.push({
            id: document.id,
            ...data,
            name: data.name || data.productName || "Unnamed Product",
          });
        }
      });

      setProducts(fetchedProducts);
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
      <StatusBar hidden={false} />

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
      <View style={[styles.searchDateContainer, { zIndex: 50 }]}>
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

        {/* CUSTOM DROPDOWN */}
        <View style={styles.datePickerWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.dropdownButton}
            onPress={() => setDropdownOpen(!dropdownOpen)}
          >
            <Text style={styles.dropdownText}>
              🗓️ {dateFilter}
            </Text>
            <Text style={styles.dropdownArrow}>
              {dropdownOpen ? "▲" : "▼"}
            </Text>
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownMenu}>
              {["All", "Today", "Yesterday"].map((item, index) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.dropdownItem,
                    index !== 2 && { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }
                  ]}
                  onPress={() => {
                    setDateFilter(item);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    dateFilter === item && { color: "#4f46e5", fontWeight: "700" }
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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

      {/* CREATE FORM MODAL */}
      {showCreateProductModal && (
        <CreateProductBiddingForm
          onCancel={() => setShowCreateProductModal(false)}
          onSubmit={() => setShowCreateProductModal(false)}
        />
      )}
      
      {/* EDIT FORM MODAL */}
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
  container: { flex: 1, backgroundColor: "#f8fafc", marginTop: 35 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, backgroundColor: "#1e3a8a", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "#fff", marginTop: 2 },
  badge: { backgroundColor: "#3b82f6", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerCount: { fontSize: 13, fontWeight: "700", color: "#fff" },
  searchDateContainer: { flexDirection: "row", paddingHorizontal: 16, marginTop: 16, alignItems: "center", gap: 10 },
  searchBar: { flex: 1, flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, alignItems: "center", height: 50, borderWidth: 1, borderColor: "#e2e8f0" },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#0f172a", fontWeight: "500" },
  datePickerWrapper: { width: 130, height: 50, position: 'relative' },
  dropdownButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, height: 50, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", width: "100%" },
  dropdownText: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  dropdownArrow: { fontSize: 10, color: "#94a3b8" },
  dropdownMenu: { position: "absolute", top: 55, left: 0, right: 0, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", zIndex: 1000, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 4, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 15, backgroundColor: '#fff' },
  dropdownItemText: { fontSize: 14, color: "#475569", fontWeight: "500" },
  categoryContainer: { marginVertical: 14},
  categoryListContent: { paddingHorizontal: 16, gap: 12, justifyContent: "space-between" },
  categoryItem: { flexDirection: "column", alignItems: "center", flex: 1 },
  categoryItemActive: {},
  categoryIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  categoryIconBoxActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  categoryIcon: { width: 26, height: 26, resizeMode: "contain" },
  categoryIconActive: {},
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
  actionText: { fontSize: 14, fontWeight: "700", color: "#0f172a" }
});