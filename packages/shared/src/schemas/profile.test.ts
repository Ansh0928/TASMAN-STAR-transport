import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, createDriverSchema } from './profile';

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(true);
  });

  it('accepts registration with phone', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: 'John Smith',
      phone: '+61400000000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(false);
  });

  it('rejects email without domain', () => {
    const result = registerSchema.safeParse({
      email: 'user@',
      password: 'password123',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password (< 8 chars)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: '1234567',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(false);
  });

  it('accepts password of exactly 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: '12345678',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty full_name', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing email', () => {
    const result = registerSchema.safeParse({
      password: 'password123',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      full_name: 'John Smith',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('stress: accepts very long password', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'a'.repeat(1000),
      full_name: 'John Smith',
    });
    expect(result.success).toBe(true);
  });

  it('stress: accepts unicode full_name', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: '田中太郎',
    });
    expect(result.success).toBe(true);
  });

  it('stress: accepts full_name with special characters', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      full_name: "O'Brien-Smith Jr.",
    });
    expect(result.success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'bad-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts single-character password (login has min 1, not 8)', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'x',
    });
    expect(result.success).toBe(true);
  });
});

describe('createDriverSchema', () => {
  it('accepts valid driver creation', () => {
    const result = createDriverSchema.safeParse({
      email: 'driver@example.com',
      password: 'driverpass123',
      full_name: 'Jane Driver',
    });
    expect(result.success).toBe(true);
  });

  it('accepts driver with phone', () => {
    const result = createDriverSchema.safeParse({
      email: 'driver@example.com',
      password: 'driverpass123',
      full_name: 'Jane Driver',
      phone: '+61400111222',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password (same rules as register)', () => {
    const result = createDriverSchema.safeParse({
      email: 'driver@example.com',
      password: 'short',
      full_name: 'Jane Driver',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createDriverSchema.safeParse({
      email: 'not-valid',
      password: 'driverpass123',
      full_name: 'Jane Driver',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createDriverSchema.safeParse({
      email: 'driver@example.com',
      password: 'driverpass123',
      full_name: '',
    });
    expect(result.success).toBe(false);
  });
});
