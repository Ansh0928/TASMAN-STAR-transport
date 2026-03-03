import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';

interface DashboardStats {
  totalBookings: number;
  activeDeliveries: number;
  totalDrivers: number;
  totalCustomers: number;
}

function StatCard({
  title,
  value,
  icon,
  bgColor,
  textColor,
}: {
  title: string;
  value: number;
  icon: string;
  bgColor: string;
  textColor: string;
}) {
  return (
    <View className={`flex-1 min-w-[45%] rounded-2xl p-5 ${bgColor}`}>
      <Text className="text-2xl mb-2">{icon}</Text>
      <Text className={`text-3xl font-bold ${textColor}`}>{value}</Text>
      <Text className="text-sm text-gray-600 mt-1">{title}</Text>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    activeDeliveries: 0,
    totalDrivers: 0,
    totalCustomers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [bookingsRes, driversRes, customersRes] = await Promise.all([
        supabase.from('bookings').select('id, status'),
        supabase.from('profiles').select('id').eq('role', 'driver'),
        supabase.from('profiles').select('id').eq('role', 'customer'),
      ]);

      const bookings = bookingsRes.data ?? [];
      const activeStatuses = [
        'pending',
        'confirmed',
        'en_route',
        'at_pickup',
        'in_transit',
      ];
      const activeDeliveries = bookings.filter((b) =>
        activeStatuses.includes(b.status)
      ).length;

      setStats({
        totalBookings: bookings.length,
        activeDeliveries,
        totalDrivers: driversRes.data?.length ?? 0,
        totalCustomers: customersRes.data?.length ?? 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 mt-3">Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">
          Admin Dashboard
        </Text>
        <Text className="text-sm text-gray-500 mb-6">
          Overview of your transport operations
        </Text>

        <View className="flex-row flex-wrap gap-3">
          <StatCard
            title="Total Bookings"
            value={stats.totalBookings}
            icon="📦"
            bgColor="bg-blue-50"
            textColor="text-blue-700"
          />
          <StatCard
            title="Active Deliveries"
            value={stats.activeDeliveries}
            icon="🚚"
            bgColor="bg-orange-50"
            textColor="text-orange-700"
          />
          <StatCard
            title="Drivers"
            value={stats.totalDrivers}
            icon="👷"
            bgColor="bg-green-50"
            textColor="text-green-700"
          />
          <StatCard
            title="Customers"
            value={stats.totalCustomers}
            icon="👥"
            bgColor="bg-purple-50"
            textColor="text-purple-700"
          />
        </View>
      </View>
    </ScrollView>
  );
}
