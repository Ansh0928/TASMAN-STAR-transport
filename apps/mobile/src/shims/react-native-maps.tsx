import React from 'react';
import { View, Text } from 'react-native';

const MapView = React.forwardRef<View, Record<string, unknown>>(
  ({ children, style, ...props }, ref) => (
    <View
      ref={ref}
      style={[
        {
          backgroundColor: '#e2e8f0',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
        },
        style as Record<string, unknown>,
      ]}
      {...props}
    >
      <Text style={{ color: '#64748b', fontSize: 14 }}>
        Map (native only – use a device or simulator)
      </Text>
      {children}
    </View>
  )
);
MapView.displayName = 'MapView';

const Marker = (_props: Record<string, unknown>) => null;
const Polyline = (_props: Record<string, unknown>) => null;
const PROVIDER_GOOGLE = 'google';

export default MapView;
export { Marker, Polyline, PROVIDER_GOOGLE };
