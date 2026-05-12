// src/screens/Users/ViewShop.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from "../../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as FileSystem from "expo-file-system";
import AddToBasketIcon from "../../../assets/add-to-basket.png";
import AddingCartModal from "./AddingCartModal";
import ReportModal from "./ReportModal";

const { width } = Dimensions.get('window');

export default function ViewShop() {
  const route = useRoute();
  const navigation = useNavigation();
  const { vendorId } = route.params;

  // --- State Management ---
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorProfileImage, setVendorProfileImage] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [businessName, setBusinessName] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportProduct, setReportProduct] = useState(null);

  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [category, setCategory] = useState("All");

  // --- Follow / Unfollow Logic ---
const handleToggleFollow = async () => {
  if (!auth.currentUser) {
    showSileo({
      title: 'Login Required',
      message: 'Please sign in to follow this shop.',
      type: 'info'
    });
    return;
  }

  try {
    // 1. Find the Vendor Document ID first
    const vendorQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", vendorId));
    const vendorSnap = await getDocs(vendorQuery);
    
    if (vendorSnap.empty) return;
    const vendorDocId = vendorSnap.docs[0].id;
    const followRef = doc(db, "ApprovedVendors", vendorDocId, "followers", auth.currentUser.uid);

    if (isFollowing) {
      // UNFOLLOW: Delete the user's ID from the followers subcollection
      await deleteDoc(followRef);
    } else {
      // FOLLOW: Add the user's ID and timestamp
      await setDoc(followRef, {
        followedAt: new Date(),
        userEmail: auth.currentUser.email
      });
    }
  } catch (error) {
    console.error("Follow error:", error);
  }
};

  // --- Helper Functions ---
  const Base64Image = ({ base64, productId, style }) => {
    const [localUri, setLocalUri] = useState(null);
    useEffect(() => {
      const saveToFile = async () => {
        if (!base64) return;
        const fileUri = FileSystem.cacheDirectory + `${productId}.jpg`;
        try {
          const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
          await FileSystem.writeAsStringAsync(fileUri, cleanBase64, { encoding: FileSystem.EncodingType.Base64 });
          setLocalUri(fileUri);
        } catch (err) { console.log(err); }
      };
      saveToFile();
    }, [base64]);
    if (!localUri) return <View style={[style, { backgroundColor: '#F3F4F6' }]} />;
    return <Image source={{ uri: localUri }} style={style} />;
  };

  // --- Data Loading ---
  useEffect(() => {
    if (!vendorId) return;

    const loadData = async () => {
      try {
        const vendorQuery = query(collection(db, "ApprovedVendors"), where("userId", "==", vendorId));
        const vendorSnap = await getDocs(vendorQuery);
        if (vendorSnap.empty) return;

        const vendorDoc = vendorSnap.docs[0];
        const vendorDocId = vendorDoc.id;
        const vendorData = vendorDoc.data();
        setVendorProfileImage(vendorData.profileImage || null);

        // Real-time Listeners
        const unsubFollowers = onSnapshot(collection(db, "ApprovedVendors", vendorDocId, "followers"), (snap) => {
          setFollowersCount(snap.size);
          if (auth.currentUser) setIsFollowing(snap.docs.some(d => d.id === auth.currentUser.uid));
        });

        const unsubProducts = onSnapshot(query(collection(db, "Products"), where("uploadedBy.uid", "==", vendorId)), (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setProducts(list);
          setBusinessName(list[0]?.uploadedBy?.businessName || vendorData.businessName || "Shop");
          setLoading(false);
        });

        const unsubRatings = onSnapshot(collection(db, "ApprovedVendors", vendorDocId, "Rating"), (snap) => {
          const reviewsList = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setReviews(reviewsList);
          if (reviewsList.length > 0) {
            const sum = reviewsList.reduce((acc, r) => acc + (r.rating || 0), 0);
            setAverageRating(sum / reviewsList.length);
            setTotalRatings(reviewsList.length);
          }
        });

        return () => { unsubFollowers(); unsubProducts(); unsubRatings(); };
      } catch (err) { console.log(err); }
    };
    loadData();
  }, [vendorId]);

  useEffect(() => {
    setFilteredProducts(category === "All" ? products : products.filter(p => p.category === category));
  }, [category, products]);

  // --- Render Functions ---
  const renderReviewItem = (item) => (
    <View key={item.id} style={styles.reviewCard}>
      <View style={styles.reviewerInfo}>
        <View style={styles.reviewerAvatar}><Text style={styles.avatarText}>{item.userName?.[0] || 'U'}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewerName}>{item.userName || "Verified Buyer"}</Text>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map(s => <Ionicons key={s} name="star" size={10} color={s <= item.rating ? "#FBBF24" : "#E2E8F0"} />)}
            <Text style={styles.reviewDate}>{item.createdAt?.toDate().toLocaleDateString()}</Text>
          </View>
        </View>
      </View>
      <Text style={item.feedback ? styles.reviewComment : styles.noCommentText}>{item.feedback || "."}</Text>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E3A8A" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER */}
      <View style={styles.customHeader}>
        <TouchableOpacity style={styles.iconCircle} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color="#1E3A8A" /></TouchableOpacity>
        <View style={styles.headerTitleWrap}><Text style={styles.headerTitleText}>{businessName}</Text><Text style={styles.headerSubTitle}>Vendor Profile</Text></View>
        <TouchableOpacity style={styles.iconCircle} onPress={() => setReportModalVisible(true)}><Image source={require("../../../assets/Alert.png")} style={styles.headerIcon} resizeMode="contain" /></TouchableOpacity>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={() => (
          <>
            <View style={styles.vendorSection}>
              <Text style={styles.sectionLabel}>Shop Overview</Text>
              <View style={styles.vendorContainer}>
                <View style={styles.vendorImageWrapper}>
                  {vendorProfileImage ? <Image source={{ uri: vendorProfileImage }} style={styles.vendorImage} /> : <View style={styles.vendorPlaceholder}><Text style={styles.placeholderChar}>{businessName?.[0]}</Text></View>}
                  {isFollowing && <View style={styles.followedBadge}><Ionicons name="checkmark-circle" size={14} color="#3B82F6" /></View>}
                </View>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName} numberOfLines={1}>{businessName}</Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.followerText}>{followersCount} Followers</Text>
                    <View style={styles.dividerDot} />
                    <View style={styles.ratingBox}><Ionicons name="star" size={12} color="#FBBF24" /><Text style={styles.ratingText}>{averageRating.toFixed(1)} ({totalRatings})</Text></View>
                  </View>
                </View>
