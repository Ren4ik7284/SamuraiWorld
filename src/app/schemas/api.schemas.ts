import { z } from 'zod';
export const NicknameSchema = z
  .string()
  .min(3, 'Никнейм должен быть не менее 3 символов')
  .max(16, 'Никнейм не более 16 символов')
  .regex(/^[a-zA-Z0-9_]+$/, 'Только латинские буквы, цифры и _');
export const PasswordSchema = z
  .string()
  .min(6, 'Пароль должен содержать от 6 до 64 символов')
  .max(64, 'Пароль не должен превышать 64 символов')
  .regex(/^\S+$/, 'Пароль не должен содержать пробелы');
export const EmailSchema = z
  .string()
  .max(100, 'Email слишком длинный')
  .email('Некорректный email')
  .optional()
  .or(z.literal(''))
  .or(z.undefined());
export const LoginSchema = z.object({
  nickname: NicknameSchema,
  password: PasswordSchema,
});
export const RegisterSchema = z.object({
  nickname: NicknameSchema,
  email: EmailSchema,
  password: PasswordSchema,
});
export const PaymentSchema = z.object({
  nickname: NicknameSchema,
  promoCode: z.string().optional(),
  paymentMethod: z.string().optional(),
});
export const PromoCodeSchema = z
  .string()
  .min(1, 'Введите промокод')
  .max(20, 'Слишком длинный промокод')
  .toUpperCase();
export const SupportTicketSchema = z.object({
  subject: z.string().min(5, 'Минимум 5 символов').max(100, 'Максимум 100 символов'),
  message: z.string().min(20, 'Минимум 20 символов').max(2000, 'Максимум 2000 символов'),
  category: z.enum(['bug', 'payment', 'appeal', 'other']),
});
export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type PaymentDto = z.infer<typeof PaymentSchema>;
export type SupportTicketDto = z.infer<typeof SupportTicketSchema>;
