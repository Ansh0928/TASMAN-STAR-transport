import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../src/providers/AuthProvider';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      Alert.alert('Error', message);
    }
  }

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <View className="bg-white rounded-xl p-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900">{profile?.full_name}</Text>
        <Text className="text-gray-500 mt-1">{profile?.email}</Text>
        {profile?.phone && (
          <Text className="text-gray-500 mt-1">{profile.phone}</Text>
        )}
      </View>

      <TouchableOpacity
        className="bg-red-50 rounded-xl p-4 mt-4 border border-red-100"
        onPress={handleSignOut}
      >
        <Text className="text-red-600 text-center font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
