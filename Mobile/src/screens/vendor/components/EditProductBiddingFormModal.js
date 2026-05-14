import React, { useState, useEffect } from "react";
import { 
  View, Text, TextInput, ScrollView, StyleSheet, Pressable, Image, ActivityIndicator, Modal, TouchableOpacity
} from "react-native";
import { db } from "../../../firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";

const normalizeImageUri = (value) => {
  if (!value) return null;
  if (value.startsWith("data:image")) return value;
  return `data:image/jpeg;base64,${value}`;
};

const EditProductBiddingFormModal = ({ visible, existingBidding, onCancel, onSubmit }) => {
  const [category, setCategory] = useState(existingBidding.category || "");
  const [productName, setProductName] = useState(existingBidding.productName || "");
  const [description, setDescription] = useState(existingBidding.description || "");
  const [freshness, setFreshness] = useState(existingBidding.freshness || "Fresh");
  const [imageBase64, setImageBase64] = useState(normalizeImageUri(existingBidding.imageBase64));
  const [isLoading, setIsLoading] = useState(false);
  
  // New Multi-Unit Fields
  const [basePrice, setBasePrice] = useState(existingBidding.basePrice?.toString() || "");
  const [totalQuantity, setTotalQuantity] = useState(existingBidding.totalQuantity?.toString() || "");
  
  const [durationInMinutes, setDurationInMinutes] = useState(existingBidding.durationMinutes || 20);
  const [customDuration, setCustomDuration] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Sileo Alert State
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({ title: "", message: "", type: "info", onPress: null });

  const showSileo = (config) => {
    setSileoConfig(config);
    setSileoVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled) {
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  useEffect(() => {
    if (!existingBidding) return;

    setCategory(existingBidding.category || "");
    setProductName(existingBidding.productName || "");
    setDescription(existingBidding.description || "");
    setFreshness(existingBidding.freshness || "Fresh");
    setImageBase64(normalizeImageUri(existingBidding.imageBase64));

    setBasePrice(existingBidding.basePrice?.toString() || "");
    setTotalQuantity(existingBidding.totalQuantity?.toString() || "");

    setDurationInMinutes(existingBidding.durationMinutes || 20);
  }, [existingBidding]);

  const handleUpdate = async () => {
    const finalDuration = useCustom ? parseInt(customDuration) : durationInMinutes;

    // Validation
    if (!productName || !basePrice || !totalQuantity || !finalDuration) {
      return showSileo({ 
        title: "Missing Info", 
        message: "Please fill in all required fields.", 
        type: "warning" 
      });
    }

    try {
      setIsLoading(true);
      const biddingRef = doc(db, "Bidding_Products", existingBidding.id);
      
      // Recalculate end time based on original start time and new duration
      const startTime = existingBidding.startTime?.toDate ? existingBidding.startTime.toDate() : new Date();
      const endTime = new Date(startTime.getTime() + finalDuration * 60000);

      await updateDoc(biddingRef, {
        category,
        productName,
        description,
        freshness,
        imageBase64,
        basePrice: parseFloat(basePrice),
        totalQuantity: parseFloat(totalQuantity),
        remainingQuantity: parseFloat(totalQuantity), // Resetting remaining for the edit
        durationMinutes: finalDuration,
        endTime: Timestamp.fromDate(endTime),
        updatedAt: Timestamp.now(),
      });

      showSileo({
        title: "Updated",
        message: "Product listing has been updated successfully.",
        type: "success",
        onPress: () => {
          onSubmit?.();
          onCancel?.();
        }
      });
    } catch (error) {
      console.error(error);
      showSileo({ title: "Error", message: "Failed to update listing.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          <View style={styles.modalHeader}>
            <View style={{ width: 32 }} /> 
            <Text style={styles.modalTitle}>Edit Bidding Details</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
{/* Premium Image Section (Non-Pressable) */}
<View style={styles.imagePicker}>
  {imageBase64 ? (
    <View style={styles.imageContainer}>
      <Image source={{ uri: imageBase64 }} style={styles.previewImage} />
    </View>
  ) : (
    <View style={styles.placeholderWrapper}>
      <Text style={styles.imagePlaceholderText}>No Product Image Available</Text>
    </View>
  )}
</View>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Product Name</Text>
              <TextInput 
                style={styles.premiumInput} 
                value={productName} 
                onChangeText={setProductName} 
                placeholder="e.g. Yellowfin Tuna"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.row}>
              {/* Premium Read-Only Category Display */}
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.readOnlyContainer}>
                  <Text style={styles.readOnlyText}>{category || "N/A"}</Text>
                </View>
              </View>

              {/* Premium Read-Only Freshness Display */}
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Freshness</Text>
                <View style={styles.readOnlyContainer}>
                  <Text style={styles.readOnlyText}>{freshness || "N/A"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Base Price (₱ / kg)</Text>
                <TextInput 
                  style={styles.premiumInput} 
                  keyboardType="numeric"
                  value={basePrice} 
                  onChangeText={setBasePrice}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Stock (kg)</Text>
                <TextInput 
                  style={styles.premiumInput} 
                  keyboardType="numeric"
                  value={totalQuantity} 
                  onChangeText={setTotalQuantity}
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.premiumInput, styles.textArea]} 
                multiline 
                numberOfLines={4}
                value={description} 
                onChangeText={setDescription}
                placeholder="Describe features, sourcing, or grading..."
                placeholderTextColor="#94a3b8"
              />
            </View>

            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleUpdate}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Sileo Alert Modal */}
        <Modal visible={sileoVisible} transparent animationType="fade">
          <View style={styles.sileoOverlay}>
            <View style={styles.sileoCard}>
              <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
              <Text style={styles.sileoMsg}>{sileoConfig.message}</Text>
              <TouchableOpacity 
                style={styles.sileoBtn} 
                onPress={() => {
                  setSileoVisible(false);
                  sileoConfig.onPress?.();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.sileoBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

export default EditProductBiddingFormModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', // Smoother premium dark overlay tint
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingBottom: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  modalTitle: { 
    fontSize: 17, 
    fontWeight: "700", 
    color: "#0f172a",
    letterSpacing: -0.3 
  },
  closeBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#f1f5f9',
    alignItems: "center", 
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  scrollContent: { padding: 24 },
  imagePicker: {
    width: "100%",
    height: 190,
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 24,
    overflow: "hidden",
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  previewImage: { width: "100%", height: "100%", resizeMode: 'cover' },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageOverlayText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  placeholderWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: { color: "#64748b", fontWeight: "600", fontSize: 14 },
  inputGroup: { marginBottom: 20 },
  row: { flexDirection: "row" },
  label: { 
    fontSize: 13, 
    fontWeight: "600", 
    color: "#475569", 
    marginBottom: 8, 
    marginLeft: 2,
    letterSpacing: -0.1
  },
  premiumInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: "#0f172a",
  },
  textArea: { 
    height: 110, 
    paddingTop: 14, 
    paddingBottom: 14,
    textAlignVertical: "top" 
  },
  readOnlyContainer: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: "center",
  },
  readOnlyText: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#2563eb", // Vibrant premium digital action blue
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  
  // High-end refinement for Sileo Custom Alert Elements
  sileoOverlay: { 
    flex: 1, 
    backgroundColor: "rgba(15, 23, 42, 0.5)", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  sileoCard: { 
    width: "84%", 
    maxWidth: 340,
    backgroundColor: "#ffffff", 
    borderRadius: 24, 
    padding: 24, 
    alignItems: "center",
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10
  },
  sileoTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 8, letterSpacing: -0.3 },
  sileoMsg: { textAlign: "center", color: "#475569", fontSize: 14, lineHeight: 20, marginBottom: 24 },
  sileoBtn: { 
    backgroundColor: "#0f172a", 
    width: "100%",
    paddingVertical: 14, 
    borderRadius: 14,
    alignItems: "center"
  },
  sileoBtnText: { color: "#ffffff", fontWeight: "600", fontSize: 15 }
});