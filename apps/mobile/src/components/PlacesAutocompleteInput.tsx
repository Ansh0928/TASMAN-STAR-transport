import React, { useRef } from 'react';
import { View, Text } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface PlacesAutocompleteInputProps {
  placeholder: string;
  onSelect: (address: string, lat: number, lng: number) => void;
  onTextChange?: (text: string) => void;
  error?: string;
}

export default function PlacesAutocompleteInput({
  placeholder,
  onSelect,
  onTextChange,
  error,
}: PlacesAutocompleteInputProps) {
  const ref = useRef<any>(null);

  return (
    <View>
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder}
        fetchDetails
        minLength={3}
        debounce={300}
        onPress={(data, details) => {
          const address = data.description;
          const lat = details?.geometry?.location?.lat ?? 0;
          const lng = details?.geometry?.location?.lng ?? 0;
          onSelect(address, lat, lng);
        }}
        textInputProps={{
          onChangeText: (text: string) => {
            onTextChange?.(text);
          },
        }}
        query={{
          key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          language: 'en',
          components: 'country:au',
        }}
        styles={{
          textInput: {
            backgroundColor: '#f9fafb',
            borderWidth: 1,
            borderColor: error ? '#f87171' : '#e5e7eb',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 12,
            fontSize: 16,
            color: '#111827',
          },
          listView: {
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 8,
            marginTop: 2,
          },
          row: {
            backgroundColor: '#ffffff',
            paddingVertical: 12,
            paddingHorizontal: 12,
          },
          separator: {
            height: 1,
            backgroundColor: '#f3f4f6',
          },
          description: {
            fontSize: 14,
            color: '#374151',
          },
          poweredContainer: {
            display: 'none',
          },
        }}
        enablePoweredByContainer={false}
      />
      {error ? <Text className="text-red-500 text-xs mt-1">{error}</Text> : null}
    </View>
  );
}
