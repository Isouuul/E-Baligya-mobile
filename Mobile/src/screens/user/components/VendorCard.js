// src/screens/Users/components/VendorCard.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import InfoCard from './InfoCard';

export default function VendorCard({ vendor, onViewShop }) {
  if (!vendor?.businessName) return null;

  return (
    <InfoCard style={styles.vendorCard}>
      <View style={styles.vendorHeader}>
        <Image
          source={{ uri: vendor.selfie || 'https://via.placeholder.com/100' }}
          style={styles.vendorImage}
        />
        <View style={styles.vendorTextGroup}>
          <Text style={styles.vendorName}>{vendor.businessName}</Text>
          <TouchableOpacity style={styles.viewShopBtn} onPress={onViewShop}>
            <Text style={styles.viewShopText}>View Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  vendorCard: { paddingVertical: 18 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vendorImage: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eee', marginRight: 15 },
  vendorTextGroup: { flex: 1 },
  vendorName: { fontSize: 18, fontWeight: '700', color: '#1e3a8a', marginBottom: 4 },
  viewShopBtn: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#e0f2f1' },
  viewShopText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
});
