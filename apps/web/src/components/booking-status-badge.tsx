import { Badge } from '@/components/ui/badge';

const STATUS_VARIANTS: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  confirmed: { variant: 'info', label: 'Confirmed' },
  en_route: { variant: 'info', label: 'En Route' },
  at_pickup: { variant: 'secondary', label: 'At Pickup' },
  in_transit: { variant: 'warning', label: 'In Transit' },
  delivered: { variant: 'success', label: 'Delivered' },
  cancelled: { variant: 'destructive', label: 'Cancelled' },
};

export function BookingStatusBadge({ status }: { status: string }) {
  const config = STATUS_VARIANTS[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
