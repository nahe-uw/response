import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
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
        return res.status(404).json({ error: 'User not found' });
      }

      // カテゴリとそれに関連するテーブルを取得
      const categories = await prisma.dataCategory.findMany({
        where: {
          userId: prismaUser.id
        },
        include: {
          tables: {
            select: {
              tableName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({ categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 