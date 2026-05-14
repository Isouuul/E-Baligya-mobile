import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView } from "react-native";
import { db, auth } from "../../../firebase";
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import * as FileSystem from "expo-file-system";

import EditIcon from "../../../../assets/Edit.png";
import TrashIcon from "../../../../assets/Trash.png";
import EditProductForm from "./EditProductForm";

const Base64Image = ({ base64, productId, style }) => {
  const [localUri, setLocalUri] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fileUri = `${FileSystem.cacheDirectory}${productId}.jpg`;

    const saveToFile = async () => {
      if (!base64) return;
      try {
        const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (isMounted) {
          setLocalUri(fileUri);
        }
      } catch (err) {
        console.error("Error saving base64 image:", err);
      }
    };

    saveToFile();

    return () => {
      isMounted = false;
      // Self-cleaning: Optional cache cleanup if desired to save disk space
    };
  }, [base64, productId]);

  if (!localUri) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <Text style={styles.placeholderText}>Loading...</Text>
      </View>
    );
  }

  return <Image source={{ uri: localUri }} style={style} />;
};

const ProductCard = ({ product }) => {
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [archived, setArchived] = useState(false);

  const currentUserUid = auth.currentUser ? auth.currentUser.uid : null;
  const productUploaderUid = product.uploadedBy?.uid;
  const normalizedFreshness = (product?.uploadedBy?.freshness || product?.freshness || "Unknown")
    .replace("Freshness:", "")
    .trim();
  const isFresh = normalizedFreshness.toLowerCase() === "fresh";
  const isRotten = normalizedFreshness.toLowerCase() === "rotten";
  
  const formattedPrice = Number.isFinite(Number(product?.basePrice))
    ? Number(product.basePrice).toLocaleString()
    : "--";
  const formattedQuantity = Number.isFinite(Number(product?.quantityKg))
    ? Number(product.quantityKg)
    : 0;

  useEffect(() => {
    const archiveIfZero = async () => {
      if (product.quantityKg <= 0 && !archived) {
        try {
          await setDoc(doc(db, "Archived_Products", product.id), product);
          await deleteDoc(doc(db, "Products", product.id));
          setArchived(true);
        } catch (error) {
          console.error("Error archiving product:", error);
        }
      }
    };
    archiveIfZero();
  }, [product.quantityKg, archived]);

  if (!currentUserUid || currentUserUid !== productUploaderUid || archived) return null;

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "Products", product.id));
      setDeleteVisible(false);
    } catch (error) {
      console.error("Error deleting product:", error);
      setDeleteVisible(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.leftSection}>
        {product.imageBase64 ? (
          <Base64Image base64={product.imageBase64} productId={product.id} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>📸 No Image</Text>
          </View>
        )}
        <View style={styles.imageTag}>
          <Text style={styles.imageTagText}>{product?.category || "Product"}</Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.topRow}>
          <Text style={styles.productName} numberOfLines={1}>
            {product.productName || "Unnamed Product"}
          </Text>
          <View
            style={[
              styles.freshnessPill,
              isFresh ? styles.freshPill : isRotten ? styles.rottenPill : styles.unknownPill,
            ]}
          >
            <Text 
              style={[
                styles.freshnessText,
                isFresh ? styles.freshText : isRotten ? styles.rottenText : styles.unknownText
              ]}
            >
              {normalizedFreshness}
            </Text>
          </View>
        </View>

        {product.description && (
          <Text style={styles.description} numberOfLines={2}>
            {product.description}
          </Text>
        )}

        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Base Price</Text>
            <Text style={styles.price}>₱{formattedPrice}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Stock Available</Text>
            <Text style={styles.quantity}>{formattedQuantity} kg</Text>
          </View>
        </View>

        {product.uploadedBy?.businessName && (
          <Text style={styles.uploader} numberOfLines={1}>
            🏪 {product.uploadedBy.businessName}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => setEditVisible(true)}
            style={[styles.actionBtn, styles.editBtn]}
            activeOpacity={0.7}
          >
            <Image source={EditIcon} style={styles.iconImage} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDeleteVisible(true)}
            style={[styles.actionBtn, styles.deleteBtn]}
            activeOpacity={0.7}
          >
            <Image source={TrashIcon} style={[styles.iconImage, styles.deleteIconColor]} />
            <Text style={[styles.actionText, styles.deleteActionText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={styles.deleteModalBackground}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteIconWrap}>
              <Image source={TrashIcon} style={styles.deleteIcon} />
            </View>
            <Text style={styles.deleteTitle}>Delete Product?</Text>
            <Text style={styles.deleteText}>
              This will permanently remove this listing from active sales. This action is irreversible.
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteActionBtn, styles.cancelDeleteBtn]}
                onPress={() => setDeleteVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteActionBtn, styles.confirmDeleteBtn]}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{/* Edit Product Layout Portal */}
{editVisible && (
  <EditProductForm
    product={product}
    onCancel={() => setEditVisible(false)}
  />
)}
    </View>
  );
};

