import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function InfoCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    marginHorizontal: 15,
    marginBottom: 15,
    elevation: 3,
  },
});
