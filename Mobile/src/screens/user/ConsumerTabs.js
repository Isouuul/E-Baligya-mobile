import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image } from 'react-native';
import { auth, db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// Screens
import HomeScreen from './Home';
import ProductScreen from './Product';
import BiddingScreen from './BiddingProductScreen';
import NotificationScreen from './Notification';
import MeScreen from './Me';

// Icons
import HomeIcon from '../../../assets/Home.png';
import ProductIcon from '../../../assets/Product.png';
import BiddingIcon from '../../../assets/Bidding.png';
import NotificationIcon from '../../../assets/notification.png';
import MeIcon from '../../../assets/Me.png';

const Tab = createBottomTabNavigator();

export default function ConsumerTabs() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "User_Notifications_Bidding"),
      where("userId", "==", auth.currentUser.uid),
      where("read", "==", false)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsub();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#ddd', height: 60 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: () => <Image source={HomeIcon} style={{ width: 25, height: 25 }} />,
        }}
      />

      <Tab.Screen
        name="Product"
        component={ProductScreen}
        options={{
          tabBarIcon: () => <Image source={ProductIcon} style={{ width: 25, height: 25 }} />,
        }}
      />

      <Tab.Screen
        name="Bidding"
        component={BiddingScreen}
        options={{
          tabBarIcon: () => <Image source={BiddingIcon} style={{ width: 25, height: 25 }} />,
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationScreen}
        options={{
          tabBarIcon: () => (
            <Image source={NotificationIcon} style={{ width: 25, height: 25 }} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />

      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{
          tabBarIcon: () => <Image source={MeIcon} style={{ width: 25, height: 25 }} />,
        }}
      />
    </Tab.Navigator>
  );
}