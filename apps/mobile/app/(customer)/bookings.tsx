import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { type Booking, formatAEST, formatCents } from '@tasman-transport/shared';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  en_route: 'bg-indigo-100 text-indigo-800',
  at_pickup: 'bg-purple-100 text-purple-800',
  in_transit: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function BookingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setBookings(data as Booking[]);
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerClassName="p-4"
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-400 text-lg">No bookings yet</Text>
            <TouchableOpacity
              className="mt-4 bg-primary-600 rounded-lg px-6 py-3"
              onPress={() => router.push('/(customer)/new-booking')}
            >
              <Text className="text-white font-semibold">Create Your First Booking</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
            onPress={() => router.push(`/(customer)/booking/${item.id}`)}
          >
            <View className="flex-row justify-between items-start">
              <Text className="text-base font-semibold text-gray-900">
                {item.booking_number}
              </Text>
              <View className={`px-2.5 py-1 rounded-full ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800'}`}>
                <Text className="text-xs font-medium capitalize">{item.status.replace('_', ' ')}</Text>
              </View>
            </View>
            <Text className="text-sm text-gray-500 mt-1">
              {item.pickup_address} → {item.dropoff_address}
            </Text>
            <View className="flex-row justify-between mt-2">
              <Text className="text-sm text-gray-400">
                {formatAEST(item.pickup_datetime, 'dd MMM yyyy HH:mm')}
              </Text>
              <Text className="text-sm font-medium text-gray-700">
                {formatCents(item.price_cents)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