export default ProductCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  leftSection: {
    marginRight: 14,
    position: "relative",
  },
  image: {
    width: 108,
    height: 108,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  imagePlaceholder: {
    width: 108,
    height: 108,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { 
    color: "#94A3B8", 
    fontSize: 11, 
    fontWeight: "600" 
  },
  imageTag: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  imageTagText: { 
    color: "#FFFFFF", 
    fontSize: 9, 
    fontWeight: "700", 
    textTransform: "uppercase", 
    letterSpacing: 0.5 
  },
  infoContainer: { 
    flex: 1, 
    justifyContent: "space-between" 
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  productName: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: "800", 
    color: "#0F172A" 
  },
  freshnessPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  freshPill: { 
    backgroundColor: "#DCFCE7", 
    borderColor: "#86EFAC" 
  },
  rottenPill: { 
    backgroundColor: "#FEE2E2", 
    borderColor: "#FCA5A5" 
  },
  unknownPill: { 
    backgroundColor: "#F1F5F9", 
    borderColor: "#CBD5E1" 
  },
  freshnessText: { 
    fontSize: 10, 
    fontWeight: "800" 
  },
  freshText: { color: "#166534" },
  rottenText: { color: "#991B1B" },
  unknownText: { color: "#475569" },

  description: { 
    fontSize: 12.5, 
    color: "#64748B", 
    lineHeight: 16, 
    fontWeight: "500",
    marginBottom: 8,
  },
  metricsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: "70%",
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
  },
  metricLabel: { 
    fontSize: 9, 
    color: "#94A3B8", 
    fontWeight: "700", 
    textTransform: "uppercase", 
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  price: { 
    fontSize: 15, 
    fontWeight: "800", 
    color: "#16A34A" 
  },
  quantity: { 
    fontSize: 14, 
    fontWeight: "800", 
    color: "#1E3A8A" 
  },
  uploader: { 
    fontSize: 11, 
    color: "#64748B", 
    fontWeight: "600",
    marginBottom: 8,
  },
  actionsRow: { 
    flexDirection: "row", 
    justifyContent: "flex-start",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  editBtn: { 
    borderColor: "#E2E8F0", 
    backgroundColor: "#FFFFFF" 
  },
  deleteBtn: { 
    borderColor: "#FEE2E2", 
    backgroundColor: "#FEF2F2" 
  },
  iconImage: { 
    width: 14, 
    height: 14, 
    resizeMode: "contain", 
    marginRight: 6 
  },
  deleteIconColor: {
  },
  actionText: { 
    color: "#334155", 
    fontWeight: "700", 
    fontSize: 12 
  },
  deleteActionText: {
    color: "#EF4444",
  },

  /* Modals */
  deleteModalBackground: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteModalContainer: {
    width: "84%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  deleteIcon: { 
    width: 24, 
    height: 24,
  },
  deleteTitle: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: "#0F172A", 
    marginBottom: 8 
  },
  deleteText: { 
    fontSize: 13.5, 
    color: "#64748B", 
    textAlign: "center", 
    marginBottom: 20, 
    lineHeight: 19 
  },
  deleteActions: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    width: "100%",
    gap: 10,
  },
  deleteActionBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 10, 
    alignItems: "center" 
  },
  cancelDeleteBtn: { 
    backgroundColor: "#F1F5F9" 
  },
  confirmDeleteBtn: { 
    backgroundColor: "#EF4444" 
  },
  cancelDeleteText: { 
    fontWeight: "700", 
    color: "#475569",
    fontSize: 13,
  },
  confirmDeleteText: { 
    color: "#FFFFFF", 
    fontWeight: "700",
    fontSize: 13,
  },

  floatingModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end", // Slides up like a native sheet
  },
  floatingModalContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    elevation: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  modalGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    marginTop: 10,
    marginBottom: 14,
  },
  modalHeaderRow: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  modalBody: {
    paddingBottom: 20,
  },
});