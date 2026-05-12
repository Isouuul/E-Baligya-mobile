// src/screens/Users/HelpCenter.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpCenter() {
  const navigation = useNavigation();
  const [expandedIndex, setExpandedIndex] = useState(null);

  const faqs = [
    {
      question: 'How do I place an order?',
      answer: 'Go to the Product Screen, select the items, and proceed to checkout.',
      action: () => navigation.navigate('ProductScreen'),
      icon: 'cart-outline'
    },
    {
      question: 'How can I track my orders?',
      answer: 'Go to the Orders section in your profile to view the status of your orders.',
      action: () => navigation.navigate('OrdersDetails'),
      icon: 'package-variant-closed'
    },
    {
      question: 'How do I edit my profile?',
      answer: 'Go to your profile and tap "Edit Profile" to update your information.',
      action: () => navigation.navigate('EditUserProfile'),
      icon: 'account-edit-outline'
    },
    {
      question: 'How can I participate in bidding?',
      answer: 'Go to the Bidding Screen to place or view your bids.',
      action: () => navigation.navigate('MyBids'),
      icon: 'gavel'
    },
    {
      question: 'How can I contact support?',
      answer: 'Use the "Chat with AgriFishery" option in the Support section of your profile.',
      action: () => navigation.navigate('SupportChat'),
      icon: 'chat-processing-outline'
    },
    {
      question: 'How do I report a product or shop?',
      answer: 'Go to the Product Screen or View Shop and tap the "Report" button to submit a report.',
      action: () => navigation.navigate('ReportScreen'),
      icon: 'alert-octagon-outline'
    },
  ];

  const toggleExpand = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
          <Ionicons name="arrow-back" size={22} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitleText}>Help Center</Text>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#1E3A8A" />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
        
        {faqs.map((faq, index) => (
          <View key={index} style={[styles.faqCard, expandedIndex === index && styles.activeCard]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleExpand(index)}
              style={styles.cardHeader}
            >
              <View style={styles.questionRow}>
                <View style={[styles.iconBox, expandedIndex === index && styles.activeIconBox]}>
                  <MaterialCommunityIcons 
                    name={faq.icon} 
                    size={22} 
                    color={expandedIndex === index ? '#fff' : '#1E3A8A'} 
                  />
                </View>
                <Text style={[styles.question, expandedIndex === index && styles.activeQuestionText]}>
                  {faq.question}
                </Text>
              </View>
              <Ionicons
                name={expandedIndex === index ? 'remove-circle-outline' : 'add-circle-outline'}
                size={22}
                color={expandedIndex === index ? '#1E3A8A' : '#94A3B8'}
              />
            </TouchableOpacity>

            {expandedIndex === index && (
              <View style={styles.answerContainer}>
                <View style={styles.divider} />
                <Text style={styles.answerText}>{faq.answer}</Text>
                <TouchableOpacity style={styles.actionButton} onPress={faq.action}>
                  <Text style={styles.actionButtonText}>Go to Screen</Text>
                  <Ionicons name="arrow-forward" size={16} color="#1E3A8A" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* SUPPORT SECTION */}
        <View style={styles.contactCard}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactSub}>Our team is available to assist you with any concerns.</Text>
          </View>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate('SupportChat')}
          >
            <MaterialCommunityIcons name="chat-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.contactButtonText}>Chat Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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

  // FAQ Card Styles
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden'
  },
  activeCard: { borderColor: '#1E3A8A', elevation: 5 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  questionRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  activeIconBox: { backgroundColor: '#1E3A8A' },
  question: { fontSize: 15, fontWeight: '700', color: '#1E293B', flex: 1 },
  activeQuestionText: { color: '#1E3A8A' },

  // Answer Styles
  answerContainer: { paddingHorizontal: 15, paddingBottom: 15, paddingTop: 0 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  answerText: { fontSize: 14, color: '#64748B', lineHeight: 20, fontWeight: '500' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-start'
  },
  actionButtonText: { color: '#1E3A8A', fontWeight: '800', fontSize: 13, marginRight: 5 },

  // Contact Support Card
  contactCard: {
    marginTop: 20,
    backgroundColor: '#1E3A8A',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  contactInfo: { flex: 1, marginRight: 10 },
  contactTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  contactSub: { color: '#BFDBFE', fontSize: 12, fontWeight: '500' },
  contactButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3
  },
  contactButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 }
});