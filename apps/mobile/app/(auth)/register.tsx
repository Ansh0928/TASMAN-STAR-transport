import React, { useState } from 'react';
import { View, Text, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { registerSchema } from '@tasman-transport/shared';

const roleConfig = {
  customer: {
    title: 'Create Customer Account',
    subtitle: 'Start booking freight deliveries',
    icon: '📦',
    accentBg: 'bg-blue-600',
    accentText: 'text-blue-600',
  },
  driver: {
    title: 'Create Driver Account',
    subtitle: 'Join our delivery team',
    icon: '🚛',
    accentBg: 'bg-emerald-600',
    accentText: 'text-emerald-600',
  },
} as const;

type RoleKey = keyof typeof roleConfig;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const role: RoleKey = params.role === 'driver' ? 'driver' : 'customer';
  const config = roleConfig[role];

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const result = registerSchema.safeParse({ email, password, full_name: fullName, phone: phone || undefined });
    if (!result.success) {
      Alert.alert('Validation Error', result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName, phone || undefined, role);
      Alert.alert('Success', 'Account created! You can now sign in.', [
        { text: 'OK', onPress: () => router.replace(`/(auth)/login?role=${role}`) },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      Alert.alert('Registration Error', message);
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
        {/* Back */}
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
            <Text className="text-sm font-medium text-gray-700 mb-1">Full Name</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="John Smith"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
            />
          </View>

          <View className="mt-4">
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
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Phone {role === 'driver' ? '(required)' : '(optional)'}
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="04XX XXX XXX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
          </View>

          {role === 'driver' && (
            <View className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Text className="text-amber-800 text-xs text-center">
                Driver accounts require admin approval before you can start accepting jobs.
              </Text>
            </View>
          )}

          <View className="mt-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={handleRegister}
              returnKeyType="go"
            />
          </View>

          <Pressable
            className={`${config.accentBg} rounded-lg py-3.5 mt-6 ${loading ? 'opacity-50' : ''}`}
            onPress={handleRegister}
            disabled={loading}
            role="button"
          >
            <Text className="text-white text-center text-base font-semibold">
              {loading ? 'Creating account...' : 'Create Account'}
            </Text>
          </Pressable>
        </View>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-gray-500">Already have an account? </Text>
          <Link href={`/(auth)/login?role=${role}`} asChild>
            <Pressable role="link">
              <Text className={`${config.accentText} font-semibold`}>Sign In</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
