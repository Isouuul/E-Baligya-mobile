import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');
const OTP_DURATION = 60;

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

            {/* FIXED LINE LOGIC */}
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

const VendorSignupStep2 = ({ route, navigation }) => {
const prevData = route.params?.formData || {};
const {
  businessType,
  marketName,
  latitude,
  longitude,
  govIDFront,
  govIDBack,
  permitImage,
} = route.params || {};



  // Form State
const [ownerName, setOwnerName] = useState('');
const [dateOfBirth, setDateOfBirth] = useState(new Date());
const [dateOfBirthString, setDateOfBirthString] = useState('');
const [showDatePicker, setShowDatePicker] = useState(false);
const [gender, setGender] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('Negros Occidental');
  const [selectedCity, setSelectedCity] = useState('Bacolod City');
  const [selectedBarangay, setSelectedBarangay] = useState('');
  const [streetName, setStreetName] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
  });

  const barangaysByCity = {
    'Bacolod City': [
      "Alangilan", "Alijis", "Banago", "Bata", "Cabug", "Estefanía", "Felisa", "Granada", "Handumanan",
      "Mandalagan", "Mansilingan", "Montevista", "Pahanocoy", "Punta Taytay", "Singcang-Airport", "Sum-ag", "Taculing",
      "Tangub", "Villamonte", "Vista Alegre", "Brgy 1", "Brgy 2", "Brgy 3", "Brgy 4" // ... add more as needed
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



// TODO: OTP handlers to be repaired
// const handleSendOtp = async () => {
//   if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//     return showNotification('Valid email is required.');
//   }
//   try {
//     setOtpSent(true);
//     setOtpTimer(OTP_DURATION);
//     setResendVisible(false);
//     const response = await fetch('https://e-baligya-mobile.onrender.com/send-otp', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email }),
//     });
//     const data = await response.json();
//     if (response.ok && data.success) {
//       showNotification('OTP sent to your email.', 'success');
//     } else {
//       showNotification(data.message || data.error || 'Failed to send OTP.');
//     }
//   } catch (err) {
//     showNotification('Error sending OTP. Check network.');
//   }
// };

// const handleVerifyOtp = async () => {
//   if (otpTimer <= 0) return showNotification('OTP expired. Please resend.');
//   if (!userOtp || userOtp.length !== 6) return showNotification('Enter 6-digit OTP.');
//   try {
//     const response = await fetch('https://e-baligya-mobile.onrender.com/verify-otp', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, otp: userOtp }),
//     });
//     const data = await response.json();
//     if (response.ok && data.success) {
//       setOtpVerified(true);
//       showNotification('Email verified successfully!', 'success');
//     } else {
//       showNotification(data.message || data.error || 'Invalid OTP.');
//     }
//   } catch (err) {
//     showNotification('Error verifying OTP.');
//   }
// };

const handleNext = () => {
  // Validate personal information
  if (!ownerName.trim()) return showNotification('Full name is required.');
  if (!dateOfBirthString) return showNotification('Date of birth is required.');
  if (!gender) return showNotification('Please select your gender.');

  // Business info
  if (!businessName.trim()) return showNotification('Business name is required.');
  if (!permitNumber.trim()) return showNotification('Permit number is required.');

  // Contact
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showNotification('Valid email is required.');

  const phoneRegex = /^09\d{9}$/;
  if (!phone || !phoneRegex.test(phone))
    return showNotification('Enter a valid mobile number (09XXXXXXXXX).');

  if (!password || password.length < 6)
    return showNotification('Password must be at least 6 characters.');

  // Address
  if (!selectedBarangay)
    return showNotification('Please select your barangay.');

  if (!streetName.trim())
    return showNotification('Street address is required.');

  // 🔥 MERGE ALL DATA
  const updatedData = {
    ...prevData, // Step1 + BusPermit
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
          <View style={styles.pickerContainer}>
            <Picker selectedValue={gender} onValueChange={setGender}>
              <Picker.Item label="Select Gender" value="" color="#94A3B8" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </View>
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
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.inputField}
            placeholder="09XXXXXXXXX"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={11}
          />

          <Text style={styles.label}>Create Password</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Min. 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
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
          <View style={styles.pickerContainer}>
            <Picker selectedValue={selectedBarangay} onValueChange={setSelectedBarangay}>
              <Picker.Item label="Select Barangay" value="" color="#94A3B8" />
              {barangaysByCity['Bacolod City'].map((b, i) => (<Picker.Item key={i} label={b} value={b} />))}
            </Picker>
          </View>

          <Text style={styles.label}>Street / House No.</Text>
          <TextInput
            style={styles.inputField}
            placeholder="e.g. 143 Rizal St."
            value={streetName}
            onChangeText={setStreetName}
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
    width: '82%',
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
  sileoSuccessCircle: { backgroundColor: '#10B981' },
  sileoWarningCircle: { backgroundColor: '#F59E0B' },
  sileoInfoCircle: { backgroundColor: '#2563EB' },
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
  infoBox: { backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { fontSize: 12, color: '#64748B' },
  infoValue: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  inputWrapperVerified: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  input: { flex: 1, padding: 12, color: '#1E293B', fontSize: 14 },
  inputField: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 14, color: '#1E293B' },
  inlineButton: { paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  inlineButtonText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  verifiedSealWrapper: { paddingHorizontal: 12, justifyContent: 'center' },
  verifiedCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  verifiedCheckText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  pickerContainer: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  otpSection: { marginTop: 12, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 10 },
  verifyButton: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginRight: 8 },
  verifyButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  timerText: { fontSize: 11, color: '#64748B', marginTop: 6, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, width: width, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  nextButton: { backgroundColor: '#2563EB', padding: 16, borderRadius: 12, alignItems: 'center' },
  nextButtonDisabled: { backgroundColor: '#CBD5E1' },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 16 },

});

export default VendorSignupStep2;