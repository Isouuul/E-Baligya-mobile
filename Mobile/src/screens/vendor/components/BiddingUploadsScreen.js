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

  // FAB menu animation matching your structured interpolation
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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bidding Products</Text>
          <Text style={styles.headerSubtitle}>Manage your active ebaligya auctions</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.headerCount}>{filtered.length} Items</Text>
        </View>
      </View>

      {/* Modern Search & Date Filter Bar */}
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
            dropdownIconColor="#4f46e5"
          >
            <Picker.Item label="🗓️ All" value="All" color="#0f172a" style={styles.pickerItem} />
            <Picker.Item label="🗓️ Today" value="Today" color="#0f172a" style={styles.pickerItem} />
            <Picker.Item label="🗓️ Yesterday" value="Yesterday" color="#0f172a" style={styles.pickerItem} />
          </Picker>
        </View>
      </View>

      {/* Box-based Category Filters with Icon and Title */}
      <View style={styles.categoryContainer}>
        <FlatList
          scrollEnabled={false}
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
                activeOpacity={0.8}
              >
                <View style={[styles.categoryIconBox, isSelected && styles.categoryIconBoxActive]}>
                  <Image source={item.icon} style={[styles.categoryIcon, isSelected && styles.categoryIconActive]} />
                </View>
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Clean Dynamic Product Canvas */}
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Image
            source={require("../../../../assets/no-order.png")}
            style={styles.noProductsImage}
          />
          <Text style={styles.noProductsText}>No bidding items found matching criteria</Text>
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

      {/* Floating Action Menu Panel */}
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
            <Text style={styles.actionText}>🛍️   Create New Auction</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Premium Gradient Style FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => setModalVisible(!modalVisible)}
      >
        <Text style={styles.fabText}>{modalVisible ? "✕" : "＋"}</Text>
      </TouchableOpacity>

      {/* Create Product Bottom Sheet Modal */}
      <Modal
        visible={showCreateProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateProductModal(false)}
      >
        <View style={styles.floatingModalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismissOverlay} 
            activeOpacity={1} 
            onPress={() => setShowCreateProductModal(false)} 
          />
          <View style={styles.floatingModalContent}>
            <View style={styles.modalGrabber} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Create New Auction</Text>
                <Text style={styles.modalSubtitle}>Fill in details to start a fresh listing</Text>
              </View>
              <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowCreateProductModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <CreateProductBiddingForm onSubmit={() => setShowCreateProductModal(false)} />
              </KeyboardAvoidingView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

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
  categoryContainer: { marginVertical: 14 },
  categoryListContent: { paddingHorizontal: 16, gap: 12, justifyContent: "space-between" },
  categoryItem: { flexDirection: "column", alignItems: "center", flex: 1 },
  categoryItemActive: {},
  categoryIconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  categoryIconBoxActive: { backgroundColor: "#03A9F4", borderColor: "#87CEFA" },
  categoryIcon: { width: 26, height: 26, resizeMode: "contain" },
  categoryIconActive: {  },
  categoryText: { fontSize: 12, fontWeight: "600", color: "#64748b", textAlign: "center" },
  categoryTextActive: { color: "#4f46e5" },
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

export default BiddingUploadsScreen;