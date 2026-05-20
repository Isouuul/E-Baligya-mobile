import React, { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { classifyFish } from '../../../utils/nyckel';

const EditProductForm = ({ product, onCancel, onSubmit }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  // Initialize state with the product's existing values
  const [productName, setProductName] = useState(product?.productName || '');
  const [basePrice, setBasePrice] = useState(product?.basePrice ? String(product.basePrice) : '');
  const [quantityKg, setQuantityKg] = useState(product?.quantityKg ? String(product.quantityKg) : '');
  const [description, setDescription] = useState(product?.description || '');
  const [category, setCategory] = useState(product?.category || '');
  
  // Handle existing image or base64 data
  const [imageUri, setImageUri] = useState(product?.imageBase64 || null);
  const [freshness, setFreshness] = useState(product?.uploadedBy?.freshness || null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const submitLockRef = useRef(false);

  // Custom Sileo Modal Configuration
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });

  const showSileo = ({ title, message, buttonText = 'OK', type = 'info', onPress = null }) => {
    setSileoConfig({ title, message, buttonText, type, onPress });
    setSileoVisible(true);
  };

  const handleSileoClose = () => {
    setSileoVisible(false);
    if (typeof sileoConfig.onPress === 'function') {
      sileoConfig.onPress();
    }
    setSileoConfig((prev) => ({ ...prev, onPress: null }));
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setImageUri(uri);
        setIsClassifying(true);
        try {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const dataUri = `data:image/jpeg;base64,${base64}`;
          const data = await classifyFish(dataUri);
          
          if (data) {
            setPrediction({
              label: data.labelName,
              confidence: data.confidence,
            });

            let freshnessResult = 'Unknown';
            if (data.labelName?.toLowerCase().includes('fresh')) {
              freshnessResult = 'Fresh';
            } else if (data.labelName?.toLowerCase().includes('rotten')) {
              freshnessResult = 'Rotten';
            }
            setFreshness(freshnessResult);
            setCategory('Fish');
          } else {
            setFreshness('Freshness: Unknown');
          }
        } catch (err) {
          console.error('Classification error:', err);
          showSileo({
            title: 'Classification Error',
            message: 'Failed to classify fish image. Please try another photo.',
            type: 'error',
          });
        } finally {
          setIsClassifying(false);
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
      showSileo({
        title: 'Image Error',
        message: 'Failed to pick or process image.',
        type: 'error',
      });
    }
  };

  const convertImageToBase64 = async (uri) => {
    if (!uri) return null;
    // If the image is already base64 string from the database, return it as-is
    if (uri.startsWith('data:image')) {
      return uri;
    }
    try {
      const maxBase64Length = 780000;
      const attempts = [
        { width: 1280, compress: 0.65 },
        { width: 1080, compress: 0.55 },
        { width: 900, compress: 0.45 },
        { width: 720, compress: 0.35 },
        { width: 600, compress: 0.3 },
      ];

      for (const attempt of attempts) {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: attempt.width } }],
          {
            compress: attempt.compress,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        const base64 = manipulated?.base64;
        if (base64 && base64.length <= maxBase64Length) {
          return `data:image/jpeg;base64,${base64}`;
        }
      }

      throw new Error('Image too large after compression. Please choose a smaller photo.');
    } catch (err) {
      console.error('Base64 conversion/compression error:', err);
      return null;
    }
  };

  const handleClose = () => {
    if (onCancel) onCancel();
    else if (onSubmit) onSubmit();
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || isSubmitting) return;

    if (!user || !productName || !category || !imageUri) {
      return showSileo({
        title: 'Missing Info',
        message: 'Please complete all required fields and add an image.',
        type: 'warning',
      });
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const imageBase64 = await convertImageToBase64(imageUri);

      if (!imageBase64) {
        throw new Error('Image is too large to upload. Please use a smaller image.');
      }

      // Prepare updated details
      const updatedProductData = {
        category,
        productName: productName.trim(),
        description: description.trim(),
        basePrice: basePrice ? parseFloat(basePrice) : null,
        quantityKg: quantityKg ? parseFloat(quantityKg) : null,
        updatedAt: Timestamp.now(),
        imageBase64,
        'uploadedBy.freshness': freshness || 'Unknown',
      };

      // Reference the specific Firestore product document by its ID
      const productRef = doc(db, 'Products', product.id);
      await updateDoc(productRef, updatedProductData);

      showSileo({
        title: 'Success',
        message: 'Product updated successfully.',
        type: 'success',
        onPress: handleClose,
      });
    } catch (err) {
      console.error('Update product error:', err);

      const errorCode = err?.code || '';
      const errorMessage = err?.message || '';

      if (errorCode.includes('permission-denied')) {
        showSileo({
          title: 'Permission Denied',
          message: 'Your Firestore rules are blocking writes to Products.',
          type: 'error',
        });
      } else if (
        errorCode.includes('resource-exhausted') ||
        /document.*too.*large/i.test(errorMessage)
      ) {
        showSileo({
          title: 'Image Too Large',
          message: 'This image is too large for Firestore document size limits. Use a smaller image.',
          type: 'warning',
        });
      } else if (errorCode.includes('unavailable') || errorCode.includes('network-request-failed')) {
        showSileo({
          title: 'Network Error',
          message: 'Cannot reach Firebase right now. Check internet and try again.',
          type: 'warning',
        });
      } else {
        showSileo({
          title: 'Update Failed',
          message: errorMessage || 'Something went wrong while updating.',
          type: 'error',
        });
      }
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const isRotten = freshness === 'Rotten';

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <View style={{ width: 32 }} />
            <Text style={styles.headerTitle}>Edit Listing</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            {/* Image Section */}
            <View style={styles.section}>
<View style={styles.imagePlaceholder}>
  {imageUri ? (
    <Image source={{ uri: imageUri }} style={styles.fullImage} />
  ) : (
    <View style={styles.uploadPrompt}>
      <Text style={styles.uploadIcon}>📸</Text>
      <Text style={styles.uploadText}>No Image Available</Text>
    </View>
  )}
</View>

              {isClassifying && (
                <View style={styles.aiBadgeLoading}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.aiText}> Analyzing Quality...</Text>
                </View>
              )}
            </View>

            {/* Details Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Basic Information</Text>
              
              <View style={styles.inputRowCat}>
                {/* Category Picker */}
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputTitle}>Category</Text>
                  <View style={[styles.pickerWrapper, { marginBottom: 0 }]}>
                    <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
                      <Picker.Item label="Select Category" value="" color="#94a3b8" />
                      <Picker.Item label="Fish" value="Fish" color="#0f172a" />
                      <Picker.Item label="Mollusk" value="Mollusk" color="#0f172a" />
                      <Picker.Item label="Crustacean" value="Crustacean" color="#0f172a" />
                      <Picker.Item label="Seasonal" value="Seasonal" color="#0f172a" />
                    </Picker>
                  </View>
                </View>

                {/* Premium Read-Only Freshness Display */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputTitle}>Quality Status</Text>
                  <View style={styles.inputGroup}>
                    <View style={styles.readOnlyContainer}>
                      <Text style={styles.readOnlyText}>{freshness}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Product Name Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputTitle}>Product Name</Text>
                <TextInput 
                  style={styles.premiumInput} 
                  placeholder="e.g., Bangus, Yellowfin Tuna" 
                  placeholderTextColor="#94a3b8"
                  value={productName} 
                  onChangeText={setProductName} 
                />
              </View>
              
              {/* Pricing & Stock Grid */}
              <View style={styles.inputRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.inputTitle}>Base Price (₱)</Text>
                  <TextInput 
                    style={styles.premiumInput} 
                    placeholder="0.00" 
                    keyboardType="numeric" 
                    placeholderTextColor="#94a3b8"      
                    value={basePrice} 
                    onChangeText={setBasePrice} 
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputTitle}>Stock (kg)</Text>
                  <TextInput 
                    style={styles.premiumInput} 
                    placeholder="0" 
                    keyboardType="numeric" 
                    placeholderTextColor="#94a3b8"
                    value={quantityKg} 
                    onChangeText={setQuantityKg} 
                  />
                </View>
              </View>

              {/* Description Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputTitle}>Product Description</Text>
                <TextInput 
                  style={[styles.premiumInput, { minHeight: 110, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }]} 
                  placeholder="Describe your batch freshness, catching location, etc. (optional)" 
                  placeholderTextColor="#94a3b8"
                  value={description} 
                  onChangeText={setDescription}
                  multiline
                />
              </View>
            </View>

            {/* Quality Warning Check */}
            {isRotten && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ Quality check failed. Spoiled products cannot remain active.</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitButton, (isSubmitting || isRotten) && styles.disabledButton]}
              disabled={isSubmitting || isRotten}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClose}
              style={styles.resetButton}
              disabled={isSubmitting || isClassifying}
              activeOpacity={0.7}
            >
              <Text style={styles.resetButtonText}>Cancel</Text>
            </TouchableOpacity>

            {/* Custom Sileo Dialog Modal */}
            <Modal
              visible={sileoVisible}
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={handleSileoClose}
            >
              <View style={styles.sileoOverlay}>
                <View style={styles.sileoModal}>
                  <View
                    style={[
                      styles.sileoIconCircle,
                      sileoConfig.type === 'success'
                        ? styles.sileoSuccess
                        : sileoConfig.type === 'warning'
                          ? styles.sileoWarning
                          : styles.sileoError,
                    ]}
                  >
                    <Text style={styles.sileoIconText}>
                      {sileoConfig.type === 'success' ? '✓' : sileoConfig.type === 'warning' ? '!' : '✕'}
                    </Text>
                  </View>
                  <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
                  <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
                  <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose} activeOpacity={0.8}>
                    <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', 
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  container: { 
    padding: 24,
    paddingBottom: 28,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 20,
  },
  headerTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#0f172a',
    letterSpacing: -0.3
  },
  closeButton: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#F1F5F9', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  closeButtonText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  
  section: { marginBottom: 24 },
  sectionLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#64748b', 
    marginBottom: 16, 
    textTransform: 'uppercase', 
    letterSpacing: 0.8,
    marginLeft: 2
  },
  fieldGroup: {
    marginBottom: 40
  },
  inputTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginLeft: 2,
  },
  imagePlaceholder: { 
    width: '100%', 
    height: 190, 
    borderRadius: 20, 
    backgroundColor: '#f8fafc', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    overflow: 'hidden', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  fullImage: { width: '100%', height: '100%', resizeMode: 'cover' },
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
  uploadPrompt: { alignItems: 'center' },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  
  aiBadgeLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  aiText: { color: '#475569', fontWeight: '600', fontSize: 14 },

  premiumInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 16,
    borderRadius: 14,
    height: 50,
    fontSize: 15,
    color: '#0f172a',
  },

  inputRow: { 
    flexDirection: 'row',
    marginBottom: 16
  },
  inputRowCat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16, 
  },
  inputGroup: {
    justifyContent: 'center',
  },
  readOnlyContainer: {
    backgroundColor: '#F8FAFC', 
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    height: 50, 
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  readOnlyText: {
    color: '#0F172A', 
    fontSize: 15,
    fontWeight: '600',
  },
  pickerWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    color: '#0f172a',
    backgroundColor: 'transparent',
  },

  errorBanner: { backgroundColor: '#ef4444', padding: 14, borderRadius: 14, marginBottom: 16 },
  errorText: { color: '#FFF', fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  submitButton: { 
    backgroundColor: '#2563eb', 
    height: 54,
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 8, 
    shadowColor: '#2563eb', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 12, 
    elevation: 3 
  },
  disabledButton: { backgroundColor: '#94a3b8', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  resetButton: { 
    height: 50,
    borderWidth: 1.5, 
    borderColor: '#cbd5e1', 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 12, 
    backgroundColor: '#FFFFFF' 
  },
  resetButtonText: { color: '#475569', fontSize: 15, fontWeight: '600' },
  
  sileoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sileoModal: {
    width: '84%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10
  },
  sileoIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sileoSuccess: { backgroundColor: '#10B981' },
  sileoWarning: { backgroundColor: '#F59E0B' },
  sileoError: { backgroundColor: '#EF4444' },
  sileoIconText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  sileoTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8, letterSpacing: -0.3 },
  sileoMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  sileoButton: {
    backgroundColor: '#0F172A',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center'
  },
  sileoButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

export default EditProductForm;