<TouchableOpacity 
  onPress={handleToggleFollow} // Updated this
  style={[styles.followBtn, isFollowing && styles.followingBtn]}
>
  <Text style={[styles.followText, isFollowing && styles.followingText]}>
    {isFollowing ? "Following" : "Follow"}
  </Text>
</TouchableOpacity>
              </View>
            </View>

            <View style={styles.categoryContainer}>
              <Text style={[styles.sectionLabel, { marginLeft: 16, marginBottom: 10 }]}>Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                {[{ name: "All", icon: require("../../../assets/all.png") }, { name: "Fish", icon: require("../../../assets/Fish.png") }, { name: "Mollusk", icon: require("../../../assets/mollusk.png") }, { name: "Crustacean", icon: require("../../../assets/Crustacean.png") }].map((cat, i) => (
                  <TouchableOpacity key={i} style={[styles.categoryButton, category === cat.name && styles.activeCategoryButton]} onPress={() => setCategory(cat.name)}>
                    <Image source={cat.icon} style={styles.categoryIcon} /><Text style={[styles.categoryButtonText, category === cat.name && styles.activeCategoryText]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={[styles.sectionLabel, { marginLeft: 16, marginTop: 10 }]}>Available Products</Text>
          </>
        )}
        renderItem={({ item }) => (
          <View style={[styles.productCardRow, { marginHorizontal: 16 }]}>
{/* 1. Wrap the image and the badge in a View */}
  <View style={styles.imageContainer}>
    <Base64Image 
      base64={item.imageBase64} 
      productId={item.id} 
      style={styles.productImageRow} 
    />
    {/* 2. Move the category here */}
    <View style={styles.categoryBadge}>
      <Text style={styles.productCategoryText}>{item.category}</Text>
    </View>
  </View>
              <View style={styles.productInfoRow}>
              <Text numberOfLines={1} style={styles.productNameRow}>{item.productName}</Text>
              <Text style={styles.productPriceRow}>₱{item.basePrice}<Text style={styles.unitText}>/kg</Text></Text>
            </View>
            <View style={styles.buttonColumnRow}>
  {/* Add to Cart Button */}
  <TouchableOpacity 
    style={styles.addToCartBtnRow} 
    onPress={() => { setSelectedProduct(item); setModalVisible(true); }}
  >
    <Text style={[styles.buyNowText, { color: '#3B82F6' }]}>Add to Cart</Text>
  </TouchableOpacity>

  {/* Buy Now Button */}
  <TouchableOpacity 
    style={styles.buyNowBtn} 
    onPress={() => navigation.navigate("BuyNowCheckedOut", { product: item, quantity: 1 })}
  >
    <Text style={styles.buyNowText}>Buy Now</Text>
  </TouchableOpacity>

  {/* Report Button */}
  <TouchableOpacity 
    style={styles.reportBtn}
    onPress={() => { setReportProduct(item); setReportModalVisible(true); }}
  >
    <Ionicons name="flag-outline" size={14} color="#EF4444" />
  </TouchableOpacity>
</View>
          </View>
        )}
ListFooterComponent={() => (
  <View style={styles.reviewsSection}>
    <View style={styles.reviewSectionHeader}>
      <Text style={styles.sectionLabel}>Customer Reviews</Text>
      
      {/* clickable See All button */}
      {reviews.length > 0 && (
        <TouchableOpacity 
          onPress={() => navigation.navigate("AllReviews", {
            reviews: reviews,
            averageRating: averageRating,
            totalRatings: totalRatings,
            businessName: businessName
          })}
        >
          <Text style={styles.seeAllText}>See All ({totalRatings})</Text>
        </TouchableOpacity>
      )}
    </View>

    {reviews.length > 0 ? (
      // We use .slice(0, 3) to only show the 3 most recent reviews here
      reviews.slice(0, 3).map(renderReviewItem)
    ) : (
      <View style={styles.emptyReviewBox}>
        <Text style={styles.emptyReviewText}>No reviews yet.</Text>
      </View>
    )}
  </View>
)}
      />

      <AddingCartModal visible={modalVisible} onClose={() => setModalVisible(false)} product={selectedProduct} selectedVariation={selectedVariation} setSelectedVariation={setSelectedVariation} selectedServices={selectedServices} setSelectedServices={setSelectedServices} />

      <ReportModal 
        visible={reportModalVisible} 
        onClose={() => {
          setReportModalVisible(false);
          setReportProduct(null);
        }} 
        productId={reportProduct?.id} 
        productName={reportProduct?.productName} 
        product={reportProduct} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF",marginTop: 30 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  customHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitleText: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },
  headerSubTitle: { fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 20, height: 20 },
  vendorSection: { padding: 16 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  vendorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  vendorImageWrapper: { position: 'relative' },
  vendorImage: { width: 60, height: 60, borderRadius: 30 },
  vendorPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  placeholderChar: { fontSize: 24, fontWeight: 'bold', color: '#64748B' },
  followedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 2 },
  vendorInfo: { flex: 1, marginLeft: 12 },
  vendorName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  followerText: { fontSize: 12, color: '#64748B' },
  dividerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1', marginHorizontal: 8 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#D97706', marginLeft: 3 },
  followBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  followingBtn: { backgroundColor: '#F1F5F9' },
  followText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  followingText: { color: '#64748B' },
  categoryContainer: { marginTop: 10 },
  categoryScroll: { paddingLeft: 16, paddingRight: 8 },
  categoryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  activeCategoryButton: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  categoryIcon: { width: 20, height: 20, marginRight: 8 },
  categoryButtonText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  activeCategoryText: { color: '#FFF' },
  productCardRow: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  productImageRow: { width: 80, height: 80, borderRadius: 12 },
  productInfoRow: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  productNameRow: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  productCategory: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  productPriceRow: { fontSize: 16, fontWeight: '800', color: '#1E3A8A', marginTop: 6 },
  unitText: { fontSize: 11, color: '#64748B', fontWeight: '400' },
buttonColumnRow: { justifyContent: 'center',width: 100},
addToCartBtnRow: {
    width: '100%',             // Make it fill the 100px width
    paddingVertical: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    marginBottom: 6,           // Gap between buttons
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE'
  },  addIconRow: { width: 20, height: 20 },
buyNowBtn: { 
    width: '100%',             // Match the width of the Add to Cart button
    backgroundColor: '#1E3A8A', 
    paddingVertical: 8, 
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
buyNowText: { 
    color: '#FFF', 
    fontSize: 11, 
    fontWeight: '700' 
  },
  reportBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
    reviewsSection: { padding: 16, marginTop: 10 },
  reviewSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  seeAllText: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },
  reviewCard: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 12 },
  reviewerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { color: '#4338CA', fontWeight: '700', fontSize: 12 },
  reviewerName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  reviewStars: { flexDirection: 'row', alignItems: 'center' },
  reviewDate: { fontSize: 10, color: '#94A3B8', marginLeft: 8 },
  reviewComment: { fontSize: 13, color: '#475569', lineHeight: 18 },
  noCommentText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  emptyReviewBox: { padding: 20, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12 },
  emptyReviewText: { color: '#94A3B8', fontSize: 13 },
imageContainer: {
    position: 'relative', // Keeps the absolute child inside these bounds
  },
  categoryBadge: {
    position: 'absolute',
    marginTop: 70,      // 8 pixels from the top of the image
    left: 25,     // 8 pixels from the left of the image
    backgroundColor: "#1e3a8a", // Semi-transparent black
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productCategoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  
});