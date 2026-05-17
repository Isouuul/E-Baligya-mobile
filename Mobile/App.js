import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Text, TextInput } from 'react-native';
import { Platform } from 'react-native';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';


import LoginScreen from './src/screens/user/LoginScreen';
import SignupScreen from './src/screens/user/User-SignupScreen';
import SignupStep2 from './src/screens/user/User-SignupStep2';
import UserSignupStep3 from './src/screens/user/UserSignupStep3';
import SignupReview from './src/screens/user/User-SignupReview';

import HomeScreen from './src/screens/user/Home';
import ProductScreen from './src/screens/user/Product'
import BiddingProductScreen from './src/screens/user/BiddingProductScreen';
import NotificationScreen from './src/screens/user/Notification';
import MeScreen from './src/screens/user/Me';
import ConsumerTabs from './src/screens/user/ConsumerTabs';
import ViewProduct from './src/screens/user/ViewProduct';
import CartShop from './src/screens/user/CartShop';
import CheckedOut from './src/screens/user/CheckedOut';
import AddressSelection from './src/screens/user/AddressSelection';
import AddAddress from './src/screens/user/AddAddress';
import EditAddress from './src/screens/user/EditAddress';
import ViewBiddingProduct from './src/screens/user/ViewBiddingProduct';
import MyBids from './src/screens/user/MyBids';
import ViewShop from './src/screens/user/ViewShop';
import HelpCenter from './src/screens/user/HelpCenter';
import ViewOrderDetails from './src/screens/user/ViewOrderDetails';
import EditProfileUser from './src/screens/user/EditProfileUser';
import BuyNow from './src/screens/user/BuyNow';
import BuyNowCheckedOut from './src/screens/user/BuyNowCheckedOut';
import ChatScreen from './src/screens/user/ChatScreen';
//Processing the buy product
import OrdersDetails from './src/screens/user/OrdersDetails';
import AddingCartModal from './src/screens/user/AddingCartModal';
import CheckedOutBidding from './src/screens/user/CheckedOutBidding';
import ReportModal from './src/screens/user/ReportModal';
import ReportShop from './src/screens/user/ReportShop';
import InboxScreenUser from './src/screens/user/InboxScreenUser';
import ChatScreenVendor from './src/screens/vendor/components/ChatScreenVendor';
//Vendor
import VendorSignupStep1 from './src/screens/vendor/VendorSignupStep1';
import VendorSignupStep2 from './src/screens/vendor/VendorSignupStep2';
import VendorSignupStep3 from './src/screens/vendor/VendorSignupStep3';
import VendorSignupReview from './src/screens/vendor/VendorSignupReview';
import VendorLoginScreen from './src/screens/vendor/VendorLoginScreen';
import VendorTabNavigator from './src/screens/vendor/navigation/VendorTabNavigator';
import EditVendorProfile from './src/screens/vendor/EditVendorProfile';
import CreateProductForm from './src/screens/vendor/components/CreateProductForm';
import CreateProductBiddingForm from './src/screens/vendor/components/CreateProductBiddingForm';
import ViewClickBid from './src/screens/vendor/components/ViewClickBid';
import HelpCenterScreen from './src/screens/vendor/components/HelpCenterScreen';
import OrdersScreen from './src/screens/vendor/components/OrdersScreen';
import UploadsScreen from './src/screens/vendor/components/UploadsScreen';
import TermsPolicyScreen from './src/screens/vendor/components/TermsPolicyScreen';
import SettingsScreen from './src/screens/vendor/components/SettingsScreen';
import BiddingUploadsScreen from './src/screens/vendor/components/BiddingUploadsScreen';
import EditProductFormModal from './src/screens/vendor/components/EditProductForm';
import SubscriptionsScreen from './src/screens/vendor/components/SubscriptionsScreen';
import VendorInbox from './src/screens/vendor/components/VendorInbox';
import ViewOrderDetailsVendor from './src/screens/vendor/components/ViewOrderDetailsVendor';
import VendorSignupBusPermit from './src/screens/vendor/VendorSignupBusPermit';
import AllReviews from './src/screens/user/AllReview';
import BuyNowModal from './src/screens/user/BuyNow';
import BuyNowModalCheckedout from './src/screens/user/BuyNowModalCheckedout';
import ReportUserModal from './src/screens/vendor/components/ReportUserModal';
import VendorNotificationModal from './src/screens/vendor/components/VendorNotificationModal';
import ReportChat from './src/screens/user/ReportChat';
const Stack = createNativeStackNavigator();
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = {
  color: baseTextColor,
};
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = {
  color: baseTextColor,
};

const baseTextColor = Platform.OS === 'android' ? '#1E293B' : '#1E293B';


