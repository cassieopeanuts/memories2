import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const forceMock = process.env.MOCK_DATABASE === 'true';
let useMock = forceMock;

let pool = null;

if (!forceMock) {
  pool = new pg.Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  // Test connection
  pool.connect((err, client, release) => {
    if (err) {
      console.warn('⚠️  PostgreSQL connection failed. Switching to Local JSON Mock Database.');
      useMock = true;
    } else {
      console.log('🚀 Database connected successfully to PostgreSQL');
      release();
    }
  });
} else {
  console.log('ℹ️  Mock Database explicitly enabled via MOCK_DATABASE=true');
}

// ==========================================
// LOCAL JSON DATABASE MOCK IMPLEMENTATION
// ==========================================
const mockDbPath = path.join(process.cwd(), 'db_mock.json');
const initialDb = {
  users: [],
  photos: []
};

function readMockDb() {
  if (!fs.existsSync(mockDbPath)) {
    fs.writeFileSync(mockDbPath, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }
  try {
    return JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
  } catch (e) {
    return initialDb;
  }
}

function writeMockDb(data) {
  fs.writeFileSync(mockDbPath, JSON.stringify(data, null, 2));
}

export async function mockQuery(text, params = []) {
  const db = readMockDb();
  
  // Normalize query spaces for regex/inclusion checks
  const queryText = text.replace(/\s+/g, ' ').trim();
  
  // 1. SELECT * FROM users WHERE yandex_id = $1
  if (queryText.includes('SELECT * FROM users WHERE yandex_id =')) {
    const yandexId = params[0];
    const rows = db.users.filter(u => u.yandex_id === yandexId);
    return { rows };
  }
  
  // 2. SELECT * FROM users WHERE sber_id = $1
  if (queryText.includes('SELECT * FROM users WHERE sber_id =')) {
    const sberId = params[0];
    const rows = db.users.filter(u => u.sber_id === sberId);
    return { rows };
  }
  
  // 3. SELECT id, name, email, storage_limit FROM users WHERE id = $1
  if (queryText.includes('SELECT id, name, email, storage_limit FROM users WHERE id =')) {
    const id = params[0];
    const rows = db.users.filter(u => u.id === id).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      storage_limit: u.storage_limit
    }));
    return { rows };
  }
  
  // 4. INSERT INTO users (yandex_id, sber_id, name, email) ...
  if (queryText.includes('INSERT INTO users')) {
    const [yandex_id, sber_id, name, email] = params;
    const newUser = {
      id: crypto.randomUUID(),
      yandex_id: yandex_id || null,
      sber_id: sber_id || null,
      name: name || 'Пользователь',
      email: email || '',
      storage_limit: 1073741824, // 1 GB in bytes
      created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    writeMockDb(db);
    return { rows: [newUser] };
  }
  
  // 5. SELECT SUM(size) as total_size FROM photos WHERE user_id = $1
  if (queryText.includes('SELECT SUM(size) as total_size FROM photos WHERE user_id =')) {
    const userId = params[0];
    const userPhotos = db.photos.filter(p => p.user_id === userId);
    const totalSize = userPhotos.reduce((sum, p) => sum + parseInt(p.size, 10), 0);
    return { rows: [{ total_size: totalSize.toString() }] };
  }
  
  // 6. INSERT INTO photos (user_id, s3_key, original_name, size, mime_type) ...
  if (queryText.includes('INSERT INTO photos')) {
    const [user_id, s3_key, original_name, size, mime_type] = params;
    const newPhoto = {
      id: crypto.randomUUID(),
      user_id,
      s3_key,
      original_name,
      size: parseInt(size, 10),
      mime_type,
      created_at: new Date().toISOString()
    };
    db.photos.push(newPhoto);
    writeMockDb(db);
    return { rows: [newPhoto] };
  }
  
  // 7. SELECT id, s3_key, original_name, size, mime_type, created_at FROM photos WHERE user_id = $1 ORDER BY created_at DESC
  if (queryText.includes('SELECT id, s3_key, original_name, size, mime_type, created_at FROM photos WHERE user_id =')) {
    const userId = params[0];
    const rows = db.photos
      .filter(p => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows };
  }
  
  // 8. SELECT * FROM photos WHERE id = $1 AND user_id = $2
  if (queryText.includes('SELECT * FROM photos WHERE id =') && queryText.includes('AND user_id =')) {
    const [id, userId] = params;
    const rows = db.photos.filter(p => p.id === id && p.user_id === userId);
    return { rows };
  }
  
  // 9. DELETE FROM photos WHERE id = $1
  if (queryText.includes('DELETE FROM photos WHERE id =')) {
    const id = params[0];
    const initialLength = db.photos.length;
    db.photos = db.photos.filter(p => p.id !== id);
    writeMockDb(db);
    return { rows: [], rowCount: initialLength - db.photos.length };
  }
  
  console.warn('⚠️  Mock DB: Unrecognized query interpreter intercepted:', queryText);
  return { rows: [] };
}

export const query = (text, params) => {
  if (useMock) {
    return mockQuery(text, params);
  }
  return pool.query(text, params);
};

export default pool;
