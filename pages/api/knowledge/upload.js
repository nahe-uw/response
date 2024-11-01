import { initializeVertexAI, vectorSearchConfig } from '../../../config/vertexAI';
import { generateEmbeddings, updateVectorSearchIndex } from '../../../services/vertexAIService';
import { extractTextFromPDF } from '../../../utils/pdfParser';
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

    const { knowledgeName, type, content } = req.body;

    // コンテンツのテキスト抽出
    let textContent;
    if (type === 'pdf') {
      const buffer = Buffer.from(content, 'base64');
      textContent = await extractTextFromPDF(buffer);
    } else if (type === 'url') {
      try {
        // URLの形式チェック
        const url = new URL(content);
        
        // URLからコンテンツを取得（ヘッダーを追加）
        const response = await fetch(content, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          redirect: 'follow',
          timeout: 10000 // 10秒でタイムアウト
        });

        // エラーレスポンスの詳細なハンドリング
        if (!response.ok) {
          console.error('URL fetch error:', {
            status: response.status,
            statusText: response.statusText,
            url: content
          });

          // エラーの種類に応じたメッセージ
          let errorMessage;
          switch (response.status) {
            case 403:
              errorMessage = 'Access forbidden. The website may be blocking automated access.';
              break;
            case 404:
              errorMessage = 'The requested content was not found.';
              break;
            case 429:
              errorMessage = 'Too many requests. Please try again later.';
              break;
            default:
              errorMessage = `Failed to fetch content: ${response.status} ${response.statusText}`;
          }

          return res.status(400).json({ 
            error: errorMessage,
            details: {
              status: response.status,
              statusText: response.statusText,
              url: content
            }
          });
        }

        const htmlContent = await response.text();
        
        // HTMLからテキストを抽出（改善版）
        textContent = htmlContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!textContent) {
          return res.status(400).json({ error: 'No readable content found at URL' });
        }

        // テキストの長さチェック
        if (textContent.length < 50) {
          return res.status(400).json({ error: 'Content is too short or empty' });
        }

      } catch (urlError) {
        console.error('URL processing error:', urlError);
        return res.status(400).json({ 
          error: urlError instanceof TypeError ? 'Invalid URL format or network error' : 'Failed to process URL content',
          details: urlError.message
        });
      }
    } else {
      textContent = content;
    }

    // ユーザーごとのVertexAI初期化
    const { vertexAI, storage } = await initializeVertexAI(prismaUser);

    // エンベディング生成（prismaUserを渡す）
    const embeddings = await generateEmbeddings(textContent, prismaUser);

    // Cloud Storageに保存
    const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}-knowledge`;
    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(`${prismaUser.id}/${knowledgeName}`);

    // URLの場合はURLそのものを保存、それ以外は従来通り
    const contentToSave = type === 'url' ? content : textContent;
    await blob.save(contentToSave, {
      contentType: type === 'pdf' ? 'application/pdf' : 
                  type === 'url' ? 'text/plain' : 'text/plain',
      metadata: {
        userId: prismaUser.id.toString(),
        type: type
      }
    });

    // Knowledgeテーブルに保存
    const knowledge = await prisma.knowledge.create({
      data: {
        userId: prismaUser.id,
        knowledgeName,
        type,
        content: type === 'url' ? content : blob.name // URLの場合はURLを直接保存
      }
    });

    // ベクトル検索インデックスの更新（prismaUserを渡す）
    await updateVectorSearchIndex(knowledge.id, embeddings, prismaUser);

    res.status(200).json({ 
      message: 'Knowledge uploaded and indexed successfully',
      knowledge 
    });

  } catch (error) {
    console.error('Knowledge upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload knowledge',
      details: error.message 
    });
  }
} 