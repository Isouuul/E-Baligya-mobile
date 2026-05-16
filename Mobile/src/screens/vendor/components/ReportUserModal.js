import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { db } from '../../../firebase';
import { collection, addDoc, doc, setDoc} from 'firebase/firestore';

export default function ReportUserModal({ visible, onClose, orderId, orderData }) {
  const [selectedOption, setSelectedOption] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);

  // Pre-defined vendor reporting reasons
  const reportOptions = [
    { id: 'joy_reserving', label: 'Joy Reserving / Booktripping' },
    { id: 'refused_delivery', label: 'Refused Payment / Delivery' },
    { id: 'fake_info', label: 'Fake Name, Phone, or Address' },
    { id: 'other', label: 'Other Reasons' }
  ];

  // Safely extract customer details
  const orderNumber = orderData?.orderNumber || 'N/A';
  const customerName = orderData?.address?.fullName || 'Unknown Customer';
  const customerPhone = orderData?.address?.contactNumber || 'N/A';
  const customerUid = orderData?.userId || 'N/A';
  const customerImage = orderData?.userProfileImage || orderData?.customerImage || null;

  const handleSubmitReport = async () => {
    if (!selectedOption) {
      alert("Please select a reason for reporting this user.");
      return;
    }

    if (selectedOption === 'other' && !reportReason.trim()) {
      alert("Please provide additional details for 'Other Reasons'.");
      return;
    }

    setIsSubmitting(true);
    
    const finalReasonCategory = reportOptions.find(o => o.id === selectedOption)?.label;
    const finalExplanation = selectedOption === 'other' ? reportReason.trim() : `Category: ${finalReasonCategory}. ${reportReason.trim()}`;

try {
  // Use the orderId directly as the document unique key
  const reportRef = doc(db, "VendorToUserReports", orderId || 'N/A');
  
  await setDoc(reportRef, {
    orderId: orderId || 'N/A',
    orderNumber: orderNumber,
    reportedCustomerName: customerName,
    reportedCustomerPhone: customerPhone,
    customerUid: customerUid,
    reasonCategory: finalReasonCategory,
    reasonDetails: finalExplanation,
    reportedAt: new Date(),
    status: 'PendingReview',
    reportType: 'Bogus Buyer / Booktripping' 
  });

  setIsSuccessVisible(true);
} catch (error) {
  console.error("Error writing vendor report: ", error);
  alert("Something went wrong. Please try again later.");
}finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setIsSuccessVisible(false);
    setSelectedOption('');
    setReportReason('');
    onClose(); // Close out the parent layout form automatically
  };

  return (
    <>
      {/* Primary Input Form Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={visible && !isSuccessVisible}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Customer</Text>
              <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBody}>
              {/* Context Card */}
              <View style={styles.userContextCard}>
                {customerImage ? (
                  <Image source={{ uri: customerImage }} style={styles.userAvatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#94A3B8" />
                  </View>
                )}
                <View style={styles.contextDetails}>
                  <Text style={styles.orderNumberTag}>Order #{orderNumber}</Text>
                  <Text style={styles.customerNameText} numberOfLines={1}>{customerName}</Text>
                </View>
              </View>

              <Text style={styles.sectionSubtitle}>Select Reason:</Text>

              {/* Radio Group Items */}
              <View style={styles.optionsGroup}>
                {reportOptions.map((option) => {
                  const isSelected = selectedOption === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      activeOpacity={0.7}
                      style={[
                        styles.radioWrapper,
                        isSelected && styles.radioWrapperSelected
                      ]}
                      onPress={() => {
                        if (!isSubmitting) setSelectedOption(option.id);
                      }}
                    >
                      <View style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected
                      ]}>
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                      
                      <Text style={[
                        styles.radioLabelText,
                        isSelected && styles.radioLabelTextSelected
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionSubtitle}>Additional Details (Optional):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={selectedOption === 'other' ? "Please explain the reason here... (Required)" : "Type extra details here..."}
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={reportReason}
                onChangeText={setReportReason}
                textAlignVertical="top"
                editable={!isSubmitting}
              />
            </ScrollView>

            {/* Action Row */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.7 }]} 
                onPress={handleSubmitReport}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Flag User</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Secondary Success Feedback Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isSuccessVisible}
        onRequestClose={handleCloseSuccess}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            
            {/* Smooth Visual Success Ring Checkmark badge */}
            <View style={styles.successIconBadge}>
              <Feather name="check" size={28} color="#10B981" />
            </View>

            <Text style={styles.successTitleText}>Report Filed</Text>
            <Text style={styles.successDescriptionText}>
              Thank you. This buyer issue has been logged for admin review to keep our marketplace safe.
            </Text>

            <TouchableOpacity 
              style={styles.successOkayButton} 
              onPress={handleCloseSuccess}
              activeOpacity={0.8}
            >
              <Text style={styles.successOkayButtonText}>Dismiss</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 345,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollBody: {
    marginBottom: 12,
  },
  userContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0'
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  contextDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center'
  },
  orderNumberTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3B82F6', 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  customerNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10,
    marginLeft: 2,
  },
  optionsGroup: {
    gap: 8,
    marginBottom: 16,
  },
  radioWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  radioWrapperSelected: {
    backgroundColor: '#EFF6FF', 
    borderColor: '#3B82F6',     
  },
  radioCircle: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#3B82F6',
  },
  radioInnerDot: {
    height: 9,
    width: 9,
    borderRadius: 4.5,
    backgroundColor: '#3B82F6',
  },
  radioLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  radioLabelTextSelected: {
    color: '#1E3A8A', 
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 80,
    marginBottom: 10,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444', 
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Layout styling structural parameters for custom Confirmation Modals
  successModalContent: {
    width: '100%',
    maxWidth: 310,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  successIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  successTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDescriptionText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  successOkayButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 0.5,
        alignItems: 'center',
    justifyContent: 'center',
  },
  successOkayButtonText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 14,
  },
});