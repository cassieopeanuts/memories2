import jwt from 'jsonwebtoken';
import { query } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'ag_very_secret_token_12345!';

/**
 * Find or create user in PostgreSQL
 */
export async function findOrCreateUser({ yandexId, sberId, name, email }) {
  try {
    let result;
    if (yandexId) {
      result = await query('SELECT * FROM users WHERE yandex_id = $1', [yandexId]);
    } else if (sberId) {
      result = await query('SELECT * FROM users WHERE sber_id = $1', [sberId]);
    } else {
      throw new Error('Either Yandex ID or Sber ID must be provided');
    }

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Create new user if not found
    const insertResult = await query(
      `INSERT INTO users (yandex_id, sber_id, name, email) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [yandexId || null, sberId || null, name, email || '']
    );
    
    console.log(`Created new user: ${name} (ID: ${insertResult.rows[0].id})`);
    return insertResult.rows[0];
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
    throw error;
  }
}

/**
 * Generate JWT token for a user
 */
export function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id,
      name: user.name,
      email: user.email 
    }, 
    JWT_SECRET, 
    { expiresIn: '30d' } // 30 days session
  );
}

/**
 * Middleware to authenticate requests via JWT
 */
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Доступ запрещен. Требуется авторизация.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user from DB to verify they still exist and get storage limits
    const result = await query('SELECT id, name, email, storage_limit FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден в системе.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('JWT validation error:', error);
    return res.status(403).json({ error: 'Недействительный или просроченный токен.' });
  }
}

/**
 * Mock profiling for quick local testing without real Yandex/Sber configuration
 */
export function getMockProfile(provider, mockId = '12345') {
  if (provider === 'yandex') {
    return {
      id: `yd-${mockId}`,
      name: 'Екатерина Яндексова',
      email: 'kate.yandex@example.ru'
    };
  } else if (provider === 'sber') {
    return {
      id: `sb-${mockId}`,
      name: 'Мария Сберова',
      email: 'mariya.sber@example.ru'
    };
  }
  return null;
}
