import { createServerClient } from '@/lib/supabase/server';
import { Package, Truck, Users, DollarSign } from 'lucide-react';
import { BookingStatusBadge } from '@/components/booking-status-badge';
import Link from 'next/link';

interface BookingRow {
  id: string;
  booking_number: string;
  status: string;
  price_cents: number;
  pickup_datetime: string;
  created_at: string;
  customer_id: string;
  route_id: string;
}

interface CustomerInfo {
  id: string;
  full_name: string;
}

interface RouteInfo {
  id: string;
  origin: string;
  destination: string;
}

async function getDashboardData(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const [bookingsRes, driversRes, customersRes] = await Promise.all([
    supabase.from('bookings').select('id, booking_number, status, price_cents, pickup_datetime, created_at, customer_id, route_id').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id').eq('role', 'driver'),
    supabase.from('profiles').select('id').eq('role', 'customer'),
  ]);

  const allBookings = (bookingsRes.data ?? []) as BookingRow[];
  const activeBookings = allBookings.filter(b => !['delivered', 'cancelled'].includes(b.status));

  // Status counts
  const statusCounts: Record<string, number> = {};
  for (const b of allBookings) {
    statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;
  }

  // Recent 10 bookings
  const recentBookings = allBookings.slice(0, 10);

  // Fetch related customer and route data for recent bookings
  const customerIds = [...new Set(recentBookings.map(b => b.customer_id))];
  const routeIds = [...new Set(recentBookings.map(b => b.route_id))];

  const [customerProfilesRes, routesRes] = await Promise.all([
    customerIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', customerIds)
      : { data: [] },
    routeIds.length > 0
      ? supabase.from('routes').select('id, origin, destination').in('id', routeIds)
      : { data: [] },
  ]);

  const customersMap = new Map(((customerProfilesRes.data ?? []) as CustomerInfo[]).map(c => [c.id, c]));
  const routesMap = new Map(((routesRes.data ?? []) as RouteInfo[]).map(r => [r.id, r]));

  const enrichedRecent = recentBookings.map(b => ({
    ...b,
    customerName: customersMap.get(b.customer_id)?.full_name ?? 'Unknown',
    routeLabel: routesMap.has(b.route_id)
      ? `${routesMap.get(b.route_id)!.origin} → ${routesMap.get(b.route_id)!.destination}`
      : 'N/A',
  }));

  return {
    totalBookings: allBookings.length,
    activeBookings: activeBookings.length,
    totalDrivers: driversRes.data?.length ?? 0,
    totalCustomers: customersRes.data?.length ?? 0,
    statusCounts,
    recentBookings: enrichedRecent,
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const data = await getDashboardData(supabase);

  const cards = [
    { title: 'Total Bookings', value: data.totalBookings, icon: Package, color: 'text-blue-600 bg-blue-50' },
    { title: 'Active Deliveries', value: data.activeBookings, icon: Truck, color: 'text-orange-600 bg-orange-50' },
    { title: 'Drivers', value: data.totalDrivers, icon: Truck, color: 'text-green-600 bg-green-50' },
    { title: 'Customers', value: data.totalCustomers, icon: Users, color: 'text-purple-600 bg-purple-50' },
  ];

  const STATUS_ORDER = ['pending', 'confirmed', 'en_route', 'at_pickup', 'in_transit', 'delivered', 'cancelled'];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl border p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Booking Status Distribution */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Status Distribution</h2>
        <div className="bg-white rounded-xl border p-6">
          <div className="flex flex-wrap gap-3">
            {STATUS_ORDER.map((status) => {
              const count = data.statusCounts[status] ?? 0;
              return (
                <div key={status} className="flex items-center gap-2">
                  <BookingStatusBadge status={status} />
                  <span className="text-sm font-medium text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
          <Link
            href="/dashboard/bookings"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all
          </Link>
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
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      No bookings yet
                    </td>
                  </tr>
                ) : (
                  data.recentBookings.map((booking) => (
                    <tr key={booking.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/bookings/${booking.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          #{booking.booking_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{booking.customerName}</td>
                      <td className="px-4 py-3 text-gray-700">{booking.routeLabel}</td>
                      <td className="px-4 py-3">
                        <BookingStatusBadge status={booking.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(booking.pickup_datetime)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatPrice(booking.price_cents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
