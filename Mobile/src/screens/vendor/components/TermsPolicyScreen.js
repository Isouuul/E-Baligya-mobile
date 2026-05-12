// src/screens/Users/TermsPolicyScreen.js
import React from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  StatusBar, 
  SafeAreaView 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsPolicyScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>Terms & Policy</Text>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#1E3A8A" />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        <Text style={styles.sectionLabel}>AgriFishery Guidelines</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>Terms of Service</Text>
          </View>
          <Text style={styles.paragraph}>
            Welcome to AgriFishery! By using our app, you agree to comply with and be bound by the following terms and conditions...
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>Privacy Policy</Text>
          </View>
          <Text style={styles.paragraph}>
            We value your privacy. Any information collected will be used solely for providing and improving our services...
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="account-check-outline" size={22} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>User Responsibilities</Text>
          </View>
          <Text style={styles.paragraph}>
            Users are responsible for maintaining the confidentiality of their accounts, using the app legally, and not engaging in prohibited activities...
          </Text>
        </View>

        {/* PENALTIES SECTION */}
        <View style={[styles.card, styles.penaltyCard]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#EF4444" />
            <Text style={[styles.sectionTitle, {color: '#B91C1C'}]}>Reporting and Penalties</Text>
          </View>
          
          <View style={styles.penaltyRow}><Text style={styles.penaltyBullet}>•</Text><Text style={styles.penaltyText}>1 verified report — 12-hour temporary login restriction.</Text></View>
          <View style={styles.penaltyRow}><Text style={styles.penaltyBullet}>•</Text><Text style={styles.penaltyText}>2 verified reports — 2-day account suspension.</Text></View>
          <View style={styles.penaltyRow}><Text style={styles.penaltyBullet}>•</Text><Text style={styles.penaltyText}>3 verified reports — 5-day account suspension.</Text></View>
          <View style={styles.penaltyRow}><Text style={styles.penaltyBullet}>•</Text><Text style={styles.penaltyText}>5 verified reports — 7-day account suspension.</Text></View>
          <View style={styles.penaltyRow}><Text style={styles.penaltyBullet}>•</Text><Text style={styles.penaltyText}>7 verified reports — permanent ban.</Text></View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={18} color="#1E3A8A" />
            <Text style={styles.infoBoxText}>
              Appeals may be filed through the Help Center with proper evidence. All safety decisions undergo review.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="scale-balance" size={22} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          </View>
          <Text style={styles.paragraph}>
            AgriFishery is not liable for damages or losses resulting from the use of this app, including but not limited to data loss or service interruptions...
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="headphones" size={22} color="#1E3A8A" />
            <Text style={styles.sectionTitle}>Contact</Text>
          </View>
          <Text style={styles.paragraph}>
            For any concerns, contact us via Help Center or Chat with AgriFishery.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsPolicyScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header matched to OrdersDetails
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: '#fff',
    marginTop: 35
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: { fontSize: 18, fontWeight: '800', color: '#1E293B' },

  scrollContainer: { padding: 20, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 15, marginLeft: 5 },

  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginLeft: 10,
  },
  paragraph: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
    fontWeight: '500',
  },

  // Penalty Section specific styles
  penaltyCard: { borderColor: '#FEE2E2', backgroundColor: '#FFF' },
  penaltyRow: { flexDirection: 'row', marginBottom: 6, paddingRight: 10 },
  penaltyBullet: { color: '#EF4444', fontWeight: 'bold', width: 20, fontSize: 18 },
  penaltyText: { color: '#475569', fontSize: 14, fontWeight: '600', flex: 1 },
  
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 15,
    alignItems: 'center'
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
    marginLeft: 8,
    lineHeight: 16
  }
});