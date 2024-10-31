import prisma from '../../../prisma';
import { supabase } from '../../../supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const { categories } = req.body;

      // セッション確認
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error || !user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Prismaの`User`テーブルからユーザーを検索
      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // トランザクションを使用して、既存のカテゴリを削除し、新しいカテゴリを保存
      await prisma.$transaction(async (prisma) => {
        // 1. 既存のCategoryTableMappingを削除
        await prisma.categoryTableMapping.deleteMany({
          where: {
            dataCategory: {
              userId: prismaUser.id
            }
          }
        });

        // 2. 既存のDataCategoryを削除
        await prisma.dataCategory.deleteMany({
          where: {
            userId: prismaUser.id
          }
        });

        // 3. 新しいカテゴリを保存
        for (const category of categories) {
          const savedCategory = await prisma.dataCategory.create({
            data: {
              userId: prismaUser.id,
              categoryName: category.name,
            }
          });

          // カテゴリとテーブルの関連付けを保存
          for (const tableName of category.tables) {
            await prisma.categoryTableMapping.create({
              data: {
                DataCategoryId: savedCategory.id,
                tableName
              }
            });
          }
        }
      });

      res.status(200).json({ message: 'Categories saved successfully' });
    } catch (error) {
      console.error('Category save error:', error);
      res.status(500).json({ error: 'Failed to save categories' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 