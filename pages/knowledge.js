import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';

export default function Knowledge() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [knowledgeName, setKnowledgeName] = useState('');
  const [type, setType] = useState('pdf'); // 'pdf', 'url', 'text'
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState([]);
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
    fetchKnowledgeList();
  }, [router]);

  // ナレッジ一覧の取得
  const fetchKnowledgeList = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/knowledge', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setKnowledgeList(data.knowledge);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to fetch knowledge list');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (type === 'url' && !url) {
      setMessage('Please enter a URL');
      return;
    }
    if (type !== 'url' && !file) {
      setMessage('Please select a file');
      return;
    }
    if (!knowledgeName) {
      setMessage('Please enter a name');
      return;
    }

    setIsUploading(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      let content;
      if (type === 'url') {
        content = url;
      } else {
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = resolve;
          reader.onerror = reject;
          if (type === 'pdf') {
            reader.readAsDataURL(file);
          } else {
            reader.readAsText(file);
          }
        });
        content = type === 'pdf' ? reader.result.split(',')[1] : reader.result;
      }

      const res = await fetch('/api/knowledge/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          knowledgeName,
          type,
          content
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Knowledge uploaded successfully!');
        setFile(null);
        setUrl('');
        setKnowledgeName('');
        fetchKnowledgeList();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to upload knowledge');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <h1>Knowledge Management</h1>
      {message && <p>{message}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Knowledge Name:
            <input
              type="text"
              value={knowledgeName}
              onChange={(e) => setKnowledgeName(e.target.value)}
              required
            />
          </label>
        </div>

        <div>
          <label>
            Type:
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="url">URL</option>
              <option value="text">Text</option>
            </select>
          </label>
        </div>

        {type === 'url' ? (
          <div>
            <label>
              URL:
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL"
                required
              />
            </label>
          </div>
        ) : (
          <div>
            <label>
              File ({type === 'pdf' ? 'PDF' : 'Text'}):
              <input
                type="file"
                accept={type === 'pdf' ? '.pdf' : '.txt'}
                onChange={(e) => setFile(e.target.files[0])}
                required
              />
            </label>
          </div>
        )}

        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Upload Knowledge'}
        </button>
      </form>

      <div style={{ marginTop: '20px' }}>
        <h2>Uploaded Knowledge</h2>
        {knowledgeList.length > 0 ? (
          <ul>
            {knowledgeList.map(item => (
              <li key={item.id}>
                {item.knowledgeName} ({item.type})
                <span style={{ marginLeft: '10px', color: 'gray' }}>
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No knowledge uploaded yet</p>
        )}
      </div>
    </div>
  );
} 