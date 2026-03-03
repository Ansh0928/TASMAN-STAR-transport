export const TIMEZONE = 'Australia/Brisbane';

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  EN_ROUTE: 'en_route',
  AT_PICKUP: 'at_pickup',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const BOOKING_STATUS_FLOW: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['en_route', 'cancelled'],
  en_route: ['at_pickup'],
  at_pickup: ['in_transit'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const PHOTO_TYPES = {
  ITEM: 'item',
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
} as const;

export type PhotoType = (typeof PHOTO_TYPES)[keyof typeof PHOTO_TYPES];

export const SIGNATURE_TYPES = {
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
} as const;

export type SignatureType = (typeof SIGNATURE_TYPES)[keyof typeof SIGNATURE_TYPES];

export const CUTOFF_HOUR = 17; // 5pm AEST cutoff for edits/cancellations

export const MAX_ITEM_PHOTOS = 5;

export const GPS_BROADCAST_INTERVAL_MS = 10_000; // 10 seconds
export const GPS_DB_THROTTLE_INTERVAL_MS = 30_000; // 30 seconds
