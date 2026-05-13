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
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.cardContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>Edit Bidding Details</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Image Section */}
            <Pressable style={styles.imagePicker} onPress={pickImage}>
              {imageBase64 ? (
                <Image source={{ uri: imageBase64 }} style={styles.previewImage} />
              ) : (
                <Text style={styles.imagePlaceholderText}>Tap to Change Photo</Text>
              )}
            </Pressable>

            {/* Inputs */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Product Name</Text>
              <TextInput 
                style={styles.premiumInput} 
                value={productName} 
                onChangeText={setProductName} 
                placeholder="e.g. Yellowfin Tuna"
                placeholderTextColor="#000"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={category} onValueChange={setCategory} style={{ color: '#000' }}>
                    <Picker.Item label="Fish" value="Fish" color="#000" />
                    <Picker.Item label="Crustacean" value="Crustacean" color="#000" />
                    <Picker.Item label="Mollusk" value="Mollusk" color="#000" />
                  </Picker>
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Freshness</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={freshness} onValueChange={setFreshness} style={{ color: '#000' }}>
                    <Picker.Item label="Fresh" value="Fresh" color="#000" />
                    <Picker.Item label="Chilled" value="Chilled" color="#000" />
                    <Picker.Item label="Frozen" value="Frozen" color="#000" />
                  </Picker>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Base Price (₱/kg)</Text>
                <TextInput 
                  style={styles.premiumInput} 
                  keyboardType="numeric"
                  value={basePrice} 
                  onChangeText={setBasePrice}
                  placeholderTextColor="#000"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Stock (kg)</Text>
                <TextInput 
                  style={styles.premiumInput} 
                  keyboardType="numeric"
                  value={totalQuantity} 
                  onChangeText={setTotalQuantity}
                  placeholderTextColor="#000"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.premiumInput, styles.textArea]} 
                multiline 
                numberOfLines={3}
                value={description} 
                onChangeText={setDescription}
                placeholderTextColor="#000"
              />
            </View>

            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleUpdate}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Sileo Alert Modal (Simplified for brevity) */}
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
              >
                <Text style={styles.sileoBtnText}>OK</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  cardContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
    paddingBottom: 20,
  },
  modalHeader: {
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  grabber: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  closeBtn: { position: "absolute", right: 20, top: 20 },
  closeBtnText: { fontSize: 18, color: "#64748B" },
  scrollContent: { padding: 20 },
  imagePicker: {
    width: "100%",
    height: 180,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: "100%" },
  imagePlaceholderText: { color: "#94A3B8", fontWeight: "600" },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6, marginLeft: 4 },
  premiumInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: "#0F172A",
  },
  textArea: { height: 100, paddingTop: 12, textAlignVertical: "top" },
  pickerContainer: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: "#1E3A8A",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  // Alert styles
  sileoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  sileoCard: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center" },
  sileoTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  sileoMsg: { textAlign: "center", color: "#64748B", marginBottom: 20 },
  sileoBtn: { backgroundColor: "#1E3A8A", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  sileoBtnText: { color: "#fff", fontWeight: "700" }
});