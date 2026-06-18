import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from './db.js';
import jwt from 'jsonwebtoken';
import { 
  findOrCreateUser, 
  generateToken, 
  authenticateJWT, 
  getMockProfile,
  JWT_SECRET
} from './auth.js';
import { 
  sendEmail, 
  sendVerificationCode, 
  sendStorageWarning 
} from './mail.js';
import { 
  generatePresignedUploadUrl, 
  generatePresignedDownloadUrl, 
  deleteFromStorage,
  transcodeVideo
} from './s3.js';

dotenv.config();

// Run database migrations on start
query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0', [])
  .then(() => console.log('Migration: checked photos table position column'))
  .catch(err => console.error('Migration error (photos position):', err));

query(`
  CREATE TABLE IF NOT EXISTS tester_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`, [])
  .then(() => console.log('Migration: checked tester_feedback table existence'))
  .catch(err => console.error('Migration error (tester_feedback table):', err));

query('ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_token VARCHAR(255) UNIQUE', [])
  .then(() => console.log('Migration: checked albums table share_token column'))
  .catch(err => console.error('Migration error (albums share_token):', err));

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5180';

// Setup CORS dynamically to allow local network IPs and FRONTEND_URL
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Check if the request comes from localhost or local subnets
    const isLocal = origin.startsWith('http://localhost') || 
                    origin.startsWith('http://127.0.0.1') || 
                    origin.startsWith('http://192.168.') || 
                    origin.startsWith('http://10.') || 
                    origin.startsWith('http://172.');
                    
    const isDomainMatch = origin.includes('xn--80affoidsgaujr8a0h.xn--p1ai') || 
                          origin.includes('легкосохранить.рф') ||
                          origin.includes('87.228.90.84');
                    
    if (isLocal || isDomainMatch || origin === FRONTEND_URL || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Request logging middleware for deployment debugging
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Create mock upload folder path
const MOCK_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Validate redirection origin to prevent Open Redirect vulnerabilities
function isValidOrigin(originUrl) {
  if (!originUrl) return true;
  try {
    const parsed = new URL(originUrl);
    // Allow FRONTEND_URL host
    const frontendHost = new URL(FRONTEND_URL).host;
    if (parsed.host === frontendHost) return true;
    
    // Allow localhost / 127.0.0.1
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
    
    // Allow local subnet IPs in development
    if (process.env.NODE_ENV === 'development') {
      if (/^192\.168\./.test(parsed.hostname) || /^10\./.test(parsed.hostname) || /^172\./.test(parsed.hostname)) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}

// ==========================================
// MOCK S3 ENDPOINTS (FOR OFFLINE / DEV MODE)
// ==========================================
// Handles direct PUT upload from client in mock mode
app.put('/api/mock-s3/*', (req, res) => {
  const fileKey = req.params[0];
  const filePath = path.resolve(MOCK_UPLOAD_DIR, fileKey);
  
  // Prevent Path Traversal
  if (!filePath.startsWith(MOCK_UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Доступ запрещен (обход путей).' });
  }
  
  // Ensure the subdirectory for the user exists before saving
  const dirName = path.dirname(filePath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  
  const writeStream = fs.createWriteStream(filePath);
  
  req.pipe(writeStream);
  
  req.on('end', () => {
    console.log(`Mock S3: Successfully saved uploaded file locally: ${fileKey}`);
    res.status(200).send('OK');
  });
  
  req.on('error', (err) => {
    console.error('Mock S3: Upload stream error:', err);
    res.status(500).json({ error: 'Ошибка сохранения файла на мок-сервере.' });
  });
});

// Serves the file locally in mock mode
app.get('/api/mock-s3/*', (req, res) => {
  const fileKey = req.params[0];
  const filePath = path.resolve(MOCK_UPLOAD_DIR, fileKey);
  
  // Prevent Path Traversal
  if (!filePath.startsWith(MOCK_UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Доступ запрещен (обход путей).' });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  res.sendFile(filePath);
});

// 1. Yandex SSO Initiation
app.get('/api/auth/yandex', async (req, res) => {
  const { origin } = req.query;
  const targetOrigin = isValidOrigin(origin) ? (origin || FRONTEND_URL) : FRONTEND_URL;
  const clientId = process.env.YANDEX_CLIENT_ID || process.env.Yandex_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
  
  if (clientId === 'mock_yandex_client_id' || !clientId) {
    const mockProfile = getMockProfile('yandex');
    return res.send(getMockOauthHtml('yandex', mockProfile, targetOrigin));
  }
  
  const yandexUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
  res.redirect(yandexUrl);
});

// Yandex SSO Callback (Used only for real Yandex integration)
app.get('/api/auth/yandex/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.YANDEX_CLIENT_ID || process.env.Yandex_CLIENT_ID,
        client_secret: process.env.YANDEX_CLIENT_SECRET,
      })
    });
    
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed to retrieve access token');
    }
    
    // Fetch user info
    const infoResponse = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenData.access_token}` }
    });
    
    const infoData = await infoResponse.json();
    
    // Create/Auth user
    const user = await findOrCreateUser({
      yandexId: infoData.id,
      name: infoData.real_name || infoData.display_name || 'Пользователь Яндекс',
      email: infoData.default_email
    });
    
    const token = generateToken(user);
    res.redirect(`${FRONTEND_URL}/auth-callback?token=${token}`);
  } catch (error) {
    console.error('Yandex SSO error:', error);
    res.status(500).send('Ошибка авторизации через Яндекс ID');
  }
});

// 2. Sber ID OIDC Simulation (OIDC Mock Flow)
app.get('/api/auth/sber', async (req, res) => {
  const { origin } = req.query;
  const targetOrigin = isValidOrigin(origin) ? (origin || FRONTEND_URL) : FRONTEND_URL;
  const mockProfile = getMockProfile('sber');
  return res.send(getMockOauthHtml('sber', mockProfile, targetOrigin));
});

// 2b. T-Bank ID OIDC Simulation
app.get('/api/auth/tbank', async (req, res) => {
  const { origin } = req.query;
  const targetOrigin = isValidOrigin(origin) ? (origin || FRONTEND_URL) : FRONTEND_URL;
  const mockProfile = getMockProfile('tbank');
  return res.send(getMockOauthHtml('tbank', mockProfile, targetOrigin));
});

// 3. Confirm Mock SSO Authorization (Redirects back to frontend callback with valid JWT)
app.get('/api/auth/mock-login-confirm', async (req, res) => {
  const { provider, origin } = req.query;
  const targetOrigin = isValidOrigin(origin) ? (origin || FRONTEND_URL) : FRONTEND_URL;
  const mockProfile = getMockProfile(provider || 'yandex', 'mock-user-456');
  
  try {
    const user = await findOrCreateUser({
      yandexId: provider === 'yandex' ? mockProfile.id : null,
      sberId: provider === 'sber' ? mockProfile.id : null,
      tbankId: provider === 'tbank' ? mockProfile.id : null,
      name: mockProfile.name,
      email: mockProfile.email
    });
    
    const token = generateToken(user);
    res.redirect(`${targetOrigin}/auth-callback?token=${token}`);
  } catch (error) {
    console.error('Error confirming mock login:', error);
    res.status(500).send('Ошибка авторизации на мок-сервере');
  }
});

// Helper to generate a realistic mock OAuth screen
function getMockOauthHtml(provider, profile, targetOrigin) {
  const isYandex = provider === 'yandex';
  const isSber = provider === 'sber';
  const logo = isYandex ? 'Я' : (isSber ? '✔' : 'Т');
  const logoBg = isYandex ? '#FC3F1D' : (isSber ? '#128024' : '#FFDD2D');
  const logoColor = isYandex || isSber ? 'white' : 'black';
  const providerName = isYandex ? 'Яндекс ID' : (isSber ? 'Сбер ID' : 'Т-Банк ID');
  const btnClass = isYandex 
    ? 'background-color: #FFCC00; color: #000; font-weight: 600;' 
    : (isSber 
      ? 'background-image: linear-gradient(to right, #21A038, #128024); color: #fff; font-weight: 600;'
      : 'background-color: #000000; color: #fff; font-weight: 600;');
  
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Вход через ${providerName}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          background-color: #f6f7f9;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .card {
          background: white;
          padding: 40px 30px;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          width: 100%;
          max-width: 400px;
          text-align: center;
          box-sizing: border-box;
        }
        .logo-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          border-radius: 16px;
          background-color: ${logoBg};
          color: ${logoColor};
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 24px;
        }
        h2 {
          font-size: 22px;
          margin: 0 0 8px 0;
          color: #1a1a1a;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 30px;
        }
        .profile-box {
          border: 1px solid #eaeaea;
          border-radius: 16px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          margin-bottom: 30px;
        }
        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background-color: #ead9d3;
          color: #553a35;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
        }
        .profile-info {
          flex: 1;
          min-width: 0;
        }
        .profile-name {
          font-weight: 600;
          font-size: 15px;
          color: #1a1a1a;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .profile-email {
          color: #888;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .btn {
          display: block;
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 16px;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.1s, opacity 0.2s;
          text-decoration: none;
          box-sizing: border-box;
          text-align: center;
          font-family: inherit;
          ${btnClass}
        }
        .btn:hover {
          opacity: 0.95;
        }
        .btn:active {
          transform: scale(0.99);
        }
        .cancel-link {
          display: block;
          margin-top: 18px;
          color: #888;
          font-size: 14px;
          text-decoration: none;
        }
        .cancel-link:hover {
          color: #555;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-container">${logo}</div>
        <h2>Вход через ${providerName}</h2>
        <p class="subtitle">Сервис <strong>Легко Сохранить</strong> запрашивает разрешение на доступ к вашему имени и почте для создания фотоальбома.</p>
        
        <div class="profile-box">
          <div class="avatar">${profile.name[0]}</div>
          <div class="profile-info">
            <div class="profile-name">${profile.name}</div>
            <div class="profile-email">${profile.email}</div>
          </div>
        </div>
        
        <a href="/api/auth/mock-login-confirm?provider=${provider}&origin=${encodeURIComponent(targetOrigin)}" class="btn">
          Войти как ${profile.name.split(' ')[0]}
        </a>
        
        <a href="${targetOrigin}" class="cancel-link">Отмена</a>
      </div>
    </body>
    </html>
  `;
}

// 3. One-click Demo Login for Testing and UI/UX checks
app.post('/api/auth/demo', async (req, res) => {
  const { provider } = req.body;
  const mockProfile = getMockProfile(provider || 'yandex', 'demo-unique-99');
  
  try {
    const user = await findOrCreateUser({
      yandexId: provider === 'yandex' ? mockProfile.id : null,
      sberId: provider === 'sber' ? mockProfile.id : null,
      tbankId: provider === 'tbank' ? mockProfile.id : null,
      name: mockProfile.name,
      email: mockProfile.email
    });
    
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, hasPin: !!user.pin_code } });
  } catch (error) {
    console.error('Demo auth failed:', error);
    res.status(500).json({ error: 'Не удалось выполнить быстрый вход.' });
  }
});

