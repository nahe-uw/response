import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';

export default function Inquiry() {
  const [userId, setUserId] = useState('');
  const [inquiryContent, setInquiryContent] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [dataSummary, setDataSummary] = useState(null);
  const [inquiryElements, setInquiryElements] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
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

  // カテゴリ一覧の取得
  useEffect(() => {
    const fetchCategories = async () => {
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
          setCategories(data.categories);
        } else {
          setMessage(`Error: ${data.error}`);
        }
      } catch (error) {
        setMessage('Failed to fetch categories');
      }
    };

    fetchCategories();
  }, []);

  // カテゴリの選択を処理
  const handleCategoryChange = (categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  // 準備ボタンの処理
  const handlePrepare = async () => {
    if (!userId || !inquiryContent || selectedCategories.length === 0) {
      setMessage('Please fill in all fields and select at least one category');
      return;
    }

    setIsPreparing(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/inquiry/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          inquiryContent,
          categoryIds: selectedCategories,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setDataSummary(data.dataSummary);
        setInquiryElements(data.inquiryElements);
        setMessage('Preparation completed successfully!');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to prepare data');
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div>
      <h1>Inquiry</h1>
      {message && <p>{message}</p>}

      <div>
        <h2>Input Information</h2>
        <div>
          <label>
            User ID:
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter User ID"
            />
          </label>
        </div>

        <div>
          <label>
            Inquiry Content:
            <textarea
              value={inquiryContent}
              onChange={(e) => setInquiryContent(e.target.value)}
              placeholder="Enter your inquiry"
              rows="4"
            />
          </label>
        </div>

        <div>
          <h3>Select Categories:</h3>
          {categories.map(category => (
            <label key={category.id}>
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.id)}
                onChange={() => handleCategoryChange(category.id)}
              />
              {category.categoryName}
            </label>
          ))}
        </div>

        <button
          onClick={handlePrepare}
          disabled={isPreparing}
        >
          {isPreparing ? 'Preparing...' : 'Prepare'}
        </button>
      </div>

      {/* データ要約と問い合わせ分解結果の表示 */}
      {(dataSummary || inquiryElements) && (
        <div>
          <h2>Results</h2>
          {dataSummary && (
            <div>
              <h3>Data Summary:</h3>
              <pre>{JSON.stringify(dataSummary, null, 2)}</pre>
            </div>
          )}
          {inquiryElements && (
            <div>
              <h3>Inquiry Elements:</h3>
              <pre>{JSON.stringify(inquiryElements, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 