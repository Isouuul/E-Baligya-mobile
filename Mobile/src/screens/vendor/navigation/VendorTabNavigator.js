// src/screens/Vendor/VendorTabs.js
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image, View, ActivityIndicator, Text,StatusBar } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../firebase'; // adjust path

// Screens
import VendorDashboardScreen from '../components/VendorDashboardScreen';
import OrdersScreen from '../components/OrdersScreen';
import UploadsScreen from '../components/UploadsScreen';
import BiddingUploadsScreen from '../components/BiddingUploadsScreen';
import VendorInbox from '../components/VendorInbox';
import SettingsScreen from '../components/SettingsScreen';

// Icons
import HomeIcon from '../../../../assets/Home.png';
import PendingIcon from '../../../../assets/Pending.png';
import ProductIcon from '../../../../assets/Product.png';
import BiddingIcon from '../../../../assets/Bidding.png';
import MessageIcon from '../../../../assets/message.png';
import MeIcon from '../../../../assets/Me.png';


const tabIcons = {
  Home: HomeIcon,
  Orders: PendingIcon,
  Uploads: ProductIcon,
  Bidding: BiddingIcon,
  Inbox: MessageIcon,
  Settings: MeIcon,
};

const Tab = createBottomTabNavigator();

export default function VendorTabNavigator({ navigation }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
        navigation.replace('Login'); // redirect to Login if not authenticated
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

    // Add this line to hide the status bar
  useEffect(() => {
    StatusBar.setHidden(true, 'fade'); // 'fade' or 'slide'
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="orange" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>You must be logged in to access this page.</Text>
      </View>
    );
  }

  return (
    
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#ddd', height: 60 },
        tabBarActiveTintColor: 'orange',
        tabBarInactiveTintColor: 'gray',
      }}
    >
      {Object.entries(tabIcons).map(([name, icon]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={
              name === 'Home'
              ? VendorDashboardScreen
              
              : name === 'Orders'
              ? OrdersScreen
              
              : name === 'Uploads'
              ? UploadsScreen
              
              : name === 'Bidding'
              ? BiddingUploadsScreen
              
              : name === 'Inbox'
              ? VendorInbox
              
              : SettingsScreen
          }
          options={{
            tabBarIcon: ({ focused }) => (
              <Image
                source={icon}
                style={{
                  width: 25,
                  height: 25,
                }}
                resizeMode="contain"
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
