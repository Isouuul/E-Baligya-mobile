import React, { useState, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from '../../../firebase';
import { collection, doc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { classifyFish } from '../../../utils/nyckel';

const CreateProductBiddingForm = ({ onCancel, onSubmit }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  // General States
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [freshness, setFreshness] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  
  // Custom Alert Modal (Sileo)
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });

  // Bidding Type States: 'fixed_qty' (Fixed Quantity Bid) or 'wholesale' (Fixed Wholesale Bid)
  const [bidType, setBidType] = useState('fixed_qty'); 
  const [basePrice, setBasePrice] = useState('');
  
  // Calculate bid increment for wholesale: quantity / 10
  const calculateBidIncrement = (qty) => {
    const numQty = parseFloat(qty) || 0;
    if (numQty <= 0) return 0;
    return Math.round((numQty / 10) * 100) / 100; // Round to 2 decimals
  };
  
  const bidIncrement = calculateBidIncrement(quantity);
  
  // Premium Services
  const [services, setServices] = useState({
    cleaned: { label: 'Cleaned & Gutted', enabled: false, price: '' },
    filleted: { label: 'Filleted', enabled: false, price: '' },
    vacuum: { label: 'Vacuum Packed', enabled: false, price: '' },
  });

  // Duration
  const [selectedDuration, setSelectedDuration] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const submitLockRef = useRef(false);

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
          const optimizedImage = await convertImageToBase64(uri);
          if (!optimizedImage) {
            showSileo({
              title: 'Image Too Large',
              message: 'This image is too large to upload. Please choose a smaller photo.',
              type: 'warning',
            });
            setImageBase64(null);
            setPrediction(null);
            setFreshness(null);
            return;
          }

          setImageBase64(optimizedImage);

          const data = await classifyFish(optimizedImage);
          if (data) {
            setPrediction({
              label: data.labelName,
              confidence: data.confidence,
            });

            let freshnessResult = 'Unknown';
            if (data.labelName?.toLowerCase().includes('fresh')) freshnessResult = 'Fresh';
            else if (data.labelName?.toLowerCase().includes('rotten')) freshnessResult = 'Rotten';

            setFreshness(`Freshness: ${freshnessResult}`);
            setCategory('Fish');
          } else {
            setFreshness('Freshness: Unknown');
          }
        } catch (err) {
          console.error('Nyckel API error:', err);
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
      console.error('Pick Image Error:', err);
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
      return null;
    } catch (err) {
      console.error('Base64 conversion/compression error:', err);
      return null;
    }
  };

  const handleClose = () => {
    resetForm();
    const closeHandler = onCancel || onSubmit;
    closeHandler?.();
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || isSubmitting) return;

    // 1. Validation Logic
    if (!user) {
      return showSileo({ title: 'Auth Required', message: 'You must be logged in.', type: 'warning' });
    }
    if (!productName || !category) {
      return showSileo({ title: 'Missing Info', message: 'Fill out Product Name and Category.', type: 'warning' });
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      return showSileo({ title: 'Invalid Quantity', message: 'Please enter a valid stock quantity.', type: 'warning' });
    }
    if (!imageBase64) {
      return showSileo({ title: 'Missing Image', message: 'Please upload an image.', type: 'warning' });
    }
    if (!basePrice || parseFloat(basePrice) <= 0) {
      const pricePlaceholder = bidType === 'wholesale' ? 'total wholesale price' : 'base price per kg';
      return showSileo({ title: 'Invalid Price', message: `Enter a valid ${pricePlaceholder}.`, type: 'warning' });
    }

    // Bid-Type Specific Validation
    if (bidType === 'fixed_qty') {
      // For fixed quantity, just need the base price
      // Entire stock will be sold as single transaction
    } else if (bidType === 'wholesale') {
      if (bidIncrement <= 0) {
        return showSileo({ 
          title: 'Invalid Stock', 
          message: 'Stock quantity must be greater than 0 to calculate bulk units.', 
          type: 'warning' 
        });
      }
    }

    const durationMinutes = selectedDuration === 'other' ? parseInt(customDuration, 10) : parseInt(selectedDuration, 10);
    if (!durationMinutes) {
      return showSileo({ title: 'Missing Duration', message: 'Please set auction duration.', type: 'warning' });
    }

    // 2. Lock and Loading
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      // 3. Get Vendor Geolocation and Data
      const vendorQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(vendorQuery);
      if (querySnapshot.empty) throw new Error('Vendor info not found.');

      const vendorDoc = querySnapshot.docs[0];
      const vendorData = vendorDoc.data();
      
      // 4. Calculate Auction Duration and Timing
      // Bidding starts immediately, overall auction ends after duration
      const now = new Date();
      const overallAuctionEnd = new Date(now.getTime() + durationMinutes * 60000);

      // 5. Format Premium Services for Firestore
      const enabledServices = Object.keys(services)
        .filter(key => services[key].enabled)
        .map(key => ({
          id: key,
          label: services[key].label,
          price: parseFloat(services[key].price) || 0
        }));

      // 6. Build the Dynamic Data Object based on Bidding System Choices
      let dynamicBiddingRules = {};
      if (bidType === 'fixed_qty') {
        // Fixed Quantity: Entire stock must be purchased as single transaction
        dynamicBiddingRules = {
          bidType: 'fixed_qty',
          totalQuantity: parseFloat(quantity),
          minQtyPerBid: parseFloat(quantity), // Buyer must buy entire stock
          maxBids: 1, // Only one bid allowed (winner takes all)
        };
      } else {
        // Fixed Wholesale: Bulk selling with calculated increments
        dynamicBiddingRules = {
          bidType: 'wholesale',
          totalQuantity: parseFloat(quantity),
          bidIncrement: bidIncrement, // Bulk unit size
          minQtyPerBid: bidIncrement, // Minimum purchase per bid
          bulkUnitsAvailable: Math.floor(parseFloat(quantity) / bidIncrement),
        };
      }

      const productData = {
        category,
        productName: productName.trim(),
        totalQuantity: parseFloat(quantity),
        remainingQuantity: parseFloat(quantity),

        // Merged Bidding Logic Properties
        basePrice: parseFloat(basePrice),
        currentPrice: parseFloat(basePrice),
        ...dynamicBiddingRules,

        // Media and Metadata
        imageBase64,
        premiumServices: enabledServices,
        location: { 
          latitude: vendorData.latitude || null, 
          longitude: vendorData.longitude || null,
          address: vendorData.address || 'Bacolod City'
        },
        
        // Auction Timing
        createdAt: Timestamp.fromDate(now),
        startTime: Timestamp.fromDate(now), // Bidding starts immediately
        endTime: Timestamp.fromDate(overallAuctionEnd), // Bidding ends after duration
        overallAuctionEndsAt: Timestamp.fromDate(overallAuctionEnd),
        
        status: 'active',
        freshness: freshness || 'Unknown',

        // Vendor Branding
        uploadedBy: {
          uid: user.uid,
          email: user.email,
          businessName: vendorData.businessName || 'Unknown',
          vendorProfileImage: vendorData.profileImage || null,
        },
      };

      // 7. Save to Firestore
      const productRef = doc(collection(db, 'Bidding_Products'));
      await setDoc(productRef, productData);
      
      showSileo({
        title: 'Auction Published',
        message: `Your ${bidType === 'fixed_qty' ? 'Fixed Stock' : 'Wholesale Bulk'} auction is live! Bidding starts now and ends in ${selectedDuration === 'other' ? customDuration : selectedDuration} minutes.`,
        type: 'success',
        onPress: handleClose,
      });

    } catch (err) {
      console.error("Submit Error:", err);
      showSileo({ title: 'Save Failed', message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const resetForm = () => {
    setProductName('');
    setQuantity('');
    setImageBase64(null);
    setCategory('');
    setBidType('fixed_qty');
    setServices({
      cleaned: { label: 'Cleaned & Gutted', enabled: false, price: '' },
      filleted: { label: 'Filleted', enabled: false, price: '' },
      vacuum: { label: 'Vacuum Packed', enabled: false, price: '' },
    });
    setSelectedDuration('');
    setCustomDuration('');
    setImageUri(null);
    setPrediction(null);
    setFreshness(null);
    setBasePrice('');
  };

  const renderServiceRow = (serviceKey) => {
    const isSelected = services[serviceKey].enabled;
    return (
      <View key={serviceKey} style={[styles.cardRow, isSelected && styles.activeRow]}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() =>
            setServices((prev) => ({
              ...prev,
              [serviceKey]: { ...prev[serviceKey], enabled: !prev[serviceKey].enabled },
            }))
          }
        >
          <View style={[styles.customCheckbox, isSelected && styles.customCheckboxChecked]}>
            {isSelected && <View style={styles.checkmark} />}
          </View>
          <Text style={styles.rowLabel}>{services[serviceKey].label}</Text>
        </TouchableOpacity>
        {isSelected && (
          <TextInput
            style={styles.rowInput}
            placeholder="Add-on ₱"
            keyboardType="numeric"
            value={services[serviceKey].price}
            onChangeText={(txt) =>
              setServices((prev) => ({ ...prev, [serviceKey]: { ...prev[serviceKey], price: txt } }))
            }
          />
        )}
      </View>
    );
  };

  const renderDurationOptions = () => {
    const options = ['20', '40', '60', 'other'];
    return options.map((opt) => {
      const isSelected = selectedDuration === opt;
      return (
        <View key={opt} style={[styles.cardRow, isSelected && styles.activeRow]}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setSelectedDuration(opt)}
          >
            <View style={[styles.customCheckbox, isSelected && styles.customCheckboxChecked]}>
              {isSelected && <View style={styles.checkmark} />}
            </View>
            <Text style={styles.rowLabel}>{opt === 'other' ? 'Other' : `${opt} mins`}</Text>
          </TouchableOpacity>
          {opt === 'other' && isSelected && (
            <TextInput
              style={styles.rowInputWide}
              placeholder="Enter minutes"
              keyboardType="numeric"
              value={customDuration}
              onChangeText={setCustomDuration}
            />
          )}
        </View>
      );
    });
  };

  const isRotten = freshness === 'Freshness: Rotten';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Auction Listing</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Live Bidding Starts Immediately */}
      <View style={styles.liveIndicatorBox}>
        <Text style={styles.liveIndicatorText}>
          🔴 LIVE • Bidding starts immediately upon upload
        </Text>
      </View>

      {/* Image Upload and AI Quality Checker */}
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

        {prediction && !isClassifying && (
          <View style={[styles.aiBadge, isRotten ? styles.badgeRotten : styles.badgeFresh]}>
            <Text style={styles.aiTextMain}>{freshness}</Text>
            <Text style={styles.aiTextSub}>{prediction.label} • {(prediction.confidence * 100).toFixed(0)}% match</Text>
          </View>
        )}
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Basic Information</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
            <Picker.Item label="Category" value="" color="#999" />
            <Picker.Item label="Fish" value="Fish" />
            <Picker.Item label="Mollusk" value="Mollusk" />
            <Picker.Item label="Crustacean" value="Crustacean" />
            <Picker.Item label="Trend" value="Trend" />
          </Picker>
        </View>
        <TextInput
          style={styles.premiumInput}
          placeholder="Product Name"
          placeholderTextColor="#999"
          value={productName}
          onChangeText={setProductName}
        />
        <TextInput
          style={styles.premiumInput}
          placeholder="Stock (kg)"
          keyboardType="numeric"
          value={quantity}
          onChangeText={setQuantity}
        />
      </View>

      {/* Segmented/Toggle Buttons for Bidding Type */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Bidding Type</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleButton, bidType === 'fixed_qty' && styles.toggleActiveButton]} 
            onPress={() => setBidType('fixed_qty')}
          >
            <Text style={[styles.toggleText, bidType === 'fixed_qty' && styles.toggleActiveText]}>
              Fixed Stock
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, bidType === 'wholesale' && styles.toggleActiveButton]} 
            onPress={() => setBidType('wholesale')}
          >
            <Text style={[styles.toggleText, bidType === 'wholesale' && styles.toggleActiveText]}>
              Wholesale Bulk
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dynamic Auction Rules based on Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Auction Rules</Text>
        
        <TextInput
          style={styles.premiumInput}
          placeholder={
            bidType === 'fixed_qty' 
              ? "Base Price for Entire Stock (₱)" 
              : "Wholesale Base Price per Bulk Unit (₱)"
          }
          keyboardType="numeric"
          value={basePrice}
          onChangeText={setBasePrice}
        />

        {bidType === 'fixed_qty' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ℹ️ Single Transaction • Buyer purchases all {quantity || '0'} kg at once
            </Text>
            <Text style={styles.infoTextSmall}>
              No partial bids. Winner takes entire stock in one transaction.
            </Text>
          </View>
        )}

        {bidType === 'wholesale' && quantity && parseFloat(quantity) > 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📊 Bulk Unit Size: {bidIncrement.toFixed(2)} kg per increment
            </Text>
            <Text style={styles.infoTextSmall}>
              Total stock: {parseFloat(quantity)} kg • Available units: {Math.floor(parseFloat(quantity) / bidIncrement)} units of {bidIncrement.toFixed(2)} kg
            </Text>
            <Text style={styles.infoTextSmall}>
              Buyers can purchase: {bidIncrement.toFixed(2)} kg, {(bidIncrement * 2).toFixed(2)} kg, {(bidIncrement * 3).toFixed(2)} kg... up to {quantity} kg
            </Text>
          </View>
        )}

        {bidType === 'wholesale' && (!quantity || parseFloat(quantity) <= 0) && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Enter stock quantity above to calculate bulk unit sizes
            </Text>
          </View>
        )}
      </View>

      {/* Premium Add-ons */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Premium Services</Text>
        {Object.keys(services).map(renderServiceRow)}
      </View>

      {/* Bidding Duration */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Bidding Duration</Text>
        {renderDurationOptions()}
        
        {selectedDuration && (
          <View style={styles.timingInfoBox}>
            <Text style={styles.timingInfoLabel}>⏰ Auction Timing</Text>
            <Text style={styles.timingInfoText}>
              ✓ Starts: Now (Immediately after upload)
            </Text>
            <Text style={styles.timingInfoText}>
              ✓ Ends: In {selectedDuration === 'other' ? customDuration : selectedDuration} minutes
            </Text>
          </View>
        )}
      </View>

      {isRotten && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ Quality check failed. Cannot list spoiled products.</Text>
        </View>
      )}

      {/* Submit Button Actions */}
      <TouchableOpacity
        onPress={handleSubmit}
        style={[styles.submitButton, (isSubmitting || isRotten) && styles.disabledButton]}
        disabled={isSubmitting || isRotten}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Publish Auction Listing</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={resetForm}
        style={styles.resetButton}
        disabled={isSubmitting || isClassifying}
      >
        <Text style={styles.resetButtonText}>Reset Form</Text>
      </TouchableOpacity>

      {/* Premium UI Dialog Modal */}
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
  );
};

