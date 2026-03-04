import { describe, it, expect } from 'vitest';
import { createBookingSchema, updateBookingStatusSchema, assignDriverSchema } from './booking';

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

const validBooking = {
  route_id: validUUID,
  pickup_address: '123 Gold Coast Hwy, Surfers Paradise QLD 4217',
  pickup_lat: -28.0023,
  pickup_lng: 153.4145,
  dropoff_address: '456 George St, Sydney NSW 2000',
  dropoff_lat: -33.8688,
  dropoff_lng: 151.2093,
  pickup_datetime: '2024-08-20T00:00:00Z',
  dropoff_datetime: '2024-08-21T10:00:00Z',
  item_type: 'Pallet',
  weight_kg: 500,
  length_cm: 120,
  width_cm: 100,
  height_cm: 150,
  price_cents: 45000,
};

describe('createBookingSchema', () => {
  it('accepts valid booking', () => {
    const result = createBookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it('accepts booking with special_instructions', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      special_instructions: 'Fragile, handle with care',
    });
    expect(result.success).toBe(true);
  });

  it('accepts booking with null special_instructions', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      special_instructions: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts booking without special_instructions field', () => {
    const result = createBookingSchema.safeParse(validBooking);
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID for route_id', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      route_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty pickup address', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_address: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty dropoff address', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      dropoff_address: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects latitude out of range (< -90)', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lat: -91,
    });
    expect(result.success).toBe(false);
  });

  it('rejects latitude out of range (> 90)', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lat: 91,
    });
    expect(result.success).toBe(false);
  });

  it('rejects longitude out of range (< -180)', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lng: -181,
    });
    expect(result.success).toBe(false);
  });

  it('rejects longitude out of range (> 180)', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lng: 181,
    });
    expect(result.success).toBe(false);
  });

  it('accepts boundary latitude values (-90 and 90)', () => {
    const result1 = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lat: -90,
    });
    const result2 = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lat: 90,
    });
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });

  it('accepts boundary longitude values (-180 and 180)', () => {
    const result1 = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lng: -180,
    });
    const result2 = createBookingSchema.safeParse({
      ...validBooking,
      pickup_lng: 180,
    });
    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });

  it('rejects non-ISO datetime for pickup_datetime', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_datetime: '2024-08-20 00:00:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO datetime for dropoff_datetime', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      dropoff_datetime: 'tomorrow',
    });
    expect(result.success).toBe(false);
  });

  it('rejects pickup_datetime after dropoff_datetime', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_datetime: '2024-08-22T00:00:00Z',
      dropoff_datetime: '2024-08-21T10:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('dropoff_datetime');
    }
  });

  it('rejects equal pickup and dropoff datetimes', () => {
    const same = '2024-08-21T10:00:00Z';
    const result = createBookingSchema.safeParse({
      ...validBooking,
      pickup_datetime: same,
      dropoff_datetime: same,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero weight', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      weight_kg: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative weight', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      weight_kg: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero dimensions', () => {
    for (const dim of ['length_cm', 'width_cm', 'height_cm']) {
      const result = createBookingSchema.safeParse({
        ...validBooking,
        [dim]: 0,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects negative price', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      price_cents: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero price', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      price_cents: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-integer price', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      price_cents: 100.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty item type', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      item_type: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = createBookingSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('stress: accepts very small positive dimensions', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      weight_kg: 0.001,
      length_cm: 0.001,
      width_cm: 0.001,
      height_cm: 0.001,
    });
    expect(result.success).toBe(true);
  });

  it('stress: accepts very large dimensions', () => {
    const result = createBookingSchema.safeParse({
      ...validBooking,
      weight_kg: 999999,
      length_cm: 999999,
      width_cm: 999999,
      height_cm: 999999,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateBookingStatusSchema', () => {
  it('accepts valid status update', () => {
    const result = updateBookingStatusSchema.safeParse({
      booking_id: validUUID,
      status: 'confirmed',
    });
    expect(result.success).toBe(true);
  });

  it('accepts status update with driver_id', () => {
    const result = updateBookingStatusSchema.safeParse({
      booking_id: validUUID,
      status: 'en_route',
      driver_id: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid status values', () => {
    const statuses = ['pending', 'confirmed', 'en_route', 'at_pickup', 'in_transit', 'delivered', 'cancelled'];
    for (const status of statuses) {
      const result = updateBookingStatusSchema.safeParse({
        booking_id: validUUID,
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status value', () => {
    const result = updateBookingStatusSchema.safeParse({
      booking_id: validUUID,
      status: 'unknown_status',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid booking_id', () => {
    const result = updateBookingStatusSchema.safeParse({
      booking_id: 'not-uuid',
      status: 'confirmed',
    });
    expect(result.success).toBe(false);
  });
});

describe('assignDriverSchema', () => {
  it('accepts valid assignment', () => {
    const result = assignDriverSchema.safeParse({
      booking_id: validUUID,
      driver_id: validUUID,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid booking_id', () => {
    const result = assignDriverSchema.safeParse({
      booking_id: 'bad',
      driver_id: validUUID,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid driver_id', () => {
    const result = assignDriverSchema.safeParse({
      booking_id: validUUID,
      driver_id: 'bad',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = assignDriverSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
