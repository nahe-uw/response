import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ApiConnection() {
  const [apiUrl, setApiUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      console.log('Checking session...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error fetching session:', error);
        router.push('/login');
        return;
      }
      
      if (!session) {
        console.log('No session found, redirecting to login...');
        router.push('/login');
        return;
      }
      
      console.log('=== Session Details ===');
      console.log('Session ID:', session.access_token);
      console.log('User ID:', session.user.id);
      console.log('User Email:', session.user.email);
      console.log('Last Sign In:', session.user.last_sign_in_at);
      console.log('User Role:', session.user.role);
      console.log('====================');
    };

    checkSession();
  }, [router]);

  const handleTestConnection = async (e) => {
    e.preventDefault();
    setMessage(''); // Reset message
    try {
      // テスト接続のロジックを実装
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        setMessage('Test connection successful!');
      } else {
        setMessage('Test connection failed.');
      }
    } catch (error) {
      setMessage('An unexpected error occurred during test connection.');
    }
  };

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    setMessage(''); // Reset message
    try {
      // セッション情報を取得
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage('Not authenticated');
        return;
      }
  
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ apiUrl, authToken }),
      });
  
      const data = await res.json();
      if (res.ok) {
        setMessage('Connection saved successfully!');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Save connection error:', error);
      setMessage('An unexpected error occurred while saving connection.');
    }
  };

  return (
    <div>
      <h1>API Connection</h1>
      <form>
        <input
          type="text"
          placeholder="API URL"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Auth Token"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          required
        />
        <button onClick={handleTestConnection}>Test Connection</button>
        <button onClick={handleSaveConnection}>Save Connection</button>
      </form>
      {message && <p>{message}</p>}
      
      <div style={{ marginTop: '20px' }}>
        <Link href="/mapping">
          Go to Data Mapping
        </Link>
      </div>
    </div>
  );
} 