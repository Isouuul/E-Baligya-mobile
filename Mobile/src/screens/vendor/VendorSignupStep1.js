import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

/* ------------------------- PROGRESS STEPS UI ------------------------- */
const ProgressSteps = ({ currentStep = 1 }) => {
  const steps = ['Verify', 'Business Permit', 'Information', 'Selfie', 'Review'];

  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const step = idx + 1;
        const completed = step < currentStep;
        const active = step === currentStep;

        return (
          <React.Fragment key={idx}>
            <View style={styles.stepWrapper}>
              <View style={[
                styles.circle,
                active && styles.activeCircle,
                completed && styles.completedCircle
              ]}>
                {completed ? (
                  <Text style={styles.circleText}>✓</Text>
                ) : (
                  <Text style={[styles.circleText, !active && !completed && styles.inactiveText]}>{step}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.activeStepLabel]}>{label}</Text>
            </View>
            {idx < steps.length - 1 && (
              <View style={[styles.line, { backgroundColor: completed ? '#2563EB' : '#E2E8F0' }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};



/* ------------------------- MAIN COMPONENT ------------------------- */
const VendorSignupStep1 = ({ route, navigation }) => {
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [govIDFront, setGovIDFront] = useState(null);
  const [govIDBack, setGovIDBack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
  });

  const showSileo = ({ title, message = '', buttonText = 'OK', type = 'info' }) => {
    setSileoConfig({ title, message, buttonText, type });
    setSileoVisible(true);
  };

  const businessType = 'Seafood';
  const currentStep = route?.params?.currentStep || 1;

  const marketOptions = [
    { name: 'Bacolod Central Market', latitude: 10.66761, longitude: 122.94719 },
    { name: 'Libertad Public Market', latitude: 10.66012, longitude: 122.94971 },
    { name: 'Bacolod North (Burgos) Market', latitude: 10.66891, longitude: 122.95498 },
    { name: 'Sum-ag Public Market', latitude: 10.60353, longitude: 122.92110 },
    { name: 'Granada Public Market', latitude: 10.66576, longitude: 123.03425 },
    { name: 'Mansilingan Public Market', latitude: 10.63160, longitude: 122.97520 },
    { name: 'Villamonte Public Market', latitude: 10.66879, longitude: 122.96470 },
    { name: 'North Capitol Road (Pala-Pala Market)', latitude: 10.66369, longitude: 122.93918 },
  ];

  /* ------------------------- PICK IMAGE FUNCTIONS (LOGS RESTORED) ------------------------- */
  const pickGovIDFront = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return showSileo({
          title: 'Permission Denied',
          message: 'Camera roll permission is required to upload images.',
          type: 'warning',
        });
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const resized = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        setGovIDFront(resized.uri);
      }
    } catch (err) {
      console.error('Pick Front Error:', err);
    }
  };

  const pickGovIDBack = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return showSileo({
          title: 'Permission Denied',
          message: 'Camera roll permission is required to upload images.',
          type: 'warning',
        });
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const resized = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        setGovIDBack(resized.uri);
      }
    } catch (err) {
      console.error('Pick Back ID Error:', err);
    }
  };

  const handleNext = () => {
    if (isLoading) return;

    if (!selectedMarket) {
      return showSileo({
        title: 'Missing Field',
        message: 'Please select your market.',
        type: 'warning',
      });
    }
    if (!govIDFront || !govIDBack) {
      return showSileo({
        title: 'Missing Photos',
        message: 'Upload both sides of your ID.',
        type: 'warning',
      });
    }



    setIsLoading(true);
    try {
      navigation.navigate('VendorSignupBusPermit', {
        businessType,
        marketName: selectedMarket.name,
        latitude: selectedMarket.latitude,
        longitude: selectedMarket.longitude,
        govIDFront,
        govIDBack,
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <View style={styles.mainWrapper}>
      {/* IMPROVED HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Verification</Text>
          <Text style={styles.headerSubtitle}>Step 1 of 5</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <ProgressSteps currentStep={currentStep} />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Identity Details</Text>

          <Text style={styles.label}>Business Category</Text>
          <View style={styles.fixedValueBadge}>
            <Text style={styles.fixedValueText}>{businessType}</Text>
          </View>

          <Text style={styles.label}>Assigned Market</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedMarket?.name ?? ""}
              onValueChange={(value) => {
                const market = marketOptions.find((m) => m.name === value);
                setSelectedMarket(market || null);
              }}
              style={{ color: '#1E293B' }}
            >
              <Picker.Item label="Select market location" value="" color="#94A3B8" />
              {marketOptions.map((m, i) => <Picker.Item key={i} label={m.name} value={m.name} color="#1E293B" />)}
            </Picker>
          </View>
          {selectedMarket && (
            <View style={styles.selectedMarketDisplay}>
              <Text style={styles.selectedMarketText}>{selectedMarket.name}</Text>
            </View>
          )}

          {selectedMarket && (
            <View style={styles.coordBox}>
              <View style={styles.coordRow}>
                <Text style={styles.coordLabel}>Lat:</Text>
                <Text style={styles.coordValue}>{selectedMarket.latitude}</Text>
              </View>
              <View style={styles.coordRow}>
                <Text style={styles.coordLabel}>Long:</Text>
                <Text style={styles.coordValue}>{selectedMarket.longitude}</Text>
              </View>
            </View>
          )}
        </View>

        {/* FRONT ID SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Government ID (Front)</Text>
          <Text style={styles.instructionText}>Ensure the ID is clear and all text is readable.</Text>

          <TouchableOpacity
            style={[styles.uploadZone, govIDFront && styles.uploadZoneActive]}
            onPress={pickGovIDFront}
          >
            {govIDFront ? (
              <Image source={{ uri: govIDFront }} style={styles.imagePreview} />
            ) : (
              <View style={styles.placeholderContent}>
                <Text style={styles.plusIcon}>+</Text>
                <Text style={styles.uploadBtnText}>Upload Front Side</Text>
              </View>
            )}
          </TouchableOpacity>


        </View>

        {/* BACK ID SECTION */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Government ID (Back)</Text>

          <TouchableOpacity
            style={[styles.uploadZone, govIDBack && styles.uploadZoneActive]}
            onPress={pickGovIDBack}
          >
            {govIDBack ? (
              <Image source={{ uri: govIDBack }} style={styles.imagePreview} />
            ) : (
              <View style={styles.placeholderContent}>
                <Text style={styles.plusIcon}>+</Text>
                <Text style={styles.uploadBtnText}>Upload Back Side</Text>
              </View>
            )}
          </TouchableOpacity>


        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FIXED FOOTER BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (isLoading || !govIDFront || !govIDBack) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>

      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === 'warning' ? styles.sileoWarningCircle : styles.sileoInfoCircle,
              ]}
            >
              <Text style={styles.sileoIcon}>{sileoConfig.type === 'warning' ? '!' : 'i'}</Text>
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            {!!sileoConfig.message && <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>}
            <TouchableOpacity style={styles.sileoButton} onPress={() => setSileoVisible(false)}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sileoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(36, 41, 46, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  sileoModal: {
    width: '82%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  sileoIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  sileoWarningCircle: { backgroundColor: '#F59E0B' },
  sileoInfoCircle: { backgroundColor: '#2563EB' },
  sileoIcon: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
  },
  sileoTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  sileoMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
    lineHeight: 20,
  },
  sileoButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  sileoButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { padding: 16 },

  /* HEADER REVISED */
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  backIcon: { fontSize: 20, color: '#1E293B', fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  /* PROGRESS STEPS REVISED */
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  stepWrapper: { alignItems: 'center', zIndex: 1 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  completedCircle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  circleText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  inactiveText: { color: '#94A3B8' },
  stepLabel: { marginTop: 6, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  activeStepLabel: { color: '#2563EB' },
  line: { height: 2, flex: 1, marginTop: -18, marginHorizontal: -10 },

  /* CARDS & INPUTS */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  fixedValueBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 16,
  },
  fixedValueText: { color: '#2563EB', fontWeight: '700', fontSize: 15 },
  pickerWrapper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  selectedMarketDisplay: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  selectedMarketText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  coordBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 10,
  },
  coordRow: { flexDirection: 'row', alignItems: 'center' },
  coordLabel: { fontSize: 12, color: '#64748B', marginRight: 4 },
  coordValue: { fontSize: 12, fontWeight: 'bold', color: '#1E293B' },

  /* UPLOAD UI */
  uploadZone: {
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 8,
  },
  uploadZoneActive: { borderStyle: 'solid', borderColor: '#2563EB' },
  placeholderContent: { alignItems: 'center' },
  plusIcon: { fontSize: 32, color: '#94A3B8', marginBottom: 8 },
  uploadBtnText: { color: '#64748B', fontWeight: '600' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  instructionText: { fontSize: 12, color: '#94A3B8', marginBottom: 10 },

  /* FOOTER */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  nextButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0 },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default VendorSignupStep1;