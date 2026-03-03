'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { BOOKING_STATUS, BOOKING_STATUS_FLOW, TIMEZONE } from '@tasman-transport/shared';
import type { Booking, Profile, Route, BookingPhoto, BookingSignature, NotificationLog } from '@tasman-transport/shared';
import { BookingStatusBadge } from '@/components/booking-status-badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft,
  User,
  MapPin,
  Clock,
  Package,
  DollarSign,
  Truck,
  Camera,
  PenTool,
  Bell,
  RefreshCw,
} from 'lucide-react';

// ---- Types ----

interface BookingDetail extends Booking {
  customer?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'>;
  route?: Pick<Route, 'origin' | 'destination'>;
  driver?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | null;
}

// ---- Helpers ----

function formatDateTimeAEST(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-AU', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

// ---- Page Component ----

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [photos, setPhotos] = useState<(BookingPhoto & { signedUrl?: string })[]>([]);
  const [signatures, setSignatures] = useState<(BookingSignature & { signedUrl?: string })[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status change
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // Driver assignment
  const [showDriverDialog, setShowDriverDialog] = useState(false);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [driverSaving, setDriverSaving] = useState(false);

  const supabase = createBrowserClient();

  // ---- Fetch booking and all related data ----

  const fetchBooking = useCallback(async () => {
    try {
      setError('');

      // Fetch the booking itself
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (bookingError || !bookingData) {
        setError('Booking not found');
        setLoading(false);
        return;
      }

      const b = bookingData as Booking;

      // Fetch related data in parallel
      const [
        customerRes,
        routeRes,
        driverRes,
        photosRes,
        signaturesRes,
        notificationsRes,
        driversListRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, phone').eq('id', b.customer_id).single(),
        supabase.from('routes').select('id, origin, destination').eq('id', b.route_id).single(),
        b.driver_id
          ? supabase.from('profiles').select('id, full_name, email, phone').eq('id', b.driver_id).single()
          : Promise.resolve({ data: null }),
        supabase.from('booking_photos').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true }),
        supabase.from('booking_signatures').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true }),
        supabase.from('notifications_log').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'driver').eq('is_active', true).order('full_name'),
      ]);

      const detail: BookingDetail = {
        ...b,
        customer: customerRes.data as Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | undefined,
        route: routeRes.data as Pick<Route, 'origin' | 'destination'> | undefined,
        driver: driverRes.data as Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | null,
      };

      setBooking(detail);
      setDrivers((driversListRes.data as Profile[]) ?? []);
      setNotifications((notificationsRes.data as NotificationLog[]) ?? []);

      // Generate signed URLs for photos
      const photosData = (photosRes.data as BookingPhoto[]) ?? [];
      const photosWithUrls = await Promise.all(
        photosData.map(async (photo) => {
          const { data: signedData } = await supabase.storage
            .from('booking-photos')
            .createSignedUrl(photo.storage_path, 3600);
          return { ...photo, signedUrl: signedData?.signedUrl };
        })
      );
      setPhotos(photosWithUrls);

      // Generate signed URLs for signatures
      const signaturesData = (signaturesRes.data as BookingSignature[]) ?? [];
      const signaturesWithUrls = await Promise.all(
        signaturesData.map(async (sig) => {
          const { data: signedData } = await supabase.storage
            .from('booking-signatures')
            .createSignedUrl(sig.storage_path, 3600);
          return { ...sig, signedUrl: signedData?.signedUrl };
        })
      );
      setSignatures(signaturesWithUrls);
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // ---- Status Change ----

  const allowedNextStatuses = booking
    ? (BOOKING_STATUS_FLOW[booking.status as keyof typeof BOOKING_STATUS_FLOW] ?? [])
    : [];

  const handleStatusChange = async () => {
    if (!booking || !newStatus) return;

    setStatusSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      setShowStatusDialog(false);
      setNewStatus('');
      fetchBooking();
    } catch (err) {
      console.error('Error changing status:', err);
      alert('Failed to change status. Please try again.');
    } finally {
      setStatusSaving(false);
    }
  };

  // ---- Driver Assignment ----

  const handleAssignDriver = async () => {
    if (!booking) return;

    setDriverSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        driver_id: assignDriverId || null,
      };

      // If assigning a driver to a pending booking, auto-confirm
      if (assignDriverId && booking.status === 'pending') {
        updateData.status = BOOKING_STATUS.CONFIRMED;
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', booking.id);

      if (updateError) throw updateError;

      setShowDriverDialog(false);
      fetchBooking();
    } catch (err) {
      console.error('Error assigning driver:', err);
      alert('Failed to assign driver. Please try again.');
    } finally {
      setDriverSaving(false);
    }
  };

  // ---- Loading & Error States ----

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading booking details...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500">{error || 'Booking not found'}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/bookings')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bookings
        </Button>
      </div>
    );
  }

  // ---- Separate photos by type ----

  const itemPhotos = photos.filter(p => p.photo_type === 'item');
  const pickupPhotos = photos.filter(p => p.photo_type === 'pickup');
  const deliveryPhotos = photos.filter(p => p.photo_type === 'delivery');

  const pickupSignature = signatures.find(s => s.signature_type === 'pickup');
  const deliverySignature = signatures.find(s => s.signature_type === 'delivery');

  // ---- Render ----

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard/bookings')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Bookings
      </button>

      {/* Booking Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Booking #{booking.booking_number}
            </h1>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Created {formatDate(booking.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBooking()}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          {allowedNextStatuses.length > 0 && (
            <Button
              size="sm"
              onClick={() => setShowStatusDialog(true)}
            >
              Change Status
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Info */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-400" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{booking.customer?.full_name ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{booking.customer?.email ?? '--'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">{booking.customer?.phone ?? '--'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Route Info */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gray-400" />
              Route
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex-1">
                <p className="text-gray-500">Origin</p>
                <p className="font-medium text-gray-900">{booking.route?.origin ?? 'N/A'}</p>
                <p className="text-xs text-gray-400 mt-1">{booking.pickup_address}</p>
              </div>
              <div className="text-gray-300 text-lg font-bold">&rarr;</div>
              <div className="flex-1">
                <p className="text-gray-500">Destination</p>
                <p className="font-medium text-gray-900">{booking.route?.destination ?? 'N/A'}</p>
                <p className="text-xs text-gray-400 mt-1">{booking.dropoff_address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Pickup</dt>
                <dd className="font-medium text-gray-900">{formatDateTimeAEST(booking.pickup_datetime)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Dropoff</dt>
                <dd className="font-medium text-gray-900">{formatDateTimeAEST(booking.dropoff_datetime)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-400" />
              Item Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd className="font-medium text-gray-900">{booking.item_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Weight</dt>
                <dd className="font-medium text-gray-900">{booking.weight_kg} kg</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Dimensions</dt>
                <dd className="font-medium text-gray-900">
                  {booking.length_cm} x {booking.width_cm} x {booking.height_cm} cm
                </dd>
              </div>
              {booking.special_instructions && (
                <div className="pt-2 border-t">
                  <dt className="text-gray-500 mb-1">Special Instructions</dt>
                  <dd className="text-gray-700">{booking.special_instructions}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Price */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total Price</p>
              <p className="text-3xl font-bold text-blue-700">{formatPrice(booking.price_cents)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Driver Info */}
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-gray-400" />
                Driver
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssignDriverId(booking.driver_id ?? '');
                  setShowDriverDialog(true);
                }}
              >
                {booking.driver ? 'Reassign' : 'Assign'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {booking.driver ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-gray-900">{booking.driver.full_name}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{booking.driver.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium text-gray-900">{booking.driver.phone ?? '--'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-400 italic">No driver assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photos Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Camera className="w-5 h-5 text-gray-400" />
          Photos
        </h2>

        {photos.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="py-8">
              <p className="text-sm text-gray-400 text-center">No photos uploaded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Item Photos */}
            {itemPhotos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Item Photos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {itemPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt="Item photo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pickup Photos */}
            {pickupPhotos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Pickup Photos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {pickupPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt="Pickup photo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery Photos */}
            {deliveryPhotos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">Delivery Photos</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {deliveryPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                      {photo.signedUrl ? (
                        <img
                          src={photo.signedUrl}
                          alt="Delivery photo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Signatures Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <PenTool className="w-5 h-5 text-gray-400" />
          Signatures
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pickup Signature */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm">Pickup Signature</CardTitle>
            </CardHeader>
            <CardContent>
              {pickupSignature?.signedUrl ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img
                    src={pickupSignature.signedUrl}
                    alt="Pickup signature"
                    className="w-full h-32 object-contain"
                  />
                  <p className="text-xs text-gray-400 text-center py-2">
                    Signed by: {pickupSignature.signed_by}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-6">Not yet signed</p>
              )}
            </CardContent>
          </Card>

          {/* Delivery Signature */}
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-sm">Delivery Signature</CardTitle>
            </CardHeader>
            <CardContent>
              {deliverySignature?.signedUrl ? (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img
                    src={deliverySignature.signedUrl}
                    alt="Delivery signature"
                    className="w-full h-32 object-contain"
                  />
                  <p className="text-xs text-gray-400 text-center py-2">
                    Signed by: {deliverySignature.signed_by}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-6">Not yet signed</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Notification History */}
      <div className="mt-8 mb-12">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-gray-400" />
          Notification History
        </h2>

        <Card className="bg-white">
          {notifications.length === 0 ? (
            <CardContent className="py-8">
              <p className="text-sm text-gray-400 text-center">No notifications sent yet</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Recipient</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Sent At</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notif) => (
                    <tr key={notif.id} className="border-b">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {notif.notification_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{notif.recipient_email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            notif.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {notif.status === 'sent' ? 'Sent' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDateTimeAEST(notif.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {notif.error_message ?? '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onClose={() => setShowStatusDialog(false)}>
        <DialogHeader>
          <DialogTitle>Change Booking Status</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm text-gray-500 mb-4">
            Current status: <span className="font-medium">{booking.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
          </p>
          <Select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
          >
            <option value="">Select new status...</option>
            {allowedNextStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </Select>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowStatusDialog(false)}
            disabled={statusSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStatusChange}
            disabled={!newStatus || statusSaving}
          >
            {statusSaving ? 'Saving...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Driver Assignment Dialog */}
      <Dialog open={showDriverDialog} onClose={() => setShowDriverDialog(false)}>
        <DialogHeader>
          <DialogTitle>{booking.driver ? 'Reassign Driver' : 'Assign Driver'}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <Select
            value={assignDriverId}
            onChange={(e) => setAssignDriverId(e.target.value)}
          >
            <option value="">-- No driver assigned --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name} ({d.email})
              </option>
            ))}
          </Select>
          {assignDriverId && booking.status === 'pending' && (
            <p className="text-sm text-blue-600 mt-3">
              Assigning a driver will automatically confirm this booking.
            </p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowDriverDialog(false)}
            disabled={driverSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignDriver}
            disabled={driverSaving}
          >
            {driverSaving ? 'Saving...' : 'Save Assignment'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
