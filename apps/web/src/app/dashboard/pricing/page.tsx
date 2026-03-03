'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Pricing, Route } from '@tasman-transport/shared';

interface PricingWithRoute extends Pricing {
  routeOrigin: string;
  routeDestination: string;
}

export default function PricingPage() {
  const [pricingData, setPricingData] = useState<PricingWithRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient();

  const fetchPricing = useCallback(async () => {
    try {
      const [pricingRes, routesRes] = await Promise.all([
        supabase.from('pricing').select('*').eq('is_active', true).order('route_id'),
        supabase.from('routes').select('*').eq('is_active', true),
      ]);

      if (pricingRes.error) throw pricingRes.error;
      if (routesRes.error) throw routesRes.error;

      const routesMap = new Map(
        (routesRes.data ?? []).map((r) => [r.id, r])
      );

      const enriched: PricingWithRoute[] = (pricingRes.data ?? []).map((p) => {
        const route = routesMap.get(p.route_id);
        return {
          ...(p as Pricing),
          routeOrigin: route?.origin ?? 'Unknown',
          routeDestination: route?.destination ?? 'Unknown',
        };
      });

      setPricingData(enriched);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleEditClick = (item: PricingWithRoute) => {
    setEditingId(item.id);
    setEditPrice((item.price_cents / 100).toFixed(2));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPrice('');
  };

  const handleSavePrice = async (itemId: string) => {
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      alert('Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const newPriceCents = Math.round(priceNum * 100);
      const { error } = await supabase
        .from('pricing')
        .update({ price_cents: newPriceCents })
        .eq('id', itemId);

      if (error) throw error;

      setEditingId(null);
      setEditPrice('');
      fetchPricing();
    } catch (error) {
      console.error('Error updating price:', error);
      alert('Failed to update price. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pricing...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage transport pricing for each route and item type
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Route</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Item Type</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricingData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">
                    No pricing configured
                  </td>
                </tr>
              ) : (
                pricingData.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900">
                      {item.routeOrigin} → {item.routeDestination}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSavePrice(item.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                        </div>
                      ) : (
                        <span className="font-semibold text-gray-900">
                          {formatPrice(item.price_cents)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSavePrice(item.id)}
                            disabled={saving}
                            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditClick(item)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Edit
                        </button>
                      )}
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
