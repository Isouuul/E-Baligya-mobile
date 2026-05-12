import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const HelpCenterScreen = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState(null);
  const navigation = useNavigation();
  const db = getFirestore();

  // Fetch FAQs from Firestore
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'HelpCenter'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFaqs(data);
      } catch (error) {
        console.error('Error fetching FAQs:', error);
        Alert.alert('Error', 'Failed to load FAQs');
      } finally {
        setLoading(false);
      }
    };
    fetchFaqs();
  }, []);

  // Filtered FAQs based on search
  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Submit ticket (dummy for now)
  const handleSubmitTicket = () => {
    navigation.navigate('SubmitTicketScreen');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Ionicons name="chevron-back" size={18} color="#0f172a" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="sparkles-outline" size={18} color="#1d4ed8" />
          </View>
          <Text style={styles.heroTag}>Premium Assistance</Text>
        </View>
        <Text style={styles.title}>Help Center</Text>
        <Text style={styles.subtitle}>Quick answers, polished support, and priority ticket routing.</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchIconWrap}>
          <Ionicons name="search" size={18} color="#6b7280" />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search FAQs"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <Text style={styles.sectionMeta}>{filteredFaqs.length} results</Text>
      </View>

      {/* FAQs List */}
      {filteredFaqs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="help-circle-outline" size={24} color="#94a3b8" />
          <Text style={styles.emptyTitle}>No matching FAQs</Text>
          <Text style={styles.emptySubtitle}>Try a different keyword or submit a ticket below.</Text>
        </View>
      ) : (
        filteredFaqs.map((faq, index) => {
          const isExpanded = expandedIndex === index;

          return (
            <TouchableOpacity
              key={faq.id}
              style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
              activeOpacity={0.85}
              onPress={() => setExpandedIndex(isExpanded ? null : index)}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.question}>{faq.question}</Text>
                <View style={[styles.chevronWrap, isExpanded && styles.chevronWrapExpanded]}>
                  <Ionicons
                    name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={16}
                    color={isExpanded ? '#1d4ed8' : '#64748b'}
                  />
                </View>
              </View>
              {isExpanded && <Text style={styles.answer}>{faq.answer}</Text>}
            </TouchableOpacity>
          );
        })
      )}

      <View style={styles.supportCard}>
        <View style={styles.supportHeader}>
          <Ionicons name="headset-outline" size={18} color="#1d4ed8" />
          <Text style={styles.supportTitle}>Need tailored support?</Text>
        </View>
        <Text style={styles.supportText}>Our team will review your request and get back with priority guidance.</Text>

        {/* Submit Ticket Button */}
        <TouchableOpacity style={styles.ticketButton} onPress={handleSubmitTicket} activeOpacity={0.9}>
          <Text style={styles.ticketButtonText}>Submit a Support Ticket</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default HelpCenterScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  heroCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  heroTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e3a8a',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    marginLeft: 10,
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    paddingVertical: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  faqItem: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  faqItemExpanded: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fbff',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  question: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    paddingRight: 10,
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronWrapExpanded: {
    backgroundColor: '#dbeafe',
  },
  answer: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  supportCard: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  supportText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    marginBottom: 12,
  },
  ticketButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ticketButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
