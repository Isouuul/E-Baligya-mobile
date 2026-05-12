// src/screens/Users/components/ProductImageHero.js
import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BasketIcon from '../../../../assets/basket.png';
import AlertIcon from '../../../../assets/Alert.png';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function ProductImageHero({ 
  navigation, 
  productImage, 
  onReportPress = () => {} 
}) {
  return (
    <View style={styles.imageHero}>
      <Image
        source={productImage
          ? { uri: productImage }
          : { uri: 'https://via.placeholder.com/600x400.png?text=No+Image' }}
        style={styles.productImage}
      />
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={styles.imageOverlay}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={32} color="#fff" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.reportButton} onPress={onReportPress}>
            <Image source={AlertIcon} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cartButton} onPress={() => navigation.navigate('CartShop')}>
            <Image source={BasketIcon} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}const styles = StyleSheet.create({
  imageHero: { width, height: height * 0.45 },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, paddingHorizontal: 15,
  },

  // 🔵 BLUE MINIMALIST BUTTONS
  backButton: { 
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  reportButton: { 
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },

  cartButton: { 
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
