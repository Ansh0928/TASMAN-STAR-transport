import { z } from 'zod';

export const createBookingSchema = z.object({
  route_id: z.string().uuid(),
  pickup_address: z.string().min(1, 'Pickup address is required'),
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  dropoff_address: z.string().min(1, 'Dropoff address is required'),
  dropoff_lat: z.number().min(-90).max(90),
  dropoff_lng: z.number().min(-180).max(180),
  pickup_datetime: z.string().datetime({ offset: true }),
  dropoff_datetime: z.string().datetime({ offset: true }),
  item_type: z.string().min(1, 'Item type is required'),
  weight_kg: z.number().positive('Weight must be positive'),
  length_cm: z.number().positive('Length must be positive'),
  width_cm: z.number().positive('Width must be positive'),
  height_cm: z.number().positive('Height must be positive'),
  special_instructions: z.string().nullable().optional(),
  price_cents: z.number().int().nonnegative(),
}).refine(
  (data) => new Date(data.pickup_datetime) < new Date(data.dropoff_datetime),
  { message: 'Pickup datetime must be before dropoff datetime', path: ['dropoff_datetime'] }
);

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const updateBookingStatusSchema = z.object({
  booking_id: z.string().uuid(),
  status: z.enum(['pending', 'confirmed', 'en_route', 'at_pickup', 'in_transit', 'delivered', 'cancelled']),
  driver_id: z.string().uuid().optional(),
});

export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

export const assignDriverSchema = z.object({
  booking_id: z.string().uuid(),
  driver_id: z.string().uuid(),
});

export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