// In-memory store for verification codes (OTP)
// email -> { code, name, expiresAt, attempts }
const verificationCodes = new Map();

// Email Authentication / Request Code
app.post('/api/auth/email', async (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Пожалуйста, укажите адрес электронной почты.' });
  }

  // Simple email format verification
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Пожалуйста, введите корректный адрес электронной почты.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Look up if user already exists
    const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const existingUser = result.rows[0];
    
    // Default name: provided name, existing user's name, or part of email before @
    const finalName = name?.trim() || (existingUser ? existingUser.name : normalizedEmail.split('@')[0]);

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in-memory with 10 minutes expiration
    verificationCodes.set(normalizedEmail, {
      code,
      name: finalName,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0
    });

    // Send code to recipient
    await sendVerificationCode(normalizedEmail, finalName, code);

    res.json({ success: true, message: 'Код подтверждения успешно отправлен на вашу почту.' });
  } catch (error) {
    console.error('Email auth code request error:', error);
    res.status(500).json({ error: 'Не удалось отправить код подтверждения. Пожалуйста, попробуйте позже.' });
  }
});

// Verify Code and Login/Register
app.post('/api/auth/email/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Пожалуйста, укажите адрес электронной почты и код.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const record = verificationCodes.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: 'Код подтверждения не запрашивался или срок его действия истек.' });
    }

    // Check expiration
    if (Date.now() > record.expiresAt) {
      verificationCodes.delete(normalizedEmail);
      return res.status(400).json({ error: 'Срок действия кода подтверждения истек. Пожалуйста, запросите код повторно.' });
    }

    // Check attempts to prevent brute force (limit to 3)
    if (record.attempts >= 3) {
      verificationCodes.delete(normalizedEmail);
      return res.status(400).json({ error: 'Превышено число попыток ввода. Пожалуйста, запросите новый код.' });
    }

    // Validate code
    if (record.code !== code.trim()) {
      record.attempts += 1;
      return res.status(400).json({ error: `Неверный код. Осталось попыток: ${3 - record.attempts}` });
    }

    // Code is correct! Clean up store
    verificationCodes.delete(normalizedEmail);

    // Find or create the user in the database
    const user = await findOrCreateUser({
      name: record.name,
      email: normalizedEmail
    });

    const token = generateToken(user);
    res.json({
      token,
      status: user.pin_code ? 'verify_pin' : 'create_pin',
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Email code verification error:', error);
    res.status(500).json({ error: 'Ошибка подтверждения кода. Пожалуйста, попробуйте позже.' });
  }
});

