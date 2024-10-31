import prisma from '../../prisma';
import { compare } from 'bcryptjs';
import { supabase } from '../../supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, password } = req.body;

    try {
      // データベースからユーザーを取得
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // パスワードを比較
      const isValid = await compare(password, user.password);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // セッション情報を返す
      res.status(200).json({ 
        message: 'Login successful!',
        user: {
          id: user.id,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 