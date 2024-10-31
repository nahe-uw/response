import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';
import CategoryEditor from '../components/CategoryEditor';

export default function Category() {
  const [savedCategories, setSavedCategories] = useState([]); // 保存済みカテゴリ
  const [generatedCategories, setGeneratedCategories] = useState(null); // 生成されたカテゴリ（未保存）
  const [editingCategories, setEditingCategories] = useState(null); // 編集中のカテゴリ
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [tables, setTables] = useState([]);
  const router = useRouter();

  // セッションチェック
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/login');
        return;
      }
    };

    checkSession();
  }, [router]);

  // テーブル一覧の取得
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setMessage('Not authenticated');
          return;
        }

        const res = await fetch('/api/mapping/tables', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        const data = await res.json();
        if (res.ok) {
          setTables(data.tables);
        } else {
          setMessage(`Error: ${data.error}`);
        }
      } catch (error) {
        setMessage('Failed to fetch tables');
      }
    };

    fetchTables();
  }, []);

  // 保存済みカテゴリの取得
  const fetchSavedCategories = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/category', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setSavedCategories(data.categories);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to fetch categories');
    }
  };

  useEffect(() => {
    fetchSavedCategories();
  }, []);

  // カテゴリの自動生成
  const handleGenerateCategories = async () => {
    try {
      setIsGenerating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/category/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedCategories(data.categories);
        setEditingCategories(data.categories); // 編集用にコピー
        setMessage('Categories generated! Please review and edit if needed.');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to generate categories');
    } finally {
      setIsGenerating(false);
    }
  };

  // カテゴリの編集
  const handleEditCategory = (index, updatedCategory) => {
    setEditingCategories(prev => {
      const newCategories = [...prev];
      newCategories[index] = updatedCategory;
      return newCategories;
    });
  };

  // カテゴリの追加
  const handleAddCategory = () => {
    setEditingCategories(prev => [
      ...prev,
      {
        name: 'New Category',
        tables: []
      }
    ]);
  };

  // カテゴリの削除
  const handleDeleteCategory = (index) => {
    setEditingCategories(prev => prev.filter((_, i) => i !== index));
  };

  // 編集内容の保存
  const handleSaveCategories = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/category/save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories: editingCategories }),
      });

      if (res.ok) {
        setMessage('Categories saved successfully!');
        setGeneratedCategories(null);
        setEditingCategories(null);
        fetchSavedCategories();
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to save categories');
    }
  };

  // 保存済みカテゴリの編集開始
  const handleEditSavedCategories = () => {
    setEditingCategories(savedCategories.map(cat => ({
      name: cat.categoryName,
      tables: cat.tables.map(t => t.tableName)
    })));
  };

  return (
    <div>
      <h1>Data Categories</h1>
      {message && <p>{message}</p>}

      {/* カテゴリ生成ボタン */}
      {!editingCategories && (
        <button 
          onClick={handleGenerateCategories}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Categories'}
        </button>
      )}

      {/* 編集中のカテゴリ（生成後または保存済みの編集） */}
      {editingCategories && (
        <div style={{ marginTop: '20px' }}>
          <h2>Edit Categories</h2>
          {editingCategories.map((category, index) => (
            <div key={index} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
              <input
                type="text"
                value={category.name}
                onChange={(e) => handleEditCategory(index, { ...category, name: e.target.value })}
              />
              <div>
                <h4>Select Tables:</h4>
                {tables.map(table => (
                  <div key={table.tableName}>
                    <label>
                      <input
                        type="checkbox"
                        checked={category.tables.includes(table.tableName)}
                        onChange={(e) => {
                          const newTables = e.target.checked
                            ? [...category.tables, table.tableName]
                            : category.tables.filter(t => t !== table.tableName);
                          handleEditCategory(index, { ...category, tables: newTables });
                        }}
                      />
                      {table.tableName}
                      {table.columns.some(col => col.isUserId) && ' (has UserID)'}
                    </label>
                  </div>
                ))}
              </div>
              <button onClick={() => handleDeleteCategory(index)}>Delete Category</button>
            </div>
          ))}
          <button onClick={handleAddCategory}>Add New Category</button>
          <button onClick={handleSaveCategories}>Save All Categories</button>
          <button onClick={() => setEditingCategories(null)}>Cancel</button>
        </div>
      )}

      {/* 保存済みカテゴリの表示 */}
      {!editingCategories && savedCategories.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Saved Categories</h2>
          {savedCategories.map(category => (
            <div key={category.id} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
              <h3>{category.categoryName}</h3>
              <div>
                <h4>Tables:</h4>
                <ul>
                  {category.tables.map(table => (
                    <li key={table.tableName}>{table.tableName}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <button onClick={handleEditSavedCategories}>Edit Categories</button>
        </div>
      )}
    </div>
  );
} 