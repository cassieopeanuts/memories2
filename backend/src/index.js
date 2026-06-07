import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from './db.js';
import { 
  findOrCreateUser, 
  generateToken, 
  authenticateJWT, 
  getMockProfile 
} from './auth.js';
import { 
  generatePresignedUploadUrl, 
  generatePresignedDownloadUrl, 
  deleteFromStorage 
} from './s3.js';

dotenv.config();

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
                    
    if (isLocal || origin === FRONTEND_URL || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Create mock upload folder path
const MOCK_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// ==========================================
// MOCK S3 ENDPOINTS (FOR OFFLINE / DEV MODE)
// ==========================================
// Handles direct PUT upload from client in mock mode
app.put('/api/mock-s3/*', (req, res) => {
  const fileKey = req.params[0];
  const filePath = path.join(MOCK_UPLOAD_DIR, fileKey);
  
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
  const filePath = path.join(MOCK_UPLOAD_DIR, fileKey);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  res.sendFile(filePath);
});

// 1. Yandex SSO Initiation
app.get('/api/auth/yandex', async (req, res) => {
  const { origin } = req.query;
  const targetOrigin = origin || FRONTEND_URL;
  const clientId = process.env.YANDEX_CLIENT_ID;
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
        client_id: process.env.YANDEX_CLIENT_ID,
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
  const targetOrigin = origin || FRONTEND_URL;
  const mockProfile = getMockProfile('sber');
  return res.send(getMockOauthHtml('sber', mockProfile, targetOrigin));
});

// 3. Confirm Mock SSO Authorization (Redirects back to frontend callback with valid JWT)
app.get('/api/auth/mock-login-confirm', async (req, res) => {
  const { provider, origin } = req.query;
  const targetOrigin = origin || FRONTEND_URL;
  const mockProfile = getMockProfile(provider || 'yandex', 'mock-user-456');
  
  try {
    const user = await findOrCreateUser({
      yandexId: provider === 'yandex' ? mockProfile.id : null,
      sberId: provider === 'sber' ? mockProfile.id : null,
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
  const logo = isYandex ? 'Я' : '✔';
  const logoBg = isYandex ? '#FC3F1D' : '#128024';
  const providerName = isYandex ? 'Яндекс ID' : 'Сбер ID';
  const btnClass = isYandex 
    ? 'background-color: #FFCC00; color: #000; font-weight: 600;' 
    : 'background-image: linear-gradient(to right, #21A038, #128024); color: #fff; font-weight: 600;';
  
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
          color: white;
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
      name: mockProfile.name,
      email: mockProfile.email
    });
    
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Demo auth failed:', error);
    res.status(500).json({ error: 'Не удалось выполнить быстрый вход.' });
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
  const { s3Key, originalName, size, mimeType } = req.body;
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
    
    // Generate fresh download URL for this photo
    newPhoto.url = await generatePresignedDownloadUrl(s3Key);

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

// Root endpoint status check
app.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'Легко Сохранить API' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
