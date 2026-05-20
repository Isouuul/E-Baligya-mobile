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
  SafeAreaView,
  Animated
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { auth, db } from '../../firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import phLocations from '../../data/ph_locations.json';

export default function AddAddress() {
  const navigation = useNavigation();
  const route = useRoute();
  const user = auth.currentUser;

  const [userData, setUserData] = useState({});
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [streetName, setStreetName] = useState('');
  const [postalCode, setPostalCode] = useState('6100');
  const [label, setLabel] = useState('Home');
  const [isDefault, setIsDefault] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [latitude, setLatitude] = useState(10.6689);
  const [longitude, setLongitude] = useState(122.9497);
  const [hasMapPin, setHasMapPin] = useState(false);

  // Focus tracking for premium input states
  const [focusedInput, setFocusedInput] = useState(null);

  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '', message: '', type: 'info', buttonText: 'OK', onClose: null,
  });

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
    if (typeof callback === 'function') callback();
  };

  useEffect(() => {
    if (route.params?.hasSelectedLocation) {
      setLatitude(route.params.selectedLatitude);
      setLongitude(route.params.selectedLongitude);
      setHasMapPin(true);
    }
    
    if (route.params?.savedFormState) {
      const { formBarangay, formStreet, formPhone, formLabel, formDefault } = route.params.savedFormState;
      if (formBarangay) setSelectedBarangay(formBarangay);
      if (formStreet) setStreetName(formStreet);
      if (formPhone) setPhoneNumber(formPhone);
      if (formLabel) setLabel(formLabel);
      if (formDefault !== undefined) setIsDefault(formDefault);
    }
  }, [route.params]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user) return;
      const userRef = doc(db, 'Users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserData(data);
        if (data.phoneNumber && !phoneNumber) setPhoneNumber(data.phoneNumber);
      }
    };
    fetchUser();
  }, [user]);

  const barangays = phLocations?.regions?.[selectedRegion]?.[selectedProvince]?.[selectedCity]?.barangays || [];

  const handleSaveAddress = async () => {
    if (!selectedBarangay) {
      showSileo({ title: 'Missing Field', message: 'Please select your barangay to continue.', type: 'warning' });
      return;
    }
    if (!hasMapPin) {
      showSileo({ title: 'Map Pin Required', message: 'Please pin your exact coordinates on the map map baseline.', type: 'warning' });
      return;
    }
    if (!streetName.trim()) {
      showSileo({ title: 'Missing Field', message: 'Please enter your street address details.', type: 'warning' });
      return;
    }
    if (!phoneNumber.trim()) {
      showSileo({ title: 'Missing Field', message: 'A secure contact number is required.', type: 'warning' });
      return;
    }
    if (!/^(09)\d{9}$/.test(phoneNumber)) {
      showSileo({ title: 'Invalid Contact', message: 'Please supply a verified 11-digit mobile number.', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      const userId = auth.currentUser.uid;
      const addressRef = collection(db, 'Users-Address', userId, 'addresses');

      if (isDefault) {
        const snapshot = await getDocs(addressRef);
        const updates = snapshot.docs.map(async (d) => {
          await updateDoc(doc(db, 'Users-Address', userId, 'addresses', d.id), {
            status: 'inactive',
          });
        });
        await Promise.all(updates);
      }
      
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
        status: isDefault ? 'active' : 'inactive', 
        latitude,
        longitude,
        createdAt: serverTimestamp(),
      };

      await addDoc(addressRef, addressData);

      showSileo({
        title: 'Address Saved',
        message: 'Your dynamic shipping destination has been stored securely.',
        type: 'success',
        onClose: () => navigation.navigate('AddressSelection'),
      });
    } catch (error) {
      console.error('Error saving address:', error);
      showSileo({ title: 'System Error', message: 'Could not record layout. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToMap = () => {
    navigation.navigate('UserAddressMapView', {
      latitude,
      longitude,
      savedFormState: {
        formBarangay: selectedBarangay,
        formStreet: streetName,
        formPhone: phoneNumber,
        formLabel: label,
        formDefault: isDefault
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Premium Minimalist Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerMainTitle}>Add Address</Text>
        <View style={{ width: 38 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* SECTION 1: CONTACT */}
        <Text style={styles.sectionTitle}>Contact Parameters</Text>
        <View style={styles.premiumCard}>
          <View style={[styles.inputGroup, styles.borderBottom]}>
            <Text style={styles.label}>Recipient Name</Text>
            <TextInput
              style={[styles.input, styles.disabledText]}
              value={`${userData.firstName || ''} ${userData.lastName || ''}`.trim()}
              editable={false}
            />
          </View>

          <View style={[styles.inputGroup, focusedInput === 'phone' && styles.focusedGroup]}>
            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 09123456789"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={11}
              placeholderTextColor="#94A3B8"
              onFocus={() => setFocusedInput('phone')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>
        </View>

        {/* SECTION 2: LOCATION CRITERIA */}
        <Text style={styles.sectionTitle}>Core Destination</Text>
        <View style={styles.premiumCard}>
          <View style={[styles.inputGroup, styles.borderBottom]}>
            <Text style={styles.label}>City & Province</Text>
            <Text style={styles.staticText}>{selectedCity}, {selectedProvince}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Barangay Sector</Text>
            <RNPickerSelect
                onValueChange={(value) => setSelectedBarangay(value)}
                items={barangays.map((b) => ({ label: b, value: b }))}
                value={selectedBarangay}
                placeholder={{ label: 'Tap to select barangay...', value: null }}
                style={pickerSelectStyles}
                useNativeAndroidPickerStyle={false}
                Icon={() => <Ionicons name="chevron-down" size={16} color="#64748B" style={{ marginTop: 2 }} />}
            />
          </View>
        </View>

        {/* EXPANDED MAP AND DETAILS SECTOR */}
        {selectedBarangay ? (
          <View>
            <Text style={styles.sectionTitle}>Geographic Verification</Text>
            
            {!hasMapPin ? (
              <TouchableOpacity 
                style={styles.mapSelectorButton}
                onPress={handleNavigateToMap}
                activeOpacity={0.8}
              >
                <View style={styles.mapSelectorIconCircle}>
                  <Ionicons name="map-outline" size={20} color="#0F172A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.mapSelectorText}>Establish Coordinates</Text>
                  <Text style={styles.mapSelectorSubtext}>Pin your home location on the satellite mesh</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : (
              <View style={styles.miniMapWrapper}>
                <View style={styles.miniMapContainer}>
                  <MapView
                    style={styles.miniMap}
                    region={{
                      latitude: latitude,
                      longitude: longitude,
                      latitudeDelta: 0.004,
                      longitudeDelta: 0.004,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    <Marker coordinate={{ latitude, longitude }} pinColor="#0F172A" />
                  </MapView>
                </View>

                <TouchableOpacity 
                  style={styles.changePinButton} 
                  onPress={handleNavigateToMap}
                  activeOpacity={0.7}
                >
                  <Ionicons name="locate-outline" size={14} color="#0F172A" />
                  <Text style={styles.changePinText}>Modify Coordinates</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.sectionTitle}>Street Address Details</Text>
            <View style={styles.premiumCard}>
              <View style={[styles.inputGroup, focusedInput === 'street' && styles.focusedGroup]}>
                <Text style={styles.label}>House No. / Building / Street Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Unit 4B, 123 Lopez Jaena St."
                  value={streetName}
                  onChangeText={setStreetName}
                  placeholderTextColor="#94A3B8"
                  onFocus={() => setFocusedInput('street')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>

            {/* PREFERENCES CARD */}
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.premiumCard}>
              <View style={styles.switchContainer}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.switchLabel}>Designate Primary</Text>
                  <Text style={styles.switchSub}>Set as preferred fallback address</Text>
                </View>
                <Switch
                  value={isDefault}
                  onValueChange={setIsDefault}
                  trackColor={{ false: '#E2E8F0', true: '#0F172A' }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* ADDRESS CLASSIFICATION TAGS */}
{/* ADDRESS CLASSIFICATION TAGS */}
<Text style={styles.sectionTitle}>Address Label</Text>
<View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 20 }}>
  {['Home', 'Work'].map((l) => {
    const isActive = label === l;
    return (
      <TouchableOpacity
        key={l}
        style={[styles.labelOption, isActive && styles.selectedLabel]}
        onPress={() => setLabel(l)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons 
          name={l === 'Home' ? 'home-variant-outline' : 'briefcase-outline'} 
          size={16} 
          color={isActive ? '#FFFFFF' : '#64748B'} 
        />
        <Text style={[styles.labelText, isActive && styles.selectedLabelText]}>{l}</Text>
      </TouchableOpacity>
    );
  })}
</View>

            {/* HIGH END SAVING TRIGGER */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress} disabled={loading} activeOpacity={0.9}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveButtonText}>Secure Location Configuration</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.onboardingSpacer}>
             <Ionicons name="map-outline" size={32} color="#94A3B8" style={{ marginBottom: 12 }} />
             <Text style={styles.onboardingHint}>Select a Barangay Sector above to begin geographic localization parameters.</Text>
          </View>
        )}
      </ScrollView>

      {/* LUXURY SYSTEM ALERTS MODAL */}
      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View style={[styles.sileoIconCircle, sileoConfig.type === 'warning' ? styles.sileoWarningCircle : sileoConfig.type === 'error' ? styles.sileoErrorCircle : sileoConfig.type === 'success' ? styles.sileoSuccessCircle : styles.sileoInfoCircle]}>
               <Ionicons 
                name={sileoConfig.type === 'success' ? "checkmark" : sileoConfig.type === 'warning' ? "alert-circle-outline" : "close"} 
                size={22} 
                color="#FFF" 
               />
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose} activeOpacity={0.8}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  
  // Premium Header Look matching modern system screens
  customHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerIconButton: { 
    width: 38, 
    height: 38, 
    borderRadius: 12, 
    backgroundColor: '#F8FAFC', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  headerMainTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 60 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 10, marginLeft: 4 },

  // Grouped Item Container Form Card
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.012,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  inputGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 64,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF'
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  focusedGroup: {
    backgroundColor: '#FAFAFA'
  },
  label: { fontSize: 11, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.1, marginBottom: 4 },
  input: { fontSize: 14, color: '#0F172A', fontWeight: '500', padding: 0 },
  disabledText: { color: '#64748B' },
  staticText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },

  // Premium Custom Map Launcher
  mapSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  mapSelectorIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  mapSelectorText: { fontSize: 14, color: '#0F172A', fontWeight: '600', letterSpacing: -0.1 },
  mapSelectorSubtext: { fontSize: 12, color: '#64748B', marginTop: 2 },

  // Premium Miniature Map Mesh
  miniMapWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  miniMapContainer: {
    height: 140,
    width: '100%',
    backgroundColor: '#F1F5F9',
  },
  miniMap: { ...StyleSheet.absoluteFillObject },
  changePinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    gap: 6
  },
  changePinText: { color: '#0F172A', fontSize: 13, fontWeight: '600' },

  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A', letterSpacing: -0.1 },
  switchSub: { fontSize: 12, color: '#64748B', marginTop: 1 },

  // Luxury classification pill design
  labelOption: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  selectedLabel: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  labelText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  selectedLabelText: { color: '#FFFFFF' },

  saveButton: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14, letterSpacing: -0.1 },

  onboardingSpacer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  onboardingHint: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  // System Notification Modals styling update
  sileoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.25)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  sileoModal: { width: '80%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
  sileoIconCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  sileoWarningCircle: { backgroundColor: '#F59E0B' },
  sileoInfoCircle: { backgroundColor: '#0F172A' },
  sileoErrorCircle: { backgroundColor: '#EF4444' },
  sileoSuccessCircle: { backgroundColor: '#10B981' },
  sileoTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  sileoMessage: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 20, lineHeight: 18, fontWeight: '400' },
  sileoButton: { backgroundColor: '#0F172A', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  sileoButtonText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: { fontSize: 14, paddingVertical: 4, color: '#0F172A', fontWeight: '500', paddingRight: 30 },
  inputAndroid: { fontSize: 14, color: '#0F172A', fontWeight: '500', paddingRight: 30, paddingVertical: 0 },
  iconContainer: { right: 0, top: 2 },
});