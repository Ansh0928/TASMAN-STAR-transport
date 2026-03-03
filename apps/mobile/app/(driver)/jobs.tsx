import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import { type Booking, formatAEST } from '@tasman-transport/shared';

type Tab = 'active' | 'completed';

const ACTIVE_STATUSES = ['confirmed', 'en_route', 'at_pickup', 'in_transit'];

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800' },
  en_route: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  at_pickup: { bg: 'bg-orange-100', text: 'text-orange-800' },
  in_transit: { bg: 'bg-purple-100', text: 'text-purple-800' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800' },
};

export default function DriverJobsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [completedBookings, setCompletedBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveJobs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', user.id)
      .in('status', ACTIVE_STATUSES)
      .order('pickup_datetime', { ascending: true });
    if (data) setActiveBookings(data as Booking[]);
  }, [user]);

  const fetchCompletedJobs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('driver_id', user.id)
      .eq('status', 'delivered')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (data) setCompletedBookings(data as Booking[]);
  }, [user]);

  const fetchJobs = useCallback(async () => {
    await Promise.all([fetchActiveJobs(), fetchCompletedJobs()]);
  }, [fetchActiveJobs, fetchCompletedJobs]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  const handleJobPress = (bookingId: string) => {
    router.push(`/(driver)/job/${bookingId}`);
  };

  const bookings = activeTab === 'active' ? activeBookings : completedBookings;

  const renderItem = ({ item }: { item: Booking }) => {
    const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS.confirmed;

    return (
      <TouchableOpacity
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 active:bg-gray-50"
        onPress={() => handleJobPress(item.id)}
      >
        <View className="flex-row justify-between items-start">
          <Text className="text-base font-semibold text-gray-900">
            {item.booking_number}
          </Text>
          <View className={`${statusColor.bg} px-2.5 py-1 rounded-full`}>
            <Text className={`text-xs font-medium ${statusColor.text} capitalize`}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
        <Text className="text-sm text-gray-500 mt-1">
          Pickup: {item.pickup_address}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Dropoff: {item.dropoff_address}
        </Text>
        <Text className="text-sm text-gray-400 mt-2">
          {formatAEST(item.pickup_datetime, 'dd MMM yyyy HH:mm')}
        </Text>

        {/* Tap indicator */}
        <View className="flex-row justify-end mt-2">
          <Text className="text-xs text-blue-500 font-medium">
            View Details {'>'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Tab Bar */}
      <View className="flex-row bg-white border-b border-gray-200 px-4">
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'active' ? 'border-blue-600' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('active')}
        >
          <Text
            className={`text-sm font-semibold ${
              activeTab === 'active' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            Active ({activeBookings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'completed' ? 'border-blue-600' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('completed')}
        >
          <Text
            className={`text-sm font-semibold ${
              activeTab === 'completed' ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            Completed ({completedBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Job List */}
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerClassName="p-4"
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-400 text-lg">
              {activeTab === 'active' ? 'No active jobs' : 'No completed jobs'}
            </Text>
            <Text className="text-gray-300 text-sm mt-1">
              {activeTab === 'active'
                ? 'Pull down to refresh'
                : 'Completed deliveries will appear here'}
            </Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  );
}
