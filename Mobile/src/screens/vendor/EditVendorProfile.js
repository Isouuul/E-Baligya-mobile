import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  doc, 
  Timestamp, 
  updateDoc 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const EditVendorProfile = ({ navigation }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    phone: '',
    businessAddress: '',
    businessType: '',
    profileImage: null,
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });

  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

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
        if (!snapshot.empty) {
          setFormData(snapshot.docs[0].data());
        }
      } catch (err) {
        console.error('Error fetching vendor data:', err);
        showSileo({ title: 'Load Failed', message: 'Failed to load profile.', type: 'warning' });
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [user, db]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        setFormData(prev => ({ ...prev, profileImage: `data:image/jpeg;base64,${base64}` }));
      }
    } catch (err) {
      console.error('Image pick error:', err);
      showSileo({ title: 'Image Error', message: 'Failed to pick image.', type: 'warning' });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sanitizedEmail = formData.email.replace(/\./g, '_');
      
      // 1. Submit to PendingVendors for admin review
      const pendingPayload = {
        userId: user.uid,
        email: formData.email ?? null,
        businessName: formData.businessName ?? null,
        ownerName: formData.ownerName ?? null,
        status: 'Pending',
        createdAt: Timestamp.now(),
        hasFullData: true,
      };

      await setDoc(doc(db, 'PendingVendors', sanitizedEmail), pendingPayload);
      await setDoc(doc(db, 'PendingVendors', sanitizedEmail, 'fullData', 'vendorData'), {
        ...formData,
        updatedAt: Timestamp.now(),
      });

      if (formData.profileImage) {
        await setDoc(
          doc(db, 'PendingVendors', sanitizedEmail, 'images', 'profileImage'),
          {
            image: formData.profileImage,
            type: 'profileImage',
            createdAt: Timestamp.now(),
          }
        );
      }

      // 2. Update the live ApprovedVendors document
      const approvedQuery = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
      const snapshot = await getDocs(approvedQuery);

      if (!snapshot.empty) {
        const docRef = doc(db, 'ApprovedVendors', snapshot.docs[0].id);
        await updateDoc(docRef, {
          ...formData,
          profileImage: formData.profileImage ?? snapshot.docs[0].data().profileImage,
          updatedAt: Timestamp.now(),
        });
      }

      showSileo({
        title: 'Success',
        message: 'Profile photo updated and changes sent for verification.',
        type: 'success',
        onPress: () => navigation.goBack(),
      });
    } catch (err) {
      console.error('Error submitting edit:', err);
      showSileo({ title: 'Submit Failed', message: 'Failed to submit changes.', type: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor Identity</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Profile Photo - THE ONLY EDITABLE PART */}
          <View style={styles.photoUploadSection}>
            <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
              {formData.profileImage ? (
                <Image source={{ uri: formData.profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="business" size={40} color="#cbd5e1" />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.uploadText}>Business Logo / Profile</Text>
          </View>

          {/* Business Info Group (LOCKED) */}
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase" size={18} color="#0f172a" />
            <Text style={styles.sectionTitle}>Business Entity</Text>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.label}>Business Name</Text>
            <View style={[styles.inputWrapper, styles.lockedInput]}>
              <Ionicons name="business-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.lockedText]}
                value={formData.businessName}
                editable={false}
              />
              <Ionicons name="lock-closed" size={14} color="#cbd5e1" style={{ marginRight: 15 }} />
            </View>

            <Text style={styles.label}>Location & Category</Text>
            <View style={styles.readOnlyContainer}>
              <View style={styles.readOnlyChip}>
                <Ionicons name="location" size={14} color="#64748b" />
                <Text style={styles.readOnlyText}>{formData.businessAddress}</Text>
              </View>
              <View style={styles.readOnlyChip}>
                <Ionicons name="pricetag" size={14} color="#64748b" />
                <Text style={styles.readOnlyText}>{formData.businessType}</Text>
              </View>
            </View>
          </View>

          {/* Contact Info Group (LOCKED) */}
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle" size={18} color="#0f172a" />
            <Text style={styles.sectionTitle}>Authorized Representative</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Full Owner Name</Text>
            <View style={[styles.inputWrapper, styles.lockedInput]}>
              <Ionicons name="person-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.lockedText]}
                value={formData.ownerName}
                editable={false}
              />
              <Ionicons name="lock-closed" size={14} color="#cbd5e1" style={{ marginRight: 15 }} />
            </View>

            <Text style={styles.label}>Mobile Number</Text>
            <View style={[styles.inputWrapper, styles.lockedInput]}>
              <Ionicons name="call-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.lockedText]}
                value={formData.phone}
                editable={false}
              />
              <Ionicons name="lock-closed" size={14} color="#cbd5e1" style={{ marginRight: 15 }} />
            </View>
          </View>

          {/* Help Callout */}
          <View style={styles.alertBox}>
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <Text style={styles.alertText}>
              Verified identity details are locked for security. Contact AgriFishery support to update legal business information.
            </Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.buttonDisabled]} 
            onPress={handleSave} 
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Confirm Profile Changes</Text>
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{marginLeft: 8}} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === 'success'
                  ? styles.sileoSuccessCircle
                  : sileoConfig.type === 'warning'
                    ? styles.sileoWarningCircle
                    : styles.sileoInfoCircle,
              ]}
            >
              <Ionicons
                name={
                  sileoConfig.type === 'success'
                    ? 'checkmark'
                    : sileoConfig.type === 'warning'
                      ? 'alert'
                      : 'information'
                }
                size={28}
                color="#fff"
              />
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default EditVendorProfile;

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingBottom: 25, 
    paddingTop: 10,
    backgroundColor: '#0f172a', 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24 
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },

  scrollContent: { padding: 24, paddingBottom: 60 },

  photoUploadSection: { alignItems: 'center', marginBottom: 30 },
  imageWrapper: { position: 'relative' },
  profileImage: { width: 110, height: 110, borderRadius: 35, borderWidth: 4, borderColor: '#fff' },
  imagePlaceholder: { width: 110, height: 110, borderRadius: 35, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' },
  cameraBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#2563eb', padding: 8, borderRadius: 12, borderWidth: 3, borderColor: '#f8fafc' },
  uploadText: { marginTop: 12, fontSize: 13, fontWeight: '700', color: '#64748b' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginLeft: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 1, marginLeft: 8 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginBottom: 25, borderWidth: 1, borderColor: '#f1f5f9' },
  
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginLeft: 2 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 18 },
  inputIcon: { marginLeft: 15 },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, fontSize: 15, color: '#0f172a', fontWeight: '500' },

  // Locked Styling
  lockedInput: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  lockedText: { color: '#94a3b8' },

  readOnlyContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  readOnlyChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  readOnlyText: { fontSize: 13, color: '#64748b', fontWeight: '600', marginLeft: 6 },

  alertBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  alertText: { flex: 1, fontSize: 12, color: '#1e40af', marginLeft: 10, lineHeight: 18, fontWeight: '500' },

  saveButton: { 
    flexDirection: 'row',
    backgroundColor: '#0f172a', 
    paddingVertical: 18, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  buttonDisabled: { backgroundColor: '#94a3b8' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  sileoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sileoModal: {
    width: '84%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
  },
  sileoIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sileoSuccessCircle: { backgroundColor: '#10b981' },
  sileoWarningCircle: { backgroundColor: '#f59e0b' },
  sileoInfoCircle: { backgroundColor: '#2563eb' },
  sileoTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  sileoMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
    fontWeight: '500',
  },
  sileoButton: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  sileoButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});