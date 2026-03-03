import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';

const TASK_NAME = 'BACKGROUND_LOCATION_TASK';
const BROADCAST_INTERVAL = 10_000;
const DB_INSERT_INTERVAL = 30_000;

let currentBookingId: string | null = null;
let currentDriverId: string | null = null;
let lastDbInsert = 0;

TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (!data?.locations?.length || !currentBookingId || !currentDriverId) return;

  const location = data.locations[data.locations.length - 1];
  const { latitude, longitude, heading, speed } = location.coords;

  // Broadcast via Realtime (every update for live display)
  const channel = supabase.channel(`driver-location:${currentBookingId}`);
  await channel.send({
    type: 'broadcast',
    event: 'location',
    payload: {
      driver_id: currentDriverId,
      booking_id: currentBookingId,
      latitude,
      longitude,
      heading,
      speed,
      recorded_at: new Date().toISOString(),
    },
  });

  // Insert to database throttled (every 30s for audit trail)
  const now = Date.now();
  if (now - lastDbInsert >= DB_INSERT_INTERVAL) {
    lastDbInsert = now;
    await supabase.from('driver_locations').insert({
      driver_id: currentDriverId,
      booking_id: currentBookingId,
      latitude,
      longitude,
      heading,
      speed,
      recorded_at: new Date().toISOString(),
    });
  }
});

export async function startTracking(bookingId: string, driverId: string): Promise<boolean> {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') return false;

  currentBookingId = bookingId;
  currentDriverId = driverId;
  lastDbInsert = 0;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: BROADCAST_INTERVAL,
    distanceInterval: 10,
    deferredUpdatesInterval: BROADCAST_INTERVAL,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Tasman Transport',
      notificationBody: 'Tracking delivery location',
      notificationColor: '#2563eb',
    },
  });

  return true;
}

export async function stopTracking(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  currentBookingId = null;
  currentDriverId = null;
}

export async function isTracking(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(TASK_NAME);
}
