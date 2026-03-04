import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCutoffDateTime, canEditOrCancel, canTransitionTo, isValidPickupDropoff } from './booking-rules';
import { BOOKING_STATUS, BOOKING_STATUS_FLOW, type BookingStatus } from '../constants';

describe('getCutoffDateTime', () => {
  it('returns 5pm AEST the day before pickup', () => {
    // Pickup at 2024-06-20 09:00 AEST = 2024-06-19 23:00 UTC
    const pickup = new Date('2024-06-19T23:00:00.000Z');
    const cutoff = getCutoffDateTime(pickup);
    expect(cutoff.getHours()).toBe(17);
    expect(cutoff.getMinutes()).toBe(0);
    expect(cutoff.getSeconds()).toBe(0);
  });

  it('handles pickup on Jan 1 (cutoff on Dec 31 previous year)', () => {
    // Pickup at 2025-01-01 09:00 AEST = 2024-12-31 23:00 UTC
    const pickup = new Date('2024-12-31T23:00:00.000Z');
    const cutoff = getCutoffDateTime(pickup);
    expect(cutoff.getDate()).toBe(31);
    expect(cutoff.getMonth()).toBe(11); // December
    expect(cutoff.getHours()).toBe(17);
  });

  it('accepts ISO string input', () => {
    const cutoff = getCutoffDateTime('2024-06-19T23:00:00.000Z');
    expect(cutoff.getHours()).toBe(17);
    expect(cutoff.getMinutes()).toBe(0);
  });

  it('cutoff date is exactly 1 day before pickup date in AEST', () => {
    // Pickup at June 20 10:00 AEST = June 20 00:00 UTC
    const pickup = new Date('2024-06-20T00:00:00.000Z');
    const cutoff = getCutoffDateTime(pickup);
    // pickup in AEST is June 20 10:00, cutoff should be June 19 17:00
    expect(cutoff.getDate()).toBe(19);
    expect(cutoff.getHours()).toBe(17);
  });
});

describe('canEditOrCancel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when now is well before cutoff', () => {
    // Set "now" to 2024-06-18 10:00 AEST = 2024-06-18 00:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-18T00:00:00.000Z'));

    // Pickup at 2024-06-20 10:00 AEST = 2024-06-20 00:00 UTC
    // Cutoff = 2024-06-19 17:00 AEST
    const result = canEditOrCancel('2024-06-20T00:00:00.000Z');
    expect(result).toBe(true);
  });

  it('returns false when now is after cutoff', () => {
    // Set "now" to 2024-06-19 18:00 AEST = 2024-06-19 08:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-19T08:00:00.000Z'));

    // Pickup at 2024-06-20 10:00 AEST = 2024-06-20 00:00 UTC
    // Cutoff = 2024-06-19 17:00 AEST
    const result = canEditOrCancel('2024-06-20T00:00:00.000Z');
    expect(result).toBe(false);
  });

  it('returns false at exactly the cutoff time', () => {
    // Set "now" to exactly 2024-06-19 17:00 AEST = 2024-06-19 07:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-19T07:00:00.000Z'));

    const result = canEditOrCancel('2024-06-20T00:00:00.000Z');
    // isBefore returns false when dates are equal
    expect(result).toBe(false);
  });

  it('returns true 1 minute before cutoff', () => {
    // 16:59 AEST = 06:59 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-19T06:59:00.000Z'));

    const result = canEditOrCancel('2024-06-20T00:00:00.000Z');
    expect(result).toBe(true);
  });
});

