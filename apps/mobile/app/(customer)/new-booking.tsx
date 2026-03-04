import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/providers/AuthProvider';
import PlacesAutocompleteInput from '../../src/components/PlacesAutocompleteInput';
import { supabase } from '../../src/lib/supabase';
import {
  type Route,
  type CreateBookingInput,
  createBookingSchema,
  MAX_ITEM_PHOTOS,
} from '@tasman-transport/shared';

// ---------------------------------------------------------------------------
// Tasman Star Seafoods rate card (from pricing sheet)
// ---------------------------------------------------------------------------

interface PriceEntry {
  item: string;
  product: string;
  rate: number;
  unit: 'flat' | 'per_kg';
}

interface RouteData {
  label: string;
  origin: string;
  destination: string;
  prices: PriceEntry[];
}

const RATE_SHEET: Record<string, RouteData> = {
  syd_to_bne_gc: {
    label: 'Sydney → Brisbane / Gold Coast',
    origin: 'Sydney',
    destination: 'Brisbane / Gold Coast',
    prices: [
      { item: 'Wet Freight', product: 'Full Pallet', rate: 450, unit: 'flat' },
      { item: 'Wet Freight', product: '1/2 Pallet', rate: 250, unit: 'flat' },
      { item: 'Poly Box Dry', product: 'Full Pallet', rate: 270, unit: 'flat' },
      { item: 'Poly Box Dry', product: '1/2 Pallet', rate: 150, unit: 'flat' },
      { item: 'Tuna Bin', product: 'Empty', rate: 200, unit: 'flat' },
      { item: 'Tuna Bin Full', product: 'Full Pallet', rate: 600, unit: 'flat' },
      { item: 'Poly Box Each (Max 4)', product: 'Poly Box Each', rate: 40, unit: 'flat' },
      { item: 'Fish Tub Each (Max 4)', product: 'Fish Tub Each', rate: 40, unit: 'flat' },
      { item: 'Frozen', product: 'Full Pallet', rate: 400, unit: 'flat' },
      { item: 'Frozen', product: '1/2 Pallet', rate: 200, unit: 'flat' },
      { item: 'Poly Box Port Botany', product: 'Full Pallet', rate: 380, unit: 'flat' },
      { item: 'Poly Box Port Botany', product: '1/2 Pallet', rate: 230, unit: 'flat' },
    ],
  },
  syd_to_gc_nsw: {
    label: 'Sydney → Gold Coast / N-NSW',
    origin: 'Sydney',
    destination: 'Gold Coast / N-NSW',
    prices: [
      { item: 'Wet Freight', product: 'Full Pallet', rate: 530, unit: 'flat' },
      { item: 'Wet Freight', product: '1/2 Pallet', rate: 330, unit: 'flat' },
      { item: 'Poly Dry Pallet', product: 'Full Pallet', rate: 350, unit: 'flat' },
      { item: 'Dry Pallet', product: '1/2 Pallet', rate: 230, unit: 'flat' },
    ],
  },
  bne_to_syd_sfm: {
    label: 'Brisbane → Sydney SFM',
    origin: 'Brisbane',
    destination: 'Sydney SFM',
    prices: [
      { item: 'Wet Freight', product: 'Full Pallet', rate: 220, unit: 'flat' },
      { item: 'Poly Dry Pallet', product: 'Full Pallet', rate: 170, unit: 'flat' },
      { item: 'Tuna Bin', product: 'Empty', rate: 150, unit: 'flat' },
      { item: 'Frozen Pallet', product: 'Full Pallet', rate: 200, unit: 'flat' },
      { item: 'Empty Tub Return', product: 'Full Pallet', rate: 150, unit: 'flat' },
    ],
  },
  tweed_to_sfm: {
    label: 'Tweed South → SFM',
    origin: 'Tweed South',
    destination: 'SFM',
    prices: [{ item: 'Weight', product: 'All', rate: 0.8, unit: 'per_kg' }],
  },
  gc_factory_to_sfm: {
    label: 'Gold Coast Factory → SFM',
    origin: 'Gold Coast Factory',
    destination: 'SFM',
    prices: [
      { item: 'Frozen Pallet', product: 'Full Pallet', rate: 170, unit: 'flat' },
      { item: 'Wet Pallet', product: 'Full Pallet', rate: 150, unit: 'flat' },
      { item: 'Weight', product: 'All', rate: 0.8, unit: 'per_kg' },
    ],
  },
  gc_to_raptis: {
    label: 'Gold Coast → Raptis',
    origin: 'Gold Coast',
    destination: 'Raptis',
    prices: [{ item: 'Weight', product: 'All', rate: 1.0, unit: 'per_kg' }],
  },
};

