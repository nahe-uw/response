import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { type, id, description, isUserId } = req.body;

      // リクエストヘッダーからセッション情報を取得
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      // Supabaseのセッションを取得
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

      if (error || !user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Prismaの`User`テーブルからユーザーを検索
      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      // typeに応じてテーブルまたはカラムの説明を更新
      if (type === 'table') {
        const updatedTable = await prisma.table.update({
          where: { id },
          data: { tableDescription: description },
        });
        res.status(200).json({ table: updatedTable });
      } 
      else if (type === 'column') {
        const updatedColumn = await prisma.column.update({
          where: { id },
          data: { 
            columnDescription: description,
            isUserId: isUserId || false
          },
        });
        res.status(200).json({ column: updatedColumn });
      }
      else {
        res.status(400).json({ error: 'Invalid update type' });
      }
    } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({ error: 'Failed to update description' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 