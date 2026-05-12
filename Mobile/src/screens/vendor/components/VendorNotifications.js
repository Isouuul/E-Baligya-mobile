// src/screens/Vendor/VendorNotifications.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../../firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

export default function VendorNotifications() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const notificationsRef = collection(db, 'Vendor_Notifications', user.uid, 'vendorNotifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(fetched);
      setLoading(false);
    }, error => {
      console.error('Failed to fetch vendor notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleNotificationPress = async (notification) => {
    // Mark notification as read
    try {
      const user = auth.currentUser;
      if (user) {
        const notifRef = doc(db, 'Vendor_Notifications', user.uid, 'vendorNotifications', notification.id);
        await updateDoc(notifRef, { status: 'read' });
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    // Navigate to OrdersScreen with orderNumber
    navigation.navigate('OrdersScreen', { orderNumber: notification.orderNumber });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.notificationCard, item.status === 'unread' && styles.unreadNotification]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconWrapper}>
        <Ionicons name="notifications-outline" size={24} color="#3B82F6" />
      </View>
      <View style={styles.textWrapper}>
        <Text style={styles.messageText}>{item.message}</Text>
        {item.createdAt?.toDate && <Text style={styles.timeText}>{item.createdAt.toDate().toLocaleString()}</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator size="large" color="#3B82F6" style={{ flex: 1, justifyContent: 'center' }} />;

  return (
    <View style={styles.container}>
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 10 },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    elevation: 2,
    alignItems: 'center',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  iconWrapper: { marginRight: 12 },
  textWrapper: { flex: 1 },
  messageText: { fontSize: 14, fontWeight: '500', color: '#111827' },
  timeText: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#6B7280' },
});
