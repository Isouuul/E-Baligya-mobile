// src/screens/Users/components/FloatingBar.js
import React from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Dimensions } from 'react-native';
import addtobasket from '../../../../assets/add-to-basket.png';
import BuyNowIcon from '../../../../assets/BuyNow.png';

const { width } = Dimensions.get('window');

export default function FloatingBar({ onAddToCart, onBuyNow, onChatNow }) {
  return (
    <View style={styles.floatingBar}>

      {/* Add to Cart */}
      <TouchableOpacity style={styles.smallButton} onPress={onAddToCart}>
        <Image source={addtobasket} style={styles.icon} />
        <Text style={styles.smallText}>Add to Cart</Text>
      </TouchableOpacity>

      {/* BUY NOW (WIDE LIKE SHOPEE) */}
      <TouchableOpacity style={styles.buyNowButton} onPress={onBuyNow}>
        <Image source={BuyNowIcon} style={styles.buyNowIcon} />
        <Text style={styles.buyNowText}>BUY NOW</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    width,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 5,
  },

  // Small Buttons: Chat & Cart
  smallButton: {
    width: 60,
    height: 60,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  icon: {
    width: 26,
    height: 26,
    marginBottom: 2,
    resizeMode: 'contain',
  },

  smallText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 8,
    padding: 3
  },

  // BUY NOW Button
  buyNowButton: {
    flex: 1,
    height: 60,
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  buyNowIcon: {
    width: 26,
    height: 26,
    marginRight: 10,
    resizeMode: 'contain',
  },

  buyNowText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
});
