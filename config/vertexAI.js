import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';
import prisma from '../prisma';

// ユーザーごとのVertexAI初期化関数
export async function initializeVertexAI(prismaUser) {
  try {
    // ユーザーのサービスアカウント情報を取得
    const serviceAccount = await prisma.serviceAccount.findFirst({
      where: { userId: prismaUser.id }
    });

    if (!serviceAccount) {
      throw new Error('Service account not found');
    }

    // JSON文字列をパース
    const credentials = JSON.parse(serviceAccount.serviceAccountKey);

    // VertexAI初期化
    const vertexAI = new VertexAI({
      credentials,
      project: credentials.project_id,
      location: 'us-central1',
    });

    // Cloud Storage初期化
    const storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    });

    return { vertexAI, storage };
  } catch (error) {
    console.error('Failed to initialize Google Cloud services:', error);
    throw error;
  }
}

// ベクトル検索用の設定
export const vectorSearchConfig = {
  dimensions: 768,
  approximateNeighborsCount: 10,
  distanceMeasureType: 'COSINE_DISTANCE',
}; 