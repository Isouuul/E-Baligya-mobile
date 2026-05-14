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
import { Picker } from '@react-native-picker/picker';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { color: '#1E293B' };

/* ------------------------- PROGRESS STEPS UI ------------------------- */
const ProgressSteps = ({ currentStep = 1 }) => {
  const steps = ['Verify', 'Information', 'Selfie', 'Review'];

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

const UserSignupStep1 = ({ route, navigation }) => {
  const [govIDFront, setGovIDFront] = useState(null);
  const [govIDBack, setGovIDBack] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentStep = route?.params?.currentStep || 1;

  // Only Government ID logic retained
  const pickGovIDFront = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Denied');

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
      if (status !== 'granted') return Alert.alert('Permission Denied');

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

  if (!govIDFront || !govIDBack) {
    return Alert.alert('Missing Photos', 'Upload both sides of your ID.');
  }

  setIsLoading(true);

  try {
    navigation.navigate('SignupStep2', {
      currentStep: 2,

      // Step 1 data
      govIDFront,
      govIDBack,
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
          <Text style={styles.headerSubtitle}>Step 1 of 4</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <ProgressSteps currentStep={currentStep} />

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

      {/* FOOTER BUTTON */}
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
    </View>
  );
};

const styles = StyleSheet.create({
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

export default UserSignupStep1;