import { describe, it, expect } from 'vitest';
import {
  TIMEZONE,
  BOOKING_STATUS,
  BOOKING_STATUS_FLOW,
  ROLES,
  PHOTO_TYPES,
  SIGNATURE_TYPES,
  CUTOFF_HOUR,
  MAX_ITEM_PHOTOS,
  GPS_BROADCAST_INTERVAL_MS,
  GPS_DB_THROTTLE_INTERVAL_MS,
} from './index';

describe('Constants integrity', () => {
  it('TIMEZONE is Australia/Brisbane', () => {
    expect(TIMEZONE).toBe('Australia/Brisbane');
  });

  it('CUTOFF_HOUR is 17 (5pm)', () => {
    expect(CUTOFF_HOUR).toBe(17);
  });

  it('MAX_ITEM_PHOTOS is 5', () => {
    expect(MAX_ITEM_PHOTOS).toBe(5);
  });

  it('GPS intervals are reasonable', () => {
    expect(GPS_BROADCAST_INTERVAL_MS).toBe(10_000);
    expect(GPS_DB_THROTTLE_INTERVAL_MS).toBe(30_000);
    expect(GPS_DB_THROTTLE_INTERVAL_MS).toBeGreaterThan(GPS_BROADCAST_INTERVAL_MS);
  });
});

describe('BOOKING_STATUS', () => {
  it('has exactly 7 statuses', () => {
    expect(Object.keys(BOOKING_STATUS)).toHaveLength(7);
  });

  it('contains all expected statuses', () => {
    expect(BOOKING_STATUS.PENDING).toBe('pending');
    expect(BOOKING_STATUS.CONFIRMED).toBe('confirmed');
    expect(BOOKING_STATUS.EN_ROUTE).toBe('en_route');
    expect(BOOKING_STATUS.AT_PICKUP).toBe('at_pickup');
    expect(BOOKING_STATUS.IN_TRANSIT).toBe('in_transit');
    expect(BOOKING_STATUS.DELIVERED).toBe('delivered');
    expect(BOOKING_STATUS.CANCELLED).toBe('cancelled');
  });
});

describe('BOOKING_STATUS_FLOW', () => {
  it('has an entry for every status', () => {
    const statuses = Object.values(BOOKING_STATUS);
    for (const status of statuses) {
      expect(BOOKING_STATUS_FLOW).toHaveProperty(status);
    }
  });

  it('all transition targets are valid statuses', () => {
    const validStatuses = new Set(Object.values(BOOKING_STATUS));
    for (const targets of Object.values(BOOKING_STATUS_FLOW)) {
      for (const target of targets) {
        expect(validStatuses.has(target)).toBe(true);
      }
    }
  });

  it('terminal states (delivered, cancelled) have no transitions', () => {
    expect(BOOKING_STATUS_FLOW.delivered).toHaveLength(0);
    expect(BOOKING_STATUS_FLOW.cancelled).toHaveLength(0);
  });

  it('happy path exists: pending → confirmed → en_route → at_pickup → in_transit → delivered', () => {
    expect(BOOKING_STATUS_FLOW.pending).toContain('confirmed');
    expect(BOOKING_STATUS_FLOW.confirmed).toContain('en_route');
    expect(BOOKING_STATUS_FLOW.en_route).toContain('at_pickup');
    expect(BOOKING_STATUS_FLOW.at_pickup).toContain('in_transit');
    expect(BOOKING_STATUS_FLOW.in_transit).toContain('delivered');
  });

  it('cancellation is only allowed from pending and confirmed', () => {
    const statuses = Object.values(BOOKING_STATUS);
    const canCancel = statuses.filter(s => BOOKING_STATUS_FLOW[s].includes('cancelled'));
    expect(canCancel).toEqual(expect.arrayContaining(['pending', 'confirmed']));
    expect(canCancel).toHaveLength(2);
  });

  it('no status transitions to itself', () => {
    for (const [status, targets] of Object.entries(BOOKING_STATUS_FLOW)) {
      expect(targets).not.toContain(status);
    }
  });
});

describe('ROLES', () => {
  it('has exactly 3 roles', () => {
    expect(Object.keys(ROLES)).toHaveLength(3);
  });

  it('contains customer, driver, admin', () => {
    expect(ROLES.CUSTOMER).toBe('customer');
    expect(ROLES.DRIVER).toBe('driver');
    expect(ROLES.ADMIN).toBe('admin');
  });
});

describe('PHOTO_TYPES', () => {
  it('has item, pickup, delivery', () => {
    expect(PHOTO_TYPES.ITEM).toBe('item');
    expect(PHOTO_TYPES.PICKUP).toBe('pickup');
    expect(PHOTO_TYPES.DELIVERY).toBe('delivery');
  });
});

describe('SIGNATURE_TYPES', () => {
  it('has pickup and delivery', () => {
    expect(SIGNATURE_TYPES.PICKUP).toBe('pickup');
    expect(SIGNATURE_TYPES.DELIVERY).toBe('delivery');
  });
});
