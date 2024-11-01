import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { userId, inquiryContent, categoryIds } = req.body;

      // リクエストの内容を確認
      console.log('Request body:', {
        userId,
        categoryIds,
        inquiryContent
      });

      // セッション確認
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error || !user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Prismaユーザーの取得
      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        console.error('Prisma user not found for email:', user.email);
        return res.status(404).json({ error: 'User not found in database' });
      }

      console.log('Prisma user found:', prismaUser);

      // データ収集のログ
      console.log('=== Data Collection Start ===');
      console.log('Selected Category IDs:', categoryIds);

      // 選択されたカテゴリに関連するテーブル情報を取得
      const categories = await prisma.dataCategory.findMany({
        where: {
          id: { in: categoryIds.map(id => parseInt(id)) },
          userId: prismaUser.id  // prismaUserのIDを使用
        },
        include: {
          tables: true
        }
      });

      console.log('Found Categories:', JSON.stringify(categories, null, 2));

      // テーブル間の関連情報を取得
      const tableRelations = await prisma.tableRelation.findMany({
        where: {
          userId: prismaUser.id  // prismaUserのIDを使用
        }
      });

      console.log('Table Relations:', JSON.stringify(tableRelations, null, 2));

      // 各テーブルの詳細情報を収集
      const tableData = {};
      for (const category of categories) {
        for (const tableMapping of category.tables) {
          // テーブルの基本情報を取得
          const table = await prisma.table.findFirst({
            where: { 
              tableName: tableMapping.tableName,
              apiConnection: {
                userId: prismaUser.id  // prismaUserのIDを使用
              }
            },
            include: {
              columns: {
                include: {
                  valueMappings: true
                }
              },
              apiConnection: true
            }
          });

          if (table) {
            console.log(`Found table:`, JSON.stringify(table, null, 2));
            console.log(`Processing table: ${table.tableName}`);
            console.log('Table structure:', {
              description: table.tableDescription,
              columns: table.columns.map(col => ({
                name: col.columnName,
                description: col.columnDescription,
                isUserId: col.isUserId,
                valueMappings: col.valueMappings
              }))
            });

            // APIからデータを取得
            const response = await fetch(`${table.apiConnection.apiURL}/${table.tableName}`, {
              headers: {
                'Authorization': `Bearer ${table.apiConnection.authToken}`
              }
            });

            if (response.ok) {
              const apiData = await response.json();
              console.log(`API Data for ${table.tableName}:`, apiData);
              
              // テーブルの完全な情報を構築
              tableData[table.tableName] = {
                description: table.tableDescription,
                apiUrl: table.apiConnection.apiURL,
                columns: table.columns.map(column => ({
                  name: column.columnName,
                  description: column.columnDescription,
                  isUserId: column.isUserId,
                  valueMappings: column.valueMappings.reduce((acc, mapping) => {
                    acc[mapping.value] = mapping.meaning;
                    return acc;
                  }, {})
                })),
                relations: tableRelations.filter(relation => 
                  relation.fromTable === table.tableName || 
                  relation.toTable === table.tableName
                ),
                data: apiData
              };
            }
          }
        }
      }

      // GPTへの入力データをログ出力
      console.log('=== GPT Input Data ===');
      console.log('Complete data structure:', {
        tables: tableData,
        relations: tableRelations,
        categories: categories.map(cat => ({
          name: cat.categoryName,
          tables: cat.tables.map(t => t.tableName)
        }))
      });
      console.log('=== Data Collection End ===');

      // データ要約の生成
      const dataSummaryCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `以下のデータを分析し、包括的な要約を生成してください：
            1. 各テーブルの構造と意味
            2. カラムの説明と特徴（特にユーザーIDカラム）
            3. 値の意味マッピング
            4. テーブル間の関連性
            5. 実際のデータの特徴や傾向

            これらの情報を統合して、データ全体の意味と関連性を説明してください。`
          },
          {
            role: "user",
            content: JSON.stringify({
              tables: tableData,
              relations: tableRelations,
              categories: categories.map(cat => ({
                name: cat.categoryName,
                tables: cat.tables.map(t => t.tableName)
              }))
            })
          }
        ]
      });

      const dataSummary = dataSummaryCompletion.choices[0].message.content;

      // 問い合わせ内容の分解
      const inquiryElementsCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "問い合わせ内容を要素に分解し、各要素が必要とするデータを特定してください。"
          },
          {
            role: "user",
            content: inquiryContent
          }
        ]
      });

      const inquiryElements = inquiryElementsCompletion.choices[0].message.content;

      // 結果を一時保存
      const inquiryHistory = await prisma.inquiryHistory.create({
        data: {
          userId: prismaUser.id,  // prismaUserのIDを使用
          inquiryContent,
          inquiryElements,
          dataSummary,
        }
      });

      res.status(200).json({
        dataSummary,
        inquiryElements,
        inquiryHistoryId: inquiryHistory.id
      });
    } catch (error) {
      console.error('Preparation error:', error);
      res.status(500).json({ 
        error: 'Failed to prepare data',
        details: error.message
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 