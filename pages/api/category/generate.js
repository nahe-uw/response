import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      // セッション確認
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error || !user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // ユーザーの取得
      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // データの収集
      const tables = await prisma.table.findMany({
        where: {
          apiConnection: {
            userId: prismaUser.id
          }
        },
        include: {
          columns: true,
          apiConnection: true
        }
      });

      const tableRelations = await prisma.tableRelation.findMany({
        where: {
          userId: prismaUser.id
        }
      });

      // GPTへの入力データを構築
      const prompt = {
        tables: tables.map(table => ({
          name: table.tableName,
          description: table.tableDescription,
          columns: table.columns.map(col => ({
            name: col.columnName,
            description: col.columnDescription,
            isUserId: col.isUserId
          })),
        })),
        relations: tableRelations
      };

      // GPTを使用してカテゴリを生成
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `あなたはテーブル構造を分析し、適切なカテゴリを提案するアシスタントです。
            以下の制約条件を必ず守ってください：
            各カテゴリには、必ず1つ以上のユーザーIDカラム（isUserId = true）を持つテーブルが含まれる必要があります

            以下の形式で回答してください：
            {
              "categories": [
                {
                  "name": "カテゴリ名",
                  "tables": ["テーブル名1", "テーブル名2"],
                }
              ]
            }`
          },
          {
            role: "user",
            content: JSON.stringify(prompt)
          }
        ],
        max_tokens: 2000
      });

      // GPTの応答を取得して解析
      let categories;
      try {
        console.log('GPT Response:', completion.choices[0].message.content);
        categories = JSON.parse(completion.choices[0].message.content);
        
        if (!categories.categories || !Array.isArray(categories.categories)) {
          throw new Error('Invalid response format');
        }
      } catch (parseError) {
        console.error('Failed to parse GPT response:', parseError);
        return res.status(500).json({ error: 'Failed to parse category data' });
      }

      // カテゴリの検証
      for (const category of categories.categories) {
        // ユーザーIDを持つテーブルが存在するか確認
        const hasUserIdTable = category.tables.some(tableName => {
          const table = tables.find(t => t.tableName === tableName);
          return table && table.columns.some(col => col.isUserId);
        });

        if (!hasUserIdTable) {
          return res.status(400).json({ 
            error: `Category "${category.name}" does not contain any table with a user ID column` 
          });
        }
      }

      // 生成されたカテゴリを返す（保存はしない）
      res.status(200).json({ categories: categories.categories });
    } catch (error) {
      console.error('Category generation error:', error);
      res.status(500).json({ error: 'Failed to generate categories' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 