import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import { vertexAI } from '../../../config/vertexAI';

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

    const { modelName, trainingDataIds } = req.body;

    // トレーニングデータの取得
    const trainingData = await prisma.trainingData.findMany({
      where: {
        id: { in: trainingDataIds },
        userId: prismaUser.id
      }
    });

    if (trainingData.length === 0) {
      return res.status(400).json({ error: 'No training data found' });
    }

    // Vertex AIでモデルを作成
    const model = vertexAI.preview.getGenerativeModel({
      model: 'text-bison@001'
    });

    // トレーニングジョブの作成
    const trainingJob = await model.createFineTuningJob({
      trainingData: trainingData.map(data => ({
        filePath: data.filePath
      })),
      modelDisplayName: modelName,
      trainingSteps: 1000
    });

    console.log('Training job created:', trainingJob);

    // TrainingModelテーブルに保存
    const trainingModel = await prisma.trainingModel.create({
      data: {
        userId: prismaUser.id,
        modelName,
        endpointUrl: '', // トレーニング完了後に更新
        status: 'TRAINING'
      }
    });

    res.status(200).json({ 
      message: 'Training model creation started',
      trainingModel
    });

  } catch (error) {
    console.error('Training model creation error:', error);
    res.status(500).json({ error: 'Failed to create training model' });
  }
} 