export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <GestureHandlerRootView style={{ flex: 1 }}>

        <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>


        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="SignupStep2" component={SignupStep2} options={{ title: 'Step 2 - Personal Info' }} />
        <Stack.Screen name="UserSignupStep3" component={UserSignupStep3} options={{ title: 'Step 3 - Selfie Verification' }} />
        <Stack.Screen name="SignupReview" component={SignupReview} options={{ title: 'Step 4 - Review & Submit' }} />
        <Stack.Screen name="VendorSignupStep1" component={VendorSignupStep1} />
        <Stack.Screen name="VendorSignupBusPermit" component={VendorSignupBusPermit} />
        <Stack.Screen name="VendorSignupStep2" component={VendorSignupStep2} />
        <Stack.Screen name="VendorSignupStep3" component={VendorSignupStep3} />
        <Stack.Screen name="VendorSignupReview" component={VendorSignupReview} />
        <Stack.Screen name='VendorLoginScreen' component={VendorLoginScreen} />
        <Stack.Screen name="VendorDashboard" component={VendorTabNavigator} />

        {/* Vendor Create Product & Edit */}
        <Stack.Screen name="EditVendorProfile" component={EditVendorProfile} />
        <Stack.Screen name="CreateProduct" component={CreateProductForm} />
        <Stack.Screen name="CreateProductBidding" component={CreateProductBiddingForm} />
        <Stack.Screen name='ViewClickBid' component={ViewClickBid} /> 
        <Stack.Screen name='HelpCenterScreen' component={HelpCenterScreen} />
        <Stack.Screen name='OrdersScreen' component={OrdersScreen} />
        <Stack.Screen name='UploadsScreen' component={UploadsScreen} />
        <Stack.Screen name='CartShop' component={CartShop} />
        <Stack.Screen name="TermsPolicyScreen" component={TermsPolicyScreen} />
        <Stack.Screen name='SettingsScreen' component={SettingsScreen} />
        <Stack.Screen name='ViewShop' component={ViewShop} />
        <Stack.Screen name= "BuyNowModal" component={BuyNowModal} />
        <Stack.Screen name='BuyNowCheckedOut' component={BuyNowCheckedOut} />
        <Stack.Screen name='BuyNowModalCheckedout' component={BuyNowModalCheckedout} />
        <Stack.Screen name='BiddingUploadsScreen' component={BiddingUploadsScreen} />
        <Stack.Screen name='EditProductFormModal' component={EditProductFormModal} />
        <Stack.Screen name='SubscriptionsScreen' component={SubscriptionsScreen} />
        <Stack.Screen name='VendorInbox' component={VendorInbox}/>
        <Stack.Screen name='ViewOrderDetailsVendor' component={ViewOrderDetailsVendor} />
        <Stack.Screen name='ReportShop' component={ReportShop} />
        <Stack.Screen name='InboxScreenUser' component={InboxScreenUser} />
        <Stack.Screen name="ChatScreenVendor" component={ChatScreenVendor} options={{ headerTitle: 'Chat' }} />
        <Stack.Screen name='ReportUserModal' component={ReportUserModal} />
        <Stack.Screen name='VendorNotificationModal' component={VendorNotificationModal} />
        {/* User Tabs */}
        <Stack.Screen name='ConsumerTabs' component={ConsumerTabs} />
        <Stack.Screen name="ProductScreen" component={ProductScreen} />
        <Stack.Screen name="BiddingProductScreen" component={BiddingProductScreen} />
        <Stack.Screen name='NotificationScreen' component={NotificationScreen} />
        <Stack.Screen name='MeScreen' component={MeScreen} />
        <Stack.Screen name='HomeScreen' component={HomeScreen} />
        <Stack.Screen name='MyBids' component={MyBids}/>
        <Stack.Screen name='HelpCenter' component={HelpCenter} />
        <Stack.Screen name='ViewOrderDetails' component={ViewOrderDetails} />
        <Stack.Screen name='EditProfileUser' component={EditProfileUser} />
        <Stack.Screen name='BuyNow' component={BuyNow} />
        <Stack.Screen name='AddingCartModal' component={AddingCartModal} />
        <Stack.Screen name='CheckedOutBidding' component={CheckedOutBidding} />
        <Stack.Screen name='ReportModal'  component={ReportModal}/>
        <Stack.Screen name="ChatScreen" component={ChatScreen} options={{ headerTitle: 'Chat' }} />    
        <Stack.Screen name='AllReviews' component={AllReviews} />
        <Stack.Screen name='ReportChat' component={ReportChat} />
      

        {/* For Product */}
        <Stack.Screen name='ViewProduct' component={ViewProduct} />
        <Stack.Screen name='CheckedOut' component={CheckedOut} />
        <Stack.Screen name='AddressSelection' component={AddressSelection} />
        <Stack.Screen name='AddAddress' component={AddAddress} />
        <Stack.Screen name='EditAddress' component={EditAddress} />

        {/* For Bidding */}
        <Stack.Screen name='ViewBiddingProduct' component={ViewBiddingProduct} />
        {/* For OrderDetails */}
        <Stack.Screen name='OrdersDetails' component={OrdersDetails} />
        </Stack.Navigator>
        <Toast />
      </GestureHandlerRootView>

    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