// Set PIN code for authenticated user
app.post('/api/auth/set-pin', authenticateJWT, async (req, res) => {
  const { pinCode } = req.body;
  if (!pinCode || pinCode.length !== 4 || !/^\d+$/.test(pinCode)) {
    return res.status(400).json({ error: 'Некорректный формат пин-кода. Требуется 4 цифры.' });
  }

  try {
    await query('UPDATE users SET pin_code = $1 WHERE id = $2', [pinCode, req.user.id]);
    res.json({ success: true, message: 'Пин-код успешно установлен.' });
  } catch (error) {
    console.error('Error setting PIN code:', error);
    res.status(500).json({ error: 'Не удалось сохранить пин-код.' });
  }
});

// Verify PIN code for authenticated user
app.post('/api/auth/verify-pin', authenticateJWT, async (req, res) => {
  const { pinCode } = req.body;
  if (!pinCode) {
    return res.status(400).json({ error: 'Введите пин-код.' });
  }
  
  try {
    const result = await query('SELECT pin_code FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }

    const dbPin = result.rows[0].pin_code;
    if (!dbPin) {
      return res.status(400).json({ error: 'Пин-код не настроен для этого пользователя.' });
    }

    if (dbPin === pinCode) {
      res.json({ success: true, message: 'Пин-код подтвержден.' });
    } else {
      res.status(400).json({ error: 'Неверный пин-код. Пожалуйста, попробуйте еще раз.' });
    }
  } catch (error) {
    console.error('PIN verification error:', error);
    res.status(500).json({ error: 'Ошибка проверки пин-кода.' });
  }
});

// Get profile details
app.get('/api/auth/me', authenticateJWT, async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, pin_code, storage_limit FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      hasPin: !!user.pin_code,
      storageLimit: parseInt(user.storage_limit, 10)
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    res.status(500).json({ error: 'Ошибка получения профиля.' });
  }
});

