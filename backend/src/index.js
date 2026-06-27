import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

import env from './config/env.js';
import { query } from './services/db.service.js';
import { 
  generatePresignedUploadUrl, 
  generatePresignedDownloadUrl, 
  deleteFromStorage 
} from './services/s3.service.js';
import { sendPushNotification } from './services/push.service.js';
import { sendStorageWarning, sendInactivityWarning } from './services/mail.service.js';

// Routers
import authRouter from './routes/auth.js';
import albumsRouter from './routes/albums.js';
import photosRouter from './routes/photos.js';
import billingRouter from './routes/billing.js';
import feedbackRouter from './routes/feedback.js';

// Middlewares
import errorHandler from './middlewares/error.middleware.js';

const app = express();
const PORT = env.PORT || 5000;
const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:5180';

// 1. Run database migrations at startup
async function runMigrations() {
  try {
    await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0', []);
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscriptions JSONB DEFAULT '[]'::jsonb", []);
    await query('ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_token VARCHAR(255) UNIQUE', []);
    
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_offer BOOLEAN NOT NULL DEFAULT FALSE', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_offer_at TIMESTAMP WITH TIME ZONE', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_offer_version VARCHAR(50)', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS card_token VARCHAR(255)', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS card_mask VARCHAR(50)', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50)', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMP WITH TIME ZONE', []);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id VARCHAR(255) UNIQUE', []);
    await query('CREATE INDEX IF NOT EXISTS idx_users_vk_id ON users(vk_id)', []);
    
    await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE', []);
    await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE', []);
    await query('ALTER TABLE photos ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(512)', []);

    await query(`
      CREATE TABLE IF NOT EXISTS tester_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `, []);

    console.log('🚀 Database migrations completed successfully.');
  } catch (err) {
    console.error('❌ Migration error during startup:', err);
  }
}

runMigrations();

