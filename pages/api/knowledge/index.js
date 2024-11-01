import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (error || !user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: user.email }
    });

    if (!prismaUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ユーザーのナレッジ一覧を取得
    const knowledge = await prisma.knowledge.findMany({
      where: {
        userId: prismaUser.id
      },
      orderBy: {
        created_at: 'desc'
      },
      select: {
        id: true,
        knowledgeName: true,
        type: true,
        created_at: true
      }
    });

    res.status(200).json({ knowledge });
  } catch (error) {
    console.error('Knowledge fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge' });
  }
} 