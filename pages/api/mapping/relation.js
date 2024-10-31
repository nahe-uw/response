import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { fromTable, fromColumn, toTable, toColumn } = req.body;

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

      // Prismaの`User`テーブルからユーザーを検索
      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      // テーブル連結情報を保存
      const tableRelation = await prisma.tableRelation.create({
        data: {
          userId: prismaUser.id,
          fromTable,
          fromColumn,
          toTable,
          toColumn,
        },
      });

      res.status(200).json({ tableRelation });
    } catch (error) {
      console.error('Relation error:', error);
      res.status(500).json({ error: 'Failed to save table relation' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 