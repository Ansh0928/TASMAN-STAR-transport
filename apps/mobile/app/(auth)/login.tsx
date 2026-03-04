import React, { useState } from 'react';
import { View, Text, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { loginSchema } from '@tasman-transport/shared';

const roleConfig = {
  customer: {
    title: 'Customer Sign In',
    subtitle: 'Book and track your freight',
    icon: '📦',
    accentBg: 'bg-blue-600',
    accentText: 'text-blue-600',
    registerLabel: "Don't have an account?",
  },
  driver: {
    title: 'Driver Sign In',
    subtitle: 'Manage your delivery jobs',
    icon: '🚛',
    accentBg: 'bg-emerald-600',
    accentText: 'text-emerald-600',
    registerLabel: "Don't have a driver account?",
  },
} as const;

type RoleKey = keyof typeof roleConfig;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const role: RoleKey = params.role === 'driver' ? 'driver' : 'customer';
  const config = roleConfig[role];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      Alert.alert('Validation Error', result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      Alert.alert('Login Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        {/* Back to role selection */}
        <Pressable
          className="absolute top-14 left-0"
          onPress={() => router.back()}
          role="button"
        >
          <Text className="text-gray-500 text-base">← Back</Text>
        </Pressable>

        <View className="items-center mb-10">
          <View className={`w-20 h-20 rounded-full ${config.accentBg} items-center justify-center mb-4`}>
            <Text className="text-3xl">{config.icon}</Text>
          </View>
          <Text className="text-3xl font-bold text-primary-800 text-center">
            {config.title}
          </Text>
          <Text className="text-base text-gray-500 text-center mt-2">
            {config.subtitle}
          </Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View className="mt-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
          </View>

          <Pressable
            className={`${config.accentBg} rounded-lg py-3.5 mt-6 ${loading ? 'opacity-50' : ''}`}
            onPress={handleLogin}
            disabled={loading}
            role="button"
          >
            <Text className="text-white text-center text-base font-semibold">
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </Pressable>
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500">{config.registerLabel} </Text>
          <Link href={`/(auth)/register?role=${role}`} asChild>
            <Pressable role="link">
              <Text className={`${config.accentText} font-semibold`}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
