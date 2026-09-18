import { describe, expect, it } from 'vitest';
import { changePasswordSchema, editUserSchema, newUserSchema } from './schemas';

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe('user schemas', () => {
  it('validates a new user', () => {
    expect(newUserSchema.safeParse({ name: 'Ahmed', email: 'ahmed@ejad.solutions', password: 'Password1', role: 'TESTER' }).success).toBe(true);
    expect(messages(newUserSchema.safeParse({ name: 'A', email: 'nope', password: 'short', role: 'TESTER' }))).toEqual([
      'Name must be at least 2 characters',
      'Enter a valid email',
      'Password must be at least 8 characters',
    ]);
  });

  it('allows editing without a new password', () => {
    expect(editUserSchema.safeParse({ name: 'Ahmed', role: 'ADMIN', active: true, password: '' }).success).toBe(true);
    expect(messages(editUserSchema.safeParse({ name: 'Ahmed', role: 'ADMIN', active: true, password: 'short' }))).toEqual([
      'Password must be at least 8 characters',
    ]);
  });

  it('requires the new password to be confirmed', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'Another123', confirmPassword: 'Another124' });
    expect(messages(r)).toEqual(['Passwords do not match']);
  });
});
