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
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import type { Booking, Profile, Route } from '@tasman-transport/shared';

type StatusFilter = 'all' | 'pending' | 'active' | 'delivered' | 'cancelled';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800' },
  en_route: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  at_pickup: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  in_transit: { bg: 'bg-orange-100', text: 'text-orange-800' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
};

const ACTIVE_STATUSES = ['confirmed', 'en_route', 'at_pickup', 'in_transit'];

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
  };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <View className={`px-2.5 py-1 rounded-full ${colors.bg}`}>
      <Text className={`text-xs font-semibold ${colors.text}`}>{label}</Text>
    </View>
  );
}

interface BookingWithRelations extends Booking {
  customer?: Pick<Profile, 'full_name' | 'email'>;
  route?: Pick<Route, 'origin' | 'destination'>;
  driver?: Pick<Profile, 'full_name'> | null;
}

export default function AdminBookingsScreen() {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');
  const [selectedBooking, setSelectedBooking] =
    useState<BookingWithRelations | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      // Fetch bookings, customers, routes, and drivers separately then join
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bookingsError) throw bookingsError;
      if (!bookingsData) {
        setBookings([]);
        return;
      }

      // Fetch related profiles and routes
      const customerIds = [...new Set(bookingsData.map((b) => b.customer_id))];
      const driverIds = [
        ...new Set(
          bookingsData.map((b) => b.driver_id).filter(Boolean) as string[]
        ),
      ];
      const routeIds = [...new Set(bookingsData.map((b) => b.route_id))];

      const [customersRes, driversRes, routesRes] = await Promise.all([
        customerIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', customerIds)
          : { data: [] },
        driverIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', driverIds)
          : { data: [] },
        routeIds.length > 0
          ? supabase
              .from('routes')
              .select('id, origin, destination')
              .in('id', routeIds)
          : { data: [] },
      ]);

      const customersMap = new Map(
        (customersRes.data ?? []).map((c) => [c.id, c])
      );
      const driversMap = new Map(
        (driversRes.data ?? []).map((d) => [d.id, d])
      );
      const routesMap = new Map(
        (routesRes.data ?? []).map((r) => [r.id, r])
      );

      const enriched: BookingWithRelations[] = bookingsData.map((b) => ({
        ...b,
        customer: customersMap.get(b.customer_id) as
          | Pick<Profile, 'full_name' | 'email'>
          | undefined,
        route: routesMap.get(b.route_id) as
          | Pick<Route, 'origin' | 'destination'>
          | undefined,
        driver: b.driver_id
          ? (driversMap.get(b.driver_id) as Pick<Profile, 'full_name'> | null)
          : null,
      }));

      setBookings(enriched);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return ACTIVE_STATUSES.includes(b.status);
    return b.status === activeTab;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 mt-3">Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Status Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-14 border-b border-gray-200 bg-white"
        contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 mr-2 rounded-full ${
                isActive ? 'bg-blue-600' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  isActive ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Bookings List */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          {filteredBookings.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text className="text-gray-400 text-lg">No bookings found</Text>
            </View>
          ) : (
            filteredBookings.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                onPress={() => setSelectedBooking(booking)}
                className="bg-white rounded-xl border border-gray-100 p-4 mb-3"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-bold text-gray-900">
                    #{booking.booking_number}
                  </Text>
                  <StatusBadge status={booking.status} />
                </View>
                <Text className="text-sm text-gray-700 mb-1">
                  {booking.customer?.full_name ?? 'Unknown Customer'}
                </Text>
                {booking.route && (
                  <Text className="text-sm text-gray-500 mb-1">
                    {booking.route.origin} → {booking.route.destination}
                  </Text>
                )}
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-xs text-gray-400">
                    {formatDate(booking.pickup_datetime)}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-700">
                    {formatPrice(booking.price_cents)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Booking Detail Modal */}
      <Modal
        visible={selectedBooking !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedBooking(null)}
      >
        {selectedBooking && (
          <View className="flex-1 bg-white">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
              <Text className="text-lg font-bold text-gray-900">
                Booking #{selectedBooking.booking_number}
              </Text>
              <Pressable onPress={() => setSelectedBooking(null)}>
                <Text className="text-blue-600 text-base font-medium">
                  Close
                </Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1 p-4">
              <View className="mb-4">
                <StatusBadge status={selectedBooking.status} />
              </View>

              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Customer
              </Text>
              <Text className="text-base text-gray-900 mb-1">
                {selectedBooking.customer?.full_name ?? 'Unknown'}
              </Text>
              <Text className="text-sm text-gray-500 mb-4">
                {selectedBooking.customer?.email ?? ''}
              </Text>

              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Route
              </Text>
              <Text className="text-base text-gray-900 mb-4">
                {selectedBooking.route
                  ? `${selectedBooking.route.origin} → ${selectedBooking.route.destination}`
                  : 'N/A'}
              </Text>

              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Pickup
              </Text>
              <Text className="text-base text-gray-900 mb-1">
                {selectedBooking.pickup_address}
              </Text>
              <Text className="text-sm text-gray-500 mb-4">
                {formatDate(selectedBooking.pickup_datetime)}
              </Text>

              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dropoff
              </Text>
              <Text className="text-base text-gray-900 mb-1">
                {selectedBooking.dropoff_address}
              </Text>
              <Text className="text-sm text-gray-500 mb-4">
                {formatDate(selectedBooking.dropoff_datetime)}
              </Text>

              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Item Details
              </Text>
              <Text className="text-base text-gray-900 mb-1">
                {selectedBooking.item_type} &mdash;{' '}
                {selectedBooking.weight_kg}kg
              </Text>
              <Text className="text-sm text-gray-500 mb-4">
                {selectedBooking.length_cm}cm x {selectedBooking.width_cm}cm x{' '}
                {selectedBooking.height_cm}cm
              </Text>

              {selectedBooking.driver && (
                <>
                  <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Assigned Driver
                  </Text>
                  <Text className="text-base text-gray-900 mb-4">
                    {selectedBooking.driver.full_name}
                  </Text>
                </>
              )}

              {selectedBooking.special_instructions && (
                <>
                  <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Special Instructions
                  </Text>
                  <Text className="text-base text-gray-900 mb-4">
                    {selectedBooking.special_instructions}
                  </Text>
                </>
              )}

              <View className="bg-blue-50 rounded-xl p-4 mt-2">
                <Text className="text-sm text-blue-600 font-medium">
                  Total Price
                </Text>
                <Text className="text-2xl font-bold text-blue-700">
                  {formatPrice(selectedBooking.price_cents)}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}
