import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Training() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [trainingDataList, setTrainingDataList] = useState([]);
  const [selectedTrainingData, setSelectedTrainingData] = useState([]);
  const [modelName, setModelName] = useState('');
  const [isCreatingModel, setIsCreatingModel] = useState(false);
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
    fetchTrainingDataList();
  }, [router]);

  // トレーニングデータ一覧の取得
  const fetchTrainingDataList = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/training', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setTrainingDataList(data.trainingData);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to fetch training data list');
    }
  };

  // ファイルの処理
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv') {
        setFile(selectedFile);
      } else {
        setMessage('Please select a CSV file');
        setFile(null);
      }
    }
  };

  // アップロード処理
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a file');
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

      // ファイルを読み込む
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;

        const res = await fetch('/api/training/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            content
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setMessage('Training data uploaded successfully!');
          setFile(null);
          fetchTrainingDataList();
        } else {
          setMessage(`Error: ${data.error}`);
        }
      };

      reader.readAsText(file);
    } catch (error) {
      setMessage('Failed to upload training data');
    } finally {
      setIsUploading(false);
    }
  };

  // 削除処理を追加
  const handleDelete = async (trainingDataId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch(`/api/training/delete?trainingDataId=${trainingDataId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        setMessage('Training data deleted successfully!');
        fetchTrainingDataList(); // リストを再取得
      } else {
        const data = await res.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to delete training data');
    }
  };

  // トレーニングモデルの作成
  const handleCreateModel = async (e) => {
    e.preventDefault();
    if (selectedTrainingData.length === 0) {
      setMessage('Please select training data');
      return;
    }
    if (!modelName) {
      setMessage('Please enter a model name');
      return;
    }

    setIsCreatingModel(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/training/model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          modelName,
          trainingDataIds: selectedTrainingData
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Training model creation started!');
        setModelName('');
        setSelectedTrainingData([]);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to create training model');
    } finally {
      setIsCreatingModel(false);
    }
  };

  // トレーニングデータの選択を処理
  const handleTrainingDataSelect = (id) => {
    setSelectedTrainingData(prev => {
      if (prev.includes(id)) {
        return prev.filter(dataId => dataId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  return (
    <div>
      <h1>Training Data Management</h1>
      {message && <p>{message}</p>}

      <div style={{ marginBottom: '20px' }}>
        <Link href="/knowledge">
          Go to Knowledge Management
        </Link>
      </div>

      <form onSubmit={handleUpload}>
        <div>
          <label>
            Training Data File (CSV):
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              required
            />
          </label>
        </div>

        <button type="submit" disabled={isUploading || !file}>
          {isUploading ? 'Uploading...' : 'Upload Training Data'}
        </button>
      </form>

      <div style={{ marginTop: '20px' }}>
        <h2>Uploaded Training Data</h2>
        {trainingDataList.length > 0 ? (
          <ul>
            {trainingDataList.map(item => (
              <li key={item.id} style={{ marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={selectedTrainingData.includes(item.id)}
                  onChange={() => handleTrainingDataSelect(item.id)}
                />
                <span>{item.fileName}</span>
                <span style={{ marginLeft: '10px', color: 'gray' }}>
                  {new Date(item.created_at).toLocaleString()}
                </span>
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ marginLeft: '10px' }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No training data uploaded yet</p>
        )}
      </div>

      {trainingDataList.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h2>Create Training Model</h2>
          <form onSubmit={handleCreateModel}>
            <div>
              <input
                type="text"
                placeholder="Model Name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isCreatingModel || selectedTrainingData.length === 0}
            >
              {isCreatingModel ? 'Creating Model...' : 'Create Model'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
} 