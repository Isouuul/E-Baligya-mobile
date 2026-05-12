import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const SubscriptionsScreen = () => {
  const navigation = useNavigation();

  // Deep link to GCash (matches QR code content)
  const gcashDeepLink = 'gcash://pay?recipient=09123456789&amount=100&currency=PHP'; // Replace with your number/amount

  const handlePayment = () => {
    Linking.canOpenURL(gcashDeepLink)
      .then((supported) => {
        if (supported) {
          Linking.openURL(gcashDeepLink);
        } else {
          Alert.alert('Payment for Subscription is Under Maintenance');
        }
      })
      .catch(err => console.error('Error opening GCash:', err));
  };

  return (
    <View style={styles.container}>        
      <StatusBar hidden={true} backgroundColor="#1e3a8a" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GCash Payment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pay via GCash</Text>
          <Text style={styles.cardPrice}>Scan QR or click below</Text>

          {/* Display QR */}
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <Image 
              source={require('../../../../assets/GcashQR.jpg')} 
              style={{ width: 250, height: 250, borderRadius: 15 }}
            />
            <TouchableOpacity onPress={handlePayment} style={styles.paymentButton}>
              <Text style={styles.paymentButtonText}>Go to Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default SubscriptionsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  scrollContainer: { padding: 20, flexGrow: 1 },

  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1e3a8a', 
    paddingVertical: 15, 
    paddingHorizontal: 15 
  },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },

  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 20, 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowOffset: { width: 0, height: 3 }, 
    shadowRadius: 5,
    alignItems: 'center'
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardPrice: { fontSize: 16, fontWeight: '600', color: '#2563eb', marginBottom: 10 },

  paymentButton: { 
    backgroundColor: '#1e3a8a', 
    paddingVertical: 12, 
    paddingHorizontal: 25, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 15 
  },
  paymentButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
