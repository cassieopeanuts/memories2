import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import env from '../config/env.js';

const forceMock = env.MOCK_DATABASE;
let useMock = forceMock;

let pool = null;

if (!forceMock) {
  pool = new pg.Pool({
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    host: env.DB_HOST,
    database: env.DB_NAME,
    port: env.DB_PORT,
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
  photos: [],
  albums: [],
  album_photos: [],
  tester_feedback: []
};

function readMockDb() {
  if (!fs.existsSync(mockDbPath)) {
    fs.writeFileSync(mockDbPath, JSON.stringify(initialDb, null, 2));
    return initialDb;
  }
  try {
    const db = JSON.parse(fs.readFileSync(mockDbPath, 'utf8'));
    db.users = db.users || [];
    db.photos = db.photos || [];
    db.albums = db.albums || [];
    db.album_photos = db.album_photos || [];
    db.tester_feedback = db.tester_feedback || [];
    return db;
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

  // 2b. SELECT * FROM users WHERE tbank_id = $1
  if (queryText.includes('SELECT * FROM users WHERE tbank_id =')) {
    const tbankId = params[0];
    const rows = db.users.filter(u => u.tbank_id === tbankId);
    return { rows };
  }

  // 2d. SELECT * FROM users WHERE vk_id = $1
  if (queryText.includes('SELECT * FROM users WHERE vk_id =')) {
    const vkId = params[0];
    const rows = db.users.filter(u => u.vk_id === vkId);
    return { rows };
  }

  // 2c. SELECT * FROM users WHERE email = $1
  if (queryText.includes('SELECT * FROM users WHERE email =')) {
    const email = params[0];
    const rows = db.users.filter(u => u.email === email);
    return { rows };
  }
  
  if (queryText.includes('FROM users WHERE id =')) {
    const id = params[0];
    const rows = db.users.filter(u => u.id === id).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      yandex_id: u.yandex_id,
      sber_id: u.sber_id,
      tbank_id: u.tbank_id,
      vk_id: u.vk_id,
      pin_code: u.pin_code,
      storage_limit: u.storage_limit,
      push_subscriptions: u.push_subscriptions || [],
      accepted_offer: u.accepted_offer || false,
      accepted_offer_at: u.accepted_offer_at || null,
      accepted_offer_version: u.accepted_offer_version || null,
      card_token: u.card_token || null,
      card_mask: u.card_mask || null,
      card_brand: u.card_brand || null,
      last_active_at: u.last_active_at || new Date().toISOString(),
      warning_sent_at: u.warning_sent_at || null,
      created_at: u.created_at
    }));
    return { rows };
  }
  
  // 4. INSERT INTO users ... RETURNING *
  if (queryText.includes('INSERT INTO users')) {
    const fieldsMatch = queryText.match(/INSERT INTO users \(([^)]+)\)/i);
    const fields = fieldsMatch ? fieldsMatch[1].split(',').map(f => f.trim()) : [];
    
    const newUser = {
      id: crypto.randomUUID(),
      yandex_id: null,
      sber_id: null,
      tbank_id: null,
      vk_id: null,
      name: 'Пользователь',
      email: '',
      pin_code: null,
      storage_limit: 1073741824, // 1 GB in bytes
      push_subscriptions: [],
      accepted_offer: false,
      accepted_offer_at: null,
      accepted_offer_version: null,
      card_token: null,
      card_mask: null,
      card_brand: null,
      last_active_at: new Date().toISOString(),
      warning_sent_at: null,
      created_at: new Date().toISOString()
    };
    
    fields.forEach((field, idx) => {
      if (params[idx] !== undefined) {
        newUser[field] = params[idx];
      }
    });
    
    db.users.push(newUser);
    writeMockDb(db);
    return { rows: [newUser] };
  }

  // 4b. UPDATE users SET pin_code = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET pin_code =')) {
    const [pinCode, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].pin_code = pinCode;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // 4c. UPDATE users SET storage_limit = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET storage_limit =')) {
    const [limit, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].storage_limit = parseInt(limit, 10);
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // 4d. UPDATE users SET push_subscriptions = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET push_subscriptions =')) {
    const [subs, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].push_subscriptions = typeof subs === 'string' ? JSON.parse(subs) : subs;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // 4e. UPDATE users SET yandex_id = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET yandex_id =')) {
    const [yandexId, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].yandex_id = yandexId;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // 4f. UPDATE users SET sber_id = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET sber_id =')) {
    const [sberId, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].sber_id = sberId;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // 4g. UPDATE users SET tbank_id = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET tbank_id =')) {
    const [tbankId, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].tbank_id = tbankId;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // 4h. UPDATE users SET vk_id = $1 WHERE id = $2
  if (queryText.includes('UPDATE users SET vk_id =')) {
    const [vkId, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].vk_id = vkId;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // UPDATE users SET accepted_offer = ...
  if (queryText.includes('UPDATE users SET accepted_offer =')) {
    const [accepted, acceptedAt, version, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].accepted_offer = accepted === true || accepted === 'true';
      db.users[idx].accepted_offer_at = acceptedAt;
      db.users[idx].accepted_offer_version = version;
      db.users[idx].last_active_at = new Date().toISOString();
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // UPDATE users SET card_token = ...
  if (queryText.includes('UPDATE users SET card_token =')) {
    const [token, mask, brand, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].card_token = token;
      db.users[idx].card_mask = mask;
      db.users[idx].card_brand = brand;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // UPDATE users SET last_active_at = ...
  if (queryText.includes('UPDATE users SET last_active_at =')) {
    const id = params[0];
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].last_active_at = new Date().toISOString();
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }

  // UPDATE users SET warning_sent_at = ...
  if (queryText.includes('UPDATE users SET warning_sent_at =')) {
    const [warningAt, id] = params;
    const idx = db.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      db.users[idx].warning_sent_at = warningAt;
      writeMockDb(db);
      return { rows: [db.users[idx]] };
    }
    return { rows: [] };
  }
  
  // 5. SELECT SUM(size) as total_size FROM photos WHERE user_id = $1
  if (queryText.includes('SELECT SUM(size) as total_size FROM photos WHERE user_id =')) {
    const userId = params[0];
    const userPhotos = db.photos.filter(p => p.user_id === userId);
    const totalSize = userPhotos.reduce((sum, p) => sum + parseInt(p.size, 10), 0);
    return { rows: [{ total_size: totalSize.toString() }] };
  }

  // 5b. SELECT COUNT(*) as cnt FROM photos WHERE user_id = $1
  if (queryText.includes('SELECT COUNT(*) as cnt FROM photos WHERE user_id =')) {
    const userId = params[0];
    const cnt = db.photos.filter(p => p.user_id === userId).length;
    return { rows: [{ cnt: cnt.toString() }] };
  }

  // 5c. SELECT COUNT(*) as cnt FROM album_photos WHERE album_id = $1
  if (queryText.includes('SELECT COUNT(*) as cnt FROM album_photos WHERE album_id =')) {
    const albumId = params[0];
    const cnt = db.album_photos.filter(ap => ap.album_id === albumId).length;
    return { rows: [{ cnt: cnt.toString() }] };
  }
  
  // 6. INSERT INTO photos ... RETURNING *
  if (queryText.includes('INSERT INTO photos')) {
    const [user_id, s3_key, original_name, size, mime_type] = params;
    const newPhoto = {
      id: crypto.randomUUID(),
      user_id,
      s3_key,
      original_name,
      size: parseInt(size, 10),
      mime_type,
      is_favorite: false,
      position: 0,
      created_at: new Date().toISOString()
    };
    db.photos.push(newPhoto);
    writeMockDb(db);
    return { rows: [newPhoto] };
  }
  
  // 1b. ALTER TABLE photos ADD COLUMN IF NOT EXISTS position
  if (queryText.includes('ALTER TABLE photos ADD COLUMN') || queryText.includes('ALTER TABLE albums ADD COLUMN')) {
    return { rows: [] };
  }

  // 6b. UPDATE photos SET is_favorite = $1 WHERE id = $2 RETURNING *
  if (queryText.includes('UPDATE photos SET is_favorite =')) {
    const [isFav, id] = params;
    const idx = db.photos.findIndex(p => p.id === id);
    if (idx !== -1) {
      db.photos[idx].is_favorite = isFav === true || isFav === 'true';
      writeMockDb(db);
      return { rows: [db.photos[idx]] };
    }
    return { rows: [] };
  }

  // 6c. UPDATE photos SET position = $1 WHERE id = $2 AND user_id = $3
  if (queryText.includes('UPDATE photos SET position =') && queryText.includes('AND user_id =')) {
    const [position, id, userId] = params;
    const idx = db.photos.findIndex(p => p.id === id && p.user_id === userId);
    if (idx !== -1) {
      db.photos[idx].position = parseInt(position, 10) || 0;
      writeMockDb(db);
      return { rows: [db.photos[idx]] };
    }
    return { rows: [] };
  }

  // 6d. UPDATE photos SET is_deleted = $1, deleted_at = $2 WHERE id = $3 (or id = ANY($3))
  if (queryText.includes('UPDATE photos SET is_deleted =')) {
    const [isDeleted, deletedAt, idOrIds, userId] = params;
    const isDeletedBool = isDeleted === true || isDeleted === 'true';
    const targetIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    
    let updatedRows = [];
    db.photos.forEach((p, idx) => {
      if (targetIds.includes(p.id) && (!userId || p.user_id === userId)) {
        db.photos[idx].is_deleted = isDeletedBool;
        db.photos[idx].deleted_at = deletedAt;
        updatedRows.push(db.photos[idx]);
      }
    });
    
    if (updatedRows.length > 0) {
      writeMockDb(db);
    }
    return { rows: updatedRows };
  }
  
  // 7. SELECT * FROM photos WHERE user_id = $1
  if (queryText.includes('FROM photos WHERE user_id =')) {
    const userId = params[0];
    const isTrashQuery = queryText.includes('is_deleted = true');
    const rows = db.photos
      .filter(p => p.user_id === userId && (isTrashQuery ? (p.is_deleted === true) : (p.is_deleted !== true)))
      .map(p => ({
        id: p.id,
        user_id: p.user_id,
        s3_key: p.s3_key,
        original_name: p.original_name,
        size: p.size,
        mime_type: p.mime_type,
        is_favorite: p.is_favorite || false,
        position: p.position || 0,
        created_at: p.created_at
      }))
      .sort((a, b) => {
        if ((a.position || 0) !== (b.position || 0)) {
          return (a.position || 0) - (b.position || 0);
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });
    return { rows };
  }
  
  // 8. SELECT * FROM photos WHERE id = $1 AND user_id = $2
  if (queryText.includes('SELECT * FROM photos WHERE id =') && queryText.includes('AND user_id =')) {
    const [id, userId] = params;
    const rows = db.photos.filter(p => p.id === id && p.user_id === userId);
    return { rows };
  }
  
  // 9. DELETE FROM photos WHERE id = $1 or id = ANY($1)
  if (queryText.includes('DELETE FROM photos WHERE id =') || queryText.includes('DELETE FROM photos WHERE id = ANY(')) {
    const idOrIds = params[0];
    const targetIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const initialLength = db.photos.length;
    db.photos = db.photos.filter(p => !targetIds.includes(p.id));
    db.album_photos = db.album_photos.filter(ap => !targetIds.includes(ap.photo_id));
    writeMockDb(db);
    return { rows: [], rowCount: initialLength - db.photos.length };
  }

  // 10. Albums query: SELECT * FROM albums WHERE user_id = $1 ORDER BY position ASC
  if (queryText.includes('SELECT * FROM albums WHERE user_id =')) {
    const userId = params[0];
    const rows = db.albums
      .filter(a => a.user_id === userId)
      .sort((a, b) => a.position - b.position);
    return { rows };
  }

  // 10b. Fetch single album by ID (with optional user_id check)
  if (queryText.includes('FROM albums WHERE') && queryText.includes(' id =')) {
    const rows = db.albums.filter(a => params.includes(a.id) && (params.includes(a.user_id) || params.length === 1));
    return { rows };
  }

  // Fetch album by share_token
  if (queryText.includes('FROM albums WHERE share_token =')) {
    const shareToken = params[0];
    const rows = db.albums.filter(a => a.share_token === shareToken);
    return { rows };
  }

  // 10c. Get next album position: SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id = $1
  if (queryText.includes('SELECT COALESCE(MAX(position)+1, 1) as next_pos FROM albums WHERE user_id =')) {
    const userId = params[0];
    const userAlbums = db.albums.filter(a => a.position !== undefined);
    const maxPos = userAlbums.reduce((max, a) => Math.max(max, a.position || 0), 0);
    const next_pos = userAlbums.length > 0 ? maxPos + 1 : 1;
    return { rows: [{ next_pos }] };
  }

  // 10d. Get next album photo position: SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id = $1
  if (queryText.includes('SELECT COALESCE(MAX(position)+1, 0) as next_pos FROM album_photos WHERE album_id =')) {
    const albumId = params[0];
    const mappings = db.album_photos.filter(ap => ap.album_id === albumId);
    const maxPos = mappings.reduce((max, ap) => Math.max(max, ap.position || 0), -1);
    const next_pos = mappings.length > 0 ? maxPos + 1 : 0;
    return { rows: [{ next_pos }] };
  }

  // 10e. Get album ID by name: SELECT id FROM albums WHERE user_id = $1 AND name = $2
  if (queryText.includes('SELECT id FROM albums WHERE user_id =') && queryText.includes('name =')) {
    const userId = params[0];
    let name = params[1];
    if (queryText.includes("name = 'Общий'")) {
      name = 'Общий';
    } else if (queryText.includes("name = 'Избранное'")) {
      name = 'Избранное';
    }
    const rows = db.albums.filter(a => a.user_id === userId && a.name === name);
    return { rows };
  }

  // 11. Create album: INSERT INTO albums (user_id, name, position) ...
  if (queryText.includes('INSERT INTO albums')) {
    const [user_id, name, position] = params;
    const newAlbum = {
      id: crypto.randomUUID(),
      user_id,
      name,
      position: parseInt(position, 10) || 0,
      share_token: null,
      created_at: new Date().toISOString()
    };
    db.albums.push(newAlbum);
    writeMockDb(db);
    return { rows: [newAlbum] };
  }

  // Update album share_token
  if (queryText.includes('UPDATE albums SET share_token =')) {
    const shareToken = params[0];
    const id = params[1];
    const userId = params[2];
    const idx = db.albums.findIndex(a => a.id === id && a.user_id === userId);
    if (idx !== -1) {
      db.albums[idx].share_token = shareToken || null;
      writeMockDb(db);
      return { rows: [db.albums[idx]] };
    }
    return { rows: [] };
  }

  // 12. Update album: UPDATE albums SET name = $1, position = $2 WHERE id = $3
  if (queryText.includes('UPDATE albums SET name =') || queryText.includes('UPDATE albums SET position =')) {
    if (queryText.includes('SET name =') && queryText.includes('position =')) {
      const [name, position, id] = params;
      const idx = db.albums.findIndex(a => a.id === id);
      if (idx !== -1) {
        db.albums[idx].name = name;
        db.albums[idx].position = parseInt(position, 10);
        writeMockDb(db);
        return { rows: [db.albums[idx]] };
      }
    } else if (queryText.includes('SET position =')) {
      const [position, id] = params;
      const idx = db.albums.findIndex(a => a.id === id);
      if (idx !== -1) {
        db.albums[idx].position = parseInt(position, 10);
        writeMockDb(db);
        return { rows: [db.albums[idx]] };
      }
    }
    return { rows: [] };
  }
  
  // SELECT id, name, email FROM users WHERE last_active_at <= ... (for inactivity check)
  if (queryText.includes('SELECT id, name, email FROM users WHERE last_active_at <=')) {
    const threshold = params[0];
    const checkWarningSent = queryText.includes('warning_sent_at IS NULL');
    const rows = db.users.filter(u => {
      const isOld = new Date(u.last_active_at) <= new Date(threshold);
      const satisfiesWarning = checkWarningSent ? (!u.warning_sent_at) : true;
      return isOld && satisfiesWarning;
    }).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email
    }));
    return { rows };
  }

  // SELECT id, s3_key FROM photos WHERE is_deleted = true AND deleted_at <= ... (for trash purge)
  if (queryText.includes('SELECT id, s3_key FROM photos WHERE is_deleted = true AND deleted_at <=')) {
    const threshold = params[0];
    const rows = db.photos.filter(p => {
      return p.is_deleted === true && new Date(p.deleted_at) <= new Date(threshold);
    }).map(p => ({
      id: p.id,
      s3_key: p.s3_key
    }));
    return { rows };
  }

  // Delete user: DELETE FROM users WHERE id = $1 (cascade deletes in mock db)
  if (queryText.includes('DELETE FROM users WHERE id =')) {
    const id = params[0];
    db.users = db.users.filter(u => u.id !== id);
    db.photos = db.photos.filter(p => p.user_id !== id);
    db.albums = db.albums.filter(a => a.user_id !== id);
    writeMockDb(db);
    return { rows: [], rowCount: 1 };
  }

  // 13. Delete album: DELETE FROM albums WHERE id = $1
  if (queryText.includes('DELETE FROM albums WHERE id =')) {
    const id = params[0];
    db.albums = db.albums.filter(a => a.id !== id);
    db.album_photos = db.album_photos.filter(ap => ap.album_id !== id);
    writeMockDb(db);
    return { rows: [], rowCount: 1 };
  }

  // 14. Fetch album photos: SELECT p.* FROM photos p JOIN album_photos ap ...
  if (queryText.includes('JOIN album_photos ap ON p.id = ap.photo_id WHERE ap.album_id =')) {
    const albumId = params[0];
    const mappings = db.album_photos.filter(ap => ap.album_id === albumId);
    const photoIds = mappings.map(ap => ap.photo_id);
    const rows = db.photos
      .filter(p => photoIds.includes(p.id))
      .map(p => {
        const mapping = mappings.find(ap => ap.photo_id === p.id);
        return {
          ...p,
          position: mapping ? mapping.position : 0
        };
      })
      .sort((a, b) => a.position - b.position);
    return { rows };
  }

  // 15. Map photo to album: INSERT INTO album_photos (album_id, photo_id, position) ...
  if (queryText.includes('INSERT INTO album_photos')) {
    const [album_id, photo_id, position] = params;
    const exists = db.album_photos.some(ap => ap.album_id === album_id && ap.photo_id === photo_id);
    if (!exists) {
      db.album_photos.push({
        album_id,
        photo_id,
        position: parseInt(position, 10) || 0
      });
      writeMockDb(db);
    }
    return { rows: [{ album_id, photo_id, position }] };
  }

  // 15b. Check photo mapping existence: SELECT 1 FROM album_photos WHERE album_id = $1 AND photo_id = $2
  if (queryText.includes('SELECT 1 FROM album_photos WHERE album_id =') && queryText.includes('AND photo_id =')) {
    const [album_id, photo_id] = params;
    const exists = db.album_photos.some(ap => ap.album_id === album_id && ap.photo_id === photo_id);
    return { rows: exists ? [{ '1': 1 }] : [] };
  }

  // 16. Update photo position inside album
  if (queryText.includes('UPDATE album_photos SET position =')) {
    const [position, album_id, photo_id] = params;
    const idx = db.album_photos.findIndex(ap => ap.album_id === album_id && ap.photo_id === photo_id);
    if (idx !== -1) {
      db.album_photos[idx].position = parseInt(position, 10);
      writeMockDb(db);
    }
    return { rows: [] };
  }

  // 17. Delete photo from album mapping
  if (queryText.includes('DELETE FROM album_photos WHERE album_id =') && queryText.includes('AND photo_id =')) {
    const [album_id, photo_id] = params;
    db.album_photos = db.album_photos.filter(ap => !(ap.album_id === album_id && ap.photo_id === photo_id));
    writeMockDb(db);
    return { rows: [] };
  }

  // 18. INSERT INTO tester_feedback
  if (queryText.includes('INSERT INTO tester_feedback')) {
    const [user_id, user_name, user_email, message, metadata] = params;
    const newFeedback = {
      id: crypto.randomUUID(),
      user_id: user_id || null,
      user_name: user_name || null,
      user_email: user_email || null,
      message,
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {}),
      created_at: new Date().toISOString()
    };
    db.tester_feedback = db.tester_feedback || [];
    db.tester_feedback.push(newFeedback);
    writeMockDb(db);
    return { rows: [newFeedback] };
  }

  // 18b. CREATE TABLE IF NOT EXISTS tester_feedback
  if (queryText.includes('CREATE TABLE IF NOT EXISTS tester_feedback')) {
    return { rows: [] };
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
