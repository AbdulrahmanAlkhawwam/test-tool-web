import { z } from 'zod';

const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);
const role = z.enum(['ADMIN', 'TESTER']);

export const newUserSchema = z.object({
  name,
  email: z.string().trim().email('Enter a valid email'),
  password,
  role,
});
export type NewUserValues = z.infer<typeof newUserSchema>;

export const editUserSchema = z.object({
  name,
  role,
  active: z.boolean(),
  password: z.union([z.literal(''), password]),
});
export type EditUserValues = z.infer<typeof editUserSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
