import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';

export default function Mapping() {
  const [tables, setTables] = useState([]);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const [editedDescriptions, setEditedDescriptions] = useState({});
  const [valueMappingForms, setValueMappingForms] = useState({});
  const [editedValueMappings, setEditedValueMappings] = useState({});
  const [userIdFlags, setUserIdFlags] = useState({});
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState({
    fromTable: '',
    fromColumn: '',
    toTable: '',
    toColumn: '',
  });

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
        // セッション情報を取得
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
          const initialFlags = {};
          data.tables.forEach(table => {
            table.columns.forEach(column => {
              initialFlags[column.id] = column.isUserId;
            });
          });
          setUserIdFlags(initialFlags);
        } else {
          setMessage(`Error: ${data.error}`);
        }
      } catch (error) {
        setMessage('Failed to fetch tables');
      }
    };

    fetchTables();
  }, []);

  // 説明の一時保存
  const handleDescriptionChange = (type, id, value) => {
    setEditedDescriptions(prev => ({
      ...prev,
      [`${type}-${id}`]: value
    }));
  };

  // 説明の保存とValueMappingの保存を一括で行う
  const handleSaveAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      // 説明の保存
      for (const [key, value] of Object.entries(editedDescriptions)) {
        const [type, id] = key.split('-');
        
        await fetch('/api/mapping/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            type,
            id: parseInt(id),
            description: value
          }),
        });
      }

      // ValueMappingの保存
      for (const [columnId, mappings] of Object.entries(editedValueMappings)) {
        for (const mapping of mappings) {
          await fetch('/api/mapping/value', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              columnId: parseInt(columnId),
              value: mapping.value,
              meaning: mapping.meaning
            }),
          });
        }
      }

      setMessage('All changes saved successfully!');
      setEditedDescriptions({});
      setEditedValueMappings({});
    } catch (error) {
      setMessage('Failed to save changes');
    }
  };

  // ValueMappingフォームの追加
  const handleAddValueMappingForm = (columnId) => {
    setValueMappingForms(prev => ({
      ...prev,
      [columnId]: [...(prev[columnId] || []), { value: '', meaning: '' }]
    }));
  };

  // ValueMappingフォームの更新
  const handleValueMappingChange = (columnId, index, field, value) => {
    setValueMappingForms(prev => {
      const forms = [...(prev[columnId] || [])];
      forms[index] = { ...forms[index], [field]: value };
      return { ...prev, [columnId]: forms };
    });

    // 編集内容を一時保存
    setEditedValueMappings(prev => {
      const mappings = [...(prev[columnId] || [])];
      mappings[index] = { value: field === 'value' ? value : mappings[index]?.value || '',
                         meaning: field === 'meaning' ? value : mappings[index]?.meaning || '' };
      return { ...prev, [columnId]: mappings };
    });
  };

  const handleUserIdFlagUpdate = async (columnId, isChecked) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/mapping/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'column',
          id: columnId,
          isUserId: isChecked
        }),
      });

      if (res.ok) {
        setUserIdFlags(prev => ({
          ...prev,
          [columnId]: isChecked
        }));
      } else {
        setMessage('Failed to update user ID flag');
      }
    } catch (error) {
      setMessage('An error occurred while updating user ID flag');
    }
  };

  // テーブル連結フォームを表示
  const handleShowRelationForm = () => {
    setShowRelationForm(true);
  };

  // テーブル連結の保存
  const handleSaveRelation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/mapping/relation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(selectedRelation),
      });

      if (res.ok) {
        setMessage('Relation saved successfully!');
        setShowRelationForm(false);
        setSelectedRelation({
          fromTable: '',
          fromColumn: '',
          toTable: '',
          toColumn: '',
        });
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to save relation');
    }
  };

  return (
    <div>
      <h1>Data Mapping</h1>
      {message && <p>{message}</p>}
      
      {/* 保存ボタンを上部に配置 */}
      <button onClick={handleSaveAll}>Save All Changes</button>
      
      <div>
        <h2>Tables</h2>
        {tables.map(table => (
          <div key={table.id}>
            <h3>{table.tableName}</h3>
            <input
              type="text"
              placeholder="Table Description"
              defaultValue={table.tableDescription || ''}
              onChange={(e) => handleDescriptionChange('table', table.id, e.target.value)}
            />
            
            <h4>Columns</h4>
            {table.columns?.map(column => (
              <div key={column.id}>
                <span>{column.columnName}</span>
                <input
                  type="text"
                  placeholder="Column Description"
                  defaultValue={column.columnDescription || ''}
                  onChange={(e) => handleDescriptionChange('column', column.id, e.target.value)}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={userIdFlags[column.id] || false}
                    onChange={(e) => handleUserIdFlagUpdate(column.id, e.target.checked)}
                  />
                  Is User ID
                </label>
                
                {/* Value Mapping セクション */}
                <div style={{ marginLeft: '20px' }}>
                  <button onClick={() => handleAddValueMappingForm(column.id)}>
                    Add Value Mapping
                  </button>
                  
                  {/* Value Mapping フォーム */}
                  {valueMappingForms[column.id]?.map((form, index) => (
                    <div key={index} style={{ marginTop: '10px' }}>
                      <input
                        type="text"
                        placeholder="Value"
                        value={form.value}
                        onChange={(e) => handleValueMappingChange(column.id, index, 'value', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Meaning"
                        value={form.meaning}
                        onChange={(e) => handleValueMappingChange(column.id, index, 'meaning', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* テーブル連結セクション */}
      <div style={{ marginTop: '20px' }}>
        <h2>Table Relations</h2>
        <button onClick={handleShowRelationForm}>Add Table Relation</button>
        
        {showRelationForm && (
          <div style={{ marginTop: '10px' }}>
            <h3>Add Table Relation</h3>
            <div>
              <select
                value={`${selectedRelation.fromTable}.${selectedRelation.fromColumn}`}
                onChange={(e) => {
                  const [table, column] = e.target.value.split('.');
                  setSelectedRelation(prev => ({
                    ...prev,
                    fromTable: table,
                    fromColumn: column
                  }));
                }}
              >
                <option value="">Select From Column</option>
                {tables.map(table => 
                  table.columns.map(column => (
                    <option key={`${table.tableName}.${column.columnName}`} value={`${table.tableName}.${column.columnName}`}>
                      {`${table.tableName}.${column.columnName}`}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div style={{ marginTop: '10px' }}>
              <select
                value={`${selectedRelation.toTable}.${selectedRelation.toColumn}`}
                onChange={(e) => {
                  const [table, column] = e.target.value.split('.');
                  setSelectedRelation(prev => ({
                    ...prev,
                    toTable: table,
                    toColumn: column
                  }));
                }}
              >
                <option value="">Select To Column</option>
                {tables.map(table => 
                  table.columns.map(column => (
                    <option key={`${table.tableName}.${column.columnName}`} value={`${table.tableName}.${column.columnName}`}>
                      {`${table.tableName}.${column.columnName}`}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div style={{ marginTop: '10px' }}>
              <button onClick={handleSaveRelation}>Save Relation</button>
              <button onClick={() => setShowRelationForm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 