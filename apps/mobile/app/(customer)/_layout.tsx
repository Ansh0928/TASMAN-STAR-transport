import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { LoadingScreen } from '../../src/components/LoadingScreen';

export default function CustomerLayout() {
  const { role, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (role !== 'customer') return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerStyle: { backgroundColor: '#1e3a5f' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'My Bookings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="new-booking"
        options={{
          title: 'New Booking',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
      {/* Hide booking detail from tab bar -- it is navigated to via push */}
      <Tabs.Screen
        name="booking/[id]"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      {/* Hide live tracking screen from tab bar -- navigated to from booking detail */}
      <Tabs.Screen
        name="tracking/[id]"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
