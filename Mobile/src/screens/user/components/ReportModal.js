import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import CheckOutSuccess from '../../../assets/CheckOutSuccess.png';
import { Image } from 'react-native';

export const REPORT_OPTIONS = [
  'Spoiled or Expired Seafood',
  'Incorrect Product Description',
  'Damaged Packaging',
  'Unhygienic Handling',
  'Wrong Weight Measurement',
  'Others',
];

export default function ReportModal({
  visible,
  selectedReason,
  setSelectedReason,
  otherText,
  setOtherText,
  onClose,
  onSubmit,
  submitting,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Report Product</Text>

          {/* RADIO OPTIONS */}
          {REPORT_OPTIONS.map((option, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.radioRow, selectedReason === option && { backgroundColor: '#dbeafe' }]}
              onPress={() => setSelectedReason(option)}
            >
              <View style={styles.radioOuter}>
                {selectedReason === option && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </TouchableOpacity>
          ))}

          {/* OTHER INPUT */}
          {selectedReason === 'Others' && (
            <TextInput
              value={otherText}
              onChangeText={setOtherText}
              placeholder="Describe the issue..."
              style={styles.otherInput}
              multiline
            />
          )}

          {/* ACTION BUTTONS */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#9ca3af' }]} onPress={onClose}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, { backgroundColor: '#2563eb' }]} onPress={onSubmit}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const ReportSuccessModal = ({ visible, onClose }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.successOverlay}>
      <View style={styles.successBox}>
        <Image
          source={CheckOutSuccess}
          style={{ width: 120, height: 120 }}
          resizeMode="contain"
        />
        <Text style={styles.successTitle}>Report Submitted!</Text>
        <Text style={styles.successSubtitle}>
          Thank you for helping us maintain quality.
        </Text>
        <TouchableOpacity style={styles.successButton} onPress={onClose}>
          <Text style={styles.successButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 330,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 50,
    backgroundColor: '#2563eb',
  },
  radioLabel: {
    fontSize: 15,
    color: '#111827',
  },
  otherInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    height: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // Report Success Styles
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  successBox: { width: 300, backgroundColor: '#fff', borderRadius: 20, padding: 30, justifyContent: 'center', alignItems: 'center' },
  successTitle: { fontSize: 22, fontWeight: '700', marginVertical: 15, color: '#2563eb', textAlign: 'center' },
  successSubtitle: { fontSize: 14, color: '#4b5563', marginBottom: 15 },
  successButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12 },
  successButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