const ROUTE_KEYS = Object.keys(RATE_SHEET);

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function generateDates(daysAhead: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

const TIME_SLOTS = [
  '05:00 AM', '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM',
  '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM',
  '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM',
];

function formatDateLabel(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function toISOWithOffset(date: Date, timeSlot: string): string {
  const [time, ampm] = timeSlot.split(' ');
  const [hStr, mStr] = time.split(':');
  let hours = parseInt(hStr, 10);
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(hours).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${mStr}:00+10:00`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewBookingScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [routeKey, setRouteKey] = useState<string>('');
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [weightKg, setWeightKg] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupDate, setPickupDate] = useState<Date | null>(null);
  const [pickupTime, setPickupTime] = useState<string>('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKgGeneral, setWeightKgGeneral] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchRoutes = useCallback(async () => {
    try {
      const { data } = await supabase.from('routes').select('*').eq('is_active', true);
      if (data) setRoutes(data as Route[]);
    } catch (err) {
      console.error('Failed to load routes:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const availableDates = useMemo(() => generateDates(30), []);

  const currentRoute = routeKey ? RATE_SHEET[routeKey] : null;
  const selectedPrice = currentRoute && selectedItemIdx !== null
    ? currentRoute.prices[selectedItemIdx]
    : null;

  const estimatedPrice = useMemo(() => {
    if (!selectedPrice) return null;
    if (selectedPrice.unit === 'per_kg') {
      const kg = parseFloat(weightKg);
      if (!kg || kg <= 0) return null;
      return selectedPrice.rate * kg;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) return null;
    return selectedPrice.rate * qty;
  }, [selectedPrice, quantity, weightKg]);

  function handleRouteChange(key: string) {
    setRouteKey(key);
    setSelectedItemIdx(null);
    setQuantity('1');
    setWeightKg('');
  }

  function updateField(field: string, value: string) {
    if (field === 'length_cm') setLengthCm(value);
    else if (field === 'width_cm') setWidthCm(value);
    else if (field === 'height_cm') setHeightCm(value);
    else if (field === 'weight_kg') setWeightKgGeneral(value);
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // ---------- Photos ----------
  async function pickPhotos() {
    if (photos.length >= MAX_ITEM_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_ITEM_PHOTOS} photos.`);
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
      Alert.alert('Limit reached', `Maximum ${MAX_ITEM_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets.length > 0) {
      setPhotos((prev) => [...prev, ...result.assets].slice(0, MAX_ITEM_PHOTOS));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadPhotos(bookingId: string): Promise<void> {
    for (const photo of photos) {
      const ext = photo.uri.split('.').pop() || 'jpg';
      const fileName = `${bookingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from('booking-photos')
        .upload(fileName, blob, { contentType: photo.mimeType || 'image/jpeg' });
      if (uploadError) continue;
      await supabase.from('booking_photos').insert({
        booking_id: bookingId,
        photo_type: 'item',
        storage_path: fileName,
        uploaded_by: user!.id,
      });
    }
  }

  // ---------- Submit ----------
  async function handleSubmit() {
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }
    if (!routeKey || selectedItemIdx === null || !selectedPrice) {
      Alert.alert('Missing info', 'Please select a route and item.');
      return;
    }
    if (estimatedPrice === null || estimatedPrice <= 0) {
      Alert.alert('Missing info', selectedPrice.unit === 'per_kg'
        ? 'Please enter the weight in kg.'
        : 'Please enter a valid quantity.');
      return;
    }
    if (!pickupAddress.trim() || !pickupCoords) {
      Alert.alert('Missing info', 'Please select a pickup address from the suggestions.');
      return;
    }
    if (!dropoffAddress.trim() || !dropoffCoords) {
      Alert.alert('Missing info', 'Please select a dropoff address from the suggestions.');
      return;
    }
    if (!pickupDate || !pickupTime) {
      Alert.alert('Missing info', 'Please select pickup date and time.');
      return;
    }

    const len = parseFloat(lengthCm) || 1;
    const wid = parseFloat(widthCm) || 1;
    const hgt = parseFloat(heightCm) || 1;
    const wgt = selectedPrice.unit === 'per_kg'
      ? (parseFloat(weightKg) || 1)
      : (parseFloat(weightKgGeneral) || 1);
    if (len <= 0 || wid <= 0 || hgt <= 0 || wgt <= 0) {
      setErrors({
        length_cm: len <= 0 ? 'Required' : '',
        width_cm: wid <= 0 ? 'Required' : '',
        height_cm: hgt <= 0 ? 'Required' : '',
        weight_kg: wgt <= 0 ? 'Required' : '',
      });
      Alert.alert('Missing info', 'Please fill in dimensions and weight.');
      return;
    }

    const pickupDatetime = toISOWithOffset(pickupDate, pickupTime);
    const dropoffDate = new Date(pickupDate);
    dropoffDate.setDate(dropoffDate.getDate() + 1);
    const dropoffDatetime = toISOWithOffset(dropoffDate, pickupTime);

    const matchedRoute = routes.find(
      (r) => r.origin === currentRoute.origin && r.destination === currentRoute.destination
    );
    const routeId = matchedRoute?.id ?? routes[0]?.id;
    if (!routeId) {
      Alert.alert('Error', 'No routes configured. Please contact support.');
      return;
    }

    const itemTypeFull = `${selectedPrice.item} - ${selectedPrice.product}`;

    const bookingInput: CreateBookingInput = {
      route_id: routeId,
      pickup_address: pickupAddress.trim(),
      pickup_lat: pickupCoords.lat,
      pickup_lng: pickupCoords.lng,
      dropoff_address: dropoffAddress.trim(),
      dropoff_lat: dropoffCoords.lat,
      dropoff_lng: dropoffCoords.lng,
      pickup_datetime: pickupDatetime,
      dropoff_datetime: dropoffDatetime,
      item_type: itemTypeFull,
      weight_kg: wgt,
      length_cm: len,
      width_cm: wid,
      height_cm: hgt,
      special_instructions: specialInstructions.trim() || null,
      price_cents: Math.round(estimatedPrice * 100),
    };

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

      if (photos.length > 0) await uploadPhotos(booking.id);

      Alert.alert(
        'Booking Created',
        `Your booking ${booking.booking_number} has been submitted.\n\nEstimated total: $${estimatedPrice.toFixed(2)} + GST`,
        [
          { text: 'View Booking', onPress: () => router.replace(`/(customer)/booking/${booking.id}`) },
          { text: 'OK', onPress: () => router.push('/(customer)/bookings') },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create booking';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#1e3a5f" />
        <Text className="text-gray-500 mt-3">Loading booking form...</Text>
      </View>
    );
  }

  const routeItems = currentRoute?.prices ?? [];

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="flex-1 bg-gray-50" keyboardShouldPersistTaps="handled" contentContainerClassName="pb-10">
        <View className="p-4">
          <Text className="text-2xl font-bold text-gray-900 mb-1">New Booking</Text>
          <Text className="text-sm text-gray-500 mb-6">
            Fill in the details below to book a transport service.
          </Text>

          {/* Route */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Route</Text>
            <View className="gap-2">
              {ROUTE_KEYS.map((key) => {
                const r = RATE_SHEET[key];
                const isSelected = routeKey === key;
                return (
                  <Pressable
                    key={key}
                    className={`px-4 py-3 rounded-lg border ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-200'}`}
                    onPress={() => handleRouteChange(key)}
                    role="button"
                  >
                    <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Item & Product (rate card) */}
          {currentRoute && (
            <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
              <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Item & Product
              </Text>
              <View className="border border-gray-200 rounded-lg overflow-hidden">
                <View className="flex-row bg-gray-100 px-3 py-2">
                  <Text className="flex-1 text-xs font-semibold text-gray-600">ITEM</Text>
                  <Text className="w-24 text-xs font-semibold text-gray-600 text-center">PRODUCT</Text>
                  <Text className="w-20 text-xs font-semibold text-gray-600 text-right">RATE</Text>
                </View>
                {routeItems.map((entry, idx) => {
                  const isSelected = selectedItemIdx === idx;
                  return (
                    <Pressable
                      key={idx}
                      className={`flex-row px-3 py-3 border-t border-gray-100 ${isSelected ? 'bg-blue-50' : ''}`}
                      onPress={() => {
                        setSelectedItemIdx(idx);
                        setQuantity('1');
                        setWeightKg('');
                      }}
                      role="button"
                    >
                      <View className="flex-1 flex-row items-center">
                        <View className={`w-5 h-5 rounded-full border-2 mr-2 items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                          {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                        </View>
                        <Text className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {entry.item}
                        </Text>
                      </View>
                      <Text className="w-24 text-sm text-gray-600 text-center">{entry.product}</Text>
                      <Text className="w-20 text-sm font-semibold text-gray-900 text-right">
                        ${entry.rate.toFixed(2)}{entry.unit === 'per_kg' ? '/kg' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity / Weight */}
          {selectedPrice && (
            <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
              <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                {selectedPrice.unit === 'per_kg' ? 'Weight (kg)' : 'Quantity'}
              </Text>
              {selectedPrice.unit === 'per_kg' ? (
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-base text-gray-900"
                  placeholder="Enter weight in kg"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={weightKg}
                  onChangeText={setWeightKg}
                />
              ) : (
                <View className="flex-row items-center">
                  <Pressable
                    className="w-12 h-12 bg-gray-100 rounded-lg items-center justify-center border border-gray-200"
                    onPress={() => setQuantity(String(Math.max(1, (parseInt(quantity, 10) || 1) - 1)))}
                    role="button"
                  >
                    <Text className="text-xl font-bold text-gray-700">−</Text>
                  </Pressable>
                  <TextInput
                    className="w-20 mx-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-base text-gray-900 text-center"
                    keyboardType="numeric"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                  <Pressable
                    className="w-12 h-12 bg-gray-100 rounded-lg items-center justify-center border border-gray-200"
                    onPress={() => setQuantity(String((parseInt(quantity, 10) || 0) + 1))}
                    role="button"
                  >
                    <Text className="text-xl font-bold text-gray-700">+</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Pickup Time */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Pickup Time (AEST)
            </Text>
            <Text className="text-sm text-gray-600 mb-1">Date</Text>
            <Pressable
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 mb-3"
              onPress={() => setShowDatePicker(true)}
              role="button"
            >
              <Text className={pickupDate ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
                {pickupDate ? formatDateLabel(pickupDate) : 'Select pickup date'}
              </Text>
            </Pressable>
            <Text className="text-sm text-gray-600 mb-1">Time</Text>
            <Pressable
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3"
              onPress={() => setShowTimePicker(true)}
              role="button"
            >
              <Text className={pickupTime ? 'text-base text-gray-900' : 'text-base text-gray-400'}>
                {pickupTime || 'Select pickup time'}
              </Text>
            </Pressable>
          </View>

          {/* Addresses */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Addresses</Text>
            <Text className="text-sm text-gray-600 mb-1">Pickup Address</Text>
            <View style={{ zIndex: 2 }}>
              <PlacesAutocompleteInput
                placeholder="e.g. 123 Main St, Gold Coast QLD"
                onSelect={(address, lat, lng) => {
                  setPickupAddress(address);
                  setPickupCoords({ lat, lng });
                  if (errors.pickup_address) setErrors((p) => { const n = { ...p }; delete n.pickup_address; return n; });
                }}
                onTextChange={() => {
                  setPickupCoords(null);
                }}
                error={errors.pickup_address}
              />
            </View>
            <View style={{ height: 12 }} />
            <Text className="text-sm text-gray-600 mb-1">Dropoff Address</Text>
            <View style={{ zIndex: 1 }}>
              <PlacesAutocompleteInput
                placeholder="e.g. 456 George St, Sydney NSW"
                onSelect={(address, lat, lng) => {
                  setDropoffAddress(address);
                  setDropoffCoords({ lat, lng });
                  if (errors.dropoff_address) setErrors((p) => { const n = { ...p }; delete n.dropoff_address; return n; });
                }}
                onTextChange={() => {
                  setDropoffCoords(null);
                }}
                error={errors.dropoff_address}
              />
            </View>
          </View>

          {/* Dimensions & Weight */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Dimensions & Weight
            </Text>
            <Text className="text-sm text-gray-600 mb-1">Weight (kg)</Text>
            <TextInput
              className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 mb-3 ${errors.weight_kg ? 'border-red-400' : 'border-gray-200'}`}
              placeholder="e.g. 25"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={weightKgGeneral}
              onChangeText={(v) => updateField('weight_kg', v)}
            />
            {errors.weight_kg && <Text className="text-red-500 text-xs mb-2">{errors.weight_kg}</Text>}
            <Text className="text-sm text-gray-600 mb-1">Dimensions (cm) — Length × Width × Height</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <TextInput
                  className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 ${errors.length_cm ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="L"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={lengthCm}
                  onChangeText={(v) => updateField('length_cm', v)}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 ${errors.width_cm ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="W"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={widthCm}
                  onChangeText={(v) => updateField('width_cm', v)}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className={`bg-gray-50 border rounded-lg px-3 py-3 text-base text-gray-900 ${errors.height_cm ? 'border-red-400' : 'border-gray-200'}`}
                  placeholder="H"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={heightCm}
                  onChangeText={(v) => updateField('height_cm', v)}
                />
              </View>
            </View>
            {(errors.length_cm || errors.width_cm || errors.height_cm) && (
              <Text className="text-red-500 text-xs mt-1">{errors.length_cm || errors.width_cm || errors.height_cm}</Text>
            )}
          </View>

          {/* Special Instructions */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Special Instructions
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-base text-gray-900"
              placeholder="Any special handling, access codes, etc."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
            />
          </View>

          {/* Item Photos */}
          <View className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Item Photos</Text>
              <Text className="text-xs text-gray-400">{photos.length}/{MAX_ITEM_PHOTOS}</Text>
            </View>
            {photos.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image source={{ uri: photo.uri }} className="w-20 h-20 rounded-lg" resizeMode="cover" />
                    <Pressable
                      className="absolute -top-1.5 -right-1.5 bg-red-500 w-5 h-5 rounded-full items-center justify-center"
                      onPress={() => removePhoto(index)}
                      role="button"
                    >
                      <Text className="text-white text-xs font-bold">X</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {photos.length < MAX_ITEM_PHOTOS && (
              <View className="flex-row gap-3">
                <Pressable className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg py-3 items-center" onPress={pickPhotos} role="button">
                  <Text className="text-gray-600 text-sm font-medium">From Library</Text>
                </Pressable>
                <Pressable className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg py-3 items-center" onPress={takePhoto} role="button">
                  <Text className="text-gray-600 text-sm font-medium">Take Photo</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Estimated Price */}
          <View className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
            <Text className="text-sm font-semibold text-blue-800 mb-1 uppercase tracking-wide">
              Estimated Price
            </Text>
            {estimatedPrice !== null ? (
              <View>
                <View className="flex-row items-baseline">
                  <Text className="text-3xl font-bold text-blue-900">${estimatedPrice.toFixed(2)}</Text>
                  <Text className="text-sm text-blue-600 ml-2">+ GST</Text>
                </View>
                {selectedPrice && (
                  <Text className="text-xs text-blue-500 mt-1">
                    {selectedPrice.item} — {selectedPrice.product}
                    {selectedPrice.unit === 'per_kg' ? ` × ${weightKg}kg @ $${selectedPrice.rate.toFixed(2)}/kg` : parseInt(quantity, 10) > 1 ? ` × ${quantity} @ $${selectedPrice.rate.toFixed(2)} each` : ''}
                  </Text>
                )}
              </View>
            ) : (
              <Text className="text-sm text-blue-600">
                {routeKey ? 'Select an item and enter quantity to see pricing' : 'Select a route to see available pricing'}
              </Text>
            )}
            <Text className="text-xs text-blue-400 mt-2">All costs are exclusive of GST. Terms 7 days.</Text>
          </View>

          <TouchableOpacity
            className={`rounded-xl py-4 items-center justify-center shadow-sm ${
              loading ? 'bg-gray-400' : 'bg-blue-600 active:opacity-90'
            }`}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white font-semibold text-base ml-2">Creating Booking...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold text-base">Submit Booking</Text>
            )}
          </TouchableOpacity>

          <Text className="text-xs text-gray-400 text-center mt-3">
            You can cancel or edit up to 5:00 PM AEST the day before pickup.
          </Text>
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowDatePicker(false)}>
          <Pressable className="bg-white rounded-t-2xl max-h-96">
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">Select Date</Text>
              <Pressable onPress={() => setShowDatePicker(false)} role="button">
                <Text className="text-blue-600 font-semibold">Done</Text>
              </Pressable>
            </View>
            <ScrollView className="p-4" style={{ maxHeight: 320 }}>
              {availableDates.map((d, i) => {
                const isSelected = pickupDate?.toDateString() === d.toDateString();
                const isToday = i === 0;
                return (
                  <Pressable
                    key={i}
                    className={`px-4 py-3 rounded-lg mb-1 ${isSelected ? 'bg-blue-600' : ''}`}
                    onPress={() => { setPickupDate(d); setShowDatePicker(false); }}
                    role="button"
                  >
                    <Text className={`text-base ${isSelected ? 'text-white font-semibold' : 'text-gray-800'}`}>
                      {formatDateLabel(d)}{isToday ? ' (Today)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowTimePicker(false)}>
          <Pressable className="bg-white rounded-t-2xl max-h-96">
            <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">Select Time</Text>
              <Pressable onPress={() => setShowTimePicker(false)} role="button">
                <Text className="text-blue-600 font-semibold">Done</Text>
              </Pressable>
            </View>
            <ScrollView className="p-4" style={{ maxHeight: 320 }}>
              {TIME_SLOTS.map((slot) => {
                const isSelected = pickupTime === slot;
                return (
                  <Pressable
                    key={slot}
                    className={`px-4 py-3 rounded-lg mb-1 ${isSelected ? 'bg-blue-600' : ''}`}
                    onPress={() => { setPickupTime(slot); setShowTimePicker(false); }}
                    role="button"
                  >
                    <Text className={`text-base ${isSelected ? 'text-white font-semibold' : 'text-gray-800'}`}>{slot}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
