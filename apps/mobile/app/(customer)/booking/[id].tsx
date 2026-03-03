import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../../src/providers/AuthProvider';
import { supabase } from '../../../src/lib/supabase';
import {
  type Booking,
  type BookingPhoto,
  type Profile,
  formatAEST,
  formatCents,
  formatWeight,
  formatDimensions,
  canEditOrCancel,
} from '@tasman-transport/shared';

// ---------- Status badge config ----------
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Confirmed' },
  en_route: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'En Route' },
  at_pickup: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'At Pickup' },
  in_transit: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Transit' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
};

interface RouteInfo {
  origin: string;
  destination: string;
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [driver, setDriver] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<BookingPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ---------- Fetch booking data ----------
  const fetchBooking = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (bookingError) throw bookingError;
      if (!bookingData) throw new Error('Booking not found');

      const b = bookingData as Booking;
      setBooking(b);

      // Fetch route info
      const { data: routeData } = await supabase
        .from('routes')
        .select('origin, destination')
        .eq('id', b.route_id)
        .single();

      if (routeData) setRoute(routeData as RouteInfo);

      // Fetch driver info if assigned
      if (b.driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', b.driver_id)
          .single();

        if (driverData) setDriver(driverData as Profile);
      }

      // Fetch photos
      const { data: photosData } = await supabase
        .from('booking_photos')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: true });

      if (photosData) {
        const p = photosData as BookingPhoto[];
        setPhotos(p);

        // Get signed URLs for photos
        const urls: Record<string, string> = {};
        for (const photo of p) {
          const { data: urlData } = await supabase.storage
            .from('booking-photos')
            .createSignedUrl(photo.storage_path, 3600); // 1 hour

          if (urlData?.signedUrl) {
            urls[photo.id] = urlData.signedUrl;
          }
        }
        setPhotoUrls(urls);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load booking';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // ---------- Real-time subscription ----------
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`booking-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setBooking(payload.new as Booking);
          // Re-fetch driver if driver_id changed
          const newBooking = payload.new as Booking;
          if (newBooking.driver_id && newBooking.driver_id !== driver?.id) {
            supabase
              .from('profiles')
              .select('*')
              .eq('id', newBooking.driver_id)
              .single()
              .then(({ data }) => {
                if (data) setDriver(data as Profile);
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, driver?.id]);

  // ---------- Cancel booking ----------
  async function handleCancel() {
    if (!booking) return;

    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${booking.booking_number}? This cannot be undone.`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', booking.id);

              if (error) throw error;

              setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
              Alert.alert('Cancelled', 'Your booking has been cancelled.');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to cancel booking';
              Alert.alert('Error', message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }

  // ---------- Refresh ----------
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBooking();
    setRefreshing(false);
  };

  // ---------- Loading ----------
  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color="#1e3a5f" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <Stack.Screen options={{ title: 'Not Found' }} />
        <Text className="text-lg text-gray-500 mb-4">Booking not found</Text>
        <TouchableOpacity
          className="bg-blue-600 rounded-lg px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- Derived state ----------
  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const canCancel =
    booking.status !== 'cancelled' &&
    booking.status !== 'delivered' &&
    canEditOrCancel(booking.pickup_datetime);
  const isInTransit = booking.status === 'in_transit';
  const isCompleted = booking.status === 'delivered' || booking.status === 'cancelled';

  return (
    <>
      <Stack.Screen
        options={{
          title: booking.booking_number,
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView
        className="flex-1 bg-gray-50"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerClassName="pb-10"
      >
        {/* ===== STATUS HEADER ===== */}
        <View className="bg-white p-4 border-b border-gray-100">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-xs text-gray-400 uppercase tracking-wide">Booking Number</Text>
              <Text className="text-lg font-bold text-gray-900">{booking.booking_number}</Text>
            </View>
            <View className={`px-3 py-1.5 rounded-full ${statusConfig.bg}`}>
              <Text className={`text-sm font-semibold ${statusConfig.text}`}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Price */}
          <View className="mt-3 pt-3 border-t border-gray-100">
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-500">Total Price</Text>
              <Text className="text-xl font-bold text-gray-900">
                {formatCents(booking.price_cents)}
              </Text>
            </View>
          </View>
        </View>

        <View className="p-4">
          {/* ===== ROUTE ===== */}
          <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Route
            </Text>
            {route ? (
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{route.origin}</Text>
                  <Text className="text-xs text-gray-400">Origin</Text>
                </View>
                <View className="px-3">
                  <Text className="text-lg text-gray-300">{'\u2192'}</Text>
                </View>
                <View className="flex-1 items-end">
                  <Text className="text-base font-semibold text-gray-900">
                    {route.destination}
                  </Text>
                  <Text className="text-xs text-gray-400">Destination</Text>
                </View>
              </View>
            ) : (
              <Text className="text-sm text-gray-400">Route information unavailable</Text>
            )}
          </View>

          {/* ===== ADDRESSES ===== */}
          <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Addresses
            </Text>

            <View className="mb-3">
              <View className="flex-row items-center mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
                <Text className="text-xs text-gray-400 uppercase">Pickup</Text>
              </View>
              <Text className="text-sm text-gray-900 ml-4.5">{booking.pickup_address}</Text>
            </View>

            <View className="border-l border-dashed border-gray-200 ml-1 h-3 mb-1" />

            <View>
              <View className="flex-row items-center mb-1">
                <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
                <Text className="text-xs text-gray-400 uppercase">Dropoff</Text>
              </View>
              <Text className="text-sm text-gray-900 ml-4.5">{booking.dropoff_address}</Text>
            </View>
          </View>

          {/* ===== DATES ===== */}
          <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Schedule
            </Text>

            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-1">Pickup</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {formatAEST(booking.pickup_datetime, 'dd MMM yyyy')}
                </Text>
                <Text className="text-sm text-gray-600">
                  {formatAEST(booking.pickup_datetime, 'HH:mm')} AEST
                </Text>
              </View>
              <View className="w-px bg-gray-100 mx-3" />
              <View className="flex-1">
                <Text className="text-xs text-gray-400 mb-1">Dropoff</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {formatAEST(booking.dropoff_datetime, 'dd MMM yyyy')}
                </Text>
                <Text className="text-sm text-gray-600">
                  {formatAEST(booking.dropoff_datetime, 'HH:mm')} AEST
                </Text>
              </View>
            </View>
          </View>

          {/* ===== ITEM DETAILS ===== */}
          <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Item Details
            </Text>

            <View className="flex-row mb-2">
              <Text className="text-sm text-gray-500 w-28">Type</Text>
              <Text className="text-sm font-medium text-gray-900 flex-1">
                {booking.item_type}
              </Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="text-sm text-gray-500 w-28">Weight</Text>
              <Text className="text-sm font-medium text-gray-900 flex-1">
                {formatWeight(booking.weight_kg)}
              </Text>
            </View>
            <View className="flex-row mb-2">
              <Text className="text-sm text-gray-500 w-28">Dimensions</Text>
              <Text className="text-sm font-medium text-gray-900 flex-1">
                {formatDimensions(booking.length_cm, booking.width_cm, booking.height_cm)}
              </Text>
            </View>

            {booking.special_instructions && (
              <View className="mt-3 pt-3 border-t border-gray-100">
                <Text className="text-xs text-gray-400 mb-1 uppercase">Special Instructions</Text>
                <Text className="text-sm text-gray-700">{booking.special_instructions}</Text>
              </View>
            )}
          </View>

          {/* ===== ITEM PHOTOS ===== */}
          {photos.length > 0 && (
            <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
              <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Item Photos ({photos.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
              >
                {photos.map((photo) => {
                  const url = photoUrls[photo.id];
                  if (!url) return null;
                  return (
                    <Image
                      key={photo.id}
                      source={{ uri: url }}
                      className="w-28 h-28 rounded-lg"
                      resizeMode="cover"
                    />
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ===== DRIVER INFO ===== */}
          <View className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Driver
            </Text>

            {driver ? (
              <View>
                <View className="flex-row items-center">
                  {/* Driver avatar placeholder */}
                  <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
                    <Text className="text-blue-600 text-lg font-bold">
                      {driver.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {driver.full_name}
                    </Text>
                    {driver.phone && (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${driver.phone}`)}>
                        <Text className="text-sm text-blue-600">{driver.phone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Call button */}
                {driver.phone && (
                  <TouchableOpacity
                    className="mt-3 bg-green-50 border border-green-200 rounded-lg py-2.5 items-center"
                    onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                  >
                    <Text className="text-green-700 font-semibold text-sm">Call Driver</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View className="items-center py-3">
                <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mb-2">
                  <Text className="text-gray-400 text-lg">?</Text>
                </View>
                <Text className="text-sm text-gray-400">
                  {isCompleted ? 'No driver was assigned' : 'A driver will be assigned soon'}
                </Text>
              </View>
            )}
          </View>

          {/* ===== LIVE TRACKING BUTTON ===== */}
          {(booking.status === 'en_route' ||
            booking.status === 'at_pickup' ||
            booking.status === 'in_transit') &&
            driver && (
              <TouchableOpacity
                className="bg-indigo-600 rounded-xl py-4 items-center mb-3 shadow-sm"
                onPress={() => {
                  router.push(`/(customer)/tracking/${booking.id}`);
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-full bg-green-400 mr-2" />
                  <Text className="text-white font-semibold text-base">Track Live Location</Text>
                </View>
                <Text className="text-indigo-200 text-xs mt-0.5">Tap to see driver on the map</Text>
              </TouchableOpacity>
            )}

          {/* ===== CANCEL BUTTON ===== */}
          {canCancel && (
            <TouchableOpacity
              className={`border border-red-200 bg-red-50 rounded-xl py-3.5 items-center mb-3 ${
                cancelling ? 'opacity-50' : ''
              }`}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#dc2626" />
                  <Text className="text-red-600 font-semibold text-sm ml-2">Cancelling...</Text>
                </View>
              ) : (
                <Text className="text-red-600 font-semibold text-sm">Cancel Booking</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Cancellation cutoff notice */}
          {!isCompleted && !canCancel && booking.status !== 'cancelled' && (
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
              <Text className="text-amber-800 text-xs text-center">
                Cancellation window has closed. Contact support if you need to make changes.
              </Text>
            </View>
          )}

          {/* ===== TIMELINE / META ===== */}
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Booking Info
            </Text>
            <View className="flex-row mb-1.5">
              <Text className="text-xs text-gray-400 w-24">Created</Text>
              <Text className="text-xs text-gray-600 flex-1">
                {formatAEST(booking.created_at, 'dd MMM yyyy HH:mm')} AEST
              </Text>
            </View>
            <View className="flex-row mb-1.5">
              <Text className="text-xs text-gray-400 w-24">Updated</Text>
              <Text className="text-xs text-gray-600 flex-1">
                {formatAEST(booking.updated_at, 'dd MMM yyyy HH:mm')} AEST
              </Text>
            </View>
            <View className="flex-row">
              <Text className="text-xs text-gray-400 w-24">Booking ID</Text>
              <Text className="text-xs text-gray-600 flex-1 font-mono">{booking.id}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
