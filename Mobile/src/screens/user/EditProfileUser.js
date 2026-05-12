// src/screens/Users/EditProfileUser.js
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert,
  ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView, SafeAreaView
} from 'react-native';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import Locations from './Locations.json';

export default function EditProfileUser({ navigation }) {
  const [userData, setUserData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    birthdate: '',
    gender: '',
    address: { street: '', barangay: '', city: '', region: 'Region VI - Western Visayas' },
    profileImage: null,
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;
      try {
        const userRef = doc(db, 'Users', userId);
        const snapshot = await getDoc(userRef);
        if (snapshot.exists()) {
          setUserData(prev => ({
            ...prev,
            ...snapshot.data(),
            address: snapshot.data().address || prev.address,
          }));
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch profile data.');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [userId]);

  const handleChange = (field, value) => setUserData(prev => ({ ...prev, [field]: value }));
  const handleAddressChange = (field, value) =>
    setUserData(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Permission to access gallery is required!');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        handleChange('profileImage', base64Image);

        if (userId) {
          try {
            const userRef = doc(db, 'Users', userId);
            await updateDoc(userRef, { profileImage: base64Image, updatedAt: new Date().toISOString() });
            Alert.alert('Success', 'Profile image updated!');
          } catch (err) {
            Alert.alert('Error', 'Failed to save profile image.');
          }
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const userRef = doc(db, 'Users', userId);
      await updateDoc(userRef, { ...userData, updatedAt: new Date().toISOString() });
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const cities = Object.keys(Locations);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Profile Picture Section */}
            <View style={styles.photoSection}>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
                <View style={styles.imageWrapper}>
                  {userData.profileImage ? (
                    <Image source={{ uri: userData.profileImage }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.placeholderImg}>
                      <Feather name="user" size={40} color="#94A3B8" />
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={styles.photoHint}>Tap to change avatar</Text>
            </View>

            {/* Personal Info Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Personal Information</Text>
              <InputField label="First Name" icon="account-outline" value={userData.firstName} onChange={text => handleChange('firstName', text)} />
              <InputField label="Middle Name" icon="account-outline" value={userData.middleName} onChange={text => handleChange('middleName', text)} />
              <InputField label="Last Name" icon="account-outline" value={userData.lastName} onChange={text => handleChange('lastName', text)} />
              <InputField label="Birthdate" icon="calendar-outline" value={userData.birthdate} placeholder="YYYY-MM-DD" onChange={text => handleChange('birthdate', text)} />
              <InputField label="Gender" icon="gender-male-female" value={userData.gender} onChange={text => handleChange('gender', text)} />
            </View>

            {/* Address Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Location Details</Text>
              
              <Text style={styles.fieldTitle}>Region</Text>
              <View style={styles.disabledPicker}>
                <Text style={styles.disabledText}>{userData.address.region}</Text>
                <MaterialCommunityIcons name="lock" size={16} color="#94A3B8" />
              </View>

              <Text style={styles.fieldTitle}>City</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={userData.address.city}
                  style={styles.picker}
                  onValueChange={val => {
                    handleAddressChange('city', val);
                    handleAddressChange('barangay', '');
                    handleAddressChange('street', '');
                  }}
                >
                  <Picker.Item label="Select City" value="" color="#94A3B8" />
                  {cities.map(c => <Picker.Item key={c} label={c} value={c} />)}
                </Picker>
              </View>

              {userData.address.city && Locations[userData.address.city] && (
                <>
                  <Text style={styles.fieldTitle}>Barangay</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={userData.address.barangay}
                      style={styles.picker}
                      onValueChange={val => handleAddressChange('barangay', val)}
                    >
                      <Picker.Item label="Select Barangay" value="" color="#94A3B8" />
                      {Locations[userData.address.city].map(b => <Picker.Item key={b} label={b} value={b} />)}
                    </Picker>
                  </View>
                </>
              )}

              {userData.address.barangay && (
                <View style={{marginTop: 10}}>
                   <InputField 
                    label="Street / House No" 
                    icon="map-marker-outline"
                    value={userData.address.street} 
                    onChange={text => handleAddressChange('street', text)} 
                    placeholder="Block & Lot / House Number"
                  />
                </View>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Update Profile</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{marginLeft: 8}} />
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const InputField = ({ label, value, onChange, placeholder, icon }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.fieldTitle}>{label}</Text>
    <View style={styles.inputWrapper}>
      <MaterialCommunityIcons name={icon} size={20} color="#64748B" style={styles.inputIcon} />
      <TextInput 
        style={styles.textInput} 
        value={value ?? ''} 
        placeholder={placeholder || `Enter ${label.toLowerCase()}`} 
        placeholderTextColor="#94A3B8"
        onChangeText={onChange} 
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    backgroundColor: '#FFF'
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Photo Section
  photoSection: { alignItems: 'center', marginVertical: 25 },
  imageWrapper: { position: 'relative' },
  profileImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#FFF' },
  placeholderImg: { 
    width: 110, height: 110, borderRadius: 55, 
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed'
  },
  cameraBadge: { 
    position: 'absolute', bottom: 5, right: 5, 
    backgroundColor: '#38BDF8', width: 32, height: 32, 
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#FFF'
  },
  photoHint: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Cards
  sectionCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3
  },
  sectionLabel: { fontSize: 14, fontWeight: '900', color: '#38BDF8', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },

  // Inputs
  inputGroup: { marginBottom: 16 },
  fieldTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginLeft: 2 },
  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    paddingHorizontal: 12
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, height: 48, fontSize: 15, color: '#0F172A', fontWeight: '600' },

  // Pickers
  pickerContainer: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 15, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    marginBottom: 12,
    overflow: 'hidden'
  },
  picker: { height: 50, width: '100%' },
  disabledPicker: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: '#F1F5F9', 
    borderRadius: 15, 
    paddingHorizontal: 15, 
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  disabledText: { color: '#94A3B8', fontWeight: '600', fontSize: 15 },

  // Buttons
  saveButton: { 
    flexDirection: 'row',
    backgroundColor: '#0F172A', 
    paddingVertical: 18, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8
  },
  saveButtonText: { color: '#FFF', fontWeight: '800', fontSize: 16 }
});