'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@tasman-transport/shared';

interface CustomerWithBookingCount extends Profile {
  bookingCount: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithBookingCount[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();

  const fetchCustomers = useCallback(async () => {
    try {
      // Fetch all customer profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const profiles = (profilesData as Profile[]) ?? [];

      if (profiles.length === 0) {
        setCustomers([]);
        return;
      }

      // Fetch booking counts per customer
      const customerIds = profiles.map((p) => p.id);
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('customer_id')
        .in('customer_id', customerIds);

      if (bookingsError) throw bookingsError;

      // Count bookings per customer
      const countMap = new Map<string, number>();
      (bookingsData ?? []).forEach((b) => {
        countMap.set(b.customer_id, (countMap.get(b.customer_id) ?? 0) + 1);
      });

      const enriched: CustomerWithBookingCount[] = profiles.map((p) => ({
        ...p,
        bookingCount: countMap.get(p.id) ?? 0,
      }));

      setCustomers(enriched);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customers...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <span className="text-sm text-gray-500">
          {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600"># Bookings</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {customer.full_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{customer.email}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {customer.phone ?? '--'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        {customer.bookingCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
