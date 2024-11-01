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
        const { url, zendeskAuth } = content;
        
        // URLからZendeskの記事IDを抽出
        const articleIdMatch = url.match(/articles\/(\d+)/);
        if (!articleIdMatch) {
          return res.status(400).json({ error: 'Invalid Zendesk article URL' });
        }
        const articleId = articleIdMatch[1];

        // Zendesk API URLの構築
        const apiUrl = `https://${zendeskAuth.domain}/api/v2/help_center/articles/${articleId}`;
        
        // Zendesk APIへのリクエスト
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${zendeskAuth.email}/token:${zendeskAuth.apiToken}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.error('Zendesk API error:', {
            status: response.status,
            statusText: response.statusText,
            url: apiUrl
          });

          return res.status(400).json({ 
            error: `Failed to fetch Zendesk article: ${response.status} ${response.statusText}`,
            details: {
              status: response.status,
              statusText: response.statusText,
              url: apiUrl
            }
          });
        }

        const data = await response.json();
        
        // 記事の本文を取得
        textContent = data.article?.body;
        
        if (!textContent) {
          return res.status(400).json({ error: 'No content found in the Zendesk article' });
        }

        // HTMLからテキストを抽出
        textContent = textContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      } catch (urlError) {
        console.error('URL processing error:', urlError);
        return res.status(400).json({ 
          error: 'Failed to process Zendesk article',
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