describe('canTransitionTo', () => {
  it('allows pending → confirmed', () => {
    expect(canTransitionTo('pending', 'confirmed')).toBe(true);
  });

  it('allows pending → cancelled', () => {
    expect(canTransitionTo('pending', 'cancelled')).toBe(true);
  });

  it('allows confirmed → en_route', () => {
    expect(canTransitionTo('confirmed', 'en_route')).toBe(true);
  });

  it('allows confirmed → cancelled', () => {
    expect(canTransitionTo('confirmed', 'cancelled')).toBe(true);
  });

  it('allows en_route → at_pickup', () => {
    expect(canTransitionTo('en_route', 'at_pickup')).toBe(true);
  });

  it('allows at_pickup → in_transit', () => {
    expect(canTransitionTo('at_pickup', 'in_transit')).toBe(true);
  });

  it('allows in_transit → delivered', () => {
    expect(canTransitionTo('in_transit', 'delivered')).toBe(true);
  });

  it('rejects delivered → any status', () => {
    const allStatuses = Object.values(BOOKING_STATUS);
    for (const status of allStatuses) {
      expect(canTransitionTo('delivered', status)).toBe(false);
    }
  });

  it('rejects cancelled → any status', () => {
    const allStatuses = Object.values(BOOKING_STATUS);
    for (const status of allStatuses) {
      expect(canTransitionTo('cancelled', status)).toBe(false);
    }
  });

  it('rejects backward transitions (delivered → pending)', () => {
    expect(canTransitionTo('delivered', 'pending')).toBe(false);
  });

  it('rejects skipping states (pending → in_transit)', () => {
    expect(canTransitionTo('pending', 'in_transit')).toBe(false);
  });

  it('rejects en_route → cancelled (cannot cancel once en route)', () => {
    expect(canTransitionTo('en_route', 'cancelled')).toBe(false);
  });

  it('rejects at_pickup → cancelled', () => {
    expect(canTransitionTo('at_pickup', 'cancelled')).toBe(false);
  });

  it('rejects in_transit → cancelled', () => {
    expect(canTransitionTo('in_transit', 'cancelled')).toBe(false);
  });

  it('rejects self-transitions (same status)', () => {
    const allStatuses = Object.values(BOOKING_STATUS);
    for (const status of allStatuses) {
      expect(canTransitionTo(status, status)).toBe(false);
    }
  });

  it('stress test: every valid transition in BOOKING_STATUS_FLOW works', () => {
    for (const [from, toList] of Object.entries(BOOKING_STATUS_FLOW)) {
      for (const to of toList) {
        expect(canTransitionTo(from as BookingStatus, to)).toBe(true);
      }
    }
  });

  it('stress test: no invalid transitions pass', () => {
    const allStatuses = Object.values(BOOKING_STATUS);
    for (const from of allStatuses) {
      const allowed = BOOKING_STATUS_FLOW[from];
      for (const to of allStatuses) {
        if (!allowed.includes(to)) {
          expect(canTransitionTo(from, to)).toBe(false);
        }
      }
    }
  });
});

describe('isValidPickupDropoff', () => {
  it('returns true when pickup is before dropoff', () => {
    const pickup = new Date('2024-06-20T00:00:00Z');
    const dropoff = new Date('2024-06-21T00:00:00Z');
    expect(isValidPickupDropoff(pickup, dropoff)).toBe(true);
  });

  it('returns false when pickup equals dropoff', () => {
    const date = new Date('2024-06-20T00:00:00Z');
    expect(isValidPickupDropoff(date, date)).toBe(false);
  });

  it('returns false when pickup is after dropoff', () => {
    const pickup = new Date('2024-06-21T00:00:00Z');
    const dropoff = new Date('2024-06-20T00:00:00Z');
    expect(isValidPickupDropoff(pickup, dropoff)).toBe(false);
  });

  it('returns true for 1 millisecond difference', () => {
    const pickup = new Date('2024-06-20T00:00:00.000Z');
    const dropoff = new Date('2024-06-20T00:00:00.001Z');
    expect(isValidPickupDropoff(pickup, dropoff)).toBe(true);
  });

  it('handles large time span (months apart)', () => {
    const pickup = new Date('2024-01-01T00:00:00Z');
    const dropoff = new Date('2024-12-31T23:59:59Z');
    expect(isValidPickupDropoff(pickup, dropoff)).toBe(true);
  });
});
