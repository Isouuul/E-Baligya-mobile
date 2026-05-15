import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  StatusBar,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { auth, db } from '../../firebase'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, query, updateDoc, where } from 'firebase/firestore';

// Login success image
import LoginSuccess from '../../../assets/Login.png';
import MeImage from '../../../assets/Me.png';
import EbaligyaLogo from '../../images/ebaligya.png';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(null); // message text
  const [messageType, setMessageType] = useState(null); // 'success' | 'error'
  const [loading, setLoading] = useState(false); 
  const [modalVisible, setModalVisible] = useState(false); // modal state
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownTime, setCountdownTime] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('');
  const [penaltyLabel, setPenaltyLabel] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const loginButtonScale = useRef(new Animated.Value(1)).current;
  const loginTimeoutRef = useRef(null);

  const animateLoginButton = (toValue) => {
    Animated.spring(loginButtonScale, {
      toValue,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const formatCountdownTime = (restrictedUntilDate) => {
    const now = new Date();
    const diffMs = restrictedUntilDate - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return { time: `${diffDays} day${diffDays > 1 ? 's' : ''} ${diffHours % 24} hour${(diffHours % 24) !== 1 ? 's' : ''}`, label: 'Suspension Active' };
    } else if (diffHours > 0) {
      return { time: `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${diffMins % 60} minute${(diffMins % 60) !== 1 ? 's' : ''}`, label: 'Restriction Active' };
    } else {
      return { time: `${diffMins} minute${diffMins !== 1 ? 's' : ''}`, label: 'Restriction Active' };
    }
  };

  useEffect(() => {
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');

    return () => {
      if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
    };
  }, []);

  const handleLogin = async () => {
  if (!email || !password) {
    setMessageType('error');
    setMessage('⚠️ Please enter both email and password.');
    return;
  }

  setLoading(true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const userQuery = query(collection(db, 'Users'), where('uid', '==', uid));
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      // ⭐ CHECK ACCOUNT STATUS
      const now = new Date();
      if (userData.status === 'banned') {
        setMessageType('error');
        setMessage('🚫 Your account has been permanently banned.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      if (userData.status === 'restricted') {
        if (userData.restrictedUntil && userData.restrictedUntil.toDate() > now) {
          const { time, label } = formatCountdownTime(userData.restrictedUntil.toDate());
          setCountdownTime(time);
          setCountdownLabel(label);
          setPenaltyLabel(userData.lastPenaltyLabel || '⚡ Account Restricted');
          setStrikeCount(userData.reportStrikeCount || 0);
          setCountdownVisible(true);
          await auth.signOut();
          setLoading(false);
          return;
        } else {
          // restriction expired, allow login and reset status
          await updateDoc(userDoc.ref, { status: 'active', restrictedUntil: null });
        }
      }

      // ✅ Login successful
      setModalVisible(true);
      loginTimeoutRef.current = setTimeout(() => {
        setModalVisible(false);
        navigation.replace('ConsumerTabs');
      }, 1500);
    } else {
      await auth.signOut();
      setMessageType('error');
      setMessage('🚫 Access Denied: This account is not registered as a user.');
    }
} catch (error) {
  console.error(error);

  let customMessage = '❌ Something went wrong. Please try again.';

  switch (error.code) {
    case 'auth/invalid-email':
      customMessage = '⚠️ Please enter a valid email address.';
      break;

    case 'auth/user-not-found':
      customMessage = '🚫 No account found with this email.';
      break;

    case 'auth/wrong-password':
      customMessage = '🔑 Incorrect password. Please try again.';
      break;

    case 'auth/invalid-credential':
      customMessage = 'Incorrect email or password.';
      break;

    case 'auth/too-many-requests':
      customMessage =
        '⏳ Too many failed login attempts. Please try again later.';
      break;

    case 'auth/network-request-failed':
      customMessage =
        '📶 Network error. Please check your internet connection.';
      break;

    default:
      customMessage = '❌ Login failed. Please try again.';
      break;
  }

  setMessageType('error');
  setMessage(customMessage);
} finally {
    setLoading(false);
  }
};


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Vendor Switch Button */}
        <TouchableOpacity
          style={styles.vendorIconContainer}
          onPress={() => navigation.navigate('VendorLoginScreen')}
        >
          <Feather name="repeat" size={16} color="#0F172A" />
          <Text style={styles.vendorText}>Switch to Vendor</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.brandCircle}>
            <Image source={MeImage} style={styles.brandImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your shopping journey</Text>
        </View>

        {/* Error / Success Alert */}
        {message && (
          <View
            style={[
              styles.alertBox,
              messageType === 'success' ? styles.successBox : styles.errorBox,
            ]}
          >
            <Feather
              name={messageType === 'success' ? 'check-circle' : 'alert-triangle'}
              size={18}
              color={messageType === 'success' ? '#166534' : '#b91c1c'}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.alertText,
                { color: messageType === 'success' ? '#166534' : '#b91c1c' },
              ]}
            >
              {message}
            </Text>
          </View>
        )}

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardWatermarkWrap} pointerEvents="none">
            <Image
              source={EbaligyaLogo}
              style={styles.cardWatermark}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <Pressable
            style={[styles.inputGroup, focusedInput === 'email' && styles.inputFocused]}
            onPress={() => emailInputRef.current?.focus()}
          >
            <Feather
              name="mail"
              size={18}
              color={focusedInput === 'email' ? '#6366f1' : '#94A3B8'}
              style={styles.icon}
            />
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="Email Address"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </Pressable>

          <Text style={styles.label}>Password</Text>
          <Pressable
            style={[styles.inputGroup, focusedInput === 'password' && styles.inputFocused]}
            onPress={() => passwordInputRef.current?.focus()}
          >
            <Feather
              name="lock"
              size={18}
              color={focusedInput === 'password' ? '#6366f1' : '#94A3B8'}
              style={styles.icon}
            />
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder="Password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              editable={!loading}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color="#94A3B8" />
            </TouchableOpacity>
          </Pressable>

          <TouchableOpacity style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: loginButtonScale }] }}>
            <TouchableOpacity
              style={[styles.loginButton, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              onPressIn={() => animateLoginButton(0.98)}
              onPressOut={() => animateLoginButton(1)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginText}>Login</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.signupPrompt}>
            <Text style={styles.promptText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}> Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Success Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalContent}>
              <Image
                source={LoginSuccess}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <Text style={styles.modalText}>Logged in successfully!</Text>
            </View>
          </View>
        </Modal>

        {/* Countdown Restriction Modal */}
        <Modal
          transparent
          animationType="fade"
          visible={countdownVisible}
          onRequestClose={() => setCountdownVisible(false)}
        >
          <View style={styles.countdownOverlay}>
            <View style={styles.countdownModal}>
              <View style={styles.countdownIconCircle}>
                <Feather name="lock" size={32} color="#fff" />
              </View>
              <Text style={styles.countdownTitle}>Access Temporarily Blocked</Text>
              <Text style={styles.countdownLabel}>{countdownLabel}</Text>
              
              {penaltyLabel && (
                <View style={styles.penaltyBox}>
                  <Text style={styles.penaltyLabel}>{penaltyLabel}</Text>
                  {strikeCount > 0 && (
                    <Text style={styles.strikeText}>Strike {strikeCount}</Text>
                  )}
                </View>
              )}
              
              <View style={styles.timerBox}>
                <Text style={styles.timerText}>{countdownTime}</Text>
              </View>
              
              <Text style={styles.countdownMessage}>
                Your account is under temporary restriction due to policy violations. Please try logging in again after the countdown expires.
              </Text>
              
              <TouchableOpacity 
                style={styles.countdownButton}
                onPress={() => setCountdownVisible(false)}
              >
                <Text style={styles.countdownButtonText}>Understood</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 60,
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 56,
    marginBottom: 30,
  },
  brandCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#5B9DFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 5,
  },
  brandImage: {
    width: 30,
    height: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    padding: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5EAF2',
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 28,
    elevation: 12,
  },
  cardWatermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWatermark: {
    width: 220,
    height: 220,
    opacity: 0.06,
    transform: [{ rotate: '-6deg' }],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#E2E8F0',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    height: 56,
  },
  inputFocused: {
    borderColor: '#6366f1',
    backgroundColor: '#FFFFFF',
    shadowColor: '#6366f1',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#1E293B', fontWeight: '500' },
  forgotLink: { alignSelf: 'flex-end', marginBottom: 28 },
  forgotText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
  loginButton: {
    backgroundColor: '#5B9DFF',
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 4,
    shadowColor: '#4338CA',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 6,
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  vendorIconContainer: {
    position: 'absolute',
    top: 40,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  vendorText: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
  signupPrompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  promptText: { fontSize: 14, color: '#64748B' },
  signupText: { fontSize: 14, color: '#0F172A', fontWeight: '700' },
  alertBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1 },
  successBox: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
  errorBox: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  alertText: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Modal styles
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    width: 210,
    height: 210,
    backgroundColor: '#fff',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5EAF2',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 8,
  },
  modalImage: { width: 80, height: 80, marginBottom: 15 },
  modalText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  // Countdown Modal
  countdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownModal: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  countdownIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  countdownTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  countdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 18,
  },
  timerBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 18,
    width: '100%',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  timerText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  countdownMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  countdownButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  countdownButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  penaltyBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  penaltyLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
  },
  strikeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    textAlign: 'center',
    marginTop: 4,
  },
});