// 2. Setup Security & Logging Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to prevent blocking local dev stylesheets and script tags
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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
                    
    if (isLocal || isDomainMatch || origin === FRONTEND_URL || env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Create mock upload folder path
const MOCK_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// ==========================================
// MOCK S3 ENDPOINTS (FOR OFFLINE / DEV MODE)
// ==========================================
app.put('/api/mock-s3/*', (req, res) => {
  const fileKey = req.params[0];
  const filePath = path.resolve(MOCK_UPLOAD_DIR, fileKey);
  
  if (!filePath.startsWith(MOCK_UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Доступ запрещен (обход путей).' });
  }
  
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

app.get('/api/mock-s3/*', (req, res) => {
  const fileKey = req.params[0];
  const filePath = path.resolve(MOCK_UPLOAD_DIR, fileKey);
  
  if (!filePath.startsWith(MOCK_UPLOAD_DIR)) {
    return res.status(403).json({ error: 'Доступ запрещен (обход путей).' });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  res.sendFile(filePath);
});

// ==========================================
// MOUNTING ROUTERS
// ==========================================
app.use('/api/auth', authRouter);
app.use('/api/albums', albumsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/billing', billingRouter);
app.use('/api/feedback', feedbackRouter);

// ==========================================
// SEO & OPEN GRAPH META INTERCEPTION
// ==========================================
async function fetchFrontendHtml() {
  const targets = [];
  if (env.NODE_ENV === 'development') {
    targets.push('http://frontend:5173');
    targets.push('http://localhost:5173');
  } else {
    targets.push('http://frontend:80');
    if (env.FRONTEND_URL) {
      targets.push(env.FRONTEND_URL);
    }
  }

  for (const target of targets) {
    try {
      const res = await fetch(target + '/', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('id="root"')) {
          return text;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch frontend index.html from ${target}:`, err.message);
    }
  }

  const localPaths = [
    path.join(process.cwd(), '../frontend/dist/index.html'),
    path.join(process.cwd(), '../frontend/index.html'),
    path.join(process.cwd(), 'dist/index.html'),
    path.join(process.cwd(), 'index.html')
  ];
  for (const p of localPaths) {
    try {
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, 'utf8');
        if (text && text.includes('id="root"')) {
          return text;
        }
      }
    } catch (e) {}
  }
  
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ЛегкоСохранить.рф — Хранилище ваших воспоминаний</title>
    <meta name="description" content="Самое просто хранилище для ваших воспоминаний. Сохраняйте то, что дорого, в один клик." />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

app.get('/shared/:share_token', async (req, res) => {
  const { share_token } = req.params;

  try {
    const albumResult = await query(
      'SELECT id, name, user_id FROM albums WHERE share_token = $1',
      [share_token]
    );

    if (albumResult.rows.length === 0) {
      const defaultHtml = await fetchFrontendHtml();
      return res.send(defaultHtml);
    }

    const album = albumResult.rows[0];
    const ownerResult = await query('SELECT name FROM users WHERE id = $1', [album.user_id]);
    const ownerName = ownerResult.rows.length > 0 ? ownerResult.rows[0].name : 'Пользователь';

    const photosResult = await query(
      `SELECT p.s3_key 
       FROM photos p 
       JOIN album_photos ap ON p.id = ap.photo_id 
       WHERE ap.album_id = $1 AND p.is_deleted = false
       ORDER BY ap.position ASC LIMIT 1`,
      [album.id]
    );

    let coverPhotoUrl = null;
    if (photosResult.rows.length > 0) {
      try {
        coverPhotoUrl = await generatePresignedDownloadUrl(photosResult.rows[0].s3_key);
      } catch (e) {
        console.error('Error generating presigned URL for cover photo:', e);
      }
    }

    let html = await fetchFrontendHtml();
    const albumName = album.name;
    const shareUrl = `https://легкосохранить.рф/shared/${share_token}`;
    const descriptionText = `Посмотрите фотоальбом «${albumName}» (автор: ${ownerName}) на ЛегкоСохранить.рф`;

    if (html.includes('<title>')) {
      html = html.replace(/<title>.*?<\/title>/, `<title>Фотоальбом «${albumName}» — ЛегкоСохранить.рф</title>`);
    } else {
      html = html.replace('</head>', `<title>Фотоальбом «${albumName}» — ЛегкоСохранить.рф</title>\n</head>`);
    }

    if (html.includes('name="description"')) {
      html = html.replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${descriptionText}" />`);
    } else {
      html = html.replace('</head>', `<meta name="description" content="${descriptionText}" />\n</head>`);
    }

    const ogTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:title" content="Фотоальбом «${albumName}»" />
    <meta property="og:description" content="${descriptionText}" />
    ${coverPhotoUrl ? `<meta property="og:image" content="${coverPhotoUrl}" />` : ''}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${shareUrl}" />
    <meta property="twitter:title" content="Фотоальбом «${albumName}»" />
    <meta property="twitter:description" content="${descriptionText}" />
    ${coverPhotoUrl ? `<meta property="twitter:image" content="${coverPhotoUrl}" />` : ''}
`;

    html = html.replace('</head>', `${ogTags}\n</head>`);
    res.send(html);
  } catch (error) {
    console.error('Error rendering shared album page:', error);
    try {
      const fallbackHtml = await fetchFrontendHtml();
      res.send(fallbackHtml);
    } catch (e) {
      res.status(500).send('Internal Server Error');
    }
  }
});

app.get('/', async (req, res, next) => {
  try {
    const html = await fetchFrontendHtml();
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// DAILY LIFECYCLE AUTOMATION DAEMON (CRON)
// ==========================================
async function runDailyGarbageCollection() {
  console.log('[GC Daemon] Starting daily garbage collection scan...');
  const now = new Date();

  try {
    // 1. Clean Trash Bin (permanently delete photos soft-deleted for >= 30 days)
    const trashThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const trashResult = await query(
      'SELECT id, s3_key FROM photos WHERE is_deleted = true AND deleted_at <= $1',
      [trashThreshold.toISOString()]
    );

    if (trashResult.rows.length > 0) {
      console.log(`[GC Daemon] Found ${trashResult.rows.length} photos in Trash to permanently purge.`);
      const photoIds = trashResult.rows.map(p => p.id);
      
      for (const photo of trashResult.rows) {
        try {
          await deleteFromStorage(photo.s3_key);
        } catch (err) {
          console.error(`[GC Daemon] Failed to delete S3 key ${photo.s3_key}:`, err.message);
        }
      }

      await query('DELETE FROM photos WHERE id = ANY($1)', [photoIds]);
      console.log(`[GC Daemon] Successfully purged ${photoIds.length} photos from Trash.`);
    }

    // 2. Inactivity Warning (150 days inactive)
    const warningThreshold = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000);
    const warnUsersResult = await query(
      'SELECT id, name, email FROM users WHERE last_active_at <= $1 AND warning_sent_at IS NULL',
      [warningThreshold.toISOString()]
    );

    for (const user of warnUsersResult.rows) {
      if (user.email && user.email.includes('@')) {
        try {
          console.log(`[GC Daemon] Sending 150-day inactivity warning email to ${user.name} (${user.email})`);
          await sendInactivityWarning(user.email, user.name, 150);
          await query(
            'UPDATE users SET warning_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
          );
        } catch (err) {
          console.error(`[GC Daemon] Failed to send inactivity warning to user ${user.id}:`, err.message);
        }
      }
    }

    // 3. Inactivity Purge (180 days inactive)
    const purgeThreshold = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const purgeUsersResult = await query(
      'SELECT id, name, email FROM users WHERE last_active_at <= $1',
      [purgeThreshold.toISOString()]
    );

    for (const user of purgeUsersResult.rows) {
      console.log(`[GC Daemon] Account inactive for >= 180 days. Initiating full storage purge for User ${user.name} (ID: ${user.id}).`);
      
      const photosResult = await query(
        'SELECT s3_key FROM photos WHERE user_id = $1',
        [user.id]
      );

      for (const photo of photosResult.rows) {
        try {
          await deleteFromStorage(photo.s3_key);
        } catch (err) {
          console.error(`[GC Daemon] Failed to delete S3 key ${photo.s3_key} during account purge:`, err.message);
        }
      }

      await query('DELETE FROM users WHERE id = $1', [user.id]);
      console.log(`[GC Daemon] User ${user.id} and all related records successfully deleted from DB.`);
    }

    console.log('[GC Daemon] Garbage collection scan finished.');
  } catch (error) {
    console.error('[GC Daemon] Error during garbage collection:', error);
  }
}

function startGcDaemon() {
  setTimeout(() => {
    runDailyGarbageCollection();
  }, 10000);

  setInterval(() => {
    runDailyGarbageCollection();
  }, 24 * 60 * 60 * 1000);
}

// 3. Error Handling Middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  startGcDaemon();
});