// ==========================================
// ALBUM MANAGEMENT ENDPOINTS (PROTECTED)
// ==========================================

// Get user's albums list
app.get('/api/albums', authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  try {
    let result = await query('SELECT * FROM albums WHERE user_id = $1 ORDER BY position ASC', [userId]);
    
    // Fallback: If no albums exist, create default "Общий"
    const hasGeneral = result.rows.some(a => a.name === 'Общий');
    if (result.rows.length === 0 || !hasGeneral) {
      await query('INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3)', [userId, 'Общий', 0]);
      result = await query('SELECT * FROM albums WHERE user_id = $1 ORDER BY position ASC', [userId]);
    }
    
    // Retrieve photo count for each album in database-agnostic code
    const albumsWithCounts = await Promise.all(
      result.rows.map(async (album) => {
        let count = 0;
        if (album.name === 'Общий') {
          const countRes = await query('SELECT COUNT(*) as cnt FROM photos WHERE user_id = $1', [userId]);
          count = parseInt(countRes.rows[0].cnt || '0', 10);
        } else {
          const countRes = await query('SELECT COUNT(*) as cnt FROM album_photos WHERE album_id = $1', [album.id]);
          count = parseInt(countRes.rows[0].cnt || '0', 10);
        }
        return { ...album, photoCount: count };
      })
    );
    
    res.json({ albums: albumsWithCounts });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({ error: 'Не удалось загрузить альбомы.' });
  }
});

// Create new custom album
app.post('/api/albums', authenticateJWT, async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Имя альбома не может быть пустым.' });
  }

  try {
    const posResult = await query('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1', [userId]);
    const nextPos = posResult.rows[0].next_pos || 1;

    const result = await query(
      'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3) RETURNING *',
      [userId, name.trim(), nextPos]
    );

    res.json({ success: true, album: result.rows[0] });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({ error: 'Не удалось создать альбом.' });
  }
});

// Update album positions (Drag & Drop sorting)
app.put('/api/albums/positions', authenticateJWT, async (req, res) => {
  const { positions } = req.body;
  const userId = req.user.id;

  if (!positions || !Array.isArray(positions)) {
    return res.status(400).json({ error: 'Неверный формат позиций.' });
  }

  try {
    for (const item of positions) {
      await query(
        'UPDATE albums SET position = $1 WHERE id = $2 AND user_id = $3',
        [parseInt(item.position, 10), item.albumId, userId]
      );
    }
    res.json({ success: true, message: 'Позиции альбомов обновлены.' });
  } catch (error) {
    console.error('Error updating album positions:', error);
    res.status(500).json({ error: 'Не удалось сохранить порядок альбомов.' });
  }
});

// Delete custom album
app.delete('/api/albums/:id', authenticateJWT, async (req, res) => {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const checkResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (checkResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Нельзя удалить основной альбом "Общий".' });
    }

    await query('DELETE FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    res.json({ success: true, message: 'Альбом успешно удален.' });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({ error: 'Не удалось удалить альбом.' });
  }
});

// Get photos in an album
app.get('/api/albums/:id/photos', authenticateJWT, async (req, res) => {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    const isGeneral = albumResult.rows[0].name === 'Общий';

    let photosResult;
    if (isGeneral) {
      photosResult = await query(
        'SELECT id, s3_key, original_name, size, mime_type, is_favorite, position, created_at FROM photos WHERE user_id = $1 ORDER BY position ASC, created_at DESC',
        [userId]
      );
    } else {
      photosResult = await query(
        `SELECT p.id, p.s3_key, p.original_name, p.size, p.mime_type, p.is_favorite, p.created_at, ap.position 
         FROM photos p 
         JOIN album_photos ap ON p.id = ap.photo_id 
         WHERE ap.album_id = $1 
         ORDER BY ap.position ASC`,
        [albumId]
      );
    }

    // Generate secure presigned GET URL for each photo
    const photosWithUrls = await Promise.all(
      photosResult.rows.map(async (photo) => {
        try {
          const url = await generatePresignedDownloadUrl(photo.s3_key);
          return { ...photo, url };
        } catch (e) {
          console.error(`Error generating download URL for key ${photo.s3_key}:`, e);
          return { ...photo, url: null };
        }
      })
    );

    res.json({ photos: photosWithUrls });
  } catch (error) {
    console.error('Error fetching album photos:', error);
    res.status(500).json({ error: 'Не удалось загрузить фотографии альбома.' });
  }
});

