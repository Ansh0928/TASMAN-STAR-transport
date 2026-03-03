'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Booking, Profile } from '@tasman-transport/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriverLocationPayload {
  driver_id: string;
  booking_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
}

interface ActiveDelivery {
  booking: Booking;
  driver: Profile | null;
  location: DriverLocationPayload | null;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; markerBg: string; markerGlyph: string }
> = {
  en_route: {
    label: 'En Route',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    markerBg: '#2563eb',
    markerGlyph: '#ffffff',
  },
  at_pickup: {
    label: 'At Pickup',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    markerBg: '#7c3aed',
    markerGlyph: '#ffffff',
  },
  in_transit: {
    label: 'In Transit',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    markerBg: '#ea580c',
    markerGlyph: '#ffffff',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function driverInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrackingPage() {
  const supabase = createBrowserClient();
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [infoWindowBookingId, setInfoWindowBookingId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: -41.45,
    lng: 145.97,
  });
  const [mapZoom, setMapZoom] = useState(8);
  const channelRefs = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const [, setTick] = useState(0);

  // Force re-render every 15s so "time ago" labels stay fresh
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // ---------- Fetch active bookings ----------
  const fetchActiveDeliveries = useCallback(async () => {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .in('status', ['en_route', 'at_pickup', 'in_transit'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch active bookings:', error);
      setLoading(false);
      return;
    }

    if (!bookings || bookings.length === 0) {
      setDeliveries([]);
      setLoading(false);
      return;
    }

    // Get unique driver IDs
    const driverIds = [
      ...new Set(
        bookings.filter((b) => b.driver_id).map((b) => b.driver_id as string)
      ),
    ];

    let driverMap: Record<string, Profile> = {};
    if (driverIds.length > 0) {
      const { data: drivers } = await supabase
        .from('profiles')
        .select('*')
        .in('id', driverIds);

      if (drivers) {
        driverMap = Object.fromEntries(
          drivers.map((d) => [d.id, d as Profile])
        );
      }
    }

    // Get last known locations from DB for each booking
    const locationMap: Record<string, DriverLocationPayload> = {};
    for (const b of bookings) {
      const { data: loc } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('booking_id', b.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loc) {
        locationMap[b.id] = {
          driver_id: loc.driver_id,
          booking_id: loc.booking_id,
          latitude: loc.latitude,
          longitude: loc.longitude,
          heading: loc.heading,
          speed: loc.speed,
          recorded_at: loc.recorded_at,
        };
      }
    }

    const activeDeliveries: ActiveDelivery[] = bookings.map((b) => ({
      booking: b as Booking,
      driver: b.driver_id ? driverMap[b.driver_id] ?? null : null,
      location: locationMap[b.id] ?? null,
    }));

    setDeliveries(activeDeliveries);
    setLoading(false);

    // Center map on first delivery with a location
    const withLocation = activeDeliveries.find((d) => d.location);
    if (withLocation?.location) {
      setMapCenter({
        lat: withLocation.location.latitude,
        lng: withLocation.location.longitude,
      });
      setMapZoom(10);
    }

    return activeDeliveries;
  }, [supabase]);

  // ---------- Subscribe to realtime channels ----------
  const subscribeToLocations = useCallback(
    (activeDeliveries: ActiveDelivery[]) => {
      // Clean up old channels
      channelRefs.current.forEach((ch) => supabase.removeChannel(ch));
      channelRefs.current = [];

      for (const delivery of activeDeliveries) {
        const channel = supabase
          .channel(`admin-driver-location:${delivery.booking.id}`)
          .on('broadcast', { event: 'location' }, (payload) => {
            const loc = payload.payload as DriverLocationPayload;
            setDeliveries((prev) =>
              prev.map((d) =>
                d.booking.id === loc.booking_id
                  ? { ...d, location: loc }
                  : d
              )
            );
          })
          .subscribe();

        channelRefs.current.push(channel);
      }

      // Also subscribe to booking status changes to detect status transitions
      const bookingChannel = supabase
        .channel('admin-active-bookings')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bookings',
          },
          (payload) => {
            const updated = payload.new as Booking;
            const activeStatuses = ['en_route', 'at_pickup', 'in_transit'];

            setDeliveries((prev) => {
              // If booking is now active, update it
              if (activeStatuses.includes(updated.status)) {
                const exists = prev.find((d) => d.booking.id === updated.id);
                if (exists) {
                  return prev.map((d) =>
                    d.booking.id === updated.id
                      ? { ...d, booking: updated }
                      : d
                  );
                }
                // New active booking -- re-fetch
                fetchActiveDeliveries();
                return prev;
              }

              // If booking is no longer active, remove it
              return prev.filter((d) => d.booking.id !== updated.id);
            });
          }
        )
        .subscribe();

      channelRefs.current.push(bookingChannel);
    },
    [supabase, fetchActiveDeliveries]
  );

  // ---------- Initial load ----------
  useEffect(() => {
    (async () => {
      const result = await fetchActiveDeliveries();
      if (result) {
        subscribeToLocations(result);
      }
    })();

    return () => {
      channelRefs.current.forEach((ch) => supabase.removeChannel(ch));
      channelRefs.current = [];
    };
  }, []);

  // ---------- Handle sidebar click ----------
  function handleSelectDelivery(bookingId: string) {
    setSelectedBookingId(bookingId);
    const delivery = deliveries.find((d) => d.booking.id === bookingId);
    if (delivery?.location) {
      setMapCenter({
        lat: delivery.location.latitude,
        lng: delivery.location.longitude,
      });
      setMapZoom(14);
    } else {
      // Fall back to pickup coordinates
      if (delivery) {
        setMapCenter({
          lat: delivery.booking.pickup_lat,
          lng: delivery.booking.pickup_lng,
        });
        setMapZoom(12);
      }
    }
  }

  // ---------- Google Maps API key ----------
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  // ---------- Render ----------
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {deliveries.length} active{' '}
            {deliveries.length === 1 ? 'delivery' : 'deliveries'}
          </p>
        </div>
        <button
          onClick={() => fetchActiveDeliveries()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* ===== SIDEBAR ===== */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Active Deliveries
            </h2>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading...</p>
              </div>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">
                  No active deliveries
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Deliveries will appear here when drivers are en route.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {deliveries.map((delivery) => {
                const statusCfg =
                  STATUS_CONFIG[delivery.booking.status] ?? STATUS_CONFIG.en_route;
                const isSelected =
                  selectedBookingId === delivery.booking.id;

                return (
                  <button
                    key={delivery.booking.id}
                    onClick={() => handleSelectDelivery(delivery.booking.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                      isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                    }`}
                  >
                    {/* Booking number + status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-900">
                        {delivery.booking.booking_number}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Driver name */}
                    <div className="flex items-center gap-2 mb-1">
                      {delivery.driver ? (
                        <>
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ backgroundColor: statusCfg.markerBg }}
                          >
                            {driverInitials(delivery.driver.full_name)}
                          </div>
                          <span className="text-sm text-gray-700 truncate">
                            {delivery.driver.full_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          No driver assigned
                        </span>
                      )}
                    </div>

                    {/* Route summary */}
                    <p className="text-xs text-gray-500 truncate">
                      {delivery.booking.pickup_address.split(',')[0]} {' -> '}{' '}
                      {delivery.booking.dropoff_address.split(',')[0]}
                    </p>

                    {/* Last update */}
                    {delivery.location && (
                      <p className="text-xs text-gray-400 mt-1">
                        Updated {timeAgo(delivery.location.recorded_at)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== MAP ===== */}
        <div className="flex-1 bg-white rounded-xl border overflow-hidden">
          {!googleMapsApiKey ? (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="text-center max-w-md p-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Google Maps API Key Required
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Add{' '}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                  </code>{' '}
                  to your environment variables to enable live map tracking.
                </p>

                {/* Fallback: show a list view of driver positions */}
                {deliveries.length > 0 && (
                  <div className="mt-4 border rounded-lg divide-y text-left">
                    {deliveries
                      .filter((d) => d.location)
                      .map((d) => (
                        <div
                          key={d.booking.id}
                          className="px-3 py-2 text-xs"
                        >
                          <span className="font-medium text-gray-900">
                            {d.driver?.full_name ?? 'Unknown'}
                          </span>
                          <span className="text-gray-400 ml-2">
                            ({d.location!.latitude.toFixed(4)},{' '}
                            {d.location!.longitude.toFixed(4)})
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <APIProvider apiKey={googleMapsApiKey}>
              <Map
                mapId="admin-tracking-map"
                center={mapCenter}
                zoom={mapZoom}
                gestureHandling="greedy"
                disableDefaultUI={false}
                className="w-full h-full"
                onCenterChanged={(e) => {
                  if (e.detail.center) {
                    setMapCenter({
                      lat: e.detail.center.lat,
                      lng: e.detail.center.lng,
                    });
                  }
                }}
                onZoomChanged={(e) => {
                  if (e.detail.zoom) {
                    setMapZoom(e.detail.zoom);
                  }
                }}
              >
                {deliveries.map((delivery) => {
                  if (!delivery.location) return null;

                  const statusCfg =
                    STATUS_CONFIG[delivery.booking.status] ??
                    STATUS_CONFIG.en_route;
                  const isSelected =
                    selectedBookingId === delivery.booking.id;

                  return (
                    <React.Fragment key={delivery.booking.id}>
                      <AdvancedMarker
                        position={{
                          lat: delivery.location.latitude,
                          lng: delivery.location.longitude,
                        }}
                        title={
                          delivery.driver?.full_name ??
                          delivery.booking.booking_number
                        }
                        onClick={() => {
                          setInfoWindowBookingId(
                            infoWindowBookingId === delivery.booking.id
                              ? null
                              : delivery.booking.id
                          );
                          setSelectedBookingId(delivery.booking.id);
                        }}
                      >
                        <Pin
                          background={statusCfg.markerBg}
                          borderColor={isSelected ? '#000000' : statusCfg.markerBg}
                          glyphColor={statusCfg.markerGlyph}
                          scale={isSelected ? 1.3 : 1.0}
                        />
                      </AdvancedMarker>

                      {infoWindowBookingId === delivery.booking.id && (
                        <InfoWindow
                          position={{
                            lat: delivery.location.latitude,
                            lng: delivery.location.longitude,
                          }}
                          onCloseClick={() => setInfoWindowBookingId(null)}
                          pixelOffset={[0, -40]}
                        >
                          <div className="p-1 min-w-[180px]">
                            <p className="font-semibold text-sm text-gray-900 mb-1">
                              {delivery.driver?.full_name ?? 'Unknown Driver'}
                            </p>
                            <p className="text-xs text-gray-500 mb-1">
                              {delivery.booking.booking_number}
                            </p>
                            <span
                              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}
                            >
                              {statusCfg.label}
                            </span>
                            <div className="mt-2 text-xs text-gray-500">
                              <p className="truncate">
                                From: {delivery.booking.pickup_address.split(',')[0]}
                              </p>
                              <p className="truncate">
                                To: {delivery.booking.dropoff_address.split(',')[0]}
                              </p>
                            </div>
                            {delivery.location && (
                              <p className="text-xs text-gray-400 mt-1">
                                Updated{' '}
                                {timeAgo(delivery.location.recorded_at)}
                              </p>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </React.Fragment>
                  );
                })}
              </Map>
            </APIProvider>
          )}
        </div>
      </div>
    </div>
  );
}
