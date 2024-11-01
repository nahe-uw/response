import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 処理時間を計測するユーティリティ関数を追加
function measureTime(startTime) {
  const endTime = performance.now();
  return `${(endTime - startTime).toFixed(2)}ms`;
}

// スキーマ情報の取得
async function getSchemaInfo(categoryIds, prismaUser) {
  const startTime = performance.now();
  console.log('=== Getting Schema Info ===');
  
  // 1. カテゴリに関連するテーブルを取得
  const categories = await prisma.dataCategory.findMany({
    select: {
      id: true,
      categoryName: true,
      tables: {
        select: {
          tableName: true
        }
      }
    },
    where: {
      id: { in: categoryIds.map(id => parseInt(id)) },
      userId: prismaUser.id
    }
  });
  console.log('Found categories:', categories);

  // 2. テーブル情報を取得
  const tableNames = categories.flatMap(cat => cat.tables.map(t => t.tableName));
  console.log('Table names:', tableNames);

  const tables = await prisma.table.findMany({
    select: {
      id: true,
      tableName: true,
      tableDescription: true,
      apiConnection: {
        select: {
          apiURL: true,
          authToken: true
        }
      },
      columns: {
        select: {
          id: true,
          columnName: true,
          columnDescription: true,
          isUserId: true,
          valueMappings: {
            select: {
              value: true,
              meaning: true
            }
          }
        }
      }
    },
    where: {
      tableName: { in: tableNames },
      apiConnection: {
        userId: prismaUser.id
      }
    }
  });
  console.log('Found tables with details:', tables);

  // 3. テーブル間の関係を取得
  const relations = await prisma.tableRelation.findMany({
    select: {
      fromTable: true,
      fromColumn: true,
      toTable: true,
      toColumn: true
    },
    where: {
      userId: prismaUser.id,
      fromTable: { in: tableNames },
      toTable: { in: tableNames }
    }
  });
  console.log('Found relations:', relations);

  const duration = measureTime(startTime);
  console.log(`Schema Info completed in ${duration}`);
  return { tables, relations };
}

