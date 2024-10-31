import prisma from '../../prisma';
import { supabase } from '../../supabase';
import { hash } from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, password } = req.body;

    try {
      // Supabaseでユーザーを作成
      const { user, error: supabaseError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (supabaseError) {
        console.error('Supabase signup error:', supabaseError);
        return res.status(400).json({ error: supabaseError.message });
      }

      // パスワードをハッシュ化
      const hashedPassword = await hash(password, 10);

      // Prismaを使用してUserテーブルにレコードを追加
      console.log('Creating user with email:', email);
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });
      console.log('User created:', newUser);

      res.status(200).json({ user: newUser });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ error: 'User creation failed' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 