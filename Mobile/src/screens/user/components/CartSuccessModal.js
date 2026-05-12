import React from 'react';
import { View, Text, Modal, Image, TouchableOpacity, StyleSheet } from 'react-native';
import CheckOutSuccess from '../../../../assets/CheckOutSuccess.png';

export default function CartSuccessModal({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Image source={CheckOutSuccess} style={{ width: 120, height: 120 }} resizeMode="contain" />
          <Text style={styles.title}>Added to Cart!</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  box: { width: 300, backgroundColor: '#fff', borderRadius: 20, padding: 30, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginVertical: 15, color: '#2563eb', textAlign: 'center' },
  button: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
