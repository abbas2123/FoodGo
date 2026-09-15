import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppStackParamList } from "@/navigation/types";
import HomePage from "@/features/home/screens/HomeScreen";
import RestaurantDetailScreen from "@/features/restaurants/screens/RestaurantDetailScreen";
import CheckoutScreen from "@/features/checkout/screens/CheckoutScreen";
import Layout from "@/layout/Layout";
import ComingSoon from "@/components/commingSoon";
import ProfilePage from "@/features/profile/screens/ProfileScreen";
import SearchPage from "@/features/search/screen/SearchScreen";
import OrdersPage from "@/features/orders/screens/OrdersScreen";
import TrackingOrderPage from "@/features/orders/screens/OrderTrackingScreen";
import OrderDetailsScreen from "@/features/orders/screens/OrderDetailsScreen";
import FavoritesScreen from "@/features/favorites/screens/FavoritesScreen";

const Stack = createNativeStackNavigator<AppStackParamList>();

export const AppNavigator = () => {
  return (
    <Layout>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomePage} />
        <Stack.Screen
          name="RestaurantDetails"
          component={RestaurantDetailScreen}
        />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Orders" component={OrdersPage} />
        <Stack.Screen name="Search" component={SearchPage} />
        <Stack.Screen name="Fav" component={FavoritesScreen} />
        <Stack.Screen name="Profile" component={ProfilePage} />
        <Stack.Screen name="EditProfile" component={ComingSoon} />
        <Stack.Screen name="TrackOrderDetails" component={TrackingOrderPage} />
        <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
      </Stack.Navigator>
    </Layout>
  );
};

export default AppNavigator;
