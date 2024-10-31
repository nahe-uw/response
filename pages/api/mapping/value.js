import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { columnId, value, meaning } = req.body;

      // リクエストヘッダーからセッション情報を取得
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      // Supabaseのセッションを取得
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

      if (error || !user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // 値マッピングを保存
      const valueMapping = await prisma.valueMapping.create({
        data: {
          columnId,
          value,
          meaning,
        },
      });

      res.status(200).json({ valueMapping });
    } catch (error) {
      console.error('Value mapping error:', error);
      res.status(500).json({ error: 'Failed to save value mapping' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 