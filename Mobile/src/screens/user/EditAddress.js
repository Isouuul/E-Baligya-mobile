import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function EditAddress() {
  const navigation = useNavigation();
  const route = useRoute();
  const { addressId } = route.params; // pass address id from AddressSelection
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState(null);

  const [streetName, setStreetName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!user || !addressId) return;

    const fetchAddress = async () => {
      try {
        const docRef = doc(db, 'Users-Address', user.uid, 'addresses', addressId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setAddress(data);

          setStreetName(data.streetName || '');
          setBarangay(data.barangay || '');
          setCity(data.city || '');
          setProvince(data.province || '');
          setRegion(data.region || '');
          setPhoneNumber(data.phoneNumber || '');
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAddress();
  }, [user, addressId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'Users-Address', user.uid, 'addresses', addressId);

      await updateDoc(docRef, {
        streetName,
        barangay,
        city,
        province,
        region,
        phoneNumber,
      });

      Alert.alert('Success', 'Address updated successfully!');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(db, 'Users-Address', user.uid, 'addresses', addressId);
              await deleteDoc(docRef);
              Alert.alert('Deleted', 'Address has been deleted');
              navigation.goBack();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Name (disabled) */}
      <Text style={styles.label}>First Name</Text>
      <TextInput style={[styles.input, { backgroundColor: '#E5E7EB' }]} value={address.firstName} editable={false} />

      <Text style={styles.label}>Last Name</Text>
      <TextInput style={[styles.input, { backgroundColor: '#E5E7EB' }]} value={address.lastName} editable={false} />

      {/* Editable Fields */}
      <Text style={styles.label}>Street Name</Text>
      <TextInput style={styles.input} value={streetName} onChangeText={setStreetName} />

      <Text style={styles.label}>Barangay</Text>
      <TextInput style={styles.input} value={barangay} onChangeText={setBarangay} />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} />

      <Text style={styles.label}>Province</Text>
      <TextInput style={styles.input} value={province} onChangeText={setProvince} />

      <Text style={styles.label}>Region</Text>
      <TextInput style={styles.input} value={region} onChangeText={setRegion} />

      <Text style={styles.label}>Phone Number</Text>
      <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Address</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10, paddingBottom: 50 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginTop: 4, fontSize: 14, borderWidth: 1, borderColor: '#D1D5DB' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  deleteButton: { backgroundColor: '#EF4444', paddingVertical: 14, flex: 0.48, borderRadius: 12, alignItems: 'center' },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  submitButton: { backgroundColor: '#3B82F6', paddingVertical: 14, flex: 0.48, borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
