import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import type { Booking, Profile } from '@tasman-transport/shared';

interface DriverLocationData {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = Dimensions.get('window').height * 0.55;

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [driver, setDriver] = useState<Profile | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  // ---------- Fetch booking and driver ----------
  useEffect(() => {
    fetchBooking();
  }, [id]);

  async function fetchBooking() {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        const b = data as Booking;
        setBooking(b);

        if (b.driver_id) {
          const { data: driverData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', b.driver_id)
            .single();
          if (driverData) setDriver(driverData as Profile);
        }

        // Also fetch last known location from DB
        const { data: locData } = await supabase
          .from('driver_locations')
          .select('*')
          .eq('booking_id', id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (locData) {
          setDriverLocation({
            latitude: locData.latitude,
            longitude: locData.longitude,
            heading: locData.heading,
            speed: locData.speed,
            recorded_at: locData.recorded_at,
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load booking';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Subscribe to driver location broadcasts ----------
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`driver-location:${id}`)
      .on('broadcast', { event: 'location' }, (payload) => {
        setDriverLocation(payload.payload as DriverLocationData);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // ---------- Subscribe to booking status changes ----------
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`tracking-booking-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Booking;
          setBooking(updated);

          // If booking is delivered, show alert and go back
          if (updated.status === 'delivered') {
            Alert.alert(
              'Delivery Complete',
              'Your package has been delivered!',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // ---------- Fit map to all markers ----------
  useEffect(() => {
    if (!booking || !mapRef.current) return;

    const coordinates = [
      { latitude: booking.pickup_lat, longitude: booking.pickup_lng },
      { latitude: booking.dropoff_lat, longitude: booking.dropoff_lng },
    ];

    if (driverLocation) {
      coordinates.push({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
      });
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [booking, driverLocation?.latitude, driverLocation?.longitude]);

  // ---------- Loading ----------
  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <Stack.Screen
          options={{
            title: 'Loading...',
            headerStyle: { backgroundColor: '#1e3a5f' },
            headerTintColor: '#fff',
          }}
        />
        <ActivityIndicator size="large" color="#1e3a5f" />
        <Text className="mt-3 text-gray-500">Loading tracking data...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center p-4">
        <Stack.Screen
          options={{
            title: 'Not Found',
            headerStyle: { backgroundColor: '#1e3a5f' },
            headerTintColor: '#fff',
          }}
        />
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

  // ---------- Status label ----------
  const statusLabels: Record<string, string> = {
    en_route: 'Driver is on the way to pickup',
    at_pickup: 'Driver is at the pickup location',
    in_transit: 'Your package is on the way',
    delivered: 'Delivery complete',
  };
  const statusLabel = statusLabels[booking.status] || 'Driver is on the way';

  // ---------- Map region ----------
  const initialRegion = {
    latitude: (booking.pickup_lat + booking.dropoff_lat) / 2,
    longitude: (booking.pickup_lng + booking.dropoff_lng) / 2,
    latitudeDelta:
      Math.abs(booking.pickup_lat - booking.dropoff_lat) * 1.5 + 0.01,
    longitudeDelta:
      Math.abs(booking.pickup_lng - booking.dropoff_lng) * 1.5 + 0.01,
  };

  // Polyline coordinates: pickup -> driver (if available) -> dropoff
  const polylineCoords = [
    { latitude: booking.pickup_lat, longitude: booking.pickup_lng },
  ];
  if (driverLocation) {
    polylineCoords.push({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
    });
  }
  polylineCoords.push({
    latitude: booking.dropoff_lat,
    longitude: booking.dropoff_lng,
  });

  const driverInitials = driver
    ? driver.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Live Tracking',
          headerStyle: { backgroundColor: '#1e3a5f' },
          headerTintColor: '#fff',
        }}
      />

      <View className="flex-1 bg-gray-50">
        {/* ===== MAP ===== */}
        <View style={{ height: MAP_HEIGHT }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {/* Pickup marker (green) */}
            <Marker
              coordinate={{
                latitude: booking.pickup_lat,
                longitude: booking.pickup_lng,
              }}
              title="Pickup"
              description={booking.pickup_address}
              pinColor="#22c55e"
            />

            {/* Dropoff marker (red) */}
            <Marker
              coordinate={{
                latitude: booking.dropoff_lat,
                longitude: booking.dropoff_lng,
              }}
              title="Dropoff"
              description={booking.dropoff_address}
              pinColor="#ef4444"
            />

            {/* Driver marker (blue) */}
            {driverLocation && (
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title={driver?.full_name ?? 'Driver'}
                description="Current location"
              >
                <View className="items-center">
                  <View className="w-10 h-10 rounded-full bg-blue-600 border-3 border-white items-center justify-center shadow-lg">
                    <Text className="text-white text-xs font-bold">
                      {driverInitials}
                    </Text>
                  </View>
                  <View className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-blue-600 -mt-0.5" />
                </View>
              </Marker>
            )}

            {/* Route polyline */}
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#2563eb"
              strokeWidth={3}
              lineDashPattern={[10, 5]}
            />
          </MapView>

          {/* Status overlay on map */}
          <View className="absolute top-3 left-3 right-3">
            <View className="bg-white/95 rounded-xl px-4 py-3 shadow-lg flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2.5" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {statusLabel}
                </Text>
                {driverLocation && (
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Last update:{' '}
                    {new Date(driverLocation.recorded_at).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Re-center button */}
          <TouchableOpacity
            className="absolute bottom-3 right-3 bg-white w-10 h-10 rounded-full items-center justify-center shadow-lg"
            onPress={() => {
              if (!mapRef.current) return;
              const coords = [
                { latitude: booking.pickup_lat, longitude: booking.pickup_lng },
                { latitude: booking.dropoff_lat, longitude: booking.dropoff_lng },
              ];
              if (driverLocation) {
                coords.push({
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                });
              }
              mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
              });
            }}
          >
            <Text className="text-blue-600 text-base">*</Text>
          </TouchableOpacity>
        </View>

        {/* ===== BOTTOM PANEL ===== */}
        <View className="flex-1 bg-white rounded-t-3xl -mt-4 shadow-lg">
          {/* Drag handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-gray-200" />
          </View>

          {/* Address summary */}
          <View className="px-5 pb-3 border-b border-gray-100">
            <View className="flex-row items-start mb-2">
              <View className="w-5 items-center mt-0.5">
                <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <View className="w-0.5 h-4 bg-gray-200 my-0.5" />
                <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
              </View>
              <View className="flex-1 ml-2">
                <Text
                  className="text-sm text-gray-900 mb-3"
                  numberOfLines={1}
                >
                  {booking.pickup_address}
                </Text>
                <Text className="text-sm text-gray-900" numberOfLines={1}>
                  {booking.dropoff_address}
                </Text>
              </View>
            </View>
          </View>

          {/* Driver info card */}
          {driver ? (
            <View className="px-5 py-4">
              <View className="flex-row items-center">
                {/* Driver avatar */}
                <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Text className="text-blue-600 text-lg font-bold">
                    {driverInitials}
                  </Text>
                </View>

                {/* Driver details */}
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {driver.full_name}
                  </Text>
                  <Text className="text-sm text-gray-500">Your driver</Text>
                </View>

                {/* Call button */}
                {driver.phone && (
                  <TouchableOpacity
                    className="w-11 h-11 rounded-full bg-green-50 border border-green-200 items-center justify-center"
                    onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                  >
                    <Text className="text-green-700 text-lg">T</Text>
                  </TouchableOpacity>
                )}

                {/* SMS button */}
                {driver.phone && (
                  <TouchableOpacity
                    className="w-11 h-11 rounded-full bg-blue-50 border border-blue-200 items-center justify-center ml-2"
                    onPress={() => Linking.openURL(`sms:${driver.phone}`)}
                  >
                    <Text className="text-blue-700 text-lg">M</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Call driver full-width button */}
              {driver.phone && (
                <TouchableOpacity
                  className="mt-4 bg-green-600 rounded-xl py-3.5 items-center"
                  onPress={() => Linking.openURL(`tel:${driver.phone}`)}
                >
                  <Text className="text-white font-semibold text-sm">
                    Call {driver.full_name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="px-5 py-6 items-center">
              <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mb-2">
                <Text className="text-gray-400 text-lg">?</Text>
              </View>
              <Text className="text-sm text-gray-400">
                Waiting for driver assignment...
              </Text>
            </View>
          )}

          {/* No live location fallback */}
          {!driverLocation && (
            <View className="mx-5 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <Text className="text-amber-800 text-xs text-center">
                Waiting for live location data from the driver. The map will
                update automatically once tracking begins.
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );
}
