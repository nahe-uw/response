import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ServiceAccount() {
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [message, setMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
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

  // サービスアカウントキーの登録
  const handleRegister = async (e) => {
    e.preventDefault();
    setIsRegistering(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      // サービスアカウントキーの検証
      try {
        JSON.parse(serviceAccountKey);
      } catch (error) {
        setMessage('Invalid JSON format');
        setIsRegistering(false);
        return;
      }

      const res = await fetch('/api/serviceAccount/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ serviceAccountKey }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Service account registered successfully!');
        setServiceAccountKey('');
        // 登録成功後、ナレッジ管理画面に遷移
        router.push('/knowledge');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to register service account');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div>
      <h1>Service Account Registration</h1>
      {message && <p>{message}</p>}

      <form onSubmit={handleRegister}>
        <div>
          <label>
            Service Account Key (JSON):
            <textarea
              value={serviceAccountKey}
              onChange={(e) => setServiceAccountKey(e.target.value)}
              rows="10"
              placeholder="Paste your service account key JSON here"
              required
            />
          </label>
        </div>

        <button type="submit" disabled={isRegistering}>
          {isRegistering ? 'Registering...' : 'Register Service Account'}
        </button>
      </form>

      <div style={{ marginTop: '20px' }}>
        <Link href="/knowledge">
          Go to Knowledge Management
        </Link>
      </div>
    </div>
  );
} 