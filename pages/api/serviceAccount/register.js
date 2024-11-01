import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { serviceAccountKey } = req.body;

    // サービスアカウントキーの検証
    try {
      const keyObject = JSON.parse(serviceAccountKey);
      if (!keyObject.project_id || !keyObject.private_key) {
        return res.status(400).json({ error: 'Invalid service account key format' });
      }
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    // 既存のサービスアカウントを確認
    const existingAccount = await prisma.serviceAccount.findFirst({
      where: { userId: prismaUser.id }
    });

    let serviceAccount;
    if (existingAccount) {
      // 既存のサービスアカウントを更新
      serviceAccount = await prisma.serviceAccount.update({
        where: { id: existingAccount.id },
        data: { serviceAccountKey }
      });
    } else {
      // 新しいサービスアカウントを作成
      serviceAccount = await prisma.serviceAccount.create({
        data: {
          userId: prismaUser.id,
          serviceAccountKey
        }
      });
    }

    res.status(200).json({ 
      message: 'Service account registered successfully',
      serviceAccount: {
        id: serviceAccount.id,
        created_at: serviceAccount.created_at
      }
    });

  } catch (error) {
    console.error('Service account registration error:', error);
    res.status(500).json({ error: 'Failed to register service account' });
  }
} 