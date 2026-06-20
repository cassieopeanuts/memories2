import crypto from 'crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

dotenv.config();

let fallbackSecret = 'ag_very_secret_token_12345!';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('🚨 SECURITY WARNING: process.env.JWT_SECRET is not configured in production environment!');
  console.warn('🚨 Generating a random secure fallback key. Sessions will be invalidated upon server restart!');
  fallbackSecret = crypto.randomBytes(32).toString('hex');
}

export const JWT_SECRET = process.env.JWT_SECRET || fallbackSecret;

/**
 * Find or create user in PostgreSQL
 */
export async function findOrCreateUser({ yandexId, sberId, tbankId, name, email }) {
  try {
    let result;
    // 1. First, try searching by the specific SSO ID provided
    if (yandexId) {
      result = await query('SELECT * FROM users WHERE yandex_id = $1', [yandexId]);
    } else if (sberId) {
      result = await query('SELECT * FROM users WHERE sber_id = $1', [sberId]);
    } else if (tbankId) {
      result = await query('SELECT * FROM users WHERE tbank_id = $1', [tbankId]);
    }

    if (result && result.rows.length > 0) {
      return result.rows[0];
    }

    // 2. If not found by SSO ID, but we have an email, check if a user with this email already exists
    if (email) {
      const emailResult = await query('SELECT * FROM users WHERE email = $1', [email]);
      if (emailResult.rows.length > 0) {
        const existingUser = emailResult.rows[0];
        
        // Link the new SSO ID to this existing account so they don't lose their data
        if (yandexId) {
          await query('UPDATE users SET yandex_id = $1 WHERE id = $2', [yandexId, existingUser.id]);
          existingUser.yandex_id = yandexId;
        } else if (sberId) {
          await query('UPDATE users SET sber_id = $1 WHERE id = $2', [sberId, existingUser.id]);
          existingUser.sber_id = sberId;
        } else if (tbankId) {
          await query('UPDATE users SET tbank_id = $1 WHERE id = $2', [tbankId, existingUser.id]);
          existingUser.tbank_id = tbankId;
        }
        
        console.log(`Linked SSO provider to existing user account: ${name} (${email})`);
        return existingUser;
      }
    }

    // 3. Fallback: if we only had email (no SSO ID) and found it, return it
    if (!yandexId && !sberId && !tbankId && email) {
      result = await query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    }

    if (!yandexId && !sberId && !tbankId && !email) {
      throw new Error('Either Yandex ID, Sber ID, T-Bank ID, or Email must be provided');
    }

    // Create new user if not found anywhere
    const insertResult = await query(
      `INSERT INTO users (yandex_id, sber_id, tbank_id, name, email) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [yandexId || null, sberId || null, tbankId || null, name, email || '']
    );
    
    const user = insertResult.rows[0];
    console.log(`Created new user: ${name} (ID: ${user.id})`);

    // Create default "Общий" album for this new user
    await query(
      'INSERT INTO albums (user_id, name, position) VALUES ($1, $2, $3)',
      [user.id, 'Общий', 0]
    );

    return user;
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
  } else if (provider === 'tbank') {
    return {
      id: `tb-${mockId}`,
      name: 'Татьяна Т-Банкова',
      email: 'tanya.tbank@example.ru'
    };
  }
  return null;
}
