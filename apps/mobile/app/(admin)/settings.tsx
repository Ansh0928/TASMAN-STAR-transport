import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import type { Pricing, Route } from '@tasman-transport/shared';

interface PricingWithRoute extends Pricing {
  routeOrigin: string;
  routeDestination: string;
}

export default function AdminSettingsScreen() {
  const [pricingData, setPricingData] = useState<PricingWithRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<PricingWithRoute | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPricing = useCallback(async () => {
    try {
      const [pricingRes, routesRes] = await Promise.all([
        supabase
          .from('pricing')
          .select('*')
          .eq('is_active', true)
          .order('route_id'),
        supabase.from('routes').select('*').eq('is_active', true),
      ]);

      if (pricingRes.error) throw pricingRes.error;
      if (routesRes.error) throw routesRes.error;

      const routesMap = new Map(
        (routesRes.data ?? []).map((r) => [r.id, r])
      );

      const enriched: PricingWithRoute[] = (pricingRes.data ?? []).map((p) => {
        const route = routesMap.get(p.route_id);
        return {
          ...(p as Pricing),
          routeOrigin: route?.origin ?? 'Unknown',
          routeDestination: route?.destination ?? 'Unknown',
        };
      });

      setPricingData(enriched);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPricing();
  }, [fetchPricing]);

  const handleEditPress = (item: PricingWithRoute) => {
    setEditingItem(item);
    setEditPrice((item.price_cents / 100).toFixed(2));
  };

  const handleSavePrice = async () => {
    if (!editingItem) return;

    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const newPriceCents = Math.round(priceNum * 100);
      const { error } = await supabase
        .from('pricing')
        .update({ price_cents: newPriceCents })
        .eq('id', editingItem.id);

      if (error) throw error;

      Alert.alert('Success', 'Price updated successfully.');
      setEditingItem(null);
      setEditPrice('');
      fetchPricing();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update price'
      );
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 mt-3">Loading pricing...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          <Text className="text-2xl font-bold text-gray-900 mb-1">
            Pricing Settings
          </Text>
          <Text className="text-sm text-gray-500 mb-4">
            Manage transport pricing for each route and item type
          </Text>

          {pricingData.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-gray-400 text-lg">
                No pricing configured
              </Text>
            </View>
          ) : (
            pricingData.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleEditPress(item)}
                className="bg-white rounded-xl border border-gray-100 p-4 mb-3"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-semibold text-gray-500 flex-1">
                    {item.routeOrigin} → {item.routeDestination}
                  </Text>
                  <Text className="text-lg font-bold text-blue-700">
                    {formatPrice(item.price_cents)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className="bg-gray-100 px-2.5 py-1 rounded-full">
                    <Text className="text-xs font-medium text-gray-600">
                      {item.item_type}
                    </Text>
                  </View>
                  <Text className="text-xs text-blue-500">Tap to edit</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Edit Price Modal */}
      <Modal
        visible={editingItem !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!saving) {
            setEditingItem(null);
            setEditPrice('');
          }
        }}
      >
        {editingItem && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
          >
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-lg font-bold text-gray-900">
                Edit Price
              </Text>
              <Pressable
                onPress={() => {
                  if (!saving) {
                    setEditingItem(null);
                    setEditPrice('');
                  }
                }}
              >
                <Text className="text-blue-600 text-base font-medium">
                  Cancel
                </Text>
              </Pressable>
            </View>

            <View className="p-4">
              <View className="bg-gray-50 rounded-xl p-4 mb-6">
                <Text className="text-sm font-semibold text-gray-500 mb-1">
                  Route
                </Text>
                <Text className="text-base text-gray-900 mb-3">
                  {editingItem.routeOrigin} → {editingItem.routeDestination}
                </Text>
                <Text className="text-sm font-semibold text-gray-500 mb-1">
                  Item Type
                </Text>
                <Text className="text-base text-gray-900">
                  {editingItem.item_type}
                </Text>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1.5">
                Price (AUD)
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-xl font-bold text-gray-900 mb-6"
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                editable={!saving}
              />

              <TouchableOpacity
                onPress={handleSavePrice}
                disabled={saving}
                className={`rounded-xl py-4 items-center ${
                  saving ? 'bg-blue-300' : 'bg-blue-600'
                }`}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    Save Price
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}
