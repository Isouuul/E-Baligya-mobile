import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { getAuth, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = () => {
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
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
  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

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
    let unsubscribeFollowers = null;
    let unsubscribeVendor = null;

    const fetchVendorData = async () => {
      try {
        if (user) {
          const vendorQuery = query(
            collection(db, 'ApprovedVendors'),
            where('userId', '==', user.uid)
          );

          const querySnapshot = await getDocs(vendorQuery);

          if (!querySnapshot.empty) {
            const vendorDoc = querySnapshot.docs[0];
            setVendorData({ ...vendorDoc.data(), id: vendorDoc.id });

            const vendorDocRef = doc(db, 'ApprovedVendors', vendorDoc.id);
            unsubscribeVendor = onSnapshot(vendorDocRef, (snapshot) => {
              if (snapshot.exists()) {
                setVendorData({ ...snapshot.data(), id: snapshot.id });
              }
            });

            const followersRef = collection(db, 'ApprovedVendors', vendorDoc.id, 'followers');
            unsubscribeFollowers = onSnapshot(followersRef, (snapshot) => {
              setFollowersCount(snapshot.size);
            });
          } else {
            console.warn('No vendor found.');
          }
        }
      } catch (error) {
        console.error('Error fetching vendor data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVendorData();

    return () => {
      if (unsubscribeFollowers) unsubscribeFollowers();
      if (unsubscribeVendor) unsubscribeVendor();
    };
  }, [user, db]);

  const handleLogout = () => {
    showSileo({
      title: 'Logout',
      message: 'Are you sure you want to end your vendor session?',
      type: 'warning',
      confirmText: 'Sign Out',
      cancelText: 'Stay',
      onConfirm: async () => {
        try {
          await signOut(auth);
          navigation.replace('Login');
        } catch (error) {
          showSileo({
            title: 'Logout Error',
            message: error?.message || 'Failed to sign out.',
            type: 'error',
            confirmText: 'OK',
          });
        }
      },
    });
  };

  const handleEditProfile = () => {
    if (vendorData) {
      navigation.navigate('EditVendorProfile', { vendorData });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (!vendorData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No vendor data found.</Text>
      </View>
    );
  }

  const profileImage = vendorData?.profileImage
    ? vendorData.profileImage.startsWith('data:')
      ? vendorData.profileImage
      : vendorData.profileImage
    : 'https://via.placeholder.com/100';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Vendor Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your business presence</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={handleLogout}>
          <Ionicons name="power" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        
        {/* Business Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.avatarWrap}>
            <Image source={{ uri: profileImage }} style={styles.image} />
            <View style={styles.editBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.profileLabel}>Verified Partner</Text>
            <Text style={styles.value} numberOfLines={1}>
              {vendorData.businessName || 'Business Name'}
            </Text>

            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{followersCount}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={[styles.statItem, { borderLeftWidth: 1, borderColor: '#e2e8f0' }]}>
                    <Text style={styles.statNumber}>Pro</Text>
                    <Text style={styles.statLabel}>Status</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={14} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Section */}
        <Text style={styles.blockTitle}>Business Tools</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity
            style={[styles.featureRow, styles.disabledFeature]}
            disabled={true}
          >
            <View style={styles.iconChip}>
              <Ionicons name="analytics" size={20} color="#64748b" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.featureTitle}>Insights & Analytics</Text>
              <Text style={styles.rowHint}>Track your store performance</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Soon</Text></View>
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={[styles.featureRow, styles.disabledFeature]}
            disabled={true}
          >
            <View style={styles.iconChip}>
              <Ionicons name="gift" size={20} color="#64748b" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.featureTitle}>Promotions</Text>
              <Text style={styles.rowHint}>Generate discount vouchers</Text>
            </View>
             <View style={styles.badge}><Text style={styles.badgeText}>Soon</Text></View>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <Text style={styles.blockTitle}>Resource Center</Text>
        <View style={styles.groupCard}>
          {[
            { icon: 'help-buoy-outline', label: 'Vendor Help Center', screen: 'HelpCenterScreen' },
            { icon: 'shield-checkmark-outline', label: 'Legal & Privacy', screen: 'TermsPolicyScreen' },
            { icon: 'chatbox-ellipses-outline', label: 'Contact Support', screen: 'ChatScreen' },
          ].map((item, index) => (
            <React.Fragment key={index}>
              <TouchableOpacity
                style={styles.featureRow}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={[styles.iconChip, {backgroundColor: '#f1f5f9'}]}>
                  <Ionicons name={item.icon} size={20} color="#0f172a" />
                </View>
                <Text style={styles.supportText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>
              {index !== 2 && <View style={styles.rowDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutAction}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutActionText}>Sign Out of Vendor Account</Text>
        </TouchableOpacity>
        
        <Text style={styles.footerVersion}>Version 2.0.4 Premium</Text>
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal transparent={true} visible={previewVisible} animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setPreviewVisible(false)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: profileImage }} style={styles.modalImage} resizeMode="contain" />
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
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContainer: { padding: 20, paddingBottom: 40 },

  // Header Styling
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

  // Section Titles
  blockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 12,
    marginTop: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingLeft: 4
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    marginTop: -15, // Overlap effect
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  avatarWrap: { position: 'relative' },
  image: { width: 85, height: 85, borderRadius: 24, backgroundColor: '#f1f5f9' },
  editBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#0f172a',
    padding: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff'
  },
  infoSection: { flex: 1, marginLeft: 20 },
  profileLabel: { fontSize: 10, color: '#10b981', fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  
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

  // Grouped Item Cards
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
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  disabledFeature: { backgroundColor: '#fafafa', opacity: 0.7 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  rowContent: { flex: 1 },
  featureTitle: { color: '#1e293b', fontWeight: '700', fontSize: 15 },
  rowHint: { marginTop: 2, color: '#94a3b8', fontSize: 12 },
  badge: { backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  supportText: { fontSize: 15, fontWeight: '600', color: '#334155', flex: 1 },
  
  rowDivider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 70 },

  // Action Buttons
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
  footerVersion: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 20 },

  // Modal
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