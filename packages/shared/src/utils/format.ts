export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatWeight(kg: number): string {
  return `${kg} kg`;
}

export function formatDimensions(length: number, width: number, height: number): string {
  return `${length} × ${width} × ${height} cm`;
}

export function formatBookingNumber(bookingNumber: string): string {
  return bookingNumber;
}
