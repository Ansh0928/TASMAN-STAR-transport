import { describe, it, expect } from 'vitest';
import { formatCents, formatWeight, formatDimensions, formatBookingNumber } from './format';

describe('formatCents', () => {
  it('formats 0 cents', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats 100 cents as $1.00', () => {
    expect(formatCents(100)).toBe('$1.00');
  });

  it('formats 45000 cents as $450.00', () => {
    expect(formatCents(45000)).toBe('$450.00');
  });

  it('formats 99 cents as $0.99', () => {
    expect(formatCents(99)).toBe('$0.99');
  });

  it('formats 1 cent as $0.01', () => {
    expect(formatCents(1)).toBe('$0.01');
  });

  it('formats large amounts (1 million cents)', () => {
    expect(formatCents(1_000_000)).toBe('$10000.00');
  });

  it('handles negative cents', () => {
    expect(formatCents(-500)).toBe('$-5.00');
  });

  it('stress: handles floating point precision for round numbers', () => {
    expect(formatCents(10)).toBe('$0.10');
    expect(formatCents(50)).toBe('$0.50');
  });

  it('stress: handles very large values', () => {
    const result = formatCents(99999999);
    expect(result).toBe('$999999.99');
  });
});

describe('formatWeight', () => {
  it('formats integer weight', () => {
    expect(formatWeight(50)).toBe('50 kg');
  });

  it('formats decimal weight', () => {
    expect(formatWeight(12.5)).toBe('12.5 kg');
  });

  it('formats zero weight', () => {
    expect(formatWeight(0)).toBe('0 kg');
  });

  it('formats very small weight', () => {
    expect(formatWeight(0.1)).toBe('0.1 kg');
  });

  it('formats large weight', () => {
    expect(formatWeight(10000)).toBe('10000 kg');
  });
});

describe('formatDimensions', () => {
  it('formats standard dimensions', () => {
    expect(formatDimensions(100, 50, 75)).toBe('100 × 50 × 75 cm');
  });

  it('formats decimal dimensions', () => {
    expect(formatDimensions(10.5, 20.3, 30.7)).toBe('10.5 × 20.3 × 30.7 cm');
  });

  it('formats zero dimensions', () => {
    expect(formatDimensions(0, 0, 0)).toBe('0 × 0 × 0 cm');
  });

  it('uses multiplication sign (×) not x', () => {
    const result = formatDimensions(1, 2, 3);
    expect(result).toContain('×');
    expect(result).not.toMatch(/\d x \d/);
  });
});

describe('formatBookingNumber', () => {
  it('returns booking number unchanged', () => {
    expect(formatBookingNumber('TT-20240620-0001')).toBe('TT-20240620-0001');
  });

  it('handles empty string', () => {
    expect(formatBookingNumber('')).toBe('');
  });

  it('is a passthrough (no formatting applied)', () => {
    const input = 'any-arbitrary-string';
    expect(formatBookingNumber(input)).toBe(input);
  });
});
