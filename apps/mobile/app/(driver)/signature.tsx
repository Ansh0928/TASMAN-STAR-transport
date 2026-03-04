import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SignaturePad, type SignaturePadRef } from '../../src/components/SignaturePad';

export default function SignatureScreen() {
  const router = useRouter();
  const { bookingId, signatureType } = useLocalSearchParams<{
    bookingId: string;
    signatureType: 'pickup' | 'delivery';
  }>();
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [capturing, setCapturing] = useState(false);

  // Guard against missing params
  if (!bookingId || !signatureType) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-4">
        <Text className="text-red-500 text-base text-center mb-4">
          Missing booking information. Please go back and try again.
        </Text>
        <TouchableOpacity
          className="bg-[#1e3a5f] rounded-xl px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  const handleConfirm = () => {
    setCapturing(true);
    signaturePadRef.current?.getSignature();
  };

  const handleSignature = (base64: string) => {
    setCapturing(false);

    if (!base64) {
      Alert.alert('No Signature', 'Please draw a signature before confirming.');
      return;
    }

    // Store signature in global state for the job detail screen to read on focus
    global.__signatureResult = {
      bookingId: bookingId as string,
      signatureType: signatureType as string,
      base64,
    };

    router.back();
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-[#1e3a5f] px-4 pt-14 pb-4">
        <Text className="text-white text-xl font-bold">
          {signatureType === 'pickup' ? 'Pickup' : 'Delivery'} Signature
        </Text>
        <Text className="text-blue-200 text-sm mt-1">
          Ask the customer to sign below
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 p-4 justify-center">
        <Text className="text-gray-600 text-sm mb-3 text-center">
          Please sign in the box below to confirm {signatureType === 'pickup' ? 'pickup' : 'delivery'} of items
        </Text>

        <SignaturePad
          ref={signaturePadRef}
          onSignature={handleSignature}
          penColor="#1e3a5f"
          strokeWidth={3}
        />

        {/* Buttons */}
        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity
            className="flex-1 bg-gray-100 rounded-xl py-4 items-center border border-gray-200"
            onPress={handleClear}
          >
            <Text className="text-gray-700 font-semibold text-base">Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-[#1e3a5f] rounded-xl py-4 items-center"
            onPress={handleConfirm}
            disabled={capturing}
          >
            <Text className="text-white font-semibold text-base">
              {capturing ? 'Capturing...' : 'Confirm Signature'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="mt-4 py-3 items-center"
          onPress={() => router.back()}
        >
          <Text className="text-gray-400 text-sm">Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
