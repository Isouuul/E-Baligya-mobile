import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../../firebase';
import { 
  collectionGroup, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';

const MyBids = ({ navigation }) => {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const bidsQuery = query(
      collectionGroup(db, 'Bids'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc') // Get newest bids first
    );

    const unsubscribe = onSnapshot(bidsQuery, (snapshot) => {
      const rawBids = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // --- DEDUPLICATION & AVAILABILITY FILTER ---
      const uniqueBidsMap = new Map();

      rawBids.forEach(bid => {
        const snapshotData = bid.productSnapshot;

        // 1. Availability Check: Drop if snapshot is missing or status is explicitly restricted
        if (!snapshotData || snapshotData.status === 'restricted') {
          return; // Skip this item entirely
        }

        // 2. Deduplication Check: Keep only the FIRST (newest) bid found per product
        if (!uniqueBidsMap.has(bid.productId)) {
          uniqueBidsMap.set(bid.productId, bid);
        }
      });

      // Convert our filtered Map back into an array for the FlatList
      const deduplicatedBids = Array.from(uniqueBidsMap.values());
      
      setBids(deduplicatedBids);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Index/Fetch Error: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderBidItem = ({ item }) => {
    // Check if the user's bid is still the leader based on the latest product snapshot
    const isWin = item.bidAmount >= (item.productSnapshot?.currentHighestBid || 0);

    return (
      <TouchableOpacity 
        style={styles.bidCard}
        onPress={() => navigation.navigate('ViewBiddingProduct', { productId: item.productId })}
        activeOpacity={0.7}
      >
        {item.productSnapshot?.imageBase64 ? (
          <Image 
            source={{ uri: item.productSnapshot.imageBase64 }} 
            style={styles.productImage} 
          />
        ) : (
          <View style={[styles.productImage, styles.centered]}>
            <Ionicons name="image-outline" size={24} color="#94a3b8" />
          </View>
        )}
        
        <View style={styles.infoContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.productSnapshot?.productName || "Unknown Product"}
            </Text>
            <View style={[styles.statusBadge, isWin ? styles.statusWinning : styles.statusOutbid]}>
              <Text style={[styles.statusText, isWin ? styles.winningText : styles.outbidText]}>
                {isWin ? 'LEADING' : 'OUTBID'}
              </Text>
            </View>
          </View>

          <Text style={styles.vendorText}>Vendor: {item.vendorSnapshot?.businessName || "N/A"}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailBlock}>
              <Text style={styles.label}>YOUR BID</Text>
              <Text style={styles.value}>₱{Number(item.bidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}/kg</Text>
            </View>
            <View style={styles.dividerV} />
            <View style={styles.detailBlock}>
              <Text style={styles.label}>QTY</Text>
              <Text style={styles.value}>{item.quantity || 0}kg</Text>
            </View>
            <View style={styles.dividerV} />
            <View style={styles.detailBlock}>
              <Text style={styles.label}>TOTAL</Text>
              <Text style={[styles.value, { color: '#0284c7' }]}>
                ₱{Number(item.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>My Active Bids</Text>
            <Text style={styles.headerSub}>Track your competitive offers</Text>
          </View>
        </View>
      </View>

      {/* Main List / Empty State View */}
      {bids.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="gavel" size={40} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>No Active Bids</Text>
          <Text style={styles.emptyDesc}>
            Items you bid on will appear here. Start exploring the marketplace!
          </Text>
        </View>
      ) : (
        <FlatList
          data={bids}
          renderItem={renderBidItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default MyBids;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  centered: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  header: { 
    paddingHorizontal: 16, 
    paddingVertical: 15, 
    backgroundColor: '#ffffff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    marginLeft: 4,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '800', 
    color: '#0f172a',
    letterSpacing: -0.5
  },
  headerSub: { 
    fontSize: 13, 
    color: '#64748b', 
    marginTop: 1 
  },
  listContent: { 
    padding: 16,
    paddingBottom: 30 
  },
  bidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 3,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  productImage: { 
    width: 75, 
    height: 75, 
    borderRadius: 12, 
    backgroundColor: '#f1f5f9' 
  },
  infoContainer: { 
    flex: 1, 
    marginLeft: 14 
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  productName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#1e293b', 
    flex: 1, 
    marginRight: 8 
  },
  vendorText: { 
    fontSize: 12, 
    color: '#94a3b8', 
    marginTop: 2,
    marginBottom: 10 
  },
  statusBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6 
  },
  statusWinning: { 
    backgroundColor: '#dcfce7' 
  },
  statusOutbid: { 
    backgroundColor: '#fee2e2' 
  },
  statusText: { 
    fontSize: 10, 
    fontWeight: '800' 
  },
  winningText: { 
    color: '#15803d' 
  },
  outbidText: { 
    color: '#b91c1c' 
  },
  detailsRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8
  },
  detailBlock: {
    flex: 1,
    alignItems: 'center'
  },
  label: { 
    fontSize: 8, 
    color: '#94a3b8', 
    fontWeight: '700', 
    letterSpacing: 0.5,
    marginBottom: 2
  },
  value: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#334155' 
  },
  dividerV: { 
    width: 1, 
    height: 15, 
    backgroundColor: '#e2e8f0' 
  },
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  emptyTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#475569' 
  },
  emptyDesc: { 
    fontSize: 14, 
    color: '#94a3b8', 
    textAlign: 'center', 
    marginTop: 8,
    lineHeight: 20
  },
});