import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import { storage } from '../../../config/vertexAI';

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

    // サービスアカウントの確認
    const serviceAccount = await prisma.serviceAccount.findFirst({
      where: { userId: prismaUser.id }
    });

    if (!serviceAccount) {
      return res.status(400).json({ error: 'Service account not registered' });
    }

    const { fileName, content } = req.body;

    // Cloud Storageにアップロード
    const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}-training`;
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(`${prismaUser.id}/training/${fileName}`);

    await blob.save(content, {
      contentType: 'text/csv',
      metadata: {
        userId: prismaUser.id.toString()
      }
    });

    // TrainingDataテーブルに保存
    const trainingData = await prisma.trainingData.create({
      data: {
        userId: prismaUser.id,
        fileName,
        filePath: blob.name
      }
    });

    res.status(200).json({ 
      message: 'Training data uploaded successfully',
      trainingData 
    });

  } catch (error) {
    console.error('Training data upload error:', error);
    res.status(500).json({ error: 'Failed to upload training data' });
  }
} 