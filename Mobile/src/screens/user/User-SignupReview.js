import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, Timestamp, getDocs, query, collection, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

const ProgressSteps = ({ currentStep = 4 }) => {
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
              <View
                style={[
                  styles.circle,
                  completed && styles.completedCircle,
                  active && styles.activeCircle,
                ]}
              >
                {completed ? (
                  <Text style={styles.circleText}>✓</Text>
                ) : (
                  <Text style={[styles.circleText, !active && styles.inactiveText]}>{step}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, active && styles.activeStepLabel]}>{label}</Text>
            </View>
            {idx < steps.length - 1 && (
              <View
                style={[styles.line, { backgroundColor: completed ? '#2563EB' : '#E2E8F0' }]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const UserSignupReview = ({ route, navigation }) => {
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

const data = route?.params ?? {};
const requiredFields = [
  'email',
  'password',
  'firstName',
  'lastName',
  'phone',
  'govIDFront',
  'govIDBack',
  'selfieUri',
];

for (const field of requiredFields) {
  if (!data[field]) {
    Alert.alert('Missing Data', `Missing field: ${field}`);
    return;
  }
}
  const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');
  const homeAddress = [data.streetName, data.selectedBarangay, data.selectedCity].filter(Boolean).join(', ');
const birthDateValue = data.birthDate || '—';
const genderValue = data.gender || '—';
  const convertImageToBase64 = async (uri) => {
    if (!uri) return null;
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      return `data:image/jpeg;base64,${base64}`;
    } catch {
      return null;
    }
  };

  const existsByField = async (collectionName, field, value) => {
    if (!value) return false;
    const q = query(collection(db, collectionName), where(field, '==', value));
    const snap = await getDocs(q);
    return !snap.empty;
  };

const handleSubmit = async () => {
  if (!agreed) {
    return Alert.alert('Required', 'Please agree to the terms.');
  }

  if (!data.email || !data.password || !data.firstName || !data.lastName || !data.phone) {
    return Alert.alert('Missing Fields', 'Please fill in all required information.');
  }

  setLoading(true);

  try {
    const email = (data.email || '').trim().toLowerCase();
    const emailLower = email;

    // check duplicate email
    const emailExists = await existsByField('Users', 'emailLower', emailLower);

    if (emailExists) {
      return Alert.alert('Duplicate Email', 'This email is already registered.');
    }

    // create auth user
    const userCred = await createUserWithEmailAndPassword(auth, email, data.password);

    // convert images
    const [idFrontB64, idBackB64, selfieB64] = await Promise.all([
      convertImageToBase64(data.govIDFront),
      convertImageToBase64(data.govIDBack),
      convertImageToBase64(data.selfieUri),
    ]);

    // FIRESTORE SAVE (clean + simple like your reference)
    await setDoc(doc(db, 'Users', userCred.user.uid), {
      address: {
        barangay: data.selectedBarangay || '',
        city: data.selectedCity || '',
        region: "Region VI - Western Visayas",
        street: data.streetName || '',
        birthdate: data.birthDate || '',
      },
      email: email,
      emailLower: emailLower,

      firstName: data.firstName || '',
      lastName: data.lastName || '',
      middleName: data.middleName || '',

      phone: data.phone || '',

      gender: data.gender || '',

      idImage: idFrontB64 || '',
      idImageBack: idBackB64 || '',
      selfieImage: selfieB64 || '',

      role: 'Consumer',
      selectedIDType: data.selectedIDType || 'National ID',

      uid: userCred.user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    await signOut(auth);
    setShowSuccess(true);

  } catch (error) {
    if (error?.code === 'auth/email-already-in-use') {
      Alert.alert('Duplicate Email', 'This email already has an account.');
    } else {
      Alert.alert('Error', error.message || 'Failed to submit registration.');
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Account Setup</Text>
          <Text style={styles.headerSubtitle}>Step 4 of 4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ProgressSteps currentStep={4} />

        <View style={styles.reviewBanner}>
          <Text style={styles.bannerTitle}>Please review your information before submitting.</Text>
          <Text style={styles.bannerSubtitle}>All details should match your legal documents and uploaded ID.</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Image
              source={data.selfieUri ? { uri: data.selfieUri } : require('../../../assets/profile.png')}
              style={styles.profileImage}
            />
            <View style={styles.profileInfoBox}>
              <Text style={styles.profileName}>{fullName}</Text>
              <Text style={styles.profileRole}>Consumer</Text>
            </View>
          </View>
          <View style={styles.profileDetailsBox}>
            <ReviewItem label="Contact Number" value={data.phone} />
            <ReviewItem label="Email Address" value={data.email} />
            <ReviewItem label="Birth Date" value={birthDateValue} />
<ReviewItem label="Gender" value={genderValue} />
            <ReviewItem label="Home Address" value={homeAddress} />
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.sectionTitle}>Uploaded Documents</Text>
        <View style={styles.mediaGrid}>
          {[
            { uri: data.govIDFront, label: 'ID Front' },
            { uri: data.govIDBack, label: 'ID Back' },
          ].map((item, idx) => (
            <View style={styles.mediaBox} key={idx}>
              <Image source={{ uri: item.uri }} style={styles.mediaImage} />
              <Text style={styles.mediaLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.termsBox}>
          <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgreed(!agreed)}>
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Text style={styles.checkText}>✓</Text>}
            </View>
            <Text style={styles.termsLabel}>I declare that all information provided is true and correct.</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
<TouchableOpacity
  style={styles.sileoButton}
  onPress={() => {
    setShowSuccess(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }}
>
  <Text style={styles.sileoButtonText}>Continue</Text>
</TouchableOpacity>
      </View>

      {showSuccess && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View style={styles.sileoIconCircle}>
              <Text style={styles.sileoIcon}>✓</Text>
            </View>
            <Text style={styles.sileoTitle}>Account Created!</Text>
            <Text style={styles.sileoMessage}>Your consumer account has been successfully created.</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={() => { setShowSuccess(false); navigation.navigate('Login'); }}>
              <Text style={styles.sileoButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const ReviewItem = ({ label, value }) => (
  <View style={styles.reviewItem}>
    <Text style={styles.reviewLabel}>{label}</Text>
    <Text style={styles.reviewValue}>{value || '—'}</Text>
  </View>
);

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
      width: '80%',
      backgroundColor: '#fff',
      borderRadius: 22,
      padding: 32,
      alignItems: 'center',
      shadowColor: '#2563EB',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    sileoIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 18,
    },
    sileoIcon: {
      color: '#fff',
      fontSize: 36,
      fontWeight: 'bold',
    },
    sileoTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: '#2563EB',
      marginBottom: 8,
      textAlign: 'center',
    },
    sileoMessage: {
      fontSize: 15,
      color: '#475569',
      textAlign: 'center',
      marginBottom: 24,
      fontWeight: '500',
    },
    sileoButton: {
      backgroundColor: '#2563EB',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 32,
      alignItems: 'center',
      marginTop: 8,
    },
    sileoButtonText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 16,
      letterSpacing: 0.2,
    },
  mainWrapper: {
    flex: 1,
    backgroundColor: '#F4F6FB',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF2',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5EAF2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  backIcon: {
    fontSize: 22,
    color: '#1E293B',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  container: {
    padding: 20,
    paddingBottom: 0,
  },
  reviewBanner: {
    backgroundColor: '#EAF2FF',
    borderRadius: 18,
    padding: 22,
    marginBottom: 22,
    alignItems: 'center',
    borderLeftWidth: 6,
    borderLeftColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#2563EB',
    marginBottom: 4,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E5EAF2',
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    padding: 22,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5EAF2',
    marginRight: 18,
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  profileInfoBox: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  profileRole: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  profileDetailsBox: {
    marginTop: 10,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: '#E5EAF2',
    borderRadius: 2,
    marginVertical: 22,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },
  stepWrapper: {
    alignItems: 'center',
    minWidth: 60,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5EAF2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  activeCircle: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  completedCircle: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  circleText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
  inactiveText: {
    color: '#94A3B8',
  },
  stepLabel: {
    marginTop: 7,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activeStepLabel: {
    color: '#2563EB',
    fontWeight: '900',
  },
  line: {
    height: 2,
    flex: 1,
    marginTop: -16,
    marginHorizontal: -5,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  mediaGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18,
    marginBottom: 18,
  },
  mediaBox: {
    flex: 1,
    maxWidth: 140,
    minWidth: 110,
    alignItems: 'center',
    backgroundColor: '#F4F6FB',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5EAF2',
    shadowColor: '#2563EB',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaImage: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E5EAF2',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mediaLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginTop: 7,
    letterSpacing: 0.2,
  },
  termsBox: {
    marginTop: 28,
    padding: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 14,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#2563EB',
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  checkboxActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  termsLabel: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  reviewItem: {
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF2',
  },
  reviewLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  reviewValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5EAF2',
    shadowColor: '#2563EB',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  btn: {
    backgroundColor: '#2563EB',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#2563EB',
    shadowOpacity: 0.10,
    shadowRadius: 8,
  },
  btnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  btnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.2,
  },
});

export default UserSignupReview;
