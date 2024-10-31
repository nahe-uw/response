import prisma from '../../prisma';
import { supabase } from '../../supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { apiUrl, authToken } = req.body;

    try {
      // リクエストヘッダーからセッション情報を取得
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        console.error('No authorization header found');
        return res.status(401).json({ error: 'No authorization header' });
      }

      // Supabaseのセッションを取得
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

      if (error || !user) {
        console.error('Server-side session error:', error);
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Prismaの`User`テーブルからユーザーを検索
      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      // API接続情報をデータベースに保存（PrismaのユーザーIDを使用）
      const apiConnection = await prisma.aPIConnection.create({
        data: {
          apiURL: apiUrl,
          authToken,
          userId: prismaUser.id, // 整数のIDを使用
        },
      });

      // APIからデータを取得
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      console.log('Fetched API data:', data);

      // レスポンスのキーからテーブルを作成
      for (const [tableName, records] of Object.entries(data)) {
        if (Array.isArray(records) && records.length > 0) {
          console.log(`Processing table: ${tableName}`);

          // テーブルを作成
          const savedTable = await prisma.table.create({
            data: {
              tableName,
              apiConnectionId: apiConnection.id,
            },
          });

          // 最初のレコードのキーからカラムを作成
          const columns = Object.keys(records[0]);
          for (const columnName of columns) {
            console.log(`Creating column: ${columnName}`);
            await prisma.column.create({
              data: {
                tableId: savedTable.id,
                columnName,
                isUserId: columnName.toLowerCase() === 'id', // idカラムの場合はisUserIdをtrueに設定
              },
            });
          }
        }
      }

      res.status(200).json({ message: 'Connection and table data saved successfully!' });
    } catch (error) {
      console.error('Connection error:', error);
      res.status(400).json({ error: 'Failed to save API connection and table data' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}