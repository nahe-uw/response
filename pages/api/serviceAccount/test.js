import prisma from '../../../prisma';
import { supabase } from '../../../supabase';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 認証チェック
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (error || !user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const prismaUser = await prisma.user.findUnique({
      where: { email: user.email }
    });

    if (!prismaUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { subdomain, email, apiToken, locale = 'ja' } = req.body;

    // サブドメインから不要な文字を削除
    const cleanSubdomain = subdomain.replace(/[\/\.]/g, '');
    
    // URLの形式を修正
    const testUrl = `https://${cleanSubdomain}.zendesk.com/api/v2/help_center/${locale}/categories.json`;
    
    console.log('Testing Zendesk connection with:', {
      url: testUrl,
      email,
      subdomain: cleanSubdomain,
      locale
    });

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${email}/token:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Zendesk API error:', {
        status: response.status,
        statusText: response.statusText,
        url: testUrl
      });

      return res.status(400).json({
        success: false,
        error: `API test failed: ${response.status} ${response.statusText}`
      });
    }

    const data = await response.json();
    console.log('Zendesk API response:', data);

    return res.status(200).json({
      success: true,
      message: 'Zendesk connection test successful',
      categories: data.categories
    });

  } catch (error) {
    console.error('Connection test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.cause || error.stack
    });
  }
} 