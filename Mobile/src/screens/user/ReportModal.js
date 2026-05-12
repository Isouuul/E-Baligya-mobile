// src/components/ReportModal.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from '../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const { height } = Dimensions.get('window');

export default function ReportModal({ visible, onClose, productId, productName, product }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [sileoVisible, setSileoVisible] = useState(false);
  const [sileoConfig, setSileoConfig] = useState({
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null,
  });

  const reasons = [
    "Spoiled Seafood",
    "Expired Products",
    "Mislabeling / Wrong Information",
    "Poor Quality",
    "Others",
  ];

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

  // Logic Preserved: Image Picking
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].base64);
    }
  };

  // Logic Preserved: Submit Handling
  const handleSubmit = async () => {
    if (!selectedReason) {
      showSileo({
        title: 'Notice',
        message: 'Please select a reason.',
        type: 'warning',
        confirmText: 'OK',
      });
      return;
    }

    if (!image) {
      showSileo({
        title: 'Notice',
        message: 'Please upload evidence photo to proceed.',
        type: 'warning',
        confirmText: 'OK',
      });
      return;
    }

    setLoading(true);
    try {
      const reportData = {
        userId: auth.currentUser.uid,
        productId,
        productName,
        vendorId: product.uploadedBy.uid,
        productImage: product.imageBase64 ? `data:image/jpeg;base64,${product.imageBase64}` : null,
        vendorEmail: product.uploadedBy.email,
        businessName: product.uploadedBy.businessName,
        reason: selectedReason,
        details: reasonText,
        evidenceImage: image ? `data:image/jpeg;base64,${image}` : null,
        createdAt: serverTimestamp(),
        status: 'pending',
      };

      await addDoc(collection(db, 'Reports_Products'), reportData);

      setLoading(false);
      setSuccessModal(true);
      setSelectedReason(null);
      setReasonText('');
      setImage(null);
    } catch (err) {
      setLoading(false);
      console.log('Report submission failed:', err);
      showSileo({
        title: 'Error',
        message: 'Failed to submit report.',
        type: 'error',
        confirmText: 'OK',
      });
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* DRAG HANDLE INDICATOR */}
            <View style={styles.dragHandle} />
            
            <View style={styles.headerRow}>
              <Text style={styles.modalTitle}>Report Product</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <Text style={styles.subTitle}>Help us understand what is wrong with <Text style={styles.boldText}>{productName}</Text></Text>

              <Text style={styles.label}>Select Reason</Text>
              <View style={styles.reasonGrid}>
                {reasons.map((r, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.reasonChip, selectedReason === r && styles.selectedChip]}
                    onPress={() => setSelectedReason(r)}
                  >
                    <MaterialCommunityIcons 
                      name={selectedReason === r ? "check-circle" : "circle-outline"} 
                      size={18} 
                      color={selectedReason === r ? "#fff" : "#94A3B8"} 
                    />
                    <Text style={[styles.reasonText, selectedReason === r && styles.selectedChipText]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Additional Details</Text>
              <TextInput
                placeholder="Briefly describe the quality issue..."
                placeholderTextColor="#94A3B8"
                style={styles.textInput}
                multiline
                value={reasonText}
                onChangeText={setReasonText}
              />

              <Text style={styles.label}>Evidence (Required)</Text>
              <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
                {image ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.previewImage} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <MaterialCommunityIcons name="camera-plus-outline" size={32} color="#3B82F6" />
                    <Text style={styles.uploadPlaceholderText}>Upload Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.submitButton, (loading || !image) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={loading || !image}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <View style={styles.submitContent}>
                    <MaterialCommunityIcons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.submitText}>Submit Report</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={successModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Ionicons name="shield-checkmark" size={60} color="#15803D" />
            </View>
            <Text style={styles.successTitle}>Report Received</Text>
            <Text style={styles.successSub}>Thank you for keeping our marketplace safe. Our team will review this report shortly.</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                setSuccessModal(false);
                onClose();
              }}
            >
              <Text style={styles.doneButtonText}>Finish</Text>
            </TouchableOpacity>
          </View>
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
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  modalContainer: { 
    width: '100%', 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 35, 
    borderTopRightRadius: 35, 
    padding: 24, 
    height: height * 0.85,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20
  },
  dragHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 10, alignSelf: 'center', marginBottom: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  closeIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  subTitle: { fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 20 },
  boldText: { fontWeight: '800', color: '#1E3A8A' },
  
  label: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginTop: 15, marginBottom: 10 },
  
  // Reasons Grid
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  reasonChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 14, 
    marginRight: 8, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  selectedChip: { backgroundColor: '#1E3A8A', borderColor: '#1E3A8A' },
  reasonText: { fontSize: 13, fontWeight: '700', color: '#64748B', marginLeft: 6 },
  selectedChipText: { color: '#fff' },

  // Inputs
  textInput: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 18, 
    padding: 15, 
    minHeight: 100, 
    textAlignVertical: 'top', 
    fontSize: 14, 
    fontWeight: '600',
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },

  // Upload Area
  uploadArea: { 
    width: '100%', 
    height: 180, 
    backgroundColor: '#F1F5F9', 
    borderRadius: 20, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    borderColor: '#CBD5E1', 
    justifyContent: 'center', 
    alignItems: 'center',
    overflow: 'hidden'
  },
  uploadPlaceholder: { alignItems: 'center' },
  uploadPlaceholderText: { marginTop: 8, fontSize: 14, fontWeight: '800', color: '#3B82F6' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  // Footer
  footer: { paddingTop: 20, paddingBottom: 10 },
  submitButton: { backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 20, alignItems: 'center', shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  submitContent: { flexDirection: 'row', alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // Success Modal
  successCard: { width: '85%', backgroundColor: '#fff', borderRadius: 30, padding: 30, alignItems: 'center', marginBottom: height * 0.3 },
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 10 },
  successSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  doneButton: { backgroundColor: '#1E3A8A', width: '100%', paddingVertical: 14, borderRadius: 15, marginTop: 25 },
  doneButtonText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '800' },

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