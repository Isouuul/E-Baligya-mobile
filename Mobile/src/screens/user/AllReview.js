import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function AllReviews() {
  const navigation = useNavigation();
  const route = useRoute();
  const { reviews, averageRating, totalRatings, businessName } = route.params;

  const [activeFilter, setActiveFilter] = useState("All");

  // --- Logic: Calculate Rating Distribution ---
  const distribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
    });
    return counts;
  }, [reviews]);

  // --- Logic: Filtered List ---
  const filteredReviews = useMemo(() => {
    if (activeFilter === "All") return reviews;
    return reviews.filter((r) => r.rating === parseInt(activeFilter));
  }, [activeFilter, reviews]);

  const RatingBar = ({ label, count }) => {
    const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
    return (
      <View style={styles.barContainer}>
        <Text style={styles.barLabel}>{label}</Text>
        <Ionicons name="star" size={12} color="#FBBF24" style={{ marginHorizontal: 4 }} />
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.barCount}>{count}</Text>
      </View>
    );
  };

  const renderReviewCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.userName?.[0] || "U"}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.userName}>{item.userName || "Verified Buyer"}</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name="star"
                size={14}
                color={s <= item.rating ? "#FBBF24" : "#E2E8F0"}
              />
            ))}
            <Text style={styles.dateText}>
               • {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Recent'}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.feedbackText}>{item.feedback || "No comment provided."}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews for {businessName}</Text>
      </View>

      <FlatList
        data={filteredReviews}
        keyExtractor={(item) => item.id}
        renderItem={renderReviewCard}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={() => (
          <View style={styles.summarySection}>
            <View style={styles.ratingOverview}>
              <View style={styles.bigRatingContainer}>
                <Text style={styles.bigRatingText}>{averageRating.toFixed(1)}</Text>
                <Text style={styles.totalText}>out of 5</Text>
                <Text style={styles.subTotalText}>{totalRatings} Ratings</Text>
              </View>
              <View style={styles.barsColumn}>
                {[5, 4, 3, 2, 1].map((num) => (
                  <RatingBar key={num} label={num} count={distribution[num]} />
                ))}
              </View>
            </View>

{/* Filter Chips - Slim Single Row */}
<View style={styles.filterWrapper}>
  {["All", "5", "4", "3", "2", "1"].map((f) => (
    <TouchableOpacity
      key={f}
      onPress={() => setActiveFilter(f)}
      style={[styles.chip, activeFilter === f && styles.activeChip]}
    >
      <Text style={[styles.chipText, activeFilter === f && styles.activeChipText]}>
        {f === "All" ? "All" : `${f}★`}
      </Text>
    </TouchableOpacity>
  ))}
</View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", marginTop: 30 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E3A8A", marginLeft: 12 },
  summarySection: { backgroundColor: "#FFF", padding: 20, marginBottom: 12 },
  ratingOverview: { flexDirection: "row", alignItems: "center" },
  bigRatingContainer: { alignItems: "center", marginRight: 24 },
  bigRatingText: { fontSize: 48, fontWeight: "800", color: "#1E3A8A" },
  totalText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  subTotalText: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  barsColumn: { flex: 1 },
  barContainer: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel: { fontSize: 12, color: "#64748B", width: 10 },
  track: { flex: 1, height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#FBBF24" },
  barCount: { fontSize: 12, color: "#94A3B8", width: 25, textAlign: "right" },
filterWrapper: {
  flexDirection: "row",
  justifyContent: "space-between", // Distributes them evenly
  marginTop: 20,
  paddingHorizontal: 16, // Match your screen margins
},
chip: {
  paddingHorizontal: 8,  // Reduced from 16
  paddingVertical: 6,    // Reduced from 8
  borderRadius: 12,      // Slightly more compact radius
  backgroundColor: "#F1F5F9",
  borderWidth: 1,
  borderColor: "#E2E8F0",
  flex: 1,               // Makes all buttons equal width
  marginHorizontal: 2,   // Tiny space between buttons
  alignItems: 'center',
  justifyContent: 'center',
},
activeChip: {
  backgroundColor: "#1E3A8A",
  borderColor: "#1E3A8A",
},
chipText: {
  color: "#64748B",
  fontWeight: "600",
  fontSize: 11,          // Reduced from 13 to fit "All" and "5★"
},
activeChipText: {
  color: "#FFF",
},
  card: { backgroundColor: "#FFF", padding: 16, marginHorizontal: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, borderBottomWidth: 0.2, borderBottomColor: "#E2E8F0", paddingBottom: 5
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#1E3A8A", fontWeight: "700" },
  userName: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
  starRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  dateText: { fontSize: 12, color: "#94A3B8", marginLeft: 8 },
  feedbackText: { fontSize: 14, color: "#475569", lineHeight: 20, marginLeft: 50 },
});