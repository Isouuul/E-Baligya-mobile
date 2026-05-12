import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  StatusBar,
  ActivityIndicator,
  SafeAreaView, Animated
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import phLocations from '../../data/ph_locations.json';

export default function AddAddress() {
  const navigation = useNavigation();
  const user = auth.currentUser;

  const [userData, setUserData] = useState({});
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [streetName, setStreetName] = useState('');
  const [postalCode, setPostalCode] = useState('6100');
  const [label, setLabel] = useState('Home');
  const [isDefault, setIsDefault] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    buttonText: 'OK',
    onClose: null,
  });

  // Default location (Bacolod City, Western Visayas)
  const selectedRegion = 'Western Visayas';
  const selectedProvince = 'Negros Occidental';
  const selectedCity = 'Bacolod City';

  const showSileo = ({ title, message, type = 'info', buttonText = 'OK', onClose = null }) => {
    setSileoConfig({ title, message, type, buttonText, onClose });
    setSileoVisible(true);
  };

  const handleSileoClose = () => {
    const callback = sileoConfig.onClose;
    setSileoVisible(false);
    if (typeof callback === 'function') {
      callback();
    }
  };

  useEffect(() => {
    if (!sileoVisible) return;
    const timeout = setTimeout(() => {
      handleSileoClose();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [sileoVisible, sileoConfig]);

  // ✅ Logic Preserved: Load user info
  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      const userRef = doc(db, 'Users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      }
    };
    fetchUser();
  }, [user]);

  // ✅ Logic Preserved: Get barangays
  const barangays =
    phLocations?.regions?.[selectedRegion]?.[selectedProvince]?.[selectedCity]
      ?.barangays || [];

  // ✅ Logic Preserved: Strict validation and save logic
  const handleSaveAddress = async () => {
    if (!selectedBarangay) {
      showSileo({
        title: 'Missing Information',
        message: 'Please select a barangay.',
        type: 'warning',
      });
      return;
    }
    if (!streetName.trim()) {
      showSileo({
        title: 'Missing Information',
        message: 'Please enter your street name.',
        type: 'warning',
      });
      return;
    }
    if (!phoneNumber.trim()) {
      showSileo({
        title: 'Missing Information',
        message: 'Please enter your phone number.',
        type: 'warning',
      });
      return;
    }
    if (!/^(09)\d{9}$/.test(phoneNumber)) {
      showSileo({
        title: 'Invalid Number',
        message: 'Please enter a valid 11-digit phone number starting with 09.',
        type: 'warning',
      });
      return;
    }
    if (!auth.currentUser) {
      showSileo({
        title: 'Error',
        message: 'You must be logged in to save your address.',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
      const addressData = {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        region: selectedRegion,
        province: selectedProvince,
        city: selectedCity,
        barangay: selectedBarangay,
        streetName,
        phoneNumber,
        postalCode,
        label,
        isDefault,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'Users-Address', userId, 'addresses'), addressData);
      showSileo({
        title: 'Success',
        message: 'Address saved successfully!',
        type: 'success',
        onClose: () => navigation.goBack(),
      });
    } catch (error) {
      console.error('Error saving address:', error);
      showSileo({
        title: 'Error',
        message: 'Something went wrong while saving your address.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ✅ PROFESSIONAL HEADER (Matches Product.js style) */}
      <View style={styles.customHeader}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconButton}>
            <Ionicons name="chevron-back" size={24} color="#1E3A8A" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerMainTitle}>Add Address</Text>
            <Text style={styles.headerSubTitle}>Set your delivery location</Text>
          </View>
          <View style={{ width: 45 }} /> 
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="account-outline" size={20} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>Contact Information</Text>
        </View>

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <View style={[styles.inputWrapper, styles.disabledInput]}>
            <TextInput
              style={styles.input}
              value={`${userData.firstName || ''} ${userData.lastName || ''}`.trim()}
              editable={false}
            />
          </View>
        </View>

        {/* Phone Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="09123456789"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={11}
            />
          </View>
        </View>

        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={20} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>Address Information</Text>
        </View>

        {/* Static Fields in a 2-column or simple row design */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location</Text>
          <View style={[styles.inputWrapper, styles.disabledInput]}>
            <Text style={styles.staticText}>{selectedCity}, {selectedProvince}</Text>
          </View>
        </View>

        {/* Barangay Dropdown */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Barangay</Text>
          <View style={styles.inputWrapper}>
            <RNPickerSelect
                onValueChange={(value) => setSelectedBarangay(value)}
                items={barangays.map((b) => ({ label: b, value: b }))}
                value={selectedBarangay}
                placeholder={{ label: 'Select your Barangay...', value: null }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
                Icon={() => <Ionicons name="chevron-down" size={20} color="#94A3B8" />}
            />
          </View>
        </View>

        {selectedBarangay && (
          <Animated.View style={styles.expandedFields}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Street / Building / House No.</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123 Lopez Jaena St."
                  value={streetName}
                  onChangeText={setStreetName}
                />
              </View>
            </View>

            <View style={styles.switchContainer}>
              <View>
                <Text style={styles.switchLabel}>Set as Default</Text>
                <Text style={styles.switchSub}>Use this for future checkouts</Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: '#E2E8F0', true: '#1E3A8A' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={[styles.label, { marginTop: 15 }]}>Address Label</Text>
            <View style={styles.labelButtons}>
              {['Home', 'Work'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.labelOption, label === l && styles.selectedLabel]}
                  onPress={() => setLabel(l)}
                >
                  <MaterialCommunityIcons 
                    name={l === 'Home' ? 'home-outline' : 'briefcase-outline'} 
                    size={18} 
                    color={label === l ? '#fff' : '#64748B'} 
                  />
                  <Text style={[styles.labelText, label === l && styles.selectedLabelText]}> {l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveAddress}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Address</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === 'warning'
                  ? styles.sileoWarningCircle
                  : sileoConfig.type === 'error'
                    ? styles.sileoErrorCircle
                    : sileoConfig.type === 'success'
                      ? styles.sileoSuccessCircle
                      : styles.sileoInfoCircle,
              ]}
            >
              <Text style={styles.sileoIcon}>
                {sileoConfig.type === 'warning'
                  ? '!'
                  : sileoConfig.type === 'error'
                    ? '×'
                    : sileoConfig.type === 'success'
                      ? '✓'
                      : 'i'}
              </Text>
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
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // Professional Rounded Header
  customHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIconButton: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { alignItems: 'center' },
  headerMainTitle: { fontSize: 18, fontWeight: '900', color: '#1E3A8A' },
  headerSubTitle: { fontSize: 11, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },

  scrollContent: { padding: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1E3A8A', marginLeft: 8 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.02,
  },
  input: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
  disabledInput: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  staticText: { fontSize: 15, color: '#64748B', fontWeight: '600' },

  expandedFields: { marginTop: 10 },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  switchLabel: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  switchSub: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  labelButtons: { flexDirection: 'row', marginTop: 5 },
  labelOption: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 25,
    marginRight: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  selectedLabel: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  labelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  selectedLabelText: { color: '#fff' },

  saveButton: {
    backgroundColor: '#1E3A8A',
    borderRadius: 15,
    paddingVertical: 16,
    marginTop: 30,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.3,
    marginBottom: 40
  },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Sileo Modal
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
    width: '84%',
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
  sileoErrorCircle: { backgroundColor: '#EF4444' },
  sileoSuccessCircle: { backgroundColor: '#16A34A' },
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
});

// Dropdown Styles
const pickerSelectStyles = StyleSheet.create({
  inputIOS: { fontSize: 15, paddingVertical: 12, color: '#1E293B', fontWeight: '600' },
  inputAndroid: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
  iconContainer: { top: 15, right: 0 },
});