import { useState } from 'react';

export default function CategoryEditor({ category, tables, onSave, onCancel }) {
  const [editedCategory, setEditedCategory] = useState({
    name: category.name,
    tables: [...category.tables]
  });

  const handleTableToggle = (tableName) => {
    setEditedCategory(prev => {
      const tables = prev.tables.includes(tableName)
        ? prev.tables.filter(t => t !== tableName)
        : [...prev.tables, tableName];
      return { ...prev, tables };
    });
  };

  const handleSave = () => {
    // カテゴリ内に少なくとも1つのユーザーIDテーブルが含まれているか確認
    const hasUserIdTable = editedCategory.tables.some(tableName => {
      const table = tables.find(t => t.tableName === tableName);
      return table && table.columns.some(col => col.isUserId);
    });

    if (!hasUserIdTable) {
      alert('Category must contain at least one table with a user ID column');
      return;
    }

    onSave(editedCategory);
  };

  return (
    <div className="category-editor">
      <input
        type="text"
        value={editedCategory.name}
        onChange={(e) => setEditedCategory(prev => ({ ...prev, name: e.target.value }))}
        placeholder="Category Name"
      />

      <div className="table-selector">
        <h4>Select Tables:</h4>
        {tables.map(table => (
          <div key={table.tableName}>
            <label>
              <input
                type="checkbox"
                checked={editedCategory.tables.includes(table.tableName)}
                onChange={() => handleTableToggle(table.tableName)}
              />
              {table.tableName}
              {table.columns.some(col => col.isUserId) && ' (has UserID)'}
            </label>
          </div>
        ))}
      </div>

      <div className="buttons">
        <button onClick={handleSave}>Save Changes</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
} 