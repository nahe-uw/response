import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import { storage } from '../../../config/vertexAI';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
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

    const { trainingDataId } = req.query;

    // トレーニングデータの取得
    const trainingData = await prisma.trainingData.findFirst({
      where: {
        id: parseInt(trainingDataId),
        userId: prismaUser.id
      }
    });

    if (!trainingData) {
      return res.status(404).json({ error: 'Training data not found' });
    }

    // Cloud Storageからファイルを削除
    const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}-training`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(trainingData.filePath);
    
    try {
      await file.delete();
    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
      // ファイルが存在しない場合でもデータベースからの削除は続行
    }

    // データベースからトレーニングデータを削除
    await prisma.trainingData.delete({
      where: {
        id: parseInt(trainingDataId)
      }
    });

    res.status(200).json({ 
      message: 'Training data deleted successfully'
    });

  } catch (error) {
    console.error('Training data deletion error:', error);
    res.status(500).json({ error: 'Failed to delete training data' });
  }
} 