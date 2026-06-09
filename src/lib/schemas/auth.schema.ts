import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスは必須です')
    .email('メールアドレスの形式が正しくありません')
    .max(255, 'メールアドレスは255文字以内で入力してください'),
  password: z
    .string()
    .min(1, 'パスワードは必須です')
    .max(72, 'パスワードは72文字以内で入力してください'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