// Add photos to an album
app.post('/api/albums/:id/photos', authenticateJWT, async (req, res) => {
  const albumId = req.params.id;
  const { photoIds } = req.body;
  const userId = req.user.id;

  if (!photoIds || !Array.isArray(photoIds)) {
    return res.status(400).json({ error: 'Неверный список фотографий.' });
  }

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (albumResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Фотографии уже находятся в альбоме "Общий" по умолчанию.' });
    }

    for (const photoId of photoIds) {
      const posResult = await query('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1', [albumId]);
      const nextPos = posResult.rows[0].next_pos || 0;

      await query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
        [albumId, photoId, nextPos]
      );
    }

    res.json({ success: true, message: 'Фотографии успешно добавлены в альбом.' });
  } catch (error) {
    console.error('Error adding photos to album:', error);
    res.status(500).json({ error: 'Не удалось добавить фотографии в альбом.' });
  }
});

// Update photos order inside custom album (Drag & Drop sorting)
app.put('/api/albums/:id/photos/positions', authenticateJWT, async (req, res) => {
  const albumId = req.params.id;
  const { photoPositions } = req.body;
  const userId = req.user.id;

  if (!photoPositions || !Array.isArray(photoPositions)) {
    return res.status(400).json({ error: 'Неверный формат позиций.' });
  }

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    const isGeneral = albumResult.rows[0].name === 'Общий';

    for (const item of photoPositions) {
      if (isGeneral) {
        await query(
          'UPDATE photos SET position = $1 WHERE id = $2 AND user_id = $3',
          [parseInt(item.position, 10), item.photoId, userId]
        );
      } else {
        await query(
          'UPDATE album_photos SET position = $1 WHERE album_id = $2 AND photo_id = $3',
          [parseInt(item.position, 10), albumId, item.photoId]
        );
      }
    }

    res.json({ success: true, message: 'Порядок фотографий обновлен.' });
  } catch (error) {
    console.error('Error sorting album photos:', error);
    res.status(500).json({ error: 'Не удалось сохранить порядок фотографий.' });
  }
});

// Remove photo from custom album
app.delete('/api/albums/:albumId/photos/:photoId', authenticateJWT, async (req, res) => {
  const { albumId, photoId } = req.params;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (albumResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Нельзя удалить фотографию из основного альбома "Общий" без её удаления из облака.' });
    }

    await query('DELETE FROM album_photos WHERE album_id = $1 AND photo_id = $2', [albumId, photoId]);
    res.json({ success: true, message: 'Фотография убрана из альбома.' });
  } catch (error) {
    console.error('Error removing photo from album:', error);
    res.status(500).json({ error: 'Не удалось убрать фотографию из альбома.' });
  }
});

// Enable album sharing (generates share_token)
app.post('/api/albums/:id/share', authenticateJWT, async (req, res) => {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name, share_token FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    if (albumResult.rows[0].name === 'Общий') {
      return res.status(400).json({ error: 'Нельзя поделиться альбомом «Общий».' });
    }

    let shareToken = albumResult.rows[0].share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID();
      await query('UPDATE albums SET share_token = $1 WHERE id = $2 AND user_id = $3', [shareToken, albumId, userId]);
    }

    res.json({ success: true, shareToken });
  } catch (error) {
    console.error('Error sharing album:', error);
    res.status(500).json({ error: 'Не удалось включить общий доступ к альбому.' });
  }
});

// Disable album sharing (sets share_token to NULL)
app.delete('/api/albums/:id/share', authenticateJWT, async (req, res) => {
  const albumId = req.params.id;
  const userId = req.user.id;

  try {
    const albumResult = await query('SELECT name FROM albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Альбом не найден.' });
    }

    await query('UPDATE albums SET share_token = NULL WHERE id = $1 AND user_id = $2', [null, albumId, userId]);
    res.json({ success: true, message: 'Доступ по ссылке отключен.' });
  } catch (error) {
    console.error('Error disabling album sharing:', error);
    res.status(500).json({ error: 'Не удалось отключить общий доступ.' });
  }
});