export default CreateProductBiddingForm;

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1e3a8a' },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 18, color: '#64748B', fontWeight: 'bold' },

  liveIndicatorBox: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 10, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  liveIndicatorText: { color: '#DC2626', fontSize: 13, fontWeight: '700', textAlign: 'center' },

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
  aiText: { color: '#64748B', fontWeight: '600' },
  aiTextMain: { fontWeight: 'bold', fontSize: 16, color: '#1E293B' },
  aiTextSub: { fontSize: 12, color: '#64748B' },

  premiumInput: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, fontSize: 16, color: '#1E293B', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  
  pickerWrapper: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  picker: { height: 55 },

  // Premium Toggle Button Styling
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 8 },
  toggleButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 10 },
  toggleActiveButton: { backgroundColor: '#1e3a8a', shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  toggleText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  toggleActiveText: { color: '#FFFFFF' },

  infoBox: { backgroundColor: '#EFF6FF', padding: 14, borderRadius: 12, marginBottom: 12, borderColor: '#BFDBFE', borderWidth: 1 },
  infoText: { color: '#1E40AF', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  infoTextSmall: { color: '#1E40AF', fontSize: 12, fontWeight: '400', lineHeight: 18, marginTop: 6 },
  
  warningBox: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 12, borderColor: '#FCD34D', borderWidth: 1 },
  warningText: { color: '#92400E', fontSize: 13, fontWeight: '500', lineHeight: 18 },

  timingInfoBox: { backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, marginTop: 12, borderColor: '#7DD3FC', borderWidth: 1 },
  timingInfoLabel: { color: '#0369A1', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  timingInfoText: { color: '#0C4A6E', fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 4 },

  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8, elevation: 1 },
  activeRow: { borderColor: '#1e3a8a', borderWidth: 1 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  customCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  customCheckboxChecked: { backgroundColor: '#1e3a8a', borderColor: '#1e3a8a' },
  checkmark: { width: 10, height: 5, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#FFF', transform: [{ rotate: '-45deg' }], marginTop: -2 },
  rowLabel: { fontSize: 15, color: '#334155', fontWeight: '500' },
  rowInput: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, width: 100, fontSize: 14, fontWeight: 'bold' },
  rowInputWide: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, width: 130, fontSize: 14, fontWeight: 'bold' },

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