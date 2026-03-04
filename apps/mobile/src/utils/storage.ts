import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { type PhotoType, type SignatureType } from '@tasman-transport/shared';

/**
 * Upload a booking photo to Supabase Storage and insert a record into booking_photos.
 *
 * @param bookingId - The booking UUID
 * @param photoType - 'item' | 'pickup' | 'delivery'
 * @param uri - Local file URI from image picker
 * @param userId - The uploader's user ID
 * @returns The storage path of the uploaded file
 */
export async function uploadBookingPhoto(
  bookingId: string,
  photoType: PhotoType,
  uri: string,
  userId: string
): Promise<string> {
  const fileName = `${bookingId}/${photoType}_${Date.now()}.jpg`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('booking-photos')
    .upload(fileName, blob, { contentType: 'image/jpeg' });

  if (error) throw error;

  // Insert record into booking_photos table
  const { error: insertError } = await supabase.from('booking_photos').insert({
    booking_id: bookingId,
    photo_type: photoType,
    storage_path: fileName,
    uploaded_by: userId,
  });

  if (insertError) throw insertError;

  return fileName;
}

/**
 * Upload a signature image (base64 PNG) to Supabase Storage and insert a record.
 *
 * @param bookingId - The booking UUID
 * @param signatureType - 'pickup' | 'delivery'
 * @param base64Data - Base64-encoded PNG string (without data URI prefix)
 * @param userId - The signer's user ID
 * @returns The storage path of the uploaded file
 */
export async function uploadSignature(
  bookingId: string,
  signatureType: SignatureType,
  base64Data: string,
  userId: string
): Promise<string> {
  const fileName = `${bookingId}/${signatureType}_signature_${Date.now()}.png`;

  // Convert base64 to ArrayBuffer using base64-arraybuffer (reliable on React Native)
  const arrayBuffer = decode(base64Data);

  const { error } = await supabase.storage
    .from('booking-signatures')
    .upload(fileName, arrayBuffer, { contentType: 'image/png' });

  if (error) throw error;

  // Insert record into booking_signatures table
  const { error: insertError } = await supabase.from('booking_signatures').insert({
    booking_id: bookingId,
    signature_type: signatureType,
    storage_path: fileName,
    signed_by: userId,
  });

  if (insertError) throw insertError;

  return fileName;
}

/**
 * Get the public URL for a booking photo.
 */
export function getPhotoUrl(path: string): string {
  const { data } = supabase.storage.from('booking-photos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get the public URL for a signature image.
 */
export function getSignatureUrl(path: string): string {
  const { data } = supabase.storage.from('booking-signatures').getPublicUrl(path);
  return data.publicUrl;
}
