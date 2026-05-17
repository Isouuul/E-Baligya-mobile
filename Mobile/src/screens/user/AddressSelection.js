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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

const { width } = Dimensions.get('window');

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
  const [mapLoading, setMapLoading] = useState(false);
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
      easing: Easing.bounce,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setSuccessVisible(false));
      }, 1500);
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
      
      // Validate coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || 
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        Alert.alert('Error', 'Invalid coordinates received. Please try again.');
        setLocationLoading(false);
        return;
      }

      setSelectedCoords({
        latitude,
        longitude,
      });

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
    <TouchableOpacity style={styles.deleteSwipeBtn} onPress={() => handleDeleteAddress(addrId)}>
      <Ionicons name="trash" size={24} color="#fff" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>Delivery Addresses</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="map-outline" size={50} color="#94A3B8" />
            </View>
            <Text style={styles.emptyText}>No saved addresses yet</Text>
            <Text style={styles.emptySubText}>Add an address to start ordering!</Text>
          </View>
        ) : (
          addresses.map((addr) => (
            <Swipeable key={addr.id} renderRightActions={() => renderRightActions(addr.id)}>
              <TouchableOpacity
                style={[styles.addressCard, addr.status === 'active' && styles.activeCard]}
                onPress={() => handleSelectAddress(addr)}
                activeOpacity={0.7}
              >
                <View style={styles.cardMain}>
                  <View style={styles.cardHeader}>
                    <View style={styles.nameRow}>
                      <Ionicons 
                        name={addr.status === 'active' ? "location" : "location-outline"} 
                        size={20} 
                        color={addr.status === 'active' ? "#1E3A8A" : "#64748B"} 
                      />
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
                    <Text style={styles.infoText} numberOfLines={1}>
                      {addr.streetName}
                    </Text>
                    <Text style={styles.infoText}>
                      {addr.barangay}, {addr.city}
                    </Text>
                    <Text style={styles.infoText}>
                      {addr.province}, {addr.region}
                    </Text>
                    <View style={styles.phoneRow}>
                      <Ionicons name="call-outline" size={14} color="#64748B" />
                      <Text style={styles.phoneText}>{addr.phoneNumber || userInfo.phoneNumber}</Text>
                    </View>
                  </View>
                </View>

                {addr.status === 'active' && (
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark-circle" size={24} color="#1E3A8A" />
                  </View>
                )}
              </TouchableOpacity>
            </Swipeable>
          ))
        )}
      </ScrollView>

      <View style={styles.bottomFooter}>
        <TouchableOpacity style={styles.footerAddBtn} onPress={handleAddAddress}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.footerAddText}>Add New Address</Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      {successVisible && (
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successBox, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.successCircle}>
               <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Updated!</Text>
            <Text style={styles.successSub}>Your address has been saved.</Text>
          </Animated.View>
        </View>
      )}

      {/* Map Modal */}
      <Modal visible={mapModalVisible} animationType="slide" transparent>
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapContainer}>
            <View style={styles.mapHeader}>
                <Text style={styles.mapHeaderText}>Confirm Location</Text>
                <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.mapCloseBtn}>
                   <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
            </View>

            {selectedCoords && selectedCoords.latitude && selectedCoords.longitude ? (
              <>
                <MapView
                  style={styles.mapView}
                  initialRegion={{
                    latitude: selectedCoords.latitude,
                    longitude: selectedCoords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  zoomEnabled={true}
                  scrollEnabled={true}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  onPress={(e) => {
                    if (e && e.nativeEvent && e.nativeEvent.coordinate) {
                      setSelectedCoords(e.nativeEvent.coordinate);
                    }
                  }}
                >
                  {selectedCoords.latitude && selectedCoords.longitude && (
                    <Marker 
                      key={`${selectedCoords.latitude}-${selectedCoords.longitude}`}
                      coordinate={selectedCoords} 
                      draggable 
                      onDragEnd={(e) => {
                        if (e && e.nativeEvent && e.nativeEvent.coordinate) {
                          setSelectedCoords(e.nativeEvent.coordinate);
                        }
                      }} 
                    />
                  )}
                </MapView>

                <View style={styles.mapInputArea}>
                  <Text style={styles.inputLabel}>Confirm Contact Number</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color="#64748B" style={{marginRight: 10}} />
                    <TextInput
                      style={styles.mapTextInput}
                      keyboardType="phone-pad"
                      placeholder="e.g. 09123456789"
                      value={phoneInput}
                      onChangeText={setPhoneInput}
                    />
                  </View>
                </View>
              </>
            ) : (
              <ActivityIndicator size="large" color="#1E3A8A" style={{ flex: 1 }} />
            )}

            <View style={styles.mapActions}>
              <TouchableOpacity
                style={[styles.saveLocBtn, !isValidPhoneNumber(phoneInput) && styles.disabledBtn]}
                disabled={!isValidPhoneNumber(phoneInput)}
                onPress={handleSaveLocation}
              >
                <Text style={styles.saveLocText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmBox}>
            <View style={styles.warnIcon}>
                <Ionicons name="trash-outline" size={30} color="#EF4444" />
            </View>
            <Text style={styles.deleteTitle}>Delete Address?</Text>
            <Text style={styles.deleteText}>This action cannot be undone.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Keep it</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDelBtn}
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
                <Text style={styles.confirmDelText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', marginTop: 35},
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  pinLocationBtn: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 20,
    shadowColor: '#1E3A8A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  activeCard: { borderColor: '#1E3A8A', backgroundColor: '#F0F7FF' },
  cardMain: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginLeft: 8 },
  activePill: { backgroundColor: '#1E3A8A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  activePillText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  addressDetails: { marginLeft: 28 },
  infoText: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  phoneText: { fontSize: 13, color: '#64748B', marginLeft: 4, fontWeight: '500' },
  checkIcon: { marginLeft: 10 },
  deleteSwipeBtn: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 20,
    marginVertical: 1,
    marginBottom: 12,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '500' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { color: '#1E293B', fontSize: 18, fontWeight: '700' },
  emptySubText: { color: '#64748B', fontSize: 14, marginTop: 4 },
  bottomFooter: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerAddBtn: { backgroundColor: '#1E3A8A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 16, paddingVertical: 15 },
  footerAddText: { color: '#fff', fontWeight: '800', fontSize: 16, marginLeft: 8 },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  successBox: { backgroundColor: '#fff', padding: 30, borderRadius: 30, alignItems: 'center', width: '80%' },
  successCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  successSub: { fontSize: 14, color: '#64748B', marginTop: 4, textAlign: 'center' },
  mapModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mapContainer: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', padding: 20 },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  mapHeaderText: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  mapCloseBtn: { padding: 5 },
  mapView: { flex: 1, borderRadius: 20, marginBottom: 15 },
  mapInputArea: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12 },
  mapTextInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#1E293B' },
  mapActions: { marginBottom: 10 },
  saveLocBtn: { backgroundColor: '#1E3A8A', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveLocText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabledBtn: { backgroundColor: '#94A3B8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center' },
  deleteConfirmBox: { width: '85%', backgroundColor: '#fff', borderRadius: 25, padding: 25, alignItems: 'center' },
  warnIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  deleteTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  deleteText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '700' },
  confirmDelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#EF4444', alignItems: 'center' },
  confirmDelText: { color: '#fff', fontWeight: '700' },
});