// データの取得と整形
async function fetchAndFormatData(tables, relations, targetUserId) {
  const startTime = performance.now();
  console.log('=== Fetching and Formatting Data ===');
  console.log('Target User ID:', targetUserId);
  
  let processedData = {};
  const processedTables = new Set();
  const relatedValuesMap = new Map(); // 変数名を変更

  // テーブルのデータを取得する関数
  async function fetchTableData(table) {
    const response = await fetch(table.apiConnection.apiURL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${table.apiConnection.authToken}`
      }
    });

    if (!response.ok) {
      console.error(`Failed to fetch data for ${table.tableName}`);
      return null;
    }

    const responseData = await response.json();
    console.log(`Raw data received for ${table.tableName}:`, responseData);

    return Array.isArray(responseData) ? responseData :
      responseData[table.tableName] ? responseData[table.tableName] :
      Object.values(responseData);
  }

  // ユーザーIDを持つテーブルから処理を開始
  async function processUserIdTables() {
    for (const table of tables) {
      // 全てのユーザーIDカラムを取得
      const userIdColumns = table.columns.filter(col => col.isUserId);
      
      if (userIdColumns.length > 0) {
        const data = await fetchTableData(table);
        if (!data || !Array.isArray(data)) continue;

        // 各ユーザーIDカラムに基づいてフィルタリング
        const filteredData = data.filter(item => 
          userIdColumns.some(col => 
            item && item[col.columnName] && 
            String(item[col.columnName]) === String(targetUserId)
          )
        );

        if (filteredData.length > 0) {
          processedData[table.tableName] = filteredData;
          processedTables.add(table.tableName);

          // 関連テーブルで使用する可能性のある値を保存
          table.columns.forEach(col => {
            const values = filteredData.map(item => String(item[col.columnName]));
            relatedValuesMap.set(`${table.tableName}.${col.columnName}`, values);
          });

          // ログ出力を追加
          console.log(`Processed ${table.tableName} with user ID columns:`, 
            userIdColumns.map(col => col.columnName));
          console.log(`Found records:`, filteredData);
        }
      }
    }
  }

  // 関連テーブルを再帰的に処理
  async function processRelatedTables() {
    let hasNewData = true;
    while (hasNewData) {
      hasNewData = false;
      for (const table of tables) {
        if (processedTables.has(table.tableName)) continue;

        // このテーブルに関連する関係を探す
        const tableRelations = relations.filter(r => 
          (r.fromTable === table.tableName && processedTables.has(r.toTable)) ||
          (r.toTable === table.tableName && processedTables.has(r.fromTable))
        );

        for (const relation of tableRelations) {
          const isFromTable = relation.fromTable === table.tableName;
          const relatedTable = isFromTable ? relation.toTable : relation.fromTable;
          const relatedColumn = isFromTable ? relation.toColumn : relation.fromColumn;
          const currentColumn = isFromTable ? relation.fromColumn : relation.toColumn;

          // 関連テーブルの値を取得
          const relatedValues = relatedValuesMap.get(`${relatedTable}.${relatedColumn}`); // 変数名を変更
          if (!relatedValues) continue;

          const data = await fetchTableData(table);
          if (!data || !Array.isArray(data)) continue;

          const filteredData = data.filter(item =>
            item && item[currentColumn] &&
            relatedValues.includes(String(item[currentColumn]))
          );

          if (filteredData.length > 0) {
            processedData[table.tableName] = filteredData;
            processedTables.add(table.tableName);
            hasNewData = true;

            // 新しく取得したデータの値を保存
            table.columns.forEach(col => {
              const values = filteredData.map(item => String(item[col.columnName]));
              relatedValuesMap.set(`${table.tableName}.${col.columnName}`, values); // 変数名を変更
            });
          }
        }
      }
    }
  }

  // 処理の実行
  await processUserIdTables();
  await processRelatedTables();

  console.log('=== Formatted Data Structure ===');
  console.log(JSON.stringify(processedData, null, 2));

  const duration = measureTime(startTime);
  console.log(`Data fetching and formatting completed in ${duration}`);
  return processedData;
}

// スキーマ情報の整形
function formatSchemaInfo(tables, relations) {
  const startTime = performance.now();
  console.log('=== Formatting Schema Info ===');
  
  const schema = {
    tables: {},
    relations: relations.map(r => ({
      fromTable: r.fromTable,
      fromColumn: r.fromColumn,
      toTable: r.toTable,
      toColumn: r.toColumn
    }))
  };

  tables.forEach(table => {
    schema.tables[table.tableName] = {
      description: table.tableDescription || '',
      columns: table.columns.reduce((acc, col) => {
        const columnInfo = {
          description: col.columnDescription || ''
        };

        // isUserIdがtrueの場合のみ追加
        if (col.isUserId) {
          columnInfo.isUserId = true;
        }

        // valueMappingsが存在し、空でない場合のみ追加
        if (col.valueMappings && col.valueMappings.length > 0) {
          columnInfo.valueMappings = col.valueMappings.reduce((mappings, vm) => {
            mappings[vm.value] = vm.meaning;
            return mappings;
          }, {});
        }

        acc[col.columnName] = columnInfo;
        return acc;
      }, {})
    };
  });

  console.log('Formatted schema:', schema);

  const duration = measureTime(startTime);
  console.log(`Schema formatting completed in ${duration}`);
  return schema;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const totalStartTime = performance.now();
    try {
      console.log('=== Starting Data Preparation ===');
      const { userId, inquiryContent, categoryIds } = req.body;
      console.log('Request parameters:', { userId, categoryIds, inquiryContent });

      // 認証処理の時間計
      const authStartTime = performance.now();
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'No authorization header' });
      }

      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (error || !user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const prismaUser = await prisma.user.findUnique({
        where: { email: user.email }
      });

      if (!prismaUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      console.log(`Authentication completed in ${measureTime(authStartTime)}`);

      // スキーマ情報の取得
      const { tables, relations } = await getSchemaInfo(categoryIds, prismaUser);
      
      // データの取得と整形
      const data = await fetchAndFormatData(tables, relations, userId);
      
      // スキーマ情報の整形
      const schema = formatSchemaInfo(tables, relations);

      // GPT処理の時間計測
      const gptStartTime = performance.now();
      console.log('=== Starting GPT Processing ===');
       
      // GPTへの入力データを構築
      const gptInput = {
        targetUserId: userId,
        schema,
        data
      };

      // ログ出力を整形
      console.log('=== Final GPT Input ===');
      console.log('Target User ID:', userId);

      // スキーマ情報の簡略表示
      console.log('\nSchema:');
      Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
        // テーブル名と説明を表示
        console.log(`\n${tableName}: ${tableInfo.description}`);
        
        // カラム情報を表示
        Object.entries(tableInfo.columns).forEach(([columnName, columnInfo]) => {
          const details = [];
          
          // カラムの属性を収集
          if (columnInfo.isUserId) {
            details.push('isUserId: true');
          }
          if (columnInfo.valueMappings) {
            const mappings = Object.entries(columnInfo.valueMappings)
              .map(([value, meaning]) => `${value} → ${meaning}`)
              .join(', ');
            if (mappings) {
              details.push(`mappings: {${mappings}}`);
            }
          }

          // カラム情報を整形して表示
          const detailsStr = details.length ? ` (${details.join(', ')})` : '';
          const description = columnInfo.description ? `: ${columnInfo.description}` : '';
          console.log(`  ${columnName}${description}${detailsStr}`);
        });
      });

      // リレーション情報の表示
      console.log('\nRelations:');
      schema.relations.forEach(relation => {
        console.log(`  ${relation.fromTable}.${relation.fromColumn} → ${relation.toTable}.${relation.toColumn}`);
      });

      // データの簡略表示を修正
      console.log('\nData:');
      Object.entries(data).forEach(([tableName, records]) => {
        console.log(`\n${tableName}: ${records.length} records`);
        console.log('All records:');
        records.forEach((record, index) => {
          console.log(`Record ${index + 1}:`, JSON.stringify(record, null, 2));
        });
      });

      // データ要約の生成
      const dataSummaryCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `ユーザーID: ${userId} に関連するデータの特徴と傾向に焦点を当てた要約を生成してください。

            特に以下の点に注意してください：
            - ユーザーID（isUserId: true）があるカラムがユーザーIDです
            - テーブル間の関係性を考慮
            - 値マッピングによる意味の解釈を行う
            
            実データの特徴と傾向のみを簡潔に要約してください。`
          },
          {
            role: "user",
            content: JSON.stringify(gptInput)
          }
        ]
      });

      const dataSummary = dataSummaryCompletion.choices[0].message.content;
      console.log('Generated data summary:', dataSummary);
      console.log(`GPT processing completed in ${measureTime(gptStartTime)}`);

      // 問い合わせ内容の分解
      const inquiryStartTime = performance.now();
      console.log('=== Starting Inquiry Processing ===');
      
      const inquiryElementsCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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
      console.log(`Inquiry processing completed in ${measureTime(inquiryStartTime)}`);

      // 結果の保存
      const saveStartTime = performance.now();
      console.log('=== Saving Results ===');
      
      const inquiryHistory = await prisma.inquiryHistory.create({
        data: {
          userId: prismaUser.id,
          inquiryContent,
          inquiryElements,
          dataSummary,
        }
      });
      console.log(`Results saved in ${measureTime(saveStartTime)}`);

      const totalDuration = measureTime(totalStartTime);
      console.log(`=== Total Processing Time: ${totalDuration} ===`);

      res.status(200).json({
        dataSummary,
        inquiryElements,
        inquiryHistoryId: inquiryHistory.id
      });
    } catch (error) {
      console.error('Preparation error:', error);
      const totalDuration = measureTime(totalStartTime);
      console.log(`=== Failed - Total Processing Time: ${totalDuration} ===`);
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