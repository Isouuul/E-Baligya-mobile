import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

const ProgressSteps = ({ currentStep = 3 }) => {
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
              <View style={[styles.circle, active && styles.activeCircle, completed && styles.completedCircle]}>
                {completed ? <Text style={styles.circleText}>✓</Text> : (
                  <Text style={[styles.circleText, !active && styles.inactiveText]}>{step}</Text>
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

const UserSignupStep3 = ({ route, navigation }) => {
  const allDataFromPreviousSteps = route.params || {};
  const [selfie, setSelfie] = useState(null);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera access to take a selfie.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled) {
      setSelfie(result.assets[0].uri);
    }
  };

  const handleNext = () => {
    if (!selfie) {
      Alert.alert('Selfie Required', 'Please take a clear selfie to proceed.');
      return;
    }

    // Create a complete payload with all previous data plus selfie
    const completeData = {
      ...allDataFromPreviousSteps,
      selfieUri: selfie,
      // Ensure all critical fields are present with defaults
      firstName: allDataFromPreviousSteps.firstName || '',
      middleName: allDataFromPreviousSteps.middleName || '',
      lastName: allDataFromPreviousSteps.lastName || '',
      email: allDataFromPreviousSteps.email || '',
      phone: allDataFromPreviousSteps.phone || '',
      password: allDataFromPreviousSteps.password || '',
      selectedCity: allDataFromPreviousSteps.selectedCity || '',
      selectedBarangay: allDataFromPreviousSteps.selectedBarangay || '',
      streetName: allDataFromPreviousSteps.streetName || '',
      govIDFront: allDataFromPreviousSteps.govIDFront || '',
      govIDBack: allDataFromPreviousSteps.govIDBack || '',
      govIDFrontText: allDataFromPreviousSteps.govIDFrontText || {},
      govIDBackText: allDataFromPreviousSteps.govIDBackText || {},
      birthDateFromID: allDataFromPreviousSteps.birthDateFromID || '',
      genderFromID: allDataFromPreviousSteps.genderFromID || '',
    };

    navigation.navigate('SignupReview', completeData);
  };

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Face Verification</Text>
          <Text style={styles.headerSubtitle}>Step 3 of 4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ProgressSteps currentStep={3} />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Take a Selfie</Text>
          <Text style={styles.instructionText}>
            Ensure your face is well-lit and clearly visible within the frame. This will be compared with your ID.
          </Text>

          <View style={styles.cameraContainer}>
            {selfie ? (
              <Image source={{ uri: selfie }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholderCircle}>
                <Text style={styles.placeholderIcon}>👤</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.cameraButton} onPress={takeSelfie}>
            <Text style={styles.cameraButtonText}>{selfie ? 'Retake Selfie' : 'Take Selfie'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dataPreview}>
          <Text style={styles.dataTitle}>VERIFYING IDENTITY FOR</Text>
          <Text style={styles.dataText}>
            {[allDataFromPreviousSteps.firstName, allDataFromPreviousSteps.middleName, allDataFromPreviousSteps.lastName]
              .filter(Boolean)
              .join(' ') || 'Unknown User'}
          </Text>
          <Text style={styles.dataSubText}>{allDataFromPreviousSteps.email}</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !selfie && styles.disabledButton]}
          onPress={handleNext}
          disabled={!selfie}
        >
          <Text style={styles.nextText}>Review Application</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  backIcon: { fontSize: 20, color: '#1E293B', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B' },

  container: { padding: 16 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 10 },
  stepWrapper: { alignItems: 'center' },
  circle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  activeCircle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  completedCircle: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  circleText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  inactiveText: { color: '#94A3B8' },
  stepLabel: { marginTop: 6, fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  activeStepLabel: { color: '#2563EB' },
  line: { height: 2, flex: 1, marginTop: -18, marginHorizontal: -5 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  instructionText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  cameraContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderCircle: { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 60, opacity: 0.2 },
  previewImage: { width: '100%', height: '100%' },

  cameraButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    alignItems: 'center'
  },
  cameraButtonText: { color: '#1E293B', fontWeight: '700', fontSize: 14 },

  dataPreview: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB'
  },
  dataTitle: { fontSize: 10, color: '#2563EB', fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 },
  dataText: { fontSize: 15, color: '#1E293B', fontWeight: '700' },
  dataSubText: { fontSize: 13, color: '#64748B' },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  nextButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center' },
  disabledButton: { backgroundColor: '#CBD5E1' },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});

export default UserSignupStep3;
