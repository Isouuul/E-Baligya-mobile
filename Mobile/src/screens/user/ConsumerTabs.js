// src/screens/Users/ConsumerTabs.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Image } from 'react-native';

// Screens
import HomeScreen from './Home';
import ProductScreen from './Product'; 
import BiddingScreen from './BiddingProductScreen';
import NotificationScreen from './Notification';
import MeScreen from './Me';

const Tab = createBottomTabNavigator();

// Import your PNG icons
import HomeIcon from '../../../assets/Home.png';
import ProductIcon from '../../../assets/Product.png';
import BiddingIcon from '../../../assets/Bidding.png';
import NotificationIcon from '../../../assets/notification.png';
import MeIcon from '../../../assets/Me.png';

// Mapping screens to icons for cleaner code
const tabIcons = {
  Home: HomeIcon,
  Product: ProductIcon,
  Bidding: BiddingIcon,
  Notifications: NotificationIcon,
  Me: MeIcon,
};

export default function ConsumerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#ddd', height: 60 },
      }}
    >
      {Object.entries(tabIcons).map(([name, icon]) => (
        <Tab.Screen
          key={name}
          name={name}
          component={
            name === 'Home'
              ? HomeScreen
              : name === 'Product'
              ? ProductScreen
              : name === 'Bidding'
              ? BiddingScreen
              : name === 'Notifications'
              ? NotificationScreen
              : MeScreen
          }
          options={{
            tabBarIcon: () => <Image source={icon} style={{ width: 25, height: 25 }} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
