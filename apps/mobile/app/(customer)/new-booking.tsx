import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/providers/AuthProvider';
import { supabase } from '../../src/lib/supabase';
import {
  type Route,
  type Pricing,
  type CreateBookingInput,
  createBookingSchema,
  formatCents,
  MAX_ITEM_PHOTOS,
} from '@tasman-transport/shared';

// TODO: Replace TextInput date fields with @react-native-community/datetimepicker
// Install: npx expo install @react-native-community/datetimepicker

const ITEM_TYPES = [
  'Pallet',
  'Parcel',
  'Furniture',
  'Equipment',
  'Vehicle Parts',
  'General Freight',
] as const;

type ItemType = (typeof ITEM_TYPES)[number];

interface FormData {
  route_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  dropoff_datetime: string;
  item_type: string;
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  special_instructions: string;
}

const INITIAL_FORM: FormData = {
  route_id: '',
  pickup_address: '',
  dropoff_address: '',
  pickup_datetime: '',
  dropoff_datetime: '',
  item_type: '',
  weight_kg: '',
  length_cm: '',
  width_cm: '',
  height_cm: '',
  special_instructions: '',
};

export default function NewBookingScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---------- Fetch routes and pricing ----------
  const fetchRoutesAndPricing = useCallback(async () => {
    try {
      const [routesRes, pricingRes] = await Promise.all([
        supabase.from('routes').select('*').eq('is_active', true),
        supabase.from('pricing').select('*').eq('is_active', true),
      ]);
      if (routesRes.data) setRoutes(routesRes.data as Route[]);
      if (pricingRes.data) setPricing(pricingRes.data as Pricing[]);
    } catch (err) {
      console.error('Failed to load routes/pricing:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutesAndPricing();
  }, [fetchRoutesAndPricing]);

  // ---------- Calculate price when route or item type changes ----------
  useEffect(() => {
    if (form.route_id && form.item_type) {
      const match = pricing.find(
        (p) =>
          p.route_id === form.route_id &&
          p.item_type.toLowerCase() === form.item_type.toLowerCase()
      );
      setCurrentPrice(match ? match.price_cents : null);
    } else {
      setCurrentPrice(null);
    }
  }, [form.route_id, form.item_type, pricing]);

  // ---------- Form helpers ----------
  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for the field being edited
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function getSelectedRoute(): Route | undefined {
    return routes.find((r) => r.id === form.route_id);
  }

  function getRouteLabel(route: Route): string {
    return `${route.origin} \u2192 ${route.destination}`;
  }

  // ---------- Photo picker ----------
  async function pickPhotos() {
    if (photos.length >= MAX_ITEM_PHOTOS) {
      Alert.alert('Limit reached', `You can upload a maximum of ${MAX_ITEM_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ITEM_PHOTOS - photos.length,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => [...prev, ...result.assets].slice(0, MAX_ITEM_PHOTOS));
    }
  }

  async function takePhoto() {
    if (photos.length >= MAX_ITEM_PHOTOS) {
      Alert.alert('Limit reached', `You can upload a maximum of ${MAX_ITEM_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => [...prev, ...result.assets].slice(0, MAX_ITEM_PHOTOS));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------- Upload photos ----------
  async function uploadPhotos(bookingId: string): Promise<void> {
    for (const photo of photos) {
      const ext = photo.uri.split('.').pop() || 'jpg';
      const fileName = `${bookingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const response = await fetch(photo.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('booking-photos')
        .upload(fileName, blob, {
          contentType: photo.mimeType || 'image/jpeg',
        });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        continue;
      }

      // Record photo in database
      await supabase.from('booking_photos').insert({
        booking_id: bookingId,
        photo_type: 'item',
        storage_path: fileName,
        uploaded_by: user!.id,
      });
    }
  }

  // ---------- Validate & submit ----------
  async function handleSubmit() {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a booking.');
      return;
    }

    if (currentPrice === null) {
      Alert.alert('Error', 'Unable to determine price. Please select a valid route and item type.');
      return;
    }

    // Build the booking input
    const bookingInput: CreateBookingInput = {
      route_id: form.route_id,
      pickup_address: form.pickup_address,
      pickup_lat: 0, // Placeholder -- Google Places will fill these
      pickup_lng: 0,
      dropoff_address: form.dropoff_address,
      dropoff_lat: 0,
      dropoff_lng: 0,
      pickup_datetime: form.pickup_datetime,
      dropoff_datetime: form.dropoff_datetime,
      item_type: form.item_type,
      weight_kg: parseFloat(form.weight_kg) || 0,
      length_cm: parseFloat(form.length_cm) || 0,
      width_cm: parseFloat(form.width_cm) || 0,
      height_cm: parseFloat(form.height_cm) || 0,
      special_instructions: form.special_instructions || null,
      price_cents: currentPrice,
    };

    // Validate with zod
    const result = createBookingSchema.safeParse(bookingInput);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0]?.toString() || 'form';
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      Alert.alert('Validation Error', 'Please correct the highlighted fields.');
      return;
    }

    setLoading(true);
    try {
      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          driver_id: null,
          status: 'pending',
          ...result.data,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      if (!booking) throw new Error('No booking returned');

      // Upload photos if any
      if (photos.length > 0) {
        await uploadPhotos(booking.id);
      }

      Alert.alert(
        'Booking Created',
        `Your booking ${booking.booking_number} has been submitted successfully.`,
        [
          {
            text: 'View Booking',
            onPress: () => router.replace(`/(customer)/booking/${booking.id}`),
          },
          {
            text: 'OK',
            onPress: () => {
              setForm(INITIAL_FORM);
              setPhotos([]);
              router.push('/(customer)/bookings');
            },
          },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  // ---------- Loading state ----------
  if (loadingData) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1e3a5f" />
        <Text className="text-gray-500 mt-3">Loading booking form...</Text>
      </View>
    );
  }

  // ---------- Render ----------
  const selectedRoute = getSelectedRoute();

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1 bg-gray-50"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-10"
      >
        <View className="p-4">
          {/* ===== HEADER ===== */}
          <Text className="text-2xl font-bold text-gray-900 mb-1">New Booking</Text>
          <Text className="text-sm text-gray-500 mb-6">
            Fill in the details below to book a transport service.
          </Text>

          {/* ===== ROUTE SELECTOR ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Route
            </Text>
            {routes.length === 0 ? (
              <Text className="text-gray-400 text-sm">No routes available</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {routes.map((route) => {
                  const isSelected = form.route_id === route.id;
                  return (
                    <TouchableOpacity
                      key={route.id}
                      className={`px-4 py-3 rounded-lg border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-200'
                      }`}
                      onPress={() => updateField('route_id', route.id)}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          isSelected ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {getRouteLabel(route)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {errors.route_id && (
              <Text className="text-red-500 text-xs mt-1">{errors.route_id}</Text>
            )}
          </View>

          {/* ===== ADDRESSES ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Addresses
            </Text>

            {/* Pickup Address */}
            <Text className="text-sm text-gray-600 mb-1">Pickup Address</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 mb-1 ${
                errors.pickup_address ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="e.g. 123 Main St, Gold Coast QLD"
              placeholderTextColor="#9ca3af"
              value={form.pickup_address}
              onChangeText={(v) => updateField('pickup_address', v)}
            />
            {/* TODO: Replace with Google Places Autocomplete */}
            {errors.pickup_address && (
              <Text className="text-red-500 text-xs mb-2">{errors.pickup_address}</Text>
            )}

            <View className="h-3" />

            {/* Dropoff Address */}
            <Text className="text-sm text-gray-600 mb-1">Dropoff Address</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 mb-1 ${
                errors.dropoff_address ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="e.g. 456 George St, Sydney NSW"
              placeholderTextColor="#9ca3af"
              value={form.dropoff_address}
              onChangeText={(v) => updateField('dropoff_address', v)}
            />
            {errors.dropoff_address && (
              <Text className="text-red-500 text-xs">{errors.dropoff_address}</Text>
            )}
          </View>

          {/* ===== DATE/TIME ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
              Schedule (AEST)
            </Text>
            <Text className="text-xs text-gray-400 mb-3">
              Enter dates in ISO format: YYYY-MM-DDTHH:mm (e.g. 2026-03-15T09:00)
            </Text>
            {/* TODO: Replace with @react-native-community/datetimepicker for proper native date pickers */}

            {/* Pickup Date/Time */}
            <Text className="text-sm text-gray-600 mb-1">Pickup Date & Time</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 mb-1 ${
                errors.pickup_datetime ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="2026-03-15T09:00"
              placeholderTextColor="#9ca3af"
              value={form.pickup_datetime}
              onChangeText={(v) => {
                // Auto-append timezone offset for AEST (+10:00) if user enters bare datetime
                const formatted = v.length === 16 && !v.includes('+') && !v.includes('Z')
                  ? v
                  : v;
                updateField('pickup_datetime', formatted);
              }}
              onBlur={() => {
                // Append AEST offset on blur if not already present
                if (form.pickup_datetime.length === 16) {
                  updateField('pickup_datetime', form.pickup_datetime + ':00+10:00');
                }
              }}
            />
            {errors.pickup_datetime && (
              <Text className="text-red-500 text-xs mb-2">{errors.pickup_datetime}</Text>
            )}

            <View className="h-3" />

            {/* Dropoff Date/Time */}
            <Text className="text-sm text-gray-600 mb-1">Dropoff Date & Time</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 mb-1 ${
                errors.dropoff_datetime ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="2026-03-16T14:00"
              placeholderTextColor="#9ca3af"
              value={form.dropoff_datetime}
              onChangeText={(v) => updateField('dropoff_datetime', v)}
              onBlur={() => {
                if (form.dropoff_datetime.length === 16) {
                  updateField('dropoff_datetime', form.dropoff_datetime + ':00+10:00');
                }
              }}
            />
            {errors.dropoff_datetime && (
              <Text className="text-red-500 text-xs">{errors.dropoff_datetime}</Text>
            )}
          </View>

          {/* ===== ITEM TYPE ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Item Type
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ITEM_TYPES.map((type) => {
                const isSelected = form.item_type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    className={`px-4 py-2.5 rounded-lg border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-200'
                    }`}
                    onPress={() => updateField('item_type', type)}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.item_type && (
              <Text className="text-red-500 text-xs mt-1">{errors.item_type}</Text>
            )}
          </View>

          {/* ===== DIMENSIONS & WEIGHT ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Dimensions & Weight
            </Text>

            {/* Weight */}
            <Text className="text-sm text-gray-600 mb-1">Weight (kg)</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 mb-3 ${
                errors.weight_kg ? 'border-red-400' : 'border-gray-200'
              }`}
              placeholder="e.g. 25"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={form.weight_kg}
              onChangeText={(v) => updateField('weight_kg', v)}
            />
            {errors.weight_kg && (
              <Text className="text-red-500 text-xs mb-2">{errors.weight_kg}</Text>
            )}

            {/* L x W x H */}
            <Text className="text-sm text-gray-600 mb-1">Dimensions (cm)</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 ${
                    errors.length_cm ? 'border-red-400' : 'border-gray-200'
                  }`}
                  placeholder="Length"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={form.length_cm}
                  onChangeText={(v) => updateField('length_cm', v)}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 ${
                    errors.width_cm ? 'border-red-400' : 'border-gray-200'
                  }`}
                  placeholder="Width"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={form.width_cm}
                  onChangeText={(v) => updateField('width_cm', v)}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 ${
                    errors.height_cm ? 'border-red-400' : 'border-gray-200'
                  }`}
                  placeholder="Height"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={form.height_cm}
                  onChangeText={(v) => updateField('height_cm', v)}
                />
              </View>
            </View>
            {(errors.length_cm || errors.width_cm || errors.height_cm) && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.length_cm || errors.width_cm || errors.height_cm}
              </Text>
            )}
          </View>

          {/* ===== SPECIAL INSTRUCTIONS ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Special Instructions
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-base text-gray-900"
              placeholder="Any special handling requirements, access codes, etc."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ minHeight: 100 }}
              value={form.special_instructions}
              onChangeText={(v) => updateField('special_instructions', v)}
            />
          </View>

          {/* ===== ITEM PHOTOS ===== */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Item Photos
              </Text>
              <Text className="text-xs text-gray-400">
                {photos.length}/{MAX_ITEM_PHOTOS}
              </Text>
            </View>

            {/* Photo grid */}
            {photos.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: photo.uri }}
                      className="w-20 h-20 rounded-lg"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      className="absolute -top-1.5 -right-1.5 bg-red-500 w-5 h-5 rounded-full items-center justify-center"
                      onPress={() => removePhoto(index)}
                    >
                      <Text className="text-white text-xs font-bold">X</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add photo buttons */}
            {photos.length < MAX_ITEM_PHOTOS && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg py-3 items-center"
                  onPress={pickPhotos}
                >
                  <Text className="text-gray-600 text-sm font-medium">From Library</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg py-3 items-center"
                  onPress={takePhoto}
                >
                  <Text className="text-gray-600 text-sm font-medium">Take Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ===== PRICE DISPLAY ===== */}
          <View className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
            <Text className="text-sm font-semibold text-blue-800 mb-1 uppercase tracking-wide">
              Estimated Price
            </Text>
            {currentPrice !== null ? (
              <View className="flex-row items-baseline">
                <Text className="text-3xl font-bold text-blue-900">
                  {formatCents(currentPrice)}
                </Text>
                <Text className="text-sm text-blue-600 ml-2">AUD</Text>
              </View>
            ) : (
              <Text className="text-sm text-blue-600">
                {form.route_id && form.item_type
                  ? 'Pricing not available for this combination'
                  : 'Select a route and item type to see pricing'}
              </Text>
            )}
            {selectedRoute && form.item_type && (
              <Text className="text-xs text-blue-500 mt-1">
                {getRouteLabel(selectedRoute)} -- {form.item_type}
              </Text>
            )}
          </View>

          {/* ===== SUBMIT BUTTON ===== */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center shadow-sm ${
              loading || currentPrice === null
                ? 'bg-gray-300'
                : 'bg-blue-600 active:bg-blue-700'
            }`}
            onPress={handleSubmit}
            disabled={loading || currentPrice === null}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white font-semibold text-base ml-2">
                  Creating Booking...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-semibold text-base">Submit Booking</Text>
            )}
          </TouchableOpacity>

          {/* ===== FOOTER NOTE ===== */}
          <Text className="text-xs text-gray-400 text-center mt-3">
            You can cancel or edit this booking up to 5:00 PM AEST the day before pickup.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
