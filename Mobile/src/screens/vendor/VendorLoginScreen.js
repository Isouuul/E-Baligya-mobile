import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  StatusBar,
  Modal,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons'; // Switched to Feather for a lighter, premium feel
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import LoginSuccess from '../../../assets/Login.png';
import MarketImage from '../../../assets/Market.png';
import EbaligyaLogo from '../../images/ebaligya.png';

const { width } = Dimensions.get('window');

const VendorLoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null); // For active input styling
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const loginButtonScale = useRef(new Animated.Value(1)).current;
  const loginTimeoutRef = useRef(null);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownTime, setCountdownTime] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('');
  const [penaltyLabel, setPenaltyLabel] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);

  useEffect(() => {
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');

    return () => {
      if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
    };
  }, []);

  const animateLoginButton = (toValue) => {
    Animated.spring(loginButtonScale, {
      toValue,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const showSileo = ({ title, message, buttonText = 'OK', type = 'info', onPress = null }) => {
    setSileoConfig({ title, message, buttonText, type, onPress });
    setSileoVisible(true);
  };

  const handleSileoClose = () => {
    setSileoVisible(false);
    if (typeof sileoConfig.onPress === 'function') {
      sileoConfig.onPress();
    }
    setSileoConfig((prev) => ({ ...prev, onPress: null }));
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

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showSileo({
        title: 'Attention',
        message: 'Please provide your credentials to continue.',
        type: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      const approvedQ = query(collection(db, 'ApprovedVendors'), where('userId', '==', user.uid));
      const approvedSnap = await getDocs(approvedQ);

      if (!approvedSnap.empty) {
        const approvedDoc = approvedSnap.docs[0];
        const approvedData = approvedDoc.data();
        const accountStatus = (approvedData.accountStatus || 'active').toLowerCase();
        const now = new Date();
        const restrictedUntil = approvedData.restrictedUntil?.toDate ? approvedData.restrictedUntil.toDate() : null;

        if (accountStatus === 'banned') {
          await signOut(auth);
          showSileo({ title: 'Access Denied', message: 'This account has been permanently deactivated.', type: 'warning' });
          return;
        }

        if (accountStatus === 'restricted') {
          if (restrictedUntil && restrictedUntil > now) {
            const { time, label } = formatCountdownTime(restrictedUntil);
            setCountdownTime(time);
            setCountdownLabel(label);
            setPenaltyLabel(approvedData.lastPenaltyLabel || '⚡ Account Restricted');
            setStrikeCount(approvedData.reportStrikeCount || 0);
            setCountdownVisible(true);
            await signOut(auth);
            return;
          }
          await updateDoc(approvedDoc.ref, { accountStatus: 'active', restrictedUntil: null });
        }

        setSuccessModalVisible(true);
        loginTimeoutRef.current = setTimeout(() => {
          setSuccessModalVisible(false);
          navigation.replace('VendorDashboard');
        }, 1500);

      } else {
        const pendingQ = query(collection(db, 'PendingVendors'), where('userId', '==', user.uid));
        const pendingSnap = await getDocs(pendingQ);
        await signOut(auth);
        
        if (!pendingSnap.empty) {
          showSileo({ title: 'In Review', message: 'Your application is currently being processed by our team.', type: 'info' });
        } else {
          showSileo({ title: 'Account Not Found', message: 'The credentials provided do not match a vendor record.', type: 'warning' });
        }
      }
    } catch (err) {
      let msg = 'An unexpected error occurred. Please try again.';
      if (err.code === 'auth/wrong-password') {
        showSileo({ title: 'Security', message: 'The password entered is incorrect.', buttonText: 'Reset Password', type: 'warning', onPress: handlePasswordReset });
        return;
      }
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      showSileo({ title: 'Login Error', message: msg, type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      showSileo({ title: 'Email Required', message: 'Please enter your email to receive a reset link.', type: 'warning' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showSileo({ title: 'Email Sent', message: 'Check your inbox for password recovery instructions.', type: 'success' });
    } catch (e) {
      showSileo({ title: 'Request Failed', message: 'We could not send a reset link at this time.', type: 'warning' });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFFFFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Switch Button */}
      <TouchableOpacity 
        style={styles.switchButton} 
        onPress={() => navigation.navigate('Login')}
      >
        <Feather name="repeat" size={16} color="#0F172A" />
        <Text style={styles.switchText}>Switch to User</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.brandCircle}>
            <Image source={MarketImage} style={styles.brandImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Vendor Portal</Text>
          <Text style={styles.subtitle}>Sign in to manage your marketplace</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <View style={styles.cardWatermarkWrap} pointerEvents="none">
            <Image
              source={EbaligyaLogo}
              style={styles.cardWatermark}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <Pressable
            style={[styles.inputWrapper, focusedInput === 'email' && styles.inputFocused]}
            onPress={() => emailInputRef.current?.focus()}
          >
            <Feather name="mail" size={18} color={focusedInput === 'email' ? '#6366f1' : '#94A3B8'} />
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="e.g. name@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              onChangeText={setEmail}
              placeholderTextColor="#CBD5E1"
              editable={!loading}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </Pressable>

          <Text style={styles.label}>Password</Text>
          <Pressable
            style={[styles.inputWrapper, focusedInput === 'password' && styles.inputFocused]}
            onPress={() => passwordInputRef.current?.focus()}
          >
            <Feather name="lock" size={18} color={focusedInput === 'password' ? '#6366f1' : '#94A3B8'} />
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              value={password}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              onChangeText={setPassword}
              placeholderTextColor="#CBD5E1"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color="#94A3B8" />
            </TouchableOpacity>
          </Pressable>

          <TouchableOpacity style={styles.forgotBtn} onPress={handlePasswordReset}>
            <Text style={styles.forgotBtnText}>Forgot password?</Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: loginButtonScale }] }}>
            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.8 }]}
              onPress={handleLogin}
              onPressIn={() => animateLoginButton(0.98)}
              onPressOut={() => animateLoginButton(1)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to the platform?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('VendorSignupStep1')}>
              <Text style={styles.footerLink}> Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modern Dialog (Sileo) */}
      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View style={[styles.sileoIconCircle, sileoConfig.type === 'success' ? styles.bgSuccess : sileoConfig.type === 'warning' ? styles.bgWarning : styles.bgInfo]}>
               <Feather 
                name={sileoConfig.type === 'success' ? 'check' : sileoConfig.type === 'warning' ? 'alert-circle' : 'info'} 
                size={28} 
                color="#fff" 
               />
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Countdown Restriction Modal */}
      {countdownVisible && (
        <View style={styles.sileoOverlay}>
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
      )}

      {/* Modern Dialog (Sileo) */}
      {sileoVisible && (
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View style={[styles.sileoIconCircle, sileoConfig.type === 'success' ? styles.bgSuccess : sileoConfig.type === 'warning' ? styles.bgWarning : styles.bgInfo]}>
               <Feather 
                name={sileoConfig.type === 'success' ? 'check' : sileoConfig.type === 'warning' ? 'alert-circle' : 'info'} 
                size={28} 
                color="#fff" 
               />
            </View>
            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>
            <TouchableOpacity style={styles.sileoButton} onPress={handleSileoClose}>
              <Text style={styles.sileoButtonText}>{sileoConfig.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Success Animation Modal */}
      <Modal transparent visible={successModalVisible} animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <Image source={LoginSuccess} style={styles.successImage} />
            <Text style={styles.successTitle}>Welcome Back</Text>
            <Text style={styles.successSub}>Authentication successful</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 60, backgroundColor: '#F8FAFC' },
  switchButton: {
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
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  switchText: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginLeft: 8 },
  headerContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
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
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748B', marginTop: 4, fontWeight: '400', lineHeight: 21, textAlign: 'center' },
  
  formCard: {
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
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
  input: { flex: 1, paddingHorizontal: 12, fontSize: 16, color: '#1E293B', fontWeight: '500' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 28 },
  forgotBtnText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
  
  primaryButton: {
    backgroundColor: '#5B9DFF',
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#4338CA',
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },
  footerText: { color: '#64748B', fontSize: 14 },
  footerLink: { color: '#0F172A', fontWeight: '700', fontSize: 14 },

  // Sileo Modal
  sileoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  sileoModal: { width: width * 0.85, backgroundColor: '#fff', borderRadius: 28, padding: 30, alignItems: 'center' },
  sileoIconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  bgSuccess: { backgroundColor: '#10B981' },
  bgWarning: { backgroundColor: '#F59E0B' },
  bgInfo: { backgroundColor: '#6366f1' },
  sileoTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  sileoMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 25 },
  sileoButton: { backgroundColor: '#0F172A', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  sileoButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Success Animation
  successOverlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center' },
  successContent: { alignItems: 'center' },
  successImage: { width: 120, height: 120, marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  successSub: { fontSize: 16, color: '#64748B', marginTop: 5 },

  // Countdown Modal
  countdownModal: { 
    width: width * 0.85, 
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

export default VendorLoginScreen;