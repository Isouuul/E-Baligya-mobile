import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Locations from './Locations.json';

const { width, height } = Dimensions.get('window');

const ProgressSteps = ({ currentStep = 2 }) => {
  const steps = ['Verify', 'Information', 'Selfie', 'Review'];

  return (
    <View style={styles.progressContainer}>
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <React.Fragment key={label}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.completedCircle,
                  isActive && styles.activeCircle,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.circleText}>✓</Text>
                ) : (
                  <Text style={[styles.circleText, !isActive && styles.inactiveText]}>{stepNumber}</Text>
                )}
              </View>

              <Text style={[styles.stepLabel, isActive && styles.activeStepLabel]}>{label}</Text>
            </View>

            {idx < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  { backgroundColor: currentStep > stepNumber ? '#2563EB' : '#E2E8F0' },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// --- PREMIUM CUSTOM PICKER MODAL ---
const PremiumPickerModal = ({ visible, title, options, selectedValue, onSelect, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = item.value === selectedValue;
              return (
                <TouchableOpacity
                  style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && <Text style={styles.modalCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const UserSignupStep2 = ({ route, navigation }) => {
  const { govIDFront, govIDBack } = route.params || {};

  // Personal details
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [birthDateString, setBirthDateString] = useState('');
  const [gender, setGender] = useState('');

  // Contact & address details
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [streetName, setStreetName] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Picker States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [barangayModalVisible, setBarangayModalVisible] = useState(false);

  const [status, setStatus] = useState({ message: '', type: '' });
  const fadeAnim = useState(new Animated.Value(0))[0];

  const cities = Object.keys(Locations || {});

  const showNotification = (msg, type = 'error') => {
    setStatus({ message: msg, type });
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setStatus({ message: '', type: '' });
      });
    }, 3000);
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (event, selectedDate) => {
    if (event.type === 'set' && selectedDate) {
      setBirthDate(selectedDate);
      setBirthDateString(formatDate(selectedDate));
      setShowDatePicker(false);
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleNext = () => {
    if (!firstName.trim()) return showNotification('First name is required.');
    if (!lastName.trim()) return showNotification('Last name is required.');
    if (!birthDateString.trim()) return showNotification('Birth date is required.');

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDifference = today.getMonth() - birth.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) return showNotification('You must be at least 18 years old to register.');
    if (!gender) return showNotification('Gender is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showNotification('Valid email is required.');

    const phoneRegex = /^09\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) return showNotification('Enter a valid mobile number (09XXXXXXXXX).');
    if (!password || password.length < 6) return showNotification('Password must be at least 6 characters.');
    if (password !== confirmPassword) return showNotification('Passwords do not match.');
    if (!selectedCity || !selectedBarangay || !streetName.trim()) return showNotification('Complete your address details.');

    navigation.navigate('UserSignupStep3', {
      ...route.params,
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      selectedCity,
      selectedBarangay,
      streetName: streetName.trim(),
      birthDate: birthDateString,
      gender,
      currentStep: 3,
    });
  };

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" />

      {status.message !== '' && (
        <Animated.View
          style={[
            styles.statusBanner,
            { opacity: fadeAnim, backgroundColor: status.type === 'success' ? '#DEF7EC' : '#FDE8E8' },
          ]}
        >
          <Text style={[styles.statusText, { color: status.type === 'success' ? '#03543F' : '#9B1C1C' }]}>
            {status.type === 'success' ? '✓ ' : '⚠️ '}
            {status.message}
          </Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Account Setup</Text>
          <Text style={styles.headerSubtitle}>Step 2 of 4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ProgressSteps currentStep={2} />

        {/* PERSONAL INFORMATION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.inputField}
            placeholder="Enter your first name"
            value={firstName}
            onChangeText={setFirstName}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Middle Name</Text>
          <TextInput
            style={styles.inputField}
            placeholder="Enter your middle name (optional)"
            value={middleName}
            onChangeText={setMiddleName}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.inputField}
            placeholder="Enter your last name"
            value={lastName}
            onChangeText={setLastName}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity style={styles.premiumPickerTrigger} onPress={() => setShowDatePicker(true)}>
            <Text style={[styles.pickerTriggerText, birthDateString ? styles.textActive : styles.textPlaceholder]}>
              {birthDateString || 'Select date (MM/DD/YYYY)'}
            </Text>
            <Text style={styles.chevronIcon}>📅</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity style={styles.premiumPickerTrigger} onPress={() => setGenderModalVisible(true)}>
            <Text style={[styles.pickerTriggerText, gender ? styles.textActive : styles.textPlaceholder]}>
              {gender || 'Select Gender'}
            </Text>
            <Text style={styles.chevronIcon}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* CONTACT INFORMATION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.inputField}
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.inputField}
            placeholder="09XXXXXXXXX"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Create Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.inlineButton} onPress={() => setShowPassword(!showPassword)}>
              <Text style={styles.inlineButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Retype password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.inlineButton} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Text style={styles.inlineButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* HOME ADDRESS CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Home Address</Text>

          <Text style={styles.label}>City</Text>
          <TouchableOpacity style={styles.premiumPickerTrigger} onPress={() => setCityModalVisible(true)}>
            <Text style={[styles.pickerTriggerText, selectedCity ? styles.textActive : styles.textPlaceholder]}>
              {selectedCity || 'Select City'}
            </Text>
            <Text style={styles.chevronIcon}>▾</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Barangay</Text>
          <TouchableOpacity 
            style={[styles.premiumPickerTrigger, !selectedCity && styles.disabledTrigger]} 
            onPress={() => selectedCity && setBarangayModalVisible(true)}
            disabled={!selectedCity}
          >
            <Text style={[styles.pickerTriggerText, selectedBarangay ? styles.textActive : styles.textPlaceholder]}>
              {selectedBarangay || 'Select Barangay'}
            </Text>
            <Text style={styles.chevronIcon}>▾</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Street / House No.</Text>
          <TextInput
            style={styles.inputField}
            placeholder="e.g. 143 Rizal St."
            value={streetName}
            onChangeText={setStreetName}
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!firstName || !lastName || !birthDateString || !gender || !email || !phone || !password || !confirmPassword || !selectedCity || !selectedBarangay || !streetName) && styles.nextButtonDisabled
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>Continue to Selfie</Text>
        </TouchableOpacity>
      </View>

      {/* --- MODAL INSTANCES --- */}
      <PremiumPickerModal
        visible={genderModalVisible}
        title="Select Gender"
        options={[
          { label: 'Male', value: 'Male' },
          { label: 'Female', value: 'Female' },
          { label: 'Other', value: 'Other' },
        ]}
        selectedValue={gender}
        onSelect={setGender}
        onClose={() => setGenderModalVisible(false)}
      />

      <PremiumPickerModal
        visible={cityModalVisible}
        title="Select City"
        options={cities.map(c => ({ label: c, value: c }))}
        selectedValue={selectedCity}
        onSelect={(val) => {
          setSelectedCity(val);
          setSelectedBarangay('');
        }}
        onClose={() => setCityModalVisible(false)}
      />

      <PremiumPickerModal
        visible={barangayModalVisible}
        title="Select Barangay"
        options={(selectedCity && Locations[selectedCity] ? Locations[selectedCity] : []).map(b => ({ label: b, value: b }))}
        selectedValue={selectedBarangay}
        onSelect={setSelectedBarangay}
        onClose={() => setBarangayModalVisible(false)}
      />

      {/* DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={birthDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          textColor="#1E293B"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  statusBanner: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 999, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  header: { backgroundColor: '#fff', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
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
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  input: { flex: 1, padding: 12, color: '#0F172A', fontSize: 14 },
  inputField: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#0F172A' },
  inlineButton: { paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  inlineButtonText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  
  // PREMIUM PICKER UI CHANGES
  premiumPickerTrigger: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: '#F8FAFC', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    padding: 14 
  },
  disabledTrigger: { opacity: 0.5, backgroundColor: '#E2E8F0' },
  pickerTriggerText: { fontSize: 14, fontWeight: '500' },
  textActive: { color: '#0F172A' },
  textPlaceholder: { color: '#94A3B8' },
  chevronIcon: { fontSize: 14, color: '#64748B' },

  // BOTTOM SHEET SHELF MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: height * 0.5 },
  modalHeader: { alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalIndicator: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  modalList: { paddingHorizontal: 20, paddingTop: 10 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  modalItemSelected: { backgroundColor: '#EFF6FF', marginHorizontal: -20, paddingHorizontal: 20, borderRadius: 8 },
  modalItemText: { fontSize: 15, color: '#334155', fontWeight: '500' },
  modalItemTextSelected: { color: '#2563EB', fontWeight: '700' },
  modalCheckmark: { color: '#2563EB', fontSize: 16, fontWeight: '700' },

  footer: { position: 'absolute', bottom: 0, width: width, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  nextButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center' },
  nextButtonDisabled: { backgroundColor: '#CBD5E1' },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default UserSignupStep2;