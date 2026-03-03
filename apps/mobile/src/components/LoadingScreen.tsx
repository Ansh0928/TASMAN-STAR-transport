import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="mt-4 text-gray-500">Loading...</Text>
    </View>
  );
}
