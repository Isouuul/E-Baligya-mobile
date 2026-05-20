// src/screens/Users/AddressSelection.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  addDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Swipeable } from 'react-native-gesture-handler';
import MapView, { Marker } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

export default function AddressSelection() {
  const user = auth.currentUser;
  const navigation = useNavigation();

  // ✅ PHONE VALIDATOR (Logic Untouched)
  const isValidPhoneNumber = (number) => {
    if (!number) return false;
    const phRegex = /^(09\d{9}|\+639\d{9})$/;
    return phRegex.test(number.trim());
  };

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', phoneNumber: '' });
  const [phoneInput, setPhoneInput] = useState('');

  // Success Animation
  const [successVisible, setSuccessVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const showSuccess = () => {
    setSuccessVisible(true);
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
      easing: Easing.out(Easing.back(1.5)),
    }).start(() => {
      setTimeout(() => {
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => setSuccessVisible(false));
      }, 1600);
    });
  };

  // Delete Modal State
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchUserInfo = async () => {
      try {
        const userDocRef = doc(db, 'Users', user.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserInfo(data);
          setPhoneInput(data.phoneNumber || '');
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };
    fetchUserInfo();

    const q = query(collection(db, 'Users-Address', user.uid, 'addresses'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (a.status === 'active' ? -1 : 1));
      setAddresses(list);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleSelectAddress = async (selectedAddr) => {
    try {
      setLoading(true);
      const addressRef = collection(db, 'Users-Address', user.uid, 'addresses');
      const snapshot = await getDocs(addressRef);
      const updates = snapshot.docs.map(async (d) => {
        await updateDoc(doc(db, 'Users-Address', user.uid, 'addresses', d.id), {
          status: d.id === selectedAddr.id ? 'active' : 'inactive',
        });
      });
      await Promise.all(updates);
      showSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = () => navigation.navigate('AddAddress');

  const handlePinLocation = async () => {
    try {
      setLocationLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!loc || !loc.coords) {
        Alert.alert('Error', 'Unable to get your current location. Please try again.');
        setLocationLoading(false);
        return;
      }

      const { latitude, longitude } = loc.coords;
      
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        Alert.alert('Error', 'Invalid coordinates received. Please try again.');
        setLocationLoading(false);
        return;
      }

      setSelectedCoords({ latitude, longitude });
      setMapModalVisible(true);
    } catch (error) {
      console.error('Pin location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please check your permissions and try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedCoords) return;

    if (!phoneInput.trim()) {
      Alert.alert('Phone number required', 'Please enter a contact number before saving.');
      return;
    }

    if (!isValidPhoneNumber(phoneInput)) {
      Alert.alert('Invalid phone number', 'Use 09XXXXXXXXX or +639XXXXXXXXX.');
      return;
    }

    try {
      setLoading(true);
      const { latitude, longitude } = selectedCoords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });

      const newAddress = {
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName || '',
        phoneNumber: phoneInput.trim(),
        streetName: place?.street || '',
        barangay: place?.subregion || '',
        city: place?.city || '',
        province: place?.region || '',
        region: place?.country || '',
        latitude,
        longitude,
        status: 'active',
      };

      const addressRef = collection(db, 'Users-Address', user.uid, 'addresses');
      const snapshot = await getDocs(addressRef);
      await Promise.all(
        snapshot.docs.map(d =>
          updateDoc(doc(db, 'Users-Address', user.uid, 'addresses', d.id), {
            status: 'inactive',
          })
        )
      );

      await addDoc(addressRef, newAddress);
      setMapModalVisible(false);
      setPhoneInput('');
      showSuccess();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save address.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = (addrId) => {
    setSelectedAddressId(addrId);
    setDeleteModalVisible(true);
  };

  const renderRightActions = (addrId) => (
    <TouchableOpacity 
      style={styles.deleteSwipeBtn} 
      onPress={() => handleDeleteAddress(addrId)}
      activeOpacity={0.9}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#0F172A" />
        <Text style={styles.loadingText}>Fetching profile details</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Premium minimal header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>Saved Addresses</Text>
        <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <Ionicons name="location-outline" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="map-outline" size={38} color="#64748B" />
            </View>
            <Text style={styles.emptyText}>No addresses recorded</Text>
            <Text style={styles.emptySubText}>Add a location baseline below to enable seamless checkouts.</Text>
          </View>
        ) : (
          addresses.map((addr) => (
            <Swipeable key={addr.id} renderRightActions={() => renderRightActions(addr.id)} containerStyle={styles.swipeContainer}>
              <TouchableOpacity
                style={[styles.addressCard, addr.status === 'active' && styles.activeCard]}
                onPress={() => handleSelectAddress(addr)}
                activeOpacity={0.85}
              >
                <View style={styles.cardMain}>
                  <View style={styles.cardHeader}>
                    <View style={styles.nameRow}>
                      <View style={[styles.addressIconWrapper, addr.status === 'active' && styles.activeIconWrapper]}>
                        <Ionicons 
                          name={addr.status === 'active' ? "home" : "home-outline"} 
                          size={16} 
                          color={addr.status === 'active' ? "#0F172A" : "#64748B"} 
                        />
                      </View>
                      <Text style={styles.nameText}>
                        {addr.firstName || userInfo.firstName} {addr.lastName || userInfo.lastName}
                      </Text>
                    </View>
                    {addr.status === 'active' && (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Primary</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.addressDetails}>
                    <Text style={styles.infoTextPrimary} numberOfLines={1}>
                      {addr.streetName || "Unspecified Street"}
                    </Text>
                    <Text style={styles.infoTextSecondary}>
                      {addr.barangay}, {addr.city}, {addr.province}
                    </Text>
                    <View style={styles.phoneRow}>
                      <Ionicons name="call-outline" size={12} color="#94A3B8" />
                      <Text style={styles.phoneText}>{addr.phoneNumber || userInfo.phoneNumber}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          ))
        )}
      </ScrollView>

      {/* Floating Bottom Action Section */}
      <View style={styles.bottomFooter}>
        <TouchableOpacity style={styles.footerAddBtn} onPress={handleAddAddress} activeOpacity={0.9}>
          <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.footerAddText}>Add Secure Address</Text>
        </TouchableOpacity>
      </View>

      {/* Modernized Ultra-smooth Success Modal */}
      {successVisible && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successBox, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.successCircle}>
               <Ionicons name="checkmark" size={28} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Configuration Saved</Text>
            <Text style={styles.successSub}>Your changes are secure and live.</Text>
          </Animated.View>
        </View>
      )}

      {/* Contemporary Styled Map Sheets */}
      <Modal visible={mapModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
                <Text style={styles.mapHeaderText}>Confirm Coordinates</Text>
                <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.mapCloseBtn}>
                   <Ionicons name="close" size={20} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {selectedCoords && selectedCoords.latitude && selectedCoords.longitude ? (
              <>
                <MapView
                  style={styles.mapView}
                  initialRegion={{
                    latitude: selectedCoords.latitude,
                    longitude: selectedCoords.longitude,
                    latitudeDelta: 0.006,
                    longitudeDelta: 0.006,
                  }}
                  zoomEnabled
                  scrollEnabled
                  pitchEnabled={false}
                  rotateEnabled={false}
                  onPress={(e) => {
                    if (e?.nativeEvent?.coordinate) setSelectedCoords(e.nativeEvent.coordinate);
                  }}
                >
                  <Marker 
                    coordinate={selectedCoords} 
                    draggable 
                    onDragEnd={(e) => {
                      if (e?.nativeEvent?.coordinate) setSelectedCoords(e.nativeEvent.coordinate);
                    }} 
                  />
                </MapView>

                <View style={styles.mapInputArea}>
                  <Text style={styles.inputLabel}>Secure Contact Reference</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={16} color="#64748B" style={{marginRight: 10}} />
                    <TextInput
                      style={styles.mapTextInput}
                      keyboardType="phone-pad"
                      placeholder="e.g. 09123456789"
                      placeholderTextColor="#94A3B8"
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                    />
                  </View>
                </View>
              </>
            ) : (
              <ActivityIndicator size="small" color="#0F172A" style={{ flex: 1 }} />
            )}

            <View style={styles.mapActions}>
              <TouchableOpacity
                style={[styles.saveLocBtn, !isValidPhoneNumber(phoneInput) && styles.disabledBtn]}
                disabled={!isValidPhoneNumber(phoneInput)}
                onPress={handleSaveLocation}
                activeOpacity={0.9}
              >
                <Text style={styles.saveLocText}>Lock Dynamic Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contextual Delete Confirmation Alert Alternative */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmBox}>
            <Text style={styles.deleteTitle}>Remove Address?</Text>
            <Text style={styles.deleteText}>This clears data points permanently from checkout memory storage.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDelBtn}
                activeOpacity={0.9}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await deleteDoc(doc(db, 'Users-Address', user.uid, 'addresses', selectedAddressId));
                    setDeleteModalVisible(false);
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.confirmDelText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50, // Styled elegant height padding spacing matching iOS status bars smoothly
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12, // Contemporary soft square look instead of extreme circular style
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  headerTitleText: { fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  swipeContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden'
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.015,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  activeCard: { 
    borderColor: '#0F172A', 
    backgroundColor: '#FFF',
    borderWidth: 1.5 
  },
  cardMain: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addressIconWrapper: {
    width: 32,
    height: 32,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  activeIconWrapper: {
    backgroundColor: '#F1F5F9',
  },
  nameText: { fontSize: 15, fontWeight: '600', color: '#0F172A', letterSpacing: -0.1 },
  activePill: { backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activePillText: { color: '#fff', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  addressDetails: { marginLeft: 2 },
  infoTextPrimary: { fontSize: 14, color: '#334155', fontWeight: '500', marginBottom: 2 },
  infoTextSecondary: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneText: { fontSize: 13, color: '#64748B', fontWeight: '400' },
  deleteSwipeBtn: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
    borderRadius: 16,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '400', letterSpacing: -0.1 },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 30 },
  emptyIconCircle: { width: 74, height: 74, borderRadius: 24, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#0F172A', fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  emptySubText: { color: '#64748B', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  bottomFooter: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(255,255,255,0.85)', padding: 20, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerAddBtn: { backgroundColor: '#0F172A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 14, paddingVertical: 14, shadowColor: '#0F172A', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  footerAddText: { color: '#fff', fontWeight: '600', fontSize: 15, letterSpacing: -0.1 },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  successBox: { backgroundColor: '#fff', padding: 24, borderRadius: 24, alignItems: 'center', width: '75%', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20 },
  successCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  successTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  successSub: { fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' },
  mapModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  mapContainer: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, height: '88%', padding: 24 },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mapHeaderText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  mapCloseBtn: { width: 30, height: 30, backgroundColor: '#F1F5F9', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  mapView: { flex: 1, borderRadius: 16, marginBottom: 20 },
  mapInputArea: { marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  mapTextInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#0F172A', fontWeight: '500' },
  mapActions: { marginBottom: 15 },
  saveLocBtn: { backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveLocText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabledBtn: { backgroundColor: '#CBD5E1' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.2)', justifyContent: 'center', alignItems: 'center' },
  deleteConfirmBox: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
  deleteTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  deleteText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  confirmDelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center' },
  confirmDelText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});