// src/screens/Users/Me.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Modal,
} from 'react-native';
import { auth, db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';

// Import your assets
import TermsIcon from '../../../assets/Terms.png';
import VoucherIcon from '../../../assets/Voucher.png';
import WalletIcon from '../../../assets/Wallet.png';
import FAQIcon from '../../../assets/FAQ.png';
import BiddingIcon from '../../../assets/Bidding.png';
import PointsIcon from '../../../assets/Points.png';
import PendingIcon from '../../../assets/Pending.png';
import RateIcon from '../../../assets/Rate.png';

export default function Me() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null,
  });
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const showSileo = ({
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = null,
    onConfirm = null,
  }) => {
    setSileoConfig({ title, message, type, confirmText, cancelText, onConfirm });
    setSileoVisible(true);
  };

  const handleSileoConfirm = async () => {
    const action = sileoConfig.onConfirm;
    setSileoVisible(false);
    if (typeof action === 'function') {
      await action();
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const uid = auth.currentUser.uid;
        const q = query(collection(db, 'Users'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) setUserData(snapshot.docs[0].data());
      } catch (err) {
        showSileo({
          title: 'Error',
          message: 'Failed to fetch user data.',
          type: 'error',
          confirmText: 'OK',
        });
      } finally {
        setLoading(false);
      }
    };
    if (isFocused) fetchUserData();
  }, [isFocused]);

  const handleLogout = () => {
    showSileo({
      title: 'Logout',
      message: 'Are you sure you want to end your session?',
      type: 'warning',
      confirmText: 'Sign Out',
      cancelText: 'Stay',
      onConfirm: async () => {
        try {
          await auth.signOut();
          navigation.replace('Login');
        } catch (error) {
          showSileo({
            title: 'Error',
            message: error?.message || 'Failed to sign out.',
            type: 'error',
            confirmText: 'OK',
          });
        }
      },
    });
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0F172A" />
    </View>
  );

  const profileImage = userData?.profileImage
    ? userData.profileImage.startsWith('data:image')
      ? userData.profileImage
      : `data:image/jpeg;base64,${userData.profileImage}`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A8A" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Account Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your profile & activity</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={handleLogout}>
          <Ionicons name="power" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.avatarWrapper}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.initialsAvatar}>
                <Text style={styles.initialsText}>{userData?.firstName?.[0]}{userData?.lastName?.[0]}</Text>
            </View>
            )}
            <TouchableOpacity
              style={styles.editBadge}
              onPress={() => navigation.navigate('EditProfileUser', { userData })}
            >
              <Feather name="edit-3" size={14} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.profileLabel}>Verified Customer</Text>
            <Text style={styles.userNameText} numberOfLines={1}>{userData?.firstName} {userData?.lastName}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>User</Text>
                <Text style={styles.statLabel}>Account</Text>
              </View>
              <View style={[styles.statItem, { borderLeftWidth: 1, borderColor: '#e2e8f0' }]}>
                <Text style={styles.statNumber}>Active</Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfileUser', { userData })}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={14} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>Activity Dashboard</Text>
          <View style={styles.groupCard}>
            <MenuAction icon={PendingIcon} label="My Orders" hint="Track shipments" onPress={() => navigation.navigate('OrdersDetails')} />
            <View style={styles.itemSeparator} />
            <MenuAction icon={BiddingIcon} label="Active Bids" hint="Check status" onPress={() => navigation.navigate('MyBids')} />
            <View style={styles.itemSeparator} />
            <MenuAction icon={RateIcon} label="Rate & Review" hint="Share feedback" disabled />
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>Financial Services</Text>
          <View style={styles.groupCard}>
            <MenuAction icon={WalletIcon} label="Pay Wallet" sub="Unavailable" disabled />
            <View style={styles.itemSeparator} />
            <MenuAction icon={PointsIcon} label="Loyalty Points" sub="Coming Soon" disabled />
            <View style={styles.itemSeparator} />
            <MenuAction icon={VoucherIcon} label="Vouchers" sub="0 Available" disabled />
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionHeader}>Account Support</Text>
          <View style={styles.groupCard}>
            <MenuAction icon={FAQIcon} label="Help Center" hint="24/7 Support" onPress={() => navigation.navigate('HelpCenter')} />
            <View style={styles.itemSeparator} />
            <MenuAction icon={TermsIcon} label="Legal & Privacy" hint="Terms of Use" onPress={() => navigation.navigate('TermsPolicyScreen')} />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutAction} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutActionText}>Sign Out of Account</Text>
        </TouchableOpacity>

        <Text style={styles.footerBrand}>Version 2.0.4</Text>
      </ScrollView>

      <Modal transparent={true} visible={previewVisible} animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setPreviewVisible(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {!!profileImage && <Image source={{ uri: profileImage }} style={styles.modalImage} resizeMode="contain" />}
        </View>
      </Modal>

      <Modal visible={sileoVisible} animationType="fade" transparent>
        <View style={styles.sileoOverlay}>
          <View style={styles.sileoModal}>
            <View
              style={[
                styles.sileoIconCircle,
                sileoConfig.type === 'warning'
                  ? styles.sileoWarningCircle
                  : sileoConfig.type === 'error'
                    ? styles.sileoErrorCircle
                    : sileoConfig.type === 'success'
                      ? styles.sileoSuccessCircle
                      : styles.sileoInfoCircle,
              ]}
            >
              <Text style={styles.sileoIcon}>
                {sileoConfig.type === 'warning'
                  ? '!'
                  : sileoConfig.type === 'error'
                    ? '×'
                    : sileoConfig.type === 'success'
                      ? '✓'
                      : 'i'}
              </Text>
            </View>

            <Text style={styles.sileoTitle}>{sileoConfig.title}</Text>
            <Text style={styles.sileoMessage}>{sileoConfig.message}</Text>

            <View style={styles.sileoActions}>
              {sileoConfig.cancelText && (
                <TouchableOpacity style={styles.sileoCancelButton} onPress={() => setSileoVisible(false)}>
                  <Text style={styles.sileoCancelText}>{sileoConfig.cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.sileoButton} onPress={handleSileoConfirm}>
                <Text style={styles.sileoButtonText}>{sileoConfig.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Internal Sub-Component for cleaner code
const MenuAction = ({ icon, label, hint, sub, onPress, disabled }) => (
  <TouchableOpacity 
    activeOpacity={0.7}
    onPress={onPress} 
    disabled={disabled} 
    style={[styles.menuRow, disabled && { opacity: 0.5 }]}
  >
    <View style={styles.menuRowLeft}>
      <View style={styles.iconContainer}>
        <Image source={icon} style={styles.menuIconImg} />
      </View>
      <View>
        <Text style={styles.menuLabelText}>{label}</Text>
        {hint && <Text style={styles.menuHintText}>{hint}</Text>}
        {sub && <Text style={styles.menuSubText}>{sub}</Text>}
      </View>
    </View>
    {!disabled && <Feather name="chevron-right" size={18} color="#94A3B8" />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  scrollContent: { padding: 20, paddingBottom: 40 },

  header: {
    paddingTop: 40,
    paddingBottom: 25,
    paddingHorizontal: 24,
    backgroundColor: '#1e3a8a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    marginTop: -15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  avatarWrapper: { position: 'relative' },
  avatarImage: { width: 85, height: 85, borderRadius: 24, backgroundColor: '#f1f5f9' },
  initialsAvatar: { 
    width: 85, height: 85, borderRadius: 24,
    backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center'
  },
  initialsText: { fontSize: 28, fontWeight: '800', color: '#38BDF8' },
  editBadge: { 
    position: 'absolute', bottom: -5, right: -5,
    backgroundColor: '#0f172a', padding: 6,
    borderRadius: 10, borderWidth: 2, borderColor: '#fff'
  },
  infoSection: { flex: 1, marginLeft: 20 },
  profileLabel: { fontSize: 10, color: '#10b981', fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  userNameText: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  statItem: { paddingHorizontal: 10 },
  statNumber: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  statLabel: { fontSize: 10, color: '#64748b' },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  editButtonText: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginRight: 4 },

  sectionWrapper: { marginTop: 15 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.5, paddingLeft: 4 },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },

  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuIconImg: { width: 22, height: 22, resizeMode: 'contain' },
  menuLabelText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  menuHintText: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  menuSubText: { fontSize: 11, color: '#EF4444', fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
  itemSeparator: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 75, marginRight: 20 },

  logoutAction: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    marginTop: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fee2e2'
  },
  logoutActionText: { color: '#ef4444', fontWeight: '700', fontSize: 15, marginLeft: 10 },
  footerBrand: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 20 },

  modalBackground: { flex: 1, backgroundColor: 'rgba(15,23,42,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeModal: { position: 'absolute', top: 50, right: 30, zIndex: 10 },
  modalImage: { width: '90%', height: '60%', borderRadius: 30 },

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
    width: '84%',
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
  sileoWarningCircle: { backgroundColor: '#F59E0B' },
  sileoInfoCircle: { backgroundColor: '#2563EB' },
  sileoErrorCircle: { backgroundColor: '#EF4444' },
  sileoSuccessCircle: { backgroundColor: '#16A34A' },
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
  sileoActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  sileoCancelButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  sileoCancelText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 15,
  },
  sileoButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  sileoButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});