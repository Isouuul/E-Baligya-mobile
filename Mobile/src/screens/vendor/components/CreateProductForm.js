import React, { useState, useEffect, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { collection, doc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
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

const CreateProductForm = ({ onCancel, onSubmit, visible }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [productName, setProductName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [category, setCategory] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [freshness, setFreshness] = useState(null);
  const submitLockRef = useRef(false);

  const [vendorData, setVendorData] = useState(null);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });

  const [services, setServices] = useState({
    cleaned: { label: 'Cleaned & Gutted', enabled: false, price: '' },
    filleted: { label: 'Filleted', enabled: false, price: '' },
    vacuum: { label: 'Vacuum Packed', enabled: false, price: '' },
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

  useEffect(() => {
    const fetchVendor = async () => {
      if (!user) return;
      try {
        const vendorQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
        const snapshot = await getDocs(vendorQuery);
        if (!snapshot.empty) setVendorData(snapshot.docs[0].data());
      } catch (err) {
        console.error('Error fetching vendor data:', err);
      }
    };
    fetchVendor();
  }, []);

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

  const resetForm = () => {
    setProductName('');
    setBasePrice('');
    setQuantityKg('');
    setDescription('');
    setImageUri(null);
    setCategory('');
    setPrediction(null);
    setIsClassifying(false);
    setFreshness(null);
    // FIX: Clear down premium services configurations safely on reset
    setServices({
      cleaned: { label: 'Cleaned & Gutted', enabled: false, price: '' },
      filleted: { label: 'Filleted', enabled: false, price: '' },
      vacuum: { label: 'Vacuum Packed', enabled: false, price: '' },
    });
  };

  const renderServiceRow = (serviceKey) => {
    const isSelected = services[serviceKey].enabled;

    return (
      <View
        key={serviceKey}
        style={[styles.cardRow, isSelected && styles.activeRow]}
      >
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() =>
            setServices((prev) => ({
              ...prev,
              [serviceKey]: {
                ...prev[serviceKey],
                enabled: !prev[serviceKey].enabled,
              },
            }))
          }
        >
          <View
            style={[
              styles.customCheckbox,
              isSelected && styles.customCheckboxChecked,
            ]}
          >
            {isSelected && <View style={styles.checkmark} />}
          </View>

          <Text style={styles.rowLabel}>
            {services[serviceKey].label}
          </Text>
        </TouchableOpacity>

        {isSelected && (
          <TextInput
            style={styles.rowInput}
            placeholder="Add-on ₱"
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
            value={services[serviceKey].price}
            onChangeText={(txt) =>
              setServices((prev) => ({
                ...prev,
                [serviceKey]: {
                  ...prev[serviceKey],
                  price: txt,
                },
              }))
            }
          />
        )}
      </View>
    );
  };

  const handleClose = () => {
    resetForm();
    const closeHandler = onCancel || onSubmit;
    closeHandler?.();
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

    if (!vendorData) {
      return showSileo({
        title: 'Please Wait',
        message: 'Vendor profile is still loading. Try again in a moment.',
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

      const now = Timestamp.now();
      const nowDate = now.toDate();
      const warningDate = new Date(nowDate.getTime() + (1 * 24 * 60 * 60 * 1000));
      const expiryDate = new Date(nowDate.getTime() + (1.5 * 24 * 60 * 60 * 1000));
      const warningTimestamp = Timestamp.fromDate(warningDate);
      const expiryTimestamp = Timestamp.fromDate(expiryDate);

      const enabledServices = Object.keys(services)
        .filter((key) => services[key].enabled)
        .map((key) => ({
          id: key,
          label: services[key].label,
          price: parseFloat(services[key].price) || 0,
        }));

      const productData = {
        category,
        productName: productName.trim(),
        description: description.trim(),
        basePrice: basePrice ? parseFloat(basePrice) : null,
        quantityKg: quantityKg ? parseFloat(quantityKg) : null,
        createdAt: Timestamp.now(),
        warningTime: warningTimestamp, 
        expiryTime: expiryTimestamp,  
        imageBase64,
        premiumServices: enabledServices,
        location: {
          latitude: vendorData.latitude || null,
          longitude: vendorData.longitude || null,
        },
        uploadedBy: {
          uid: user.uid,
          email: user.email,
          businessName: vendorData.businessName || 'Unknown',
          marketName: vendorData.marketName || 'Unknown Market',
          vendorProfileImage: vendorData.profileImage || null,
          freshness: freshness || 'Unknown',
        },
      };

      await setDoc(doc(collection(db, 'Products')), productData);
      showSileo({
        title: 'Success',
        message: 'Product listed successfully.',
        type: 'success',
        onPress: handleClose,
      });
    } catch (err) {
      console.error('Save product error:', err);

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
          title: 'Save Failed',
          message: errorMessage || 'Something went wrong while saving.',
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
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.cardModalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create New Product</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Image Card Section */}
            <View style={styles.cardSection}>
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

              {prediction && !isClassifying && (
                <View style={[styles.aiBadge, isRotten ? styles.badgeRotten : styles.badgeFresh]}>
                  <Text style={styles.aiTextMain}>Freshness: {freshness}</Text>
                  <Text style={styles.aiTextSub}>{prediction.label} • {(prediction.confidence * 100).toFixed(0)}% match</Text>
                </View>
              )}
            </View>

            {/* Details Card Section */}
            <View style={styles.cardSection}>
              <Text style={styles.sectionLabel}>Basic Information</Text>
              
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
                  <Picker.Item label="Select Category" value="" color="#94A3B8" />
                  <Picker.Item label="Fish" value="Fish" color="#1E293B" />
                  <Picker.Item label="Mollusk" value="Mollusk" color="#1E293B" />
                  <Picker.Item label="Crustacean" value="Crustacean" color="#1E293B" />
                  <Picker.Item label="Seasonal" value="Seasonal" color="#1E293B" />
                </Picker>
              </View>

              <TextInput 
                style={styles.premiumInput} 
                placeholder="Product Name" 
                placeholderTextColor="#94A3B8" 
                value={productName} 
                onChangeText={setProductName} 
              />

              <View style={styles.inputRow}>
                <TextInput 
                  style={[styles.premiumInput, { flex: 1, marginRight: 12 }]} 
                  placeholder="Base Price" 
                  keyboardType="numeric" 
                  placeholderTextColor="#94A3B8" 
                  value={basePrice} 
                  onChangeText={setBasePrice} 
                />
                <TextInput 
                  style={[styles.premiumInput, { flex: 1 }]} 
                  placeholder="Stock (kg)" 
                  keyboardType="numeric" 
                  placeholderTextColor="#94A3B8" 
                  value={quantityKg} 
                  onChangeText={setQuantityKg} 
                />
              </View>

              <View style={styles.cardSection}>
                <Text style={styles.sectionLabel}>
                  Premium Services
                </Text>
                {Object.keys(services).map(renderServiceRow)}
              </View>

              <TextInput 
                style={[styles.premiumInput, { minHeight: 100, textAlignVertical: 'top' }]} 
                placeholder="Product Description (optional)" 
                placeholderTextColor="#94A3B8" 
                value={description} 
                onChangeText={setDescription}
                multiline
              />
            </View>

            {isRotten && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ Quality check failed. Cannot list spoiled products.</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                onPress={handleSubmit}
                style={[styles.submitButton, (isSubmitting || isRotten) && styles.disabledButton]}
                disabled={isSubmitting || isRotten}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Publish Listing</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={resetForm}
                style={styles.resetButton}
                disabled={isSubmitting || isClassifying}
              >
                <Text style={styles.resetButtonText}>Reset Form</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Sileo Custom Alert Modal */}
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end', 
    alignItems: 'center',
  },
  cardModalContainer: {
    width: '100%',
    maxWidth: 550,
    maxHeight: '90%',
    backgroundColor: '#F8FAFC', 
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A8A' },
  closeButton: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#F1F5F9', 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  closeButtonText: { fontSize: 16, color: '#64748B', fontWeight: 'bold' },
  
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#64748B', 
    marginBottom: 14, 
    textTransform: 'uppercase', 
    letterSpacing: 1.2 
  },
  
  imagePlaceholder: { 
    width: '100%', 
    height: 180, 
    borderRadius: 14, 
    backgroundColor: '#F8FAFC', 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#CBD5E1', 
    overflow: 'hidden', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  fullImage: { width: '100%', height: '100%' },
  uploadPrompt: { alignItems: 'center' },
  uploadIcon: { fontSize: 36, marginBottom: 6 },
  uploadText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  
  aiBadge: { padding: 14, borderRadius: 12, marginTop: 14, borderLeftWidth: 5 },
  aiBadgeLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  badgeFresh: { backgroundColor: '#F0FDF4', borderLeftColor: '#22C55E' },
  badgeRotten: { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' },
  aiTextMain: { fontWeight: 'bold', fontSize: 15, color: '#1E293B' },
  aiTextSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  aiText: { color: '#1E3A8A', fontWeight: '600' },

  premiumInput: { 
    backgroundColor: '#F8FAFC', 
    padding: 14, 
    borderRadius: 12, 
    fontSize: 15, 
    color: '#1E293B', 
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  inputRow: { flexDirection: 'row' },
  
  pickerWrapper: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    marginBottom: 12, 
    overflow: 'hidden', 
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  picker: { height: 50, color: '#1E293B' },

  errorBanner: { backgroundColor: '#EF4444', padding: 14, borderRadius: 14, marginBottom: 16 },
  errorText: { color: '#FFF', fontWeight: 'bold', textAlign: 'center', fontSize: 14 },

  actionContainer: {
    paddingHorizontal: 4,
    marginTop: 8,
  },
  submitButton: { 
    backgroundColor: '#1E3A8A', 
    paddingVertical: 16, 
    borderRadius: 14, 
    alignItems: 'center', 
    shadowColor: '#1E3A8A', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 4 
  },
  disabledButton: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  resetButton: { 
    paddingVertical: 14, 
    borderRadius: 14, 
    alignItems: 'center', 
    marginTop: 12, 
    backgroundColor: 'transparent' 
  },
  resetButtonText: { color: '#64748B', fontSize: 15, fontWeight: '600' },

  sileoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sileoModal: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    elevation: 20,
  },
  sileoIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sileoSuccess: { backgroundColor: '#10B981' },
  sileoWarning: { backgroundColor: '#F59E0B' },
  sileoError: { backgroundColor: '#EF4444' },
  sileoIconText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sileoTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  sileoMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  sileoButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center'
  },
  sileoButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeRow: {
    borderColor: '#1E3A8A',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxChecked: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  checkmark: {
    width: 10,
    height: 5,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#FFF',
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  rowLabel: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  rowInput: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    width: 110,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#1E293B',
  },
});

export default CreateProductForm;