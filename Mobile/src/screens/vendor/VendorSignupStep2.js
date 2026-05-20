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
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width, height } = Dimensions.get('window');

/* ------------------------- PROGRESS STEPS UI ------------------------- */
const ProgressSteps = ({ currentStep = 3 }) => {
  const steps = ['Verify', 'Business Permit', 'Information', 'Selfie', 'Review'];

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
                  <Text style={[styles.circleText, { color: '#fff' }]}>✓</Text>
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      !isActive && styles.inactiveText,
                      { color: isActive ? '#fff' : '#1E293B' },
                    ]}
                  >
                    {stepNumber}
                  </Text>
                )}
              </View>

              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.activeStepLabel,
                ]}
              >
                {label}
              </Text>
            </View>

            {idx < steps.length - 1 && (
              <View
                style={[
                  styles.line,
                  {
                    backgroundColor:
                      currentStep > stepNumber ? '#2563EB' : '#E2E8F0',
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

/* ------------------------- PREMIUM BOTTOM SHEET DROPDOWN ------------------------- */
const PremiumDropdownModal = ({ visible, title, options, selectedValue, onSelect, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
          <View style={styles.bottomSheetHeader}>
            <View style={styles.notch} />
            <Text style={styles.bottomSheetTitle}>{title}</Text>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item }) => {
              const isSelected = item === selectedValue;
              return (
                <TouchableOpacity
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {item}
                  </Text>
                  {isSelected && <Text style={styles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const VendorSignupStep2 = ({ route, navigation }) => {
  const prevData = route.params?.formData || {};

  // Form State
  const [ownerName, setOwnerName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [dateOfBirthString, setDateOfBirthString] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Custom dropdown states
  const [gender, setGender] = useState('');
  const [genderModalVisible, setGenderModalVisible] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [barangayModalVisible, setBarangayModalVisible] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('Negros Occidental');
  const [selectedCity, setSelectedCity] = useState('Bacolod City');
  const [streetName, setStreetName] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({ title: '', message: '', buttonText: 'OK', type: 'info' });

  const genderOptions = ['Male', 'Female', 'Other'];
  const barangaysByCity = {
    'Bacolod City': [
      "Alangilan", "Alijis", "Banago", "Bata", "Cabug", "Estefanía", "Felisa", "Granada", "Handumanan",
      "Mandalagan", "Mansilingan", "Montevista", "Pahanocoy", "Punta Taytay", "Singcang-Airport", "Sum-ag", "Taculing",
      "Tangub", "Villamonte", "Vista Alegre", "Brgy 1", "Brgy 2", "Brgy 3", "Brgy 4"
    ],
  };

  const showNotification = (msg, type = 'error') => {
    setSileoConfig({
      title: type === 'success' ? 'Success' : 'Notice',
      message: msg,
      buttonText: 'OK',
      type,
    });
    setSileoVisible(true);
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (event, selectedDate) => {
    if (event.type === 'set' && selectedDate) {
      setDateOfBirth(selectedDate);
      setDateOfBirthString(formatDate(selectedDate));
      setShowDatePicker(false);
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleNext = () => {
    if (!ownerName.trim()) return showNotification('Full name is required.');
    if (!dateOfBirthString.trim()) return showNotification('Birth date is required.');

    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDifference = today.getMonth() - birth.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) return showNotification('You must be at least 18 years old to register.');
    if (!gender) return showNotification('Gender is required.');
    if (!businessName.trim()) return showNotification('Business name is required.');
    if (!permitNumber.trim()) return showNotification('Permit number is required.');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return showNotification('Valid email is required.');

    const phoneRegex = /^09\d{9}$/;
    if (!phone || !phoneRegex.test(phone))
      return showNotification('Enter a valid mobile number (09XXXXXXXXX).');

    if (!password || password.length < 6)
      return showNotification('Password must be at least 6 characters.');

    if (!selectedBarangay) return showNotification('Please select your barangay.');
    if (!streetName.trim()) return showNotification('Street address is required.');

    const updatedData = {
      ...prevData,
      ownerName,
      dateOfBirth: dateOfBirthString,
      gender,
      businessName,
      permitNumber,
      email,
      phone,
      password,
      selectedProvince,
      selectedCity,
      selectedBarangay,
      streetName,
    };

    navigation.navigate('VendorSignupStep3', {
      formData: updatedData,
    });
  };

  return (
    <View style={styles.mainWrapper}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Account Setup</Text>
          <Text style={styles.headerSubtitle}>Step 2 of 5</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ProgressSteps currentStep={2} />

        {/* PERSONAL INFORMATION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.inputField}
            placeholder="Enter your full name"
            value={ownerName}
            onChangeText={setOwnerName}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={styles.inputField}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: dateOfBirthString ? '#1E293B' : '#94A3B8', fontSize: 14 }}>
              {dateOfBirthString || 'Select date (MM/DD/YYYY)'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity
            style={styles.premiumDropdownTrigger}
            onPress={() => setGenderModalVisible(true)}
          >
            <Text style={[styles.premiumDropdownText, !gender && styles.premiumDropdownPlaceholder]}>
              {gender || 'Select Gender'}
            </Text>
            <Text style={styles.premiumDropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* BUSINESS INFORMATION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Business Information</Text>

          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.inputField}
            placeholder="Enter business name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Permit Number</Text>
          <TextInput
            style={styles.inputField}
            placeholder="Enter permit number"
            value={permitNumber}
            onChangeText={setPermitNumber}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* CONTACT INFO CARD */}
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
        </View>

        {/* ADDRESS CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Home Address</Text>

          <Text style={styles.label}>City</Text>
          <View style={[styles.inputField, { backgroundColor: '#F1F5F9' }]}>
            <Text style={{ color: '#64748B' }}>Bacolod City</Text>
          </View>

          <Text style={styles.label}>Barangay</Text>
          <TouchableOpacity
            style={styles.premiumDropdownTrigger}
            onPress={() => setBarangayModalVisible(true)}
          >
            <Text style={[styles.premiumDropdownText, !selectedBarangay && styles.premiumDropdownPlaceholder]}>
              {selectedBarangay || 'Select Barangay'}
            </Text>
            <Text style={styles.premiumDropdownArrow}>▼</Text>
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

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!ownerName || !dateOfBirthString || !gender || !businessName || !permitNumber || !email || !phone || !password) && styles.nextButtonDisabled]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>Continue to Step 4</Text>
        </TouchableOpacity>
      </View>

      {/* DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={dateOfBirth}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          textColor="#1E293B"
        />
      )}

      {/* PREMIUM GENDER DROPDOWN SHEET */}
      <PremiumDropdownModal
        visible={genderModalVisible}
        title="Select Gender"
        options={genderOptions}
        selectedValue={gender}
        onSelect={setGender}
        onClose={() => setGenderModalVisible(false)}
      />

      {/* PREMIUM BARANGAY DROPDOWN SHEET */}
      <PremiumDropdownModal
        visible={barangayModalVisible}
        title="Select Barangay"
        options={barangaysByCity['Bacolod City']}
        selectedValue={selectedBarangay}
        onSelect={setSelectedBarangay}
        onClose={() => setBarangayModalVisible(false)}
      />

      {/* NOTIFICATION MODAL */}
      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === 'success'
                  ? styles.sileoSuccessCircle
                  : sileoConfig.type === 'error'
                    ? styles.sileoWarningCircle
                    : styles.sileoInfoCircle,
              ]}
            >
              <Text style={styles.sileoIcon}>
                {sileoConfig.type === 'success' ? '✓' : sileoConfig.type === 'error' ? '!' : 'i'}
              </Text>
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={() => setSileoVisible(false)}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  /* NEW PREMIUM DROPDOWN MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Soft modern overlay blur
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.5, // Caps height at 50% screen so it looks like a clean sheet
    paddingHorizontal: 24,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notch: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  optionRowSelected: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  optionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#2563EB',
    fontWeight: '700',
  },
  optionCheck: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '700',
  },
  premiumDropdownTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  premiumDropdownText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  premiumDropdownPlaceholder: {
    color: '#94A3B8',
  },
  premiumDropdownArrow: {
    fontSize: 10,
    color: '#64748B',
  },

  /* STANDARDIZED EXISTING STYLES */
  sileoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(36, 41, 46, 0.32)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  sileoModal: { width: '82%', backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#2563EB', shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  sileoIconCircle: { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  sileoSuccessCircle: { backgroundColor: '#10B981' },
  sileoWarningCircle: { backgroundColor: '#F59E0B' },
  sileoInfoCircle: { backgroundColor: '#2563EB' },
  sileoIcon: { color: '#fff', fontSize: 30, fontWeight: '900' },
  sileoTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  sileoMessage: { fontSize: 14, color: '#475569', textAlign: 'center', marginBottom: 20, fontWeight: '500', lineHeight: 20 },
  sileoButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 28, alignItems: 'center' },
  sileoButtonText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  mainWrapper: { flex: 1, backgroundColor: '#F8FAFC' },
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
  circleText: { fontSize: 12, fontWeight: 'bold', color: '#1E293B' },
  inactiveText: { color: '#475569' },
  stepLabel: { marginTop: 6, fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  activeStepLabel: { color: '#2563EB' },
  line: { height: 2, flex: 1, marginTop: -18, marginHorizontal: -5 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  input: { flex: 1, padding: 12, color: '#1E293B', fontSize: 14 },
  inputField: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#1E293B' },
  inlineButton: { paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  inlineButtonText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  footer: { position: 'absolute', bottom: 0, width: width, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  nextButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center' },
  nextButtonDisabled: { backgroundColor: '#CBD5E1' },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default VendorSignupStep2;