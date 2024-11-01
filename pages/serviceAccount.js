import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function ServiceAccount() {
  const [activeTab, setActiveTab] = useState('googleCloud');
  const [message, setMessage] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();

  // Google Cloud
  const [serviceAccountKey, setServiceAccountKey] = useState('');

  // Zendesk
  const [zendeskEmail, setZendeskEmail] = useState('');
  const [zendeskApiToken, setZendeskApiToken] = useState('');
  const [zendeskDomain, setZendeskDomain] = useState('');

  // テスト用のstate追加
  const [isTestingConnection, setIsTestingConnection] = useState(false);

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

  // サービスアカウントの登録
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

      let authInfo = {};
      if (activeTab === 'googleCloud') {
        // Google Cloud用の認証情報
        try {
          JSON.parse(serviceAccountKey);
          authInfo = {
            serviceAccountKey,
            type: 'googleCloud'
          };
        } catch (error) {
          setMessage('Invalid JSON format for Google Cloud service account key');
          setIsRegistering(false);
          return;
        }
      } else if (activeTab === 'zendesk') {
        // Zendesk用の認証情報
        if (!zendeskEmail || !zendeskApiToken || !zendeskDomain) {
          setMessage('Please fill in all Zendesk fields');
          setIsRegistering(false);
          return;
        }
        authInfo = {
          type: 'zendesk',
          zendeskAuth: {
            email: zendeskEmail,
            apiToken: zendeskApiToken,
            domain: zendeskDomain
          }
        };
      }

      const res = await fetch('/api/serviceAccount/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(authInfo),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Service account registered successfully!');
        // フォームをリセット
        if (activeTab === 'googleCloud') {
          setServiceAccountKey('');
        } else {
          setZendeskEmail('');
          setZendeskApiToken('');
          setZendeskDomain('');
        }
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to register service account');
    } finally {
      setIsRegistering(false);
    }
  };

  // テスト接続の処理を追加
  const handleTestConnection = async () => {
    if (!zendeskEmail || !zendeskApiToken || !zendeskDomain) {
      setMessage('Please fill in all Zendesk fields');
      return;
    }

    setIsTestingConnection(true);
    setMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        return;
      }

      const res = await fetch('/api/serviceAccount/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subdomain: zendeskDomain.split('.')[0], // company.zendesk.com から company を抽出
          email: zendeskEmail,
          apiToken: zendeskApiToken,
          locale: 'ja'
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`Connection test successful! Found ${data.categories.length} categories.`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to test connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div>
      <h1>Service Account Registration</h1>
      {message && <p>{message}</p>}

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('googleCloud')}
          style={{ 
            backgroundColor: activeTab === 'googleCloud' ? '#0070f3' : '#f0f0f0',
            color: activeTab === 'googleCloud' ? 'white' : 'black'
          }}
        >
          Google Cloud
        </button>
        <button 
          onClick={() => setActiveTab('zendesk')}
          style={{ 
            backgroundColor: activeTab === 'zendesk' ? '#0070f3' : '#f0f0f0',
            color: activeTab === 'zendesk' ? 'white' : 'black',
            marginLeft: '10px'
          }}
        >
          Zendesk
        </button>
      </div>

      <form onSubmit={handleRegister}>
        {activeTab === 'googleCloud' ? (
          <div>
            <h2>Google Cloud Service Account</h2>
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
          </div>
        ) : (
          <div>
            <h2>Zendesk Authentication</h2>
            <div>
              <label>
                Email:
                <input
                  type="email"
                  value={zendeskEmail}
                  onChange={(e) => setZendeskEmail(e.target.value)}
                  placeholder="admin@company.com"
                  required
                />
              </label>
            </div>
            <div>
              <label>
                API Token:
                <input
                  type="password"
                  value={zendeskApiToken}
                  onChange={(e) => setZendeskApiToken(e.target.value)}
                  placeholder="Zendesk API Token"
                  required
                />
              </label>
            </div>
            <div>
              <label>
                Domain:
                <input
                  type="text"
                  value={zendeskDomain}
                  onChange={(e) => {
                    // https:// や .zendesk.com を自動的に削除
                    const domain = e.target.value
                      .replace('https://', '')
                      .replace('http://', '')
                      .replace('.zendesk.com', '');
                    setZendeskDomain(domain);
                  }}
                  placeholder="company (without .zendesk.com)"
                  required
                />
                <span>.zendesk.com</span>
              </label>
            </div>
            {/* テストボタンを追加 */}
            <button 
              type="button" 
              onClick={handleTestConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        )}

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