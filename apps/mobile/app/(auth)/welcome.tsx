import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white justify-center px-6">
      <View className="mb-12">
        <Text className="text-3xl font-bold text-primary-800 text-center">
          Tasman Transport
        </Text>
        <Text className="text-base text-gray-500 text-center mt-2">
          Gold Coast ↔ Sydney Freight
        </Text>
      </View>

      <Text className="text-lg font-semibold text-gray-700 text-center mb-6">
        How would you like to continue?
      </Text>

      {/* Customer Card */}
      <Pressable
        className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-4 active:bg-blue-100"
        onPress={() => router.push('/(auth)/login?role=customer')}
        role="button"
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-blue-600 items-center justify-center mr-4">
            <Text className="text-white text-2xl">📦</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">
              I need to ship goods
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              Book and track freight deliveries
            </Text>
          </View>
          <Text className="text-gray-400 text-xl">›</Text>
        </View>
      </Pressable>

      {/* Driver Card */}
      <Pressable
        className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 mb-4 active:bg-emerald-100"
        onPress={() => router.push('/(auth)/login?role=driver')}
        role="button"
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-emerald-600 items-center justify-center mr-4">
            <Text className="text-white text-2xl">🚛</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">
              I'm a delivery driver
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              View and manage assigned jobs
            </Text>
          </View>
          <Text className="text-gray-400 text-xl">›</Text>
        </View>
      </Pressable>
    </View>
  );
}
