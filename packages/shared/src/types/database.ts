export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'customer' | 'driver' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  origin: string;
  destination: string;
  is_active: boolean;
  created_at: string;
}

export interface Pricing {
  id: string;
  route_id: string;
  item_type: string;
  price_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  customer_id: string;
  driver_id: string | null;
  route_id: string;
  status: 'pending' | 'confirmed' | 'en_route' | 'at_pickup' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_datetime: string;
  dropoff_datetime: string;
  item_type: string;
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  special_instructions: string | null;
  price_cents: number;
  created_at: string;
  updated_at: string;
}

export interface BookingPhoto {
  id: string;
  booking_id: string;
  photo_type: 'item' | 'pickup' | 'delivery';
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface BookingSignature {
  id: string;
  booking_id: string;
  signature_type: 'pickup' | 'delivery';
  storage_path: string;
  signed_by: string;
  created_at: string;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  booking_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  booking_id: string;
  recipient_email: string;
  notification_type: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>> };
      routes: { Row: Route; Insert: Omit<Route, 'id' | 'created_at'>; Update: Partial<Omit<Route, 'id' | 'created_at'>> };
      pricing: { Row: Pricing; Insert: Omit<Pricing, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Pricing, 'id' | 'created_at' | 'updated_at'>> };
      bookings: { Row: Booking; Insert: Omit<Booking, 'id' | 'booking_number' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Booking, 'id' | 'booking_number' | 'created_at' | 'updated_at'>> };
      booking_photos: { Row: BookingPhoto; Insert: Omit<BookingPhoto, 'id' | 'created_at'>; Update: Partial<Omit<BookingPhoto, 'id' | 'created_at'>> };
      booking_signatures: { Row: BookingSignature; Insert: Omit<BookingSignature, 'id' | 'created_at'>; Update: Partial<Omit<BookingSignature, 'id' | 'created_at'>> };
      driver_locations: { Row: DriverLocation; Insert: Omit<DriverLocation, 'id' | 'created_at'>; Update: Partial<Omit<DriverLocation, 'id' | 'created_at'>> };
      notifications_log: { Row: NotificationLog; Insert: Omit<NotificationLog, 'id' | 'created_at'>; Update: Partial<Omit<NotificationLog, 'id' | 'created_at'>> };
    };
  };
}