// GET /api/shared/album/:share_token - Public route to fetch shared album photos
app.get('/api/shared/album/:share_token', async (req, res) => {
  const { share_token } = req.params;

  try {
    const albumResult = await query(
      'SELECT id, name, user_id FROM albums WHERE share_token = $1',
      [share_token]
    );

    if (albumResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ссылка недействительна или владелец отключил доступ.' });
    }

    const album = albumResult.rows[0];

    // Get owner's name
    const ownerResult = await query('SELECT name FROM users WHERE id = $1', [album.user_id]);
    const ownerName = ownerResult.rows.length > 0 ? ownerResult.rows[0].name : 'Пользователь';

    // Get photos in the shared album
    const photosResult = await query(
      `SELECT p.id, p.s3_key, p.original_name, p.size, p.mime_type, p.is_favorite, p.created_at, ap.position 
       FROM photos p 
       JOIN album_photos ap ON p.id = ap.photo_id 
       WHERE ap.album_id = $1 
       ORDER BY ap.position ASC`,
      [album.id]
    );

    // Generate secure presigned GET URL for each photo
    const photosWithUrls = await Promise.all(
      photosResult.rows.map(async (photo) => {
        try {
          const url = await generatePresignedDownloadUrl(photo.s3_key);
          return { ...photo, url };
        } catch (e) {
          console.error(`Error generating download URL for key ${photo.s3_key}:`, e);
          return { ...photo, url: null };
        }
      })
    );

    res.json({
      albumName: album.name,
      ownerName,
      photos: photosWithUrls
    });
  } catch (error) {
    console.error('Error fetching shared album:', error);
    res.status(500).json({ error: 'Не удалось загрузить фотографии альбома.' });
  }
});

// Toggle photo favorite state
app.put('/api/photos/:id/favorite', authenticateJWT, async (req, res) => {
  const photoId = req.params.id;
  const { isFavorite } = req.body;
  const userId = req.user.id;

  try {
    // 1. Update photos table
    await query(
      'UPDATE photos SET is_favorite = $1 WHERE id = $2 AND user_id = $3',
      [isFavorite === true, photoId, userId]
    );

    if (isFavorite === true) {
      // 2. Find or create "Избранное" album
      let albumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = $2", [userId, 'Избранное']);
      let favAlbumId;
      
      if (albumRes.rows.length === 0) {
        // Create the "Избранное" album
        const posResult = await query('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1', [userId]);
        const nextPos = posResult.rows[0].next_pos || 1;
        
        const insertAlbumRes = await query(
          'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3) RETURNING id',
          [userId, 'Избранное', nextPos]
        );
        favAlbumId = insertAlbumRes.rows[0].id;
      } else {
        favAlbumId = albumRes.rows[0].id;
      }

      // 3. Map photo to "Избранное" album if not already mapped
      const mapCheck = await query(
        'SELECT 1 FROM album_photos WHERE album_id = $1 AND photo_id = $2',
        [favAlbumId, photoId]
      );
      
      if (mapCheck.rows.length === 0) {
        const posResult = await query(
          'SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1',
          [favAlbumId]
        );
        const nextPos = posResult.rows[0].next_pos || 0;
        
        await query(
          'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
          [favAlbumId, photoId, nextPos]
        );
      }
    } else {
      // 4. If un-favorited, remove from "Избранное" album if mapping exists
      const albumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = $2", [userId, 'Избранное']);
      if (albumRes.rows.length > 0) {
        const favAlbumId = albumRes.rows[0].id;
        await query(
          'DELETE FROM album_photos WHERE album_id = $1 AND photo_id = $2',
          [favAlbumId, photoId]
        );
      }
    }

    res.json({ success: true, isFavorite: isFavorite === true });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Не удалось обновить статус Избранного.' });
  }
});

// Upgrade storage plan / subscription
app.post('/api/subscription/upgrade', authenticateJWT, async (req, res) => {
  const { limitBytes } = req.body;
  const userId = req.user.id;

  if (!limitBytes || typeof limitBytes !== 'number') {
    return res.status(400).json({ error: 'Некорректный размер хранилища.' });
  }

  try {
    await query('UPDATE users SET storage_limit = $1 WHERE id = $2', [limitBytes, userId]);
    res.json({ success: true, storageLimit: limitBytes });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ error: 'Не удалось активировать подписку.' });
  }
});


// ==========================================
// PHOTO MANAGEMENT ENDPOINTS (PROTECTED)
// ==========================================

