import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const router = useRouter();

  // セッションチェック
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
    };

    checkSession();
  }, [router]);

  const menuItems = [
    {
      title: 'API Connection',
      description: 'Configure API connections and manage data sources',
      path: '/apiConnection',
      icon: '🔌'
    },
    {
      title: 'Data Mapping',
      description: 'Map and configure table relationships and data meanings',
      path: '/mapping',
      icon: '🗺️'
    },
    {
      title: 'Data Categories',
      description: 'Manage and organize data into categories',
      path: '/category',
      icon: '📁'
    },
    {
      title: 'Knowledge Management',
      description: 'Upload and manage knowledge base documents',
      path: '/knowledge',
      icon: '📚'
    },
    {
      title: 'Training Data',
      description: 'Manage training data and models',
      path: '/training',
      icon: '🎓'
    },
    {
      title: 'Service Account',
      description: 'Configure Vertex AI service account',
      path: '/serviceAccount',
      icon: '🔑'
    },
    {
      title: 'Inquiry',
      description: 'Make inquiries and view responses',
      path: '/inquiry',
      icon: '❓'
    }
  ];

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
    } catch (error) {
      setMessage('Error logging out');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Dashboard</h1>
        {user && (
          <div style={styles.userInfo}>
            <span>{user.email}</span>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        )}
      </header>

      {message && <p style={styles.message}>{message}</p>}

      <div style={styles.menuGrid}>
        {menuItems.map((item, index) => (
          <Link href={item.path} key={index} style={styles.menuItem}>
            <div>
              <span style={styles.icon}>{item.icon}</span>
              <h2 style={styles.title}>{item.title}</h2>
              <p style={styles.description}>{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    padding: '20px 0'
  },
  menuItem: {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    textDecoration: 'none',
    color: 'inherit',
    backgroundColor: 'white',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    ':hover': {
      transform: 'translateY(-5px)',
      boxShadow: '0 5px 15px rgba(0,0,0,0.1)'
    }
  },
  icon: {
    fontSize: '2em',
    marginBottom: '10px',
    display: 'block'
  },
  title: {
    margin: '10px 0',
    fontSize: '1.2em'
  },
  description: {
    color: '#666',
    fontSize: '0.9em',
    margin: 0
  },
  message: {
    padding: '10px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    marginBottom: '20px'
  }
}; 