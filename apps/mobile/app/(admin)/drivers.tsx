import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import type { Profile } from '@tasman-transport/shared';

export default function AdminDriversScreen() {
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const fetchDrivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers((data as Profile[]) ?? []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDrivers();
  }, [fetchDrivers]);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
  };

  const handleCreateDriver = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      Alert.alert('Validation Error', 'Name, email, and password are required.');
      return;
    }

    if (formPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        Alert.alert('Error', 'You must be logged in to create a driver.');
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-driver`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: formEmail.trim(),
            password: formPassword,
            full_name: formName.trim(),
            phone: formPhone.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create driver');
      }

      Alert.alert('Success', 'Driver account created successfully.');
      resetForm();
      setShowCreateModal(false);
      fetchDrivers();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create driver'
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 mt-3">Loading drivers...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header with Add Button */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <Text className="text-lg font-bold text-gray-900">
          {drivers.length} Driver{drivers.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          className="bg-blue-600 px-4 py-2.5 rounded-xl"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">+ Add Driver</Text>
        </TouchableOpacity>
      </View>

      {/* Driver List */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          {drivers.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-gray-400 text-lg">No drivers found</Text>
              <Text className="text-gray-400 text-sm mt-1">
                Tap "+ Add Driver" to create one
              </Text>
            </View>
          ) : (
            drivers.map((driver) => (
              <View
                key={driver.id}
                className="bg-white rounded-xl border border-gray-100 p-4 mb-3"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-gray-900">
                    {driver.full_name}
                  </Text>
                  <View
                    className={`px-2.5 py-1 rounded-full ${
                      driver.is_active ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        driver.is_active ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {driver.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600 mb-1">
                  {driver.email}
                </Text>
                {driver.phone && (
                  <Text className="text-sm text-gray-500">{driver.phone}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Driver Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!creating) {
            setShowCreateModal(false);
            resetForm();
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-white"
        >
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-lg font-bold text-gray-900">
              Create New Driver
            </Text>
            <Pressable
              onPress={() => {
                if (!creating) {
                  setShowCreateModal(false);
                  resetForm();
                }
              }}
            >
              <Text className="text-blue-600 text-base font-medium">
                Cancel
              </Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 p-4">
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Full Name *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              placeholder="John Smith"
              value={formName}
              onChangeText={setFormName}
              autoCapitalize="words"
              editable={!creating}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Email *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              placeholder="driver@example.com"
              value={formEmail}
              onChangeText={setFormEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!creating}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-4"
              placeholder="0412 345 678"
              value={formPhone}
              onChangeText={setFormPhone}
              keyboardType="phone-pad"
              editable={!creating}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Password *
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 mb-6"
              placeholder="Minimum 6 characters"
              value={formPassword}
              onChangeText={setFormPassword}
              secureTextEntry
              editable={!creating}
            />

            <TouchableOpacity
              onPress={handleCreateDriver}
              disabled={creating}
              className={`rounded-xl py-4 items-center ${
                creating ? 'bg-blue-300' : 'bg-blue-600'
              }`}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  Create Driver Account
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