// Request upload permission & get presigned PUT URL
app.post('/api/photos/upload-url', authenticateJWT, async (req, res) => {
  const { fileName, fileType, fileSize } = req.body;
  const userId = req.user.id;
  const limit = req.user.storage_limit;

  if (!fileName || !fileType || !fileSize) {
    return res.status(400).json({ error: 'Не все параметры файла указаны.' });
  }

  try {
    // 1. Calculate space usage
    const sizeResult = await query('SELECT SUM(size) as total_size FROM photos WHERE user_id = $1', [userId]);
    const currentSize = parseInt(sizeResult.rows[0].total_size || '0', 10);

    if (currentSize + parseInt(fileSize, 10) > parseInt(limit, 10)) {
      // Send storage full notification (asynchronous in background, non-blocking)
      sendStorageWarning(userId, req.user.email, req.user.name, currentSize, parseInt(limit, 10), true)
        .catch(err => console.error('[Storage Alert Upload-Url Error]', err));

      return res.status(400).json({ 
        error: 'Ой, на вашем облаке не хватает памяти для этой фотографии. Вы можете удалить старые фото или перейти на расширенное хранилище.' 
      });
    }

    // 2. Generate a unique key for S3 (UUID + extension)
    const fileExt = path.extname(fileName) || '.jpg';
    const uniqueId = crypto.randomUUID();
    const s3Key = `${userId}/${uniqueId}${fileExt}`;

    // 3. Generate PUT URL
    const uploadUrl = await generatePresignedUploadUrl(s3Key, fileType);

    res.json({
      uploadUrl,
      s3Key,
      mimeType: fileType
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Не удалось подготовить хранилище для загрузки.' });
  }
});

// Confirm successful upload to S3
app.post('/api/photos/confirm', authenticateJWT, async (req, res) => {
  const { s3Key, originalName, size, mimeType, albumId } = req.body;
  const userId = req.user.id;

  if (!s3Key || !originalName || !size || !mimeType) {
    return res.status(400).json({ error: 'Не все метаданные файла предоставлены.' });
  }

  try {
    // Write photo metadata to database
    const insertResult = await query(
      `INSERT INTO photos (user_id, s3_key, original_name, size, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, s3Key, originalName, size, mimeType]
    );

    const newPhoto = insertResult.rows[0];
    
    // Automatically map to "Общий" album
    const albumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = 'Общий'", [userId]);
    if (albumRes.rows.length > 0) {
      const generalAlbumId = albumRes.rows[0].id;
      await query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
        [generalAlbumId, newPhoto.id, 0]
      );
    }

    // Automatically check/create "Видео" album if a video file is uploaded
    if (mimeType && mimeType.startsWith('video/')) {
      let videoAlbumId;
      const videoAlbumRes = await query("SELECT id FROM albums WHERE user_id = $1 AND name = 'Видео'", [userId]);
      
      if (videoAlbumRes.rows.length === 0) {
        const posRes = await query('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1', [userId]);
        const nextPos = posRes.rows[0].next_pos || 1;
        const createRes = await query(
          'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3) RETURNING id',
          [userId, 'Видео', nextPos]
        );
        videoAlbumId = createRes.rows[0].id;
        console.log(`Automatically created "Видео" album for user ${userId}`);
      } else {
        videoAlbumId = videoAlbumRes.rows[0].id;
      }

      // Map this video to the "Видео" album
      const posResult = await query('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1', [videoAlbumId]);
      const nextPhotoPos = posResult.rows[0].next_pos || 0;
      await query(
        'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
        [videoAlbumId, newPhoto.id, nextPhotoPos]
      );

      // Start transcoding in the background
      transcodeVideo(s3Key)
        .then(async ({ newSize, mimeType: newMimeType }) => {
          await query(
            `UPDATE photos SET size = $1, mime_type = $2 WHERE id = $3`,
            [newSize, newMimeType, newPhoto.id]
          );
          console.log(`Async transcode complete for photo ID ${newPhoto.id}. Size: ${newSize}`);
        })
        .catch(err => {
          console.error(`Async transcode failed for photo ID ${newPhoto.id}:`, err);
        });
    }

    // Also map to target custom album if provided and valid (and not "Общий")
    if (albumId) {
      const targetAlbumRes = await query("SELECT id, name FROM albums WHERE user_id = $1 AND id = $2", [userId, albumId]);
      if (targetAlbumRes.rows.length > 0 && targetAlbumRes.rows[0].name !== 'Общий') {
        const posResult = await query('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1', [albumId]);
        const nextPos = posResult.rows[0].next_pos || 0;
        await query(
          'INSERT INTO album_photos (album_id, photo_id, position) VALUES ($1, $2, $3)',
          [albumId, newPhoto.id, nextPos]
        );
      }
    }
    
    // Generate fresh download URL for this photo
    newPhoto.url = await generatePresignedDownloadUrl(s3Key);

    // Check storage capacity and send warning if >= 90% full
    // Run asynchronously in the background so it doesn't block the API response
    query('SELECT SUM(size) as total_size FROM photos WHERE user_id = $1', [userId])
      .then(async (sizeRes) => {
        const currentSize = parseInt(sizeRes.rows[0].total_size || '0', 10);
        const limitBytes = parseInt(req.user.storage_limit, 10);
        if (currentSize >= limitBytes * 0.90) {
          await sendStorageWarning(userId, req.user.email, req.user.name, currentSize, limitBytes, false);
        }
      })
      .catch(err => console.error('[Storage Alert Confirm Error]', err));

    console.log(`User ${userId} uploaded photo: ${originalName}`);
    res.status(201).json(newPhoto);
  } catch (error) {
    console.error('Error saving photo metadata:', error);
    res.status(500).json({ error: 'Не удалось сохранить информацию о фотографии в базе данных.' });
  }
});

// Fetch all photos for authorized user
app.get('/api/photos', authenticateJWT, async (req, res) => {
  const userId = req.user.id;
  const limit = req.user.storage_limit;

  try {
    // 1. Fetch photo details from DB
    const photosResult = await query(
      'SELECT id, s3_key, original_name, size, mime_type, created_at FROM photos WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    const photos = photosResult.rows;

    // 2. Generate secure presigned GET URL for each photo
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const url = await generatePresignedDownloadUrl(photo.s3_key);
          return { ...photo, url };
        } catch (e) {
          console.error(`Error generating download URL for key ${photo.s3_key}:`, e);
          return { ...photo, url: null };
        }
      })
    );

    // 3. Fetch storage usage
    const sizeResult = await query('SELECT SUM(size) as total_size FROM photos WHERE user_id = $1', [userId]);
    const totalUsedBytes = parseInt(sizeResult.rows[0].total_size || '0', 10);

    res.json({
      photos: photosWithUrls,
      storage: {
        used: totalUsedBytes,
        limit: parseInt(limit, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching gallery photos:', error);
    res.status(500).json({ error: 'Не удалось загрузить ваши фотографии.' });
  }
});

// Delete a photo
app.delete('/api/photos/:id', authenticateJWT, async (req, res) => {
  const photoId = req.params.id;
  const userId = req.user.id;

  try {
    // 1. Find photo
    const photoResult = await query('SELECT * FROM photos WHERE id = $1 AND user_id = $2', [photoId, userId]);
    
    if (photoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Фотография не найдена или у вас нет прав на её удаление.' });
    }
    
    const photo = photoResult.rows[0];

    // 2. Delete from S3 storage
    await deleteFromStorage(photo.s3_key);

    // 3. Delete from Database
    await query('DELETE FROM photos WHERE id = $1', [photoId]);

    res.json({ success: true, message: 'Фотография успешно удалена.' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Не удалось удалить фотографию.' });
  }
});


// POST /api/feedback - Collect tester feedback (saves to DB and sends email if SMTP configured)
app.post('/api/feedback', async (req, res) => {
  const { name, email, message, metadata } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Пожалуйста, введите описание проблемы.' });
  }

  // 1. Try to extract userId from JWT token optionally
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (e) {
      // Ignore token decode errors for feedback
    }
  }

  try {
    // 2. Save to Database
    const dbResult = await query(
      'INSERT INTO tester_feedback (user_id, user_name, user_email, message, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        userId,
        name ? name.trim() : null,
        email ? email.trim() : null,
        message.trim(),
        JSON.stringify(metadata || {})
      ]
    );
    const feedback = dbResult.rows[0];

    // 3. Send via unified email service
    const feedbackReceiver = process.env.FEEDBACK_RECEIVER || process.env.SMTP_USER || 'admin@xn--80affoidsgaujr8a0h.xn--p1ai';
    
    const emailSubject = `[ОБРАТНАЯ СВЯЗЬ] ЛегкоСохранить.рф — Отзыв от тестировщика`;
    const emailBodyText = `
Новый отзыв от тестировщика:
----------------------------------------
Имя: ${name || 'Аноним'}
Email: ${email || 'Не указан'}
Пользователь ID: ${userId || 'Не авторизован'}
Сообщение: ${message}

Метаданные устройства:
${JSON.stringify(metadata || {}, null, 2)}
----------------------------------------
    `;

    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcf9f8;">
        <h2 style="color: #1c2b2a; border-bottom: 2px solid #a45a44; padding-bottom: 10px;">Новый отзыв тестировщика</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; width: 150px; color: #555;">Имя:</td>
            <td style="padding: 6px 0; color: #1c2b2a;">${name || '<em>Аноним</em>'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #555;">Email:</td>
            <td style="padding: 6px 0; color: #1c2b2a;">${email || '<em>Не указан</em>'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #555;">User ID:</td>
            <td style="padding: 6px 0; color: #1c2b2a; font-family: monospace; font-size: 12px;">${userId || '<em>Не авторизован</em>'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #555; vertical-align: top;">Сообщение:</td>
            <td style="padding: 6px 0; color: #1c2b2a; white-space: pre-wrap; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #eee;">${message}</td>
          </tr>
        </table>

        <h3 style="color: #333; margin-top: 25px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Метаданные окружения</h3>
        <pre style="background: #f4f4f4; padding: 10px; border-radius: 8px; font-size: 11px; color: #666; overflow-x: auto;">${JSON.stringify(metadata || {}, null, 2)}</pre>
        
        <p style="font-size: 10px; color: #999; margin-top: 30px; text-align: center;">Письмо сгенерировано автоматически системой ЛегкоСохранить.рф</p>
      </div>
    `;

    await sendEmail({
      to: feedbackReceiver,
      subject: emailSubject,
      text: emailBodyText,
      html: emailBodyHtml
    });

    res.json({ success: true, message: 'Отзыв успешно сохранен и отправлен разработчикам. Спасибо!' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Не удалось отправить отзыв. Пожалуйста, попробуйте позже.' });
  }
});

// Root endpoint status check
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'Легко Сохранить API' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
