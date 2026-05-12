// VendorSignupBusPermit.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

/* ------------------------- PROGRESS STEPS UI ------------------------- */
const ProgressSteps = ({ currentStep = 2 }) => {
  const steps = ['Verify', 'Business Permit', 'Information', 'Selfie', 'Review'];

  return (
    <View style={styles.progressContainer}>
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <React.Fragment key={label}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.completedCircle,
                  isActive && styles.activeCircle,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.circleText}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      !isActive && styles.inactiveText,
                    ]}
                  >
                    {stepNumber}
                  </Text>
                )}
              </View>

              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.activeStepLabel,
                ]}
              >
                {label}
              </Text>
            </View>

            {index < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: isCompleted ? '#2563EB' : '#E2E8F0' },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};




/* ------------------------- MAIN COMPONENT ------------------------- */
const VendorSignupBusPermit = ({ route, navigation }) => {
  const {
    govIDFront, govIDBack, govIDFrontText, govIDBackText,
    marketName, latitude, longitude, businessType,
    ownerName, birthDate, genderFromID
  } = route.params || {};

  const [permitImage, setPermitImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickPermitImage = async () => {
    try {
      console.log('Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission denied');
        return Alert.alert('Permission Denied', 'Camera roll permission is required to upload images.');
      }

      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (result.canceled) {
        console.log('Image picker canceled by user');
        return;
      }

      const uri = result.assets[0].uri;
      console.log('Selected image URI:', uri);

      console.log('Resizing image...');
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      console.log('Resized image URI:', resized.uri);
      setPermitImage(resized.uri);
    } catch (err) {
      console.error('Pick Permit Error:', err);
      Alert.alert('Error', 'Something went wrong while picking the image.');
    }
  };



  const handleNext = () => {
    if (!permitImage)
      return Alert.alert('Missing Image', 'Please upload your Business Permit.');

    setIsLoading(true);
    try {
      navigation.navigate('VendorSignupStep2', {
        govIDFront,
        govIDBack,
        marketName,
        latitude,
        longitude,
        businessType,
        ownerName,
        birthDate,
        genderFromID,
        permitImage,
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <View style={styles.mainWrapper}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Verification</Text>
          <Text style={styles.headerSubtitle}>Step 2 of 5</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ProgressSteps currentStep={2} />


        {/* BUSINESS PERMIT UPLOAD */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Business Permit Upload</Text>
          <Text style={styles.instructionText}>
            Upload your official business permit.
          </Text>

          <TouchableOpacity
            style={[styles.uploadZone, permitImage && styles.uploadZoneActive]}
            onPress={pickPermitImage}
          >
            {permitImage ? (
              <Image source={{ uri: permitImage }} style={styles.imagePreview} />
            ) : (
              <View style={styles.placeholderContent}>
                <Text style={styles.plusIcon}>+</Text>
                <Text style={styles.uploadBtnText}>Upload Business Permit</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FOOTER BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!permitImage || isLoading) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!permitImage || isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 16 },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  backIcon: { fontSize: 20, color: '#1E293B', fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 24 },
  stepWrapper: { alignItems: 'center', zIndex: 1 },
  circle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  activeCircle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  completedCircle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  circleText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  inactiveText: { color: '#94A3B8' },
  stepLabel: { marginTop: 6, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  activeStepLabel: { color: '#2563EB' },
  line: { height: 2, flex: 1, marginTop: -18, marginHorizontal: -10 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  instructionText: { fontSize: 12, color: '#94A3B8', marginBottom: 10 },

  uploadZone: { height: 180, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginTop: 8 },
  uploadZoneActive: { borderStyle: 'solid', borderColor: '#2563EB' },
  placeholderContent: { alignItems: 'center' },
  plusIcon: { fontSize: 32, color: '#94A3B8', marginBottom: 8 },
  uploadBtnText: { color: '#64748B', fontWeight: '600' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  nextButton: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  nextButtonDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default VendorSignupBusPermit;
