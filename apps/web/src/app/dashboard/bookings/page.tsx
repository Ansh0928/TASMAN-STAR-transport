'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Booking, Profile, Route } from '@tasman-transport/shared';
import { BOOKING_STATUS } from '@tasman-transport/shared';
import { BookingStatusBadge } from '@/components/booking-status-badge';

interface BookingWithRelations extends Booking {
  customer?: Pick<Profile, 'full_name' | 'email'>;
  route?: Pick<Route, 'origin' | 'destination'>;
  driver?: Pick<Profile, 'full_name'> | null;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'en_route', label: 'En Route' },
  { value: 'at_pickup', label: 'At Pickup' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient();

  const fetchData = useCallback(async () => {
    try {
      const [bookingsRes, driversRes] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'driver').eq('is_active', true),
      ]);

      const bookingsData = bookingsRes.data ?? [];
      const driversData = (driversRes.data as Profile[]) ?? [];
      setDrivers(driversData);

      // Gather related IDs
      const customerIds = [...new Set(bookingsData.map((b) => b.customer_id))];
      const driverIds = [...new Set(bookingsData.map((b) => b.driver_id).filter(Boolean) as string[])];
      const routeIds = [...new Set(bookingsData.map((b) => b.route_id))];

      const [customersRes, driverProfilesRes, routesRes] = await Promise.all([
        customerIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', customerIds)
          : { data: [] },
        driverIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', driverIds)
          : { data: [] },
        routeIds.length > 0
          ? supabase.from('routes').select('id, origin, destination').in('id', routeIds)
          : { data: [] },
      ]);

      const customersMap = new Map((customersRes.data ?? []).map((c) => [c.id, c]));
      const driverProfilesMap = new Map((driverProfilesRes.data ?? []).map((d) => [d.id, d]));
      const routesMap = new Map((routesRes.data ?? []).map((r) => [r.id, r]));

      const enriched: BookingWithRelations[] = bookingsData.map((b) => ({
        ...(b as Booking),
        customer: customersMap.get(b.customer_id) as Pick<Profile, 'full_name' | 'email'> | undefined,
        route: routesMap.get(b.route_id) as Pick<Route, 'origin' | 'destination'> | undefined,
        driver: b.driver_id
          ? (driverProfilesMap.get(b.driver_id) as Pick<Profile, 'full_name'> | null)
          : null,
      }));

      setBookings(enriched);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBookings = bookings.filter(
    (b) => statusFilter === 'all' || b.status === statusFilter
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleOpenDetail = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setAssignDriverId(booking.driver_id ?? '');
  };

  const handleAssignDriver = async () => {
    if (!selectedBooking) return;

    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        driver_id: assignDriverId || null,
      };

      // If assigning a driver to a pending booking, set to confirmed
      if (assignDriverId && selectedBooking.status === 'pending') {
        updateData.status = BOOKING_STATUS.CONFIRMED;
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setSelectedBooking(null);
      fetchData();
    } catch (error) {
      console.error('Error assigning driver:', error);
      alert('Failed to assign driver. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Booking #</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Route</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Pickup Date</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    onClick={() => handleOpenDetail(booking)}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      #{booking.booking_number}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {booking.customer?.full_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {booking.route
                        ? `${booking.route.origin} → ${booking.route.destination}`
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(booking.pickup_datetime)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatPrice(booking.price_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/bookings/${booking.id}`);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Detail Panel */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedBooking(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                Booking #{selectedBooking.booking_number}
              </h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="flex items-center justify-between">
                <BookingStatusBadge status={selectedBooking.status} />
                <button
                  onClick={() => {
                    setSelectedBooking(null);
                    router.push(`/dashboard/bookings/${selectedBooking.id}`);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  View Full Details &rarr;
                </button>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Customer
                </h3>
                <p className="text-sm text-gray-900">
                  {selectedBooking.customer?.full_name ?? 'Unknown'}
                </p>
                <p className="text-sm text-gray-500">
                  {selectedBooking.customer?.email ?? ''}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Route
                </h3>
                <p className="text-sm text-gray-900">
                  {selectedBooking.route
                    ? `${selectedBooking.route.origin} → ${selectedBooking.route.destination}`
                    : 'N/A'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Pickup
                  </h3>
                  <p className="text-sm text-gray-900">
                    {selectedBooking.pickup_address}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(selectedBooking.pickup_datetime)}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Dropoff
                  </h3>
                  <p className="text-sm text-gray-900">
                    {selectedBooking.dropoff_address}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(selectedBooking.dropoff_datetime)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Item Details
                </h3>
                <p className="text-sm text-gray-900">
                  {selectedBooking.item_type} &mdash; {selectedBooking.weight_kg}kg
                </p>
                <p className="text-sm text-gray-500">
                  {selectedBooking.length_cm}cm &times; {selectedBooking.width_cm}cm &times;{' '}
                  {selectedBooking.height_cm}cm
                </p>
              </div>

              {selectedBooking.special_instructions && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Special Instructions
                  </h3>
                  <p className="text-sm text-gray-700">
                    {selectedBooking.special_instructions}
                  </p>
                </div>
              )}

              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium">Total Price</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatPrice(selectedBooking.price_cents)}
                </p>
              </div>

              {/* Assign Driver */}
              <div className="border-t pt-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Assign Driver
                </h3>
                <select
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- No driver assigned --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.email})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleAssignDriver}
                  disabled={saving}
                  className="mt-3 w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
