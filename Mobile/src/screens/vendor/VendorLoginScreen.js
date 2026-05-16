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
import { Feather } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs, query, where, updateDoc, increment } from 'firebase/firestore';
import LoginSuccess from '../../../assets/Login.png';
import MarketImage from '../../../assets/Market.png';
import EbaligyaLogo from '../../images/ebaligya.png';

const { width } = Dimensions.get('window');

const VendorLoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const loginButtonScale = useRef(new Animated.Value(1)).current;
  
  // Timing References
  const loginTimeoutRef = useRef(null);
  const forcedTimerRef = useRef(null);

  // Modals Engine
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    buttonText: 'OK',
    type: 'info',
    onPress: null,
  });

  // Restriction Metrics Context
  const [countdownTime, setCountdownTime] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('');
  const [penaltyLabel, setPenaltyLabel] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);
  const [forcedSeconds, setForcedSeconds] = useState(10);

  useEffect(() => {
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');

    return () => {
      if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
      if (forcedTimerRef.current) clearInterval(forcedTimerRef.current);
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
    if (diffMs <= 0) return { time: '0 minutes', label: 'Restriction Expired' };

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

  /**
   * Core engine running compliance validation rules for Vendor data.
   * Returns true if locked out or delayed by an active penalty modal.
   */
  const processVendorRestrictions = async (vendorDoc, onSuccessCallback) => {
    const vendorData = vendorDoc.data();
    let accountStatus = (vendorData.accountStatus || 'active').toLowerCase();
    const verifiedCount = Number(vendorData.verifiedReports || 0);
    const loginWarningCount = Number(vendorData.loginWarningCount || 0);
    const now = new Date();
    const restrictedUntil = vendorData.restrictedUntil?.toDate ? vendorData.restrictedUntil.toDate() : null;

    // 🛑 1. HARD BLOCK: PERMANENT BAN
    if (accountStatus === 'banned') {
      await signOut(auth);
      setLoading(false);
      showSileo({ 
        title: 'Access Denied', 
        message: 'This account has been permanently deactivated from running business listings.', 
        type: 'warning' 
      });
      return true;
    }

    // ⏳ 2. HARD BLOCK: ACTIVE RESTRICTIONS COUNTDOWN
    if (accountStatus === 'restricted') {
      if (restrictedUntil && restrictedUntil > now) {
        const { time, label } = formatCountdownTime(restrictedUntil);
        setCountdownTime(time);
        setCountdownLabel(label);
        setPenaltyLabel(vendorData.lastPenaltyLabel || '⚡ Account Restricted');
        setStrikeCount(vendorData.reportStrikeCount || 0);
        setCountdownVisible(true);
        await signOut(auth);
        setLoading(false);
        return true;
      } else {
        // 💡 TIME SERVED: Automatically reinstate clean status if timeframe expired
        await updateDoc(vendorDoc.ref, { accountStatus: 'active', restrictedUntil: null });
        accountStatus = 'active'; // Mutate local reference state to avoid getting caught down below
      }
    }

    // ⚠️ 3. WARNING DELAY LAYER: Intercepts up to 5 times maximum
    if ((verifiedCount === 1 || verifiedCount === 2) && loginWarningCount < 5) {
      await updateDoc(vendorDoc.ref, {
        loginWarningCount: increment(1)
      });

      setPenaltyLabel(vendorData.lastPenaltyLabel || '⚠️ Vendor Warning Notice');
      setStrikeCount(vendorData.reportStrikeCount || 0);
      setForcedSeconds(10);
      setWarningVisible(true);
      setLoading(false);

      if (forcedTimerRef.current) clearInterval(forcedTimerRef.current);

      forcedTimerRef.current = setInterval(() => {
        setForcedSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(forcedTimerRef.current);
            setWarningVisible(false);
            onSuccessCallback();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return true;
    }

    return false;
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
        
        // Evaluate systemic rules
        const isIntercepted = await processVendorRestrictions(approvedDoc, executeSuccessTransition);
        
        if (!isIntercepted) {
          executeSuccessTransition();
        }

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
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showSileo({ 
          title: 'Security', 
          message: 'The password entered is incorrect.', 
          buttonText: 'OK', 
          type: 'warning',
          onPress: () => {
            setPassword(''); // Instantly clear input field for a clean retry state
            passwordInputRef.current?.focus();
          }
        });
        return;
      }
      if (err.code === 'auth/user-not-found') msg = 'No account found with this email.';
      showSileo({ title: 'Login Error', message: msg, type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const handleUserSwitch = () => {
    if (forcedTimerRef.current) clearInterval(forcedTimerRef.current);
    navigation.navigate('Login');
  };

  const executeSuccessTransition = () => {
    setSuccessModalVisible(true);
    loginTimeoutRef.current = setTimeout(() => {
      setSuccessModalVisible(false);
      navigation.replace('VendorDashboard');
    }, 1500);
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
        onPress={handleUserSwitch}
        disabled={loading}
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
            <Image source={EbaligyaLogo} style={styles.cardWatermark} resizeMode="contain" />
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

      {/* ⚠️ MODAL A: MANDATORY 10-SECOND PENALTY WARNING SCREEN */}
      <Modal transparent animationType="fade" visible={warningVisible} onRequestClose={() => {}}>
        <View style={styles.sileoOverlay}>
          <View style={styles.countdownModal}>
            <View style={[styles.warningIconCircleCircle, { backgroundColor: '#F59E0B' }]}>
              <Feather name="alert-circle" size={32} color="#fff" />
            </View>
            <Text style={styles.countdownTitle}>Account Citation Logged</Text>
            <Text style={[styles.warningSubLabel, { color: '#D97706' }]}>Compliance Review</Text>
            
            <View style={[styles.penaltyBox, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <Text style={[styles.penaltyBoxText, { color: '#92400E' }]}>{penaltyLabel}</Text>
            </View>
            
            <View style={styles.timerBox}>
              <Text style={[styles.timerText, { color: '#B45309' }]}>Proceeding in {forcedSeconds}s...</Text>
            </View>
            
            <Text style={styles.countdownMessage}>
              An administrator has verified a violation report filed against your store profile. Continued marketplace infractions will lead to structural business listing suspensions or permanent termination.
            </Text>
          </View>
        </View>
      </Modal>

      {/* 🚫 MODAL B: COUNTDOWN SUSPENSION LOCK (UNPASSABLE) */}
      <Modal transparent animationType="fade" visible={countdownVisible} onRequestClose={() => setCountdownVisible(false)}>
        <View style={styles.sileoOverlay}>
          <View style={styles.countdownModal}>
            <View style={styles.countdownIconCircle}>
              <Feather name="lock" size={32} color="#fff" />
            </View>
            <Text style={styles.countdownTitle}>Access Temporarily Blocked</Text>
            <Text style={styles.countdownLabel}>{countdownLabel}</Text>
            
            {penaltyLabel && (
              <View style={styles.penaltyBox}>
                <Text style={styles.penaltyBoxText}>{penaltyLabel}</Text>
                {strikeCount > 0 && (
                  <Text style={styles.strikeText}>Strike {strikeCount}</Text>
                )}
              </View>
            )}
            
            <View style={styles.timerBox}>
              <Text style={styles.timerText}>{countdownTime}</Text>
            </View>
            
            <Text style={styles.countdownMessage}>
              Your storefront access is under structural suspension due to system integrity rules. Standard vendor operations will unlock automatically upon expiry.
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

      {/* Modern Dialog (Sileo Engine Alerts) */}
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderRadius: 20,
    marginTop: 70,
    marginBottom: 70, 
    marginRight: 24,
  },
  switchText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandCircle: {
    width: 70,
    height: 70,
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 10,
    padding: 10,
  },
  brandImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  },
  cardWatermarkWrap: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    opacity: 0.03,
  },
  cardWatermark: {
    width: 150,
    height: 150,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 18,
  },
  inputFocused: {
    borderColor: '#6366f1',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
    marginLeft: 10,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotBtnText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  footerLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  sileoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 24,
  },
  sileoModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  sileoIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  bgSuccess: { backgroundColor: '#10B981' },
  bgWarning: { backgroundColor: '#EF4444' },
  bgInfo: { backgroundColor: '#3B82F6' },
  sileoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  sileoMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  sileoButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  sileoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  countdownModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  countdownIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIconCircleCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  countdownTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningSubLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  penaltyBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  penaltyBoxText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    textAlign: 'center',
  },
  strikeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 2,
  },
  timerBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  countdownMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  countdownButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 18,
  },
  countdownButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 28,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  successImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default VendorLoginScreen;