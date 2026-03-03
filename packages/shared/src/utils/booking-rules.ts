import { setHours, setMinutes, setSeconds, subDays, isBefore } from 'date-fns';
import { CUTOFF_HOUR, BOOKING_STATUS_FLOW, type BookingStatus } from '../constants';
import { toAEST } from './dates';

export function getCutoffDateTime(pickupDatetime: Date | string): Date {
  const pickupAEST = toAEST(pickupDatetime);
  const dayBefore = subDays(pickupAEST, 1);
  return setSeconds(setMinutes(setHours(dayBefore, CUTOFF_HOUR), 0), 0);
}

export function canEditOrCancel(pickupDatetime: Date | string): boolean {
  const cutoff = getCutoffDateTime(pickupDatetime);
  const nowAEST = toAEST(new Date());
  return isBefore(nowAEST, cutoff);
}

export function canTransitionTo(currentStatus: BookingStatus, targetStatus: BookingStatus): boolean {
  return BOOKING_STATUS_FLOW[currentStatus]?.includes(targetStatus) ?? false;
}

export function isValidPickupDropoff(pickup: Date, dropoff: Date): boolean {
  return isBefore(pickup, dropoff);
}
