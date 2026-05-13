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
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Edit Listing</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

      {/* Image Section */}
      <View style={styles.section}>
        <Pressable onPress={pickImage} style={styles.imagePlaceholder}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.fullImage} />
          ) : (
            <View style={styles.uploadPrompt}>
              <Text style={styles.uploadIcon}>📸</Text>
              <Text style={styles.uploadText}>Upload Product Photo</Text>
            </View>
          )}
        </Pressable>

        {isClassifying && (
          <View style={styles.aiBadgeLoading}>
            <ActivityIndicator size="small" color="#1e3a8a" />
            <Text style={styles.aiText}> Analyzing Quality...</Text>
          </View>
        )}

        {freshness && !isClassifying && (
          <View style={[styles.aiBadge, isRotten ? styles.badgeRotten : styles.badgeFresh]}>
            <Text style={styles.aiTextMain}>Freshness: {freshness}</Text>
            {prediction && (
              <Text style={styles.aiTextSub}>
                {prediction.label} • {(prediction.confidence * 100).toFixed(0)}% match
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Basic Information</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={category} onValueChange={setCategory} style={[styles.picker, { color: '#000' }]}>
            <Picker.Item label="Select Category" value="" color="#999" />
            <Picker.Item label="Fish" value="Fish" color="#000" />
            <Picker.Item label="Mollusk" value="Mollusk" color="#000" />
            <Picker.Item label="Crustacean" value="Crustacean" color="#000" />
            <Picker.Item label="Seasonal" value="Seasonal" color="#000" />
          </Picker>
        </View>
        <TextInput 
          style={styles.premiumInput} 
          placeholder="Product Name" 
          placeholderTextColor="#000" 
          value={productName} 
          onChangeText={setProductName} 
        />
        <View style={styles.inputRow}>
          <TextInput 
            style={[styles.premiumInput, { flex: 1, marginRight: 10 }]} 
            placeholder="Base Price" 
            keyboardType="numeric" 
            placeholderTextColor="#000" 
            value={basePrice} 
            onChangeText={setBasePrice} 
          />
          <TextInput 
            style={[styles.premiumInput, { flex: 1 }]} 
            placeholder="Stock (kg)" 
            keyboardType="numeric" 
            placeholderTextColor="#000" 
            value={quantityKg} 
            onChangeText={setQuantityKg} 
          />
        </View>
        <TextInput 
          style={[styles.premiumInput, { minHeight: 100, textAlignVertical: 'top' }]} 
          placeholder="Product Description (optional)" 
          placeholderTextColor="#000" 
          value={description} 
          onChangeText={setDescription}
          multiline
        />
      </View>

      {isRotten && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ Quality check failed. Spoiled products cannot remain active.</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        style={[styles.submitButton, (isSubmitting || isRotten) && styles.disabledButton]}
        disabled={isSubmitting || isRotten}
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
      >
        <Text style={styles.resetButtonText}>Cancel</Text>
      </TouchableOpacity>

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
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose}>
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

// Reusing same exact stylings as CreateProductForm for design consistency
const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  container: { 
    padding: 24,
    paddingBottom: 32,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1E3A8A' },
  closeButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#F1F5F9', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 4,
  },
  closeButtonText: { fontSize: 20, color: '#64748B', fontWeight: 'bold' },
  
  section: { marginBottom: 25 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  
  imagePlaceholder: { width: '100%', height: 200, borderRadius: 16, backgroundColor: '#FFF', borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '100%' },
  uploadPrompt: { alignItems: 'center' },
  uploadIcon: { fontSize: 40, marginBottom: 8 },
  uploadText: { color: '#64748B', fontWeight: '600' },
  
  aiBadge: { padding: 12, borderRadius: 12, marginTop: 12, borderLeftWidth: 5 },
  aiBadgeLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  badgeFresh: { backgroundColor: '#F0FDF4', borderLeftColor: '#22C55E' },
  badgeRotten: { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' },
  aiTextMain: { fontWeight: 'bold', fontSize: 16, color: '#1E293B' },
  aiTextSub: { fontSize: 12, color: '#64748B' },

  premiumInput: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, color: '#1E293B', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  inputRow: { flexDirection: 'row' },
  
  pickerWrapper: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2 },
  picker: { height: 55 },

  errorBanner: { backgroundColor: '#EF4444', padding: 12, borderRadius: 12, marginBottom: 15 },
  errorText: { color: '#FFF', fontWeight: 'bold', textAlign: 'center' },

  submitButton: { backgroundColor: '#1e3a8a', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 10, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  disabledButton: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  resetButton: { borderWidth: 1.5, borderColor: '#1e3a8a', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 10, backgroundColor: '#FFFFFF' },
  resetButtonText: { color: '#1e3a8a', fontSize: 16, fontWeight: '700' },
  
  sileoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sileoModal: {
    width: '86%',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  sileoIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sileoSuccess: { backgroundColor: '#10B981' },
  sileoWarning: { backgroundColor: '#F59E0B' },
  sileoError: { backgroundColor: '#EF4444' },
  sileoIconText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sileoTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  sileoMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  sileoButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  sileoButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default EditProductForm;