// src/components/ProductBiddingCard.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { db, auth } from "../../../firebase";
import {
  doc,
  deleteDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";

import TrashIcon from "../../../../assets/Trash.png";
import EditIcon from "../../../../assets/Edit.png";

const { width } = Dimensions.get("window");

const ProductBiddingCard = ({ product, onEdit }) => {  const navigation = useNavigation();
  const [timeLeft, setTimeLeft] = useState("");
  const [archived, setArchived] = useState(false);

  const currentUserUid = auth.currentUser?.uid;
  const productUploaderUid = product?.uploadedBy?.uid;

  // -----------------------------
  // 🧠 Normalize Data
  // -----------------------------
  const normalizedFreshness = (product?.freshness || "Unknown")
    .replace("Freshness:", "")
    .trim();

  const isFresh = normalizedFreshness.toLowerCase() === "fresh";
  const isRotten = normalizedFreshness.toLowerCase() === "rotten";

  const displayPrice = product?.basePrice
    ? product.basePrice.toLocaleString()
    : "0";

  const displayStock =
    product?.remainingQuantity ?? product?.totalQuantity ?? 0;

  // -----------------------------
  // 🧠 Bidding Type
  // -----------------------------
  const biddingType = product?.bidType || "fixed_qty";
  const isBulkAuction = biddingType === "wholesale";

  const bidIncrement = product?.bidIncrement || 1;
  const bulkUnitsAvailable =
    product?.bulkUnitsAvailable ||
    Math.floor(displayStock / bidIncrement);

  // -----------------------------
  // 📦 Archive (Reusable)
  // -----------------------------
  const archiveProduct = async (statusType = "manual") => {
    if (archived) return;

    try {
      await setDoc(doc(db, "Archived_BiddingProduct", product.id), {
        ...product,
        archivedAt: Timestamp.now(),
        status: statusType,
      });

      await deleteDoc(doc(db, "Bidding_Products", product.id));

      setArchived(true);
    } catch (error) {
      console.error("Archive error:", error);
    }
  };

  // -----------------------------
  // ⏱ Countdown + Auto Archive
  // -----------------------------
  useEffect(() => {
    if (!product?.overallAuctionEndsAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const auctionEnd = product.overallAuctionEndsAt.toDate();

      if (now >= auctionEnd) {
        setTimeLeft("Auction Ended");
        archiveProduct("expired");
        return false;
      }

      const diff = auctionEnd - now;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor(
        (diff % (1000 * 60 * 60)) / (1000 * 60)
      );
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      } else if (mins > 0) {
        setTimeLeft(`${mins}m ${secs}s`);
      } else {
        setTimeLeft(`${secs}s`);
      }

      return true;
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [product?.overallAuctionEndsAt]);

  // -----------------------------
  // 🚫 Hide if not owner
  // -----------------------------
  if (
    !product ||
    !currentUserUid ||
    currentUserUid !== productUploaderUid ||
    archived
  )
    return null;

  const isAuctionEnded = timeLeft === "Auction Ended";

  // -----------------------------
  // 🗑 Remove (Archive instead)
  // -----------------------------
  const handleRemove = () => {
    Alert.alert(
      "Remove Product",
      "Move this product to archive?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: () => archiveProduct("manually_removed"),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        navigation.navigate("ViewClickBid", { bidding: product })
      }
      style={styles.container}
    >
      <View style={styles.card}>
        {/* LEFT */}
        <View style={styles.leftSection}>
          {product.imageBase64 ? (
            <Image
              source={{ uri: product.imageBase64 }}
              style={styles.image}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text>No Image</Text>
            </View>
          )}

          <View
            style={[
              styles.batchTag,
              isAuctionEnded && styles.tagEnded,
            ]}
          >
            <Text style={styles.tagText}>
              {isAuctionEnded ? "Expired" : "Active"}
            </Text>
          </View>

          <View
            style={[
              styles.biddingTypeTag,
              isBulkAuction ? styles.bulkTag : styles.fixedTag,
            ]}
          >
            <Text style={styles.biddingTypeText}>
              {isBulkAuction ? "Bulk" : "Fixed"}
            </Text>
          </View>
        </View>

        {/* RIGHT */}
        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.productName}
            </Text>

            <View
              style={[
                styles.pill,
                isFresh
                  ? styles.freshPill
                  : isRotten
                  ? styles.rottenPill
                  : styles.unknownPill,
              ]}
            >
              <Text style={styles.pillText}>
                {normalizedFreshness}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statLabel}>
                {isBulkAuction ? "Base Price" : "Starting Price"}
              </Text>
              <Text style={styles.statValue}>
                ₱{displayPrice}
                {isBulkAuction ? "/unit" : ""}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.statLabel}>
                {isBulkAuction ? "Units Available" : "Total Stock"}
              </Text>
              <Text style={styles.statValue}>
                {isBulkAuction
                  ? bulkUnitsAvailable
                  : displayStock}
                {isBulkAuction ? " units" : " kg"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.timerBox,
              isAuctionEnded && styles.timerBoxEnded,
            ]}
          >
            <Text style={styles.timerLabel}>Countdown:</Text>
            <Text
              style={[
                styles.timerValue,
                isAuctionEnded && styles.timerValueEnded,
              ]}
            >
              {timeLeft}
            </Text>
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
<TouchableOpacity
  onPress={(e) => {
    e.stopPropagation();
    onEdit?.(product); // send to parent screen
  }}
  style={[
    styles.btn,
    styles.editBtn,
    isAuctionEnded && styles.disabled,
  ]}
  disabled={isAuctionEnded}
>
  <Image source={EditIcon} style={styles.btnIcon} />
  <Text style={styles.btnText}>Edit</Text>
</TouchableOpacity>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              style={[styles.btn, styles.deleteBtn]}
            >
              <Image source={TrashIcon} style={styles.btnIcon} />
              <Text style={styles.btnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ProductBiddingCard;

// -----------------------------
// 🎨 STYLES
// -----------------------------
const styles = StyleSheet.create({
  container: { marginBottom: 16, marginHorizontal: 16 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    flexDirection: "row",
    padding: 12,
    elevation: 5,
  },

  leftSection: { width: 110, height: 155, position: "relative" },

  image: { width: "100%", height: "100%", borderRadius: 15 },

  placeholder: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    borderRadius: 15,
  },

  batchTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#1e3a8a",
    padding: 4,
    borderRadius: 6,
  },

  tagEnded: { backgroundColor: "#ef4444" },

  tagText: { color: "#fff", fontSize: 10 },

  biddingTypeTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    padding: 4,
    borderRadius: 6,
  },

  bulkTag: { backgroundColor: "#22c55e" },
  fixedTag: { backgroundColor: "#3b82f6" },

  biddingTypeText: { color: "#fff", fontSize: 10 },

  infoContainer: { flex: 1, marginLeft: 10 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  productName: { fontWeight: "700", fontSize: 15 },

  pill: { padding: 4, borderRadius: 6 },

  freshPill: { backgroundColor: "#dcfce7" },
  rottenPill: { backgroundColor: "#fee2e2" },
  unknownPill: { backgroundColor: "#eee" },

  pillText: { fontSize: 10 },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  statLabel: { fontSize: 10, color: "#666" },
  statValue: { fontWeight: "700" },

  timerBox: {
    marginTop: 10,
    padding: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  timerBoxEnded: { backgroundColor: "#fee2e2" },

  timerLabel: { fontSize: 10 },
  timerValue: { fontWeight: "800" },

  timerValueEnded: { color: "#ef4444" },

  actions: { flexDirection: "row", marginTop: 10, gap: 6 },

  btn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    padding: 8,
    borderRadius: 8,
  },

  editBtn: { backgroundColor: "#e2e8f0" },
  deleteBtn: { backgroundColor: "#fee2e2" },

  btnIcon: { width: 14, height: 14, marginRight: 4 },

  btnText: { fontSize: 12 },

  disabled: { opacity: 0.5 },
});