import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';
import { LoadingScreen } from '../../src/components/LoadingScreen';

export default function DriverLayout() {
  const { role, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (role !== 'driver') return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb',
        headerStyle: { backgroundColor: '#1e3a5f' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🚛</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
      {/* Hidden screens — accessible via navigation but not shown in tab bar */}
      <Tabs.Screen
        name="job/[id]"
        options={{
          title: 'Job Details',
          href: null, // hides from tab bar
        }}
      />
      <Tabs.Screen
        name="signature"
        options={{
          title: 'Signature',
          href: null, // hides from tab bar
          headerShown: false, // signature screen manages its own header
        }}
      />
    </Tabs>
  );
}
