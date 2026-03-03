import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../../../src/providers/AuthProvider';
import { supabase } from '../../../src/lib/supabase';
import { uploadBookingPhoto, uploadSignature } from '../../../src/utils/storage';
import {
  type Booking,
  type BookingStatus,
  BOOKING_STATUS,
  BOOKING_STATUS_FLOW,
  MAX_ITEM_PHOTOS,
  formatAEST,
  formatCents,
  formatWeight,
  formatDimensions,
} from '@tasman-transport/shared';

// Global type for signature result passed from signature screen
declare global {
  // eslint-disable-next-line no-var
  var __signatureResult:
    | { bookingId: string; signatureType: string; base64: string }
    | undefined;
}

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-blue-100', text: 'text-blue-800' },
  en_route: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  at_pickup: { bg: 'bg-orange-100', text: 'text-orange-800' },
  in_transit: { bg: 'bg-purple-100', text: 'text-purple-800' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800' },
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Photo capture state
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  // Track which phase we're capturing for (pickup or delivery)
  const [photoPhase, setPhotoPhase] = useState<'pickup' | 'delivery'>('pickup');

  // Fetch booking data
  const fetchBooking = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBooking(data as Booking);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load booking';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Check for signature result when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      if (global.__signatureResult && global.__signatureResult.bookingId === id) {
        setSignatureBase64(global.__signatureResult.base64);
        global.__signatureResult = undefined;
      }
    }, [id])
  );

  // Update booking status
  const updateStatus = async (newStatus: BookingStatus) => {
    if (!booking || !user) return;

    // Validate status transition
    const allowedNext = BOOKING_STATUS_FLOW[booking.status as BookingStatus];
    if (!allowedNext.includes(newStatus)) {
      Alert.alert('Error', `Cannot transition from ${booking.status} to ${newStatus}`);
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (error) throw error;

      setBooking({ ...booking, status: newStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update status';
      Alert.alert('Error', message);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Google Maps navigation
  const openNavigation = (address: string, lat: number, lng: number) => {
    const scheme = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(address)}&saddr=Current+Location&daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });

    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(address)}`;

    if (scheme) {
      Linking.canOpenURL(scheme).then((supported) => {
        if (supported) {
          Linking.openURL(scheme);
        } else {
          Linking.openURL(fallbackUrl);
        }
      });
    } else {
      Linking.openURL(fallbackUrl);
    }
  };

  // Take photos with image picker
  const handleTakePhoto = async () => {
    if (capturedPhotos.length >= MAX_ITEM_PHOTOS) {
      Alert.alert('Limit Reached', `You can capture up to ${MAX_ITEM_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // Remove a captured photo
  const removePhoto = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Start Job (confirmed -> en_route)
  const handleStartJob = async () => {
    // Request location permission for GPS tracking
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Permission',
        'Location access helps track your delivery progress. Continue without tracking?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => updateStatus(BOOKING_STATUS.EN_ROUTE) },
        ]
      );
      return;
    }
    await updateStatus(BOOKING_STATUS.EN_ROUTE);
  };

  // Handle Confirm Pickup (uploads photos + signature, at_pickup -> in_transit)
  const handleConfirmPickup = async () => {
    if (!booking || !user) return;

    if (capturedPhotos.length === 0) {
      Alert.alert('Photos Required', 'Please take at least one photo before confirming pickup.');
      return;
    }

    if (!signatureBase64) {
      Alert.alert('Signature Required', 'Please capture the customer signature before confirming pickup.');
      return;
    }

    setActionLoading(true);
    try {
      // Upload all captured photos
      for (const photoUri of capturedPhotos) {
        await uploadBookingPhoto(booking.id, 'pickup', photoUri, user.id);
      }

      // Upload signature
      await uploadSignature(booking.id, 'pickup', signatureBase64, user.id);

      // Transition to in_transit
      await updateStatus(BOOKING_STATUS.IN_TRANSIT);

      // Reset capture state for delivery phase
      setCapturedPhotos([]);
      setSignatureBase64(null);
      setPhotoPhase('delivery');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm pickup';
      Alert.alert('Upload Error', message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Confirm Delivery (uploads photos + signature, in_transit -> delivered)
  const handleConfirmDelivery = async () => {
    if (!booking || !user) return;

    if (capturedPhotos.length === 0) {
      Alert.alert('Photos Required', 'Please take at least one delivery photo.');
      return;
    }

    if (!signatureBase64) {
      Alert.alert('Signature Required', 'Please capture the customer signature for delivery.');
      return;
    }

    setActionLoading(true);
    try {
      // Upload delivery photos
      for (const photoUri of capturedPhotos) {
        await uploadBookingPhoto(booking.id, 'delivery', photoUri, user.id);
      }

      // Upload delivery signature
      await uploadSignature(booking.id, 'delivery', signatureBase64, user.id);

      // Transition to delivered
      const { error } = await supabase
        .from('bookings')
        .update({ status: BOOKING_STATUS.DELIVERED })
        .eq('id', booking.id);

      if (error) throw error;
      setBooking({ ...booking, status: BOOKING_STATUS.DELIVERED });

      // Reset capture state
      setCapturedPhotos([]);
      setSignatureBase64(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm delivery';
      Alert.alert('Upload Error', message);
    } finally {
      setActionLoading(false);
    }
  };

  // Navigate to signature screen
  const goToSignature = () => {
    if (!booking) return;
    const sigType = booking.status === 'at_pickup' ? 'pickup' : 'delivery';
    router.push({
      pathname: '/(driver)/signature',
      params: { bookingId: booking.id, signatureType: sigType },
    });
  };

  // Handle Finish (delivered -> back to jobs list)
  const handleFinish = () => {
    router.replace('/(driver)/jobs');
  };

  // ---- RENDER HELPERS ----

  // Booking info card (always shown)
  const renderBookingInfo = () => {
    if (!booking) return null;

    const statusColor = STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed;

    return (
      <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{booking.booking_number}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              {formatAEST(booking.pickup_datetime, 'EEEE, dd MMM yyyy')}
            </Text>
          </View>
          <View className={`${statusColor.bg} px-3 py-1 rounded-full`}>
            <Text className={`text-xs font-semibold ${statusColor.text} capitalize`}>
              {booking.status.replace('_', ' ')}
            </Text>
          </View>
        </View>

        {/* Addresses */}
        <View className="bg-gray-50 rounded-lg p-3 mb-3">
          <View className="flex-row items-start mb-2">
            <View className="w-6 h-6 rounded-full bg-green-500 items-center justify-center mr-2 mt-0.5">
              <Text className="text-white text-xs font-bold">P</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-400 font-medium">PICKUP</Text>
              <Text className="text-sm text-gray-800">{booking.pickup_address}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {formatAEST(booking.pickup_datetime, 'HH:mm')}
              </Text>
            </View>
          </View>

          <View className="border-l-2 border-dashed border-gray-300 ml-3 h-3 mb-2" />

          <View className="flex-row items-start">
            <View className="w-6 h-6 rounded-full bg-red-500 items-center justify-center mr-2 mt-0.5">
              <Text className="text-white text-xs font-bold">D</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-400 font-medium">DROPOFF</Text>
              <Text className="text-sm text-gray-800">{booking.dropoff_address}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {formatAEST(booking.dropoff_datetime, 'HH:mm')}
              </Text>
            </View>
          </View>
        </View>

        {/* Item details */}
        <View className="flex-row flex-wrap gap-2">
          <View className="bg-blue-50 px-2.5 py-1 rounded-lg">
            <Text className="text-xs text-blue-700">{booking.item_type}</Text>
          </View>
          <View className="bg-blue-50 px-2.5 py-1 rounded-lg">
            <Text className="text-xs text-blue-700">{formatWeight(booking.weight_kg)}</Text>
          </View>
          <View className="bg-blue-50 px-2.5 py-1 rounded-lg">
            <Text className="text-xs text-blue-700">
              {formatDimensions(booking.length_cm, booking.width_cm, booking.height_cm)}
            </Text>
          </View>
          <View className="bg-green-50 px-2.5 py-1 rounded-lg">
            <Text className="text-xs text-green-700 font-semibold">
              {formatCents(booking.price_cents)}
            </Text>
          </View>
        </View>

        {/* Special instructions */}
        {booking.special_instructions ? (
          <View className="mt-3 bg-amber-50 rounded-lg p-3 border border-amber-100">
            <Text className="text-xs text-amber-800 font-medium mb-0.5">SPECIAL INSTRUCTIONS</Text>
            <Text className="text-sm text-amber-900">{booking.special_instructions}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // Photo thumbnails grid
  const renderPhotoThumbnails = () => {
    if (capturedPhotos.length === 0) return null;

    return (
      <View className="mt-3">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Photos ({capturedPhotos.length}/{MAX_ITEM_PHOTOS})
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {capturedPhotos.map((uri, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                Alert.alert('Remove Photo', 'Remove this photo?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removePhoto(index) },
                ]);
              }}
              className="relative"
            >
              <Image
                source={{ uri }}
                className="w-20 h-20 rounded-lg"
                resizeMode="cover"
              />
              <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                <Text className="text-white text-xs font-bold">X</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Signature status indicator
  const renderSignatureStatus = () => {
    if (!signatureBase64) return null;

    return (
      <View className="mt-3 flex-row items-center bg-green-50 rounded-lg px-3 py-2 border border-green-200">
        <Text className="text-green-700 text-sm font-medium">Signature captured</Text>
      </View>
    );
  };

  // ---- STATUS-SPECIFIC ACTIONS ----

  const renderConfirmedActions = () => (
    <View className="mt-4">
      <TouchableOpacity
        className="bg-[#1e3a5f] rounded-xl py-4 items-center"
        onPress={handleStartJob}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-bold text-base">Start Job</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEnRouteActions = () => {
    if (!booking) return null;

    return (
      <View className="mt-4 gap-3">
        {/* Navigate button */}
        <TouchableOpacity
          className="bg-blue-500 rounded-xl py-4 items-center flex-row justify-center"
          onPress={() =>
            openNavigation(booking.pickup_address, booking.pickup_lat, booking.pickup_lng)
          }
        >
          <Text className="text-white font-bold text-base">Navigate to Pickup</Text>
        </TouchableOpacity>

        {/* Arrived button */}
        <TouchableOpacity
          className="bg-[#1e3a5f] rounded-xl py-4 items-center"
          onPress={() => updateStatus(BOOKING_STATUS.AT_PICKUP)}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Arrived at Pickup</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderAtPickupActions = () => (
    <View className="mt-4">
      <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <Text className="text-base font-bold text-gray-900 mb-3">Pickup Verification</Text>

        {/* Take Photos button */}
        <TouchableOpacity
          className="bg-blue-50 border border-blue-200 rounded-xl py-3.5 items-center mb-3"
          onPress={handleTakePhoto}
          disabled={capturedPhotos.length >= MAX_ITEM_PHOTOS}
        >
          <Text className="text-blue-700 font-semibold text-sm">
            Take Photo ({capturedPhotos.length}/{MAX_ITEM_PHOTOS})
          </Text>
        </TouchableOpacity>

        {renderPhotoThumbnails()}

        {/* Get Signature button */}
        <TouchableOpacity
          className="bg-blue-50 border border-blue-200 rounded-xl py-3.5 items-center mt-3"
          onPress={goToSignature}
        >
          <Text className="text-blue-700 font-semibold text-sm">
            {signatureBase64 ? 'Retake Signature' : 'Get Customer Signature'}
          </Text>
        </TouchableOpacity>

        {renderSignatureStatus()}

        {/* Confirm Pickup button - only if both photos and signature are done */}
        {capturedPhotos.length > 0 && signatureBase64 ? (
          <TouchableOpacity
            className="bg-[#1e3a5f] rounded-xl py-4 items-center mt-4"
            onPress={handleConfirmPickup}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Confirm Pickup</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View className="bg-gray-100 rounded-xl py-4 items-center mt-4">
            <Text className="text-gray-400 font-semibold text-sm">
              Take photos and get signature to continue
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderInTransitActions = () => {
    if (!booking) return null;

    // If we haven't started delivery capture yet, show navigate + arrived buttons
    const hasDeliveryPhotos = capturedPhotos.length > 0 && photoPhase === 'delivery';
    const showDeliveryCapture = capturedPhotos.length > 0 || signatureBase64;

    return (
      <View className="mt-4 gap-3">
        {/* Navigate button */}
        <TouchableOpacity
          className="bg-blue-500 rounded-xl py-4 items-center flex-row justify-center"
          onPress={() =>
            openNavigation(booking.dropoff_address, booking.dropoff_lat, booking.dropoff_lng)
          }
        >
          <Text className="text-white font-bold text-base">Navigate to Delivery</Text>
        </TouchableOpacity>

        {/* Delivery verification panel */}
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <Text className="text-base font-bold text-gray-900 mb-3">Delivery Verification</Text>

          {/* Take Photos button */}
          <TouchableOpacity
            className="bg-blue-50 border border-blue-200 rounded-xl py-3.5 items-center mb-3"
            onPress={() => {
              setPhotoPhase('delivery');
              handleTakePhoto();
            }}
            disabled={capturedPhotos.length >= MAX_ITEM_PHOTOS}
          >
            <Text className="text-blue-700 font-semibold text-sm">
              Take Delivery Photo ({capturedPhotos.length}/{MAX_ITEM_PHOTOS})
            </Text>
          </TouchableOpacity>

          {renderPhotoThumbnails()}

          {/* Get Signature button */}
          <TouchableOpacity
            className="bg-blue-50 border border-blue-200 rounded-xl py-3.5 items-center mt-3"
            onPress={goToSignature}
          >
            <Text className="text-blue-700 font-semibold text-sm">
              {signatureBase64 ? 'Retake Signature' : 'Get Delivery Signature'}
            </Text>
          </TouchableOpacity>

          {renderSignatureStatus()}

          {/* Confirm Delivery button */}
          {capturedPhotos.length > 0 && signatureBase64 ? (
            <TouchableOpacity
              className="bg-green-600 rounded-xl py-4 items-center mt-4"
              onPress={handleConfirmDelivery}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Confirm Delivery</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View className="bg-gray-100 rounded-xl py-4 items-center mt-4">
              <Text className="text-gray-400 font-semibold text-sm">
                Take photos and get signature to confirm delivery
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDeliveredActions = () => {
    if (!booking) return null;

    return (
      <View className="mt-4">
        <View className="bg-green-50 rounded-xl p-4 border border-green-200 mb-4">
          <Text className="text-green-800 text-base font-bold text-center mb-1">
            Delivery Complete
          </Text>
          <Text className="text-green-700 text-sm text-center">
            {booking.booking_number} has been successfully delivered.
          </Text>
        </View>

        {/* Summary */}
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-sm font-bold text-gray-900 mb-2">Summary</Text>
          <View className="gap-1">
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-500">Item</Text>
              <Text className="text-sm text-gray-800">{booking.item_type}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-500">Weight</Text>
              <Text className="text-sm text-gray-800">{formatWeight(booking.weight_kg)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-500">Fare</Text>
              <Text className="text-sm text-gray-800 font-semibold">
                {formatCents(booking.price_cents)}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          className="bg-[#1e3a5f] rounded-xl py-4 items-center"
          onPress={handleFinish}
        >
          <Text className="text-white font-bold text-base">Finish</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render the status-specific action section
  const renderActions = () => {
    if (!booking) return null;

    switch (booking.status) {
      case BOOKING_STATUS.CONFIRMED:
        return renderConfirmedActions();
      case BOOKING_STATUS.EN_ROUTE:
        return renderEnRouteActions();
      case BOOKING_STATUS.AT_PICKUP:
        return renderAtPickupActions();
      case BOOKING_STATUS.IN_TRANSIT:
        return renderInTransitActions();
      case BOOKING_STATUS.DELIVERED:
        return renderDeliveredActions();
      default:
        return null;
    }
  };

  // ---- MAIN RENDER ----

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1e3a5f" />
        <Text className="mt-3 text-gray-500">Loading job details...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-4">
        <Text className="text-gray-500 text-lg text-center">Booking not found</Text>
        <TouchableOpacity
          className="mt-4 bg-[#1e3a5f] rounded-xl px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 pb-8"
      showsVerticalScrollIndicator={false}
    >
      {renderBookingInfo()}
      {renderActions()}
    </ScrollView>
  );
}
