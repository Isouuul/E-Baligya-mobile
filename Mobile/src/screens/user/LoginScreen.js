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
import { collection, getDocs, query, updateDoc, where, increment } from 'firebase/firestore';

// Asset Graphics
import LoginSuccess from '../../../assets/Login.png';
import MeImage from '../../../assets/Me.png';
import EbaligyaLogo from '../../images/ebaligya.png';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  
  // Modals Engine
  const [modalVisible, setModalVisible] = useState(false); 
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  
  // Restriction Metrics Context
  const [countdownTime, setCountdownTime] = useState('');
  const [countdownLabel, setCountdownLabel] = useState('');
  const [penaltyLabel, setPenaltyLabel] = useState('');
  const [strikeCount, setStrikeCount] = useState(0);
  const [forcedSeconds, setForcedSeconds] = useState(10);

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const loginButtonScale = useRef(new Animated.Value(1)).current;
  const checkboxScale = useRef(new Animated.Value(1)).current;
  
  // Timing References
  const forcedTimerRef = useRef(null);
  const transitionTimeoutRef = useRef(null);

  const animateLoginButton = (toValue) => {
    Animated.spring(loginButtonScale, {
      toValue,
      useNativeDriver: true,
      speed: 35,
      bounciness: 4,
    }).start();
  };

  const toggleRememberMe = () => {
    setRememberMe(!rememberMe);
    Animated.sequence([
      Animated.timing(checkboxScale, { toValue: 0.85, duration: 60, useNativeDriver: true }),
      Animated.spring(checkboxScale, { toValue: 1, bounciness: 12, useNativeDriver: true }),
    ]).start();
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

  useEffect(() => {
    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') StatusBar.setBackgroundColor('transparent');

    return () => {
      if (forcedTimerRef.current) clearInterval(forcedTimerRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  const processAccountRestrictions = async (userDoc, onSuccessCallback) => {
    let userData = userDoc.data();
    let currentStatus = userData.accountStatus || userData.status || 'active';
    const verifiedCount = Number(userData.verifiedReports || 0);
    const loginWarningCount = Number(userData.loginWarningCount || 0);
    const now = new Date();

    if (currentStatus === 'banned') {
      setMessageType('error');
      setMessage('🚫 Your account has been permanently banned.');
      await auth.signOut();
      setLoading(false);
      return true;
    }

    if (currentStatus === 'restricted') {
      if (userData.restrictedUntil && userData.restrictedUntil.toDate() > now) {
        // Time has NOT passed -> Block access and present the countdown modal
        const { time, label } = formatCountdownTime(userData.restrictedUntil.toDate());
        setCountdownTime(time);
        setCountdownLabel(label);
        setPenaltyLabel(userData.lastPenaltyLabel || '⚡ Account Restricted');
        setStrikeCount(userData.reportStrikeCount || 0);
        setCountdownVisible(true);
        await auth.signOut();
        setLoading(false);
        return true;
      } else {
        // 💡 TIME HAS SERVED -> Silently restore active state fields
        await updateDoc(userDoc.ref, { 
          accountStatus: 'active', 
          restrictedUntil: null 
        });
        // Mutate memory object references locally so the lower warning evaluations check current standings
        currentStatus = 'active';
      }
    }

    // Handle warning citations logic gracefully for warning layers
    if ((verifiedCount === 1 || verifiedCount === 2) && loginWarningCount < 5) {
      await updateDoc(userDoc.ref, {
        loginWarningCount: increment(1)
      });

      setPenaltyLabel(userData.lastPenaltyLabel || '⚠️ Account Warning');
      setStrikeCount(userData.reportStrikeCount || 0);
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
        const isIntercepted = await processAccountRestrictions(userDoc, executeSuccessTransition);
        
        if (!isIntercepted) {
          executeSuccessTransition();
        }
      } else {
        await auth.signOut();
        setMessageType('error');
        setMessage('🚫 Access Denied: This account is not registered as a user.');
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      let customMessage = '❌ Something went wrong. Please try again.';
      if (error.code === 'auth/invalid-credential') customMessage = 'Incorrect email or password.';
      else if (error.code === 'auth/too-many-requests') customMessage = '⏳ Too many failed login attempts.';
      
      setMessageType('error');
      setMessage(customMessage);
      Loading(false);
    }
  };

  const handleVendorSwitch = () => {
    navigation.navigate('VendorLoginScreen');
  };

  const executeSuccessTransition = () => {
    setModalVisible(true);
    transitionTimeoutRef.current = setTimeout(() => {
      setModalVisible(false);
      navigation.replace('ConsumerTabs');
    }, 1500);
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
        <TouchableOpacity
          style={styles.vendorIconContainer}
          onPress={handleVendorSwitch}
        >
          <Feather name="repeat" size={16} color="#0F172A" />
          <Text style={styles.vendorText}>Switch to Vendor</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <View style={styles.brandCircle}>
            <Image source={MeImage} style={styles.brandImage} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your shopping journey</Text>
        </View>

        {message && (
          <View style={[styles.alertBox, messageType === 'success' ? styles.successBox : styles.errorBox]}>
            <Feather
              name={messageType === 'success' ? 'check-circle' : 'alert-triangle'}
              size={18}
              color={messageType === 'success' ? '#166534' : '#b91c1c'}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.alertText, { color: messageType === 'success' ? '#166534' : '#b91c1c' }]}>
              {message}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardWatermarkWrap} pointerEvents="none">
            <Image source={EbaligyaLogo} style={styles.cardWatermark} resizeMode="contain" />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <Pressable
            style={[styles.inputGroup, focusedInput === 'email' && styles.inputFocused]}
            onPress={() => emailInputRef.current?.focus()}
          >
            <Feather name="mail" size={18} color={focusedInput === 'email' ? '#6366f1' : '#94A3B8'} style={styles.icon} />
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
              editable={!loading}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </Pressable>

          <Text style={styles.label}>Password</Text>
          <Pressable
            style={[styles.inputGroup, focusedInput === 'password' && styles.inputFocused]}
            onPress={() => passwordInputRef.current?.focus()}
          >
            <Feather name="lock" size={18} color={focusedInput === 'password' ? '#6366f1' : '#94A3B8'} style={styles.icon} />
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

          <View style={styles.optionsRow}>
            <TouchableOpacity 
              style={styles.rememberMeContainer} 
              onPress={toggleRememberMe}
              activeOpacity={0.8}
            >
              <Animated.View 
                style={[
                  styles.checkbox, 
                  rememberMe && styles.checkboxChecked,
                  { transform: [{ scale: checkboxScale }] }
                ]}
              >
                {rememberMe && <Feather name="check" size={12} color="#FFFFFF" />}
              </Animated.View>
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <Animated.View style={{ transform: [{ scale: loginButtonScale }] }}>
            <TouchableOpacity
              style={[styles.loginButton, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              onPressIn={() => animateLoginButton(0.98)}
              onPressOut={() => animateLoginButton(1)}
              disabled={loading}
            >
              {loading ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={styles.loginText}>SIGN IN</Text>}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.signupPrompt}>
            <Text style={styles.promptText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.signupText}> Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal warning layers */}
        <Modal transparent animationType="fade" visible={warningVisible} onRequestClose={() => {}}>
          <View style={styles.countdownOverlay}>
            <View style={styles.countdownModal}>
              <View style={[styles.countdownIconCircle, { backgroundColor: '#F59E0B' }]}>
                <Feather name="alert-circle" size={32} color="#fff" />
              </View>
              <Text style={styles.countdownTitle}>Account Citation Logged</Text>
              <Text style={[styles.modalCountdownLabel, { color: '#D97706' }]}>Compliance Review</Text>
              <View style={[styles.penaltyBox, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Text style={[styles.penaltyTextDisplay, { color: '#92400E' }]}>{penaltyLabel}</Text>
              </View>
              <View style={styles.timerBox}>
                <Text style={[styles.timerText, { color: '#B45309' }]}>Proceeding in {forcedSeconds}s...</Text>
              </View>
              <Text style={styles.countdownMessage}>
                An administrator has verified a violation report filed against your profile activities. Continued marketplace infractions will lead to structural hourly/daily suspensions or permanent termination.
              </Text>
            </View>
          </View>
        </Modal>

        <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalBackground}>
            <View style={styles.modalContent}>
              <Image source={LoginSuccess} style={styles.modalImage} resizeMode="contain" />
              <Text style={styles.modalText}>Logged in successfully!</Text>
            </View>
          </View>
        </Modal>

        <Modal transparent animationType="fade" visible={countdownVisible} onRequestClose={() => setCountdownVisible(false)}>
          <View style={styles.countdownOverlay}>
            <View style={styles.countdownModal}>
              <View style={styles.countdownIconCircle}>
                <Feather name="lock" size={32} color="#fff" />
              </View>
              <Text style={styles.countdownTitle}>Access Temporarily Blocked</Text>
              <Text style={styles.modalCountdownLabel}>{countdownLabel}</Text>
              {penaltyLabel && (
                <View style={styles.penaltyBox}>
                  <Text style={styles.penaltyTextDisplay}>{penaltyLabel}</Text>
                  {strikeCount > 0 && <Text style={styles.strikeText}>Strike {strikeCount}</Text>}
                </View>
              )}
              <View style={styles.timerBox}>
                <Text style={styles.timerText}>{countdownTime}</Text>
              </View>
              <Text style={styles.countdownMessage}>
                Your account is under structural suspension due to system integrity rules. Standard operations will unlock automatically upon expiry.
              </Text>
              <TouchableOpacity style={styles.countdownButton} onPress={() => setCountdownVisible(false)}>
                <Text style={styles.countdownButtonText}>Understood</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
  },
  vendorIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 70,
    marginBottom: 70, 
  },
  vendorText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 24,
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
    padding: 10,
    borderRadius: 10,
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
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  successBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  alertText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  card: {
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
  inputGroup: {
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
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  rememberMeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  forgotLink: {
    alignSelf: 'center',
  },
  forgotText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 0.5,
    height: 54,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  promptText: {
    fontSize: 14,
    color: '#64748B',
  },
  signupText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 28,
    alignItems: 'center',
    width: '80%',
  },
  modalImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  countdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  countdownTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalCountdownLabel: {
    fontSize: 14,
    color: '#EF4444',
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
  penaltyTextDisplay: {
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
});

export default LoginScreen;