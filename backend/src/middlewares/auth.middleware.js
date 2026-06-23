import jwt from 'jsonwebtoken';
import { query } from '../services/db.service.js';
import env from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;

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
    
    // Fetch user from DB to verify they still exist and get storage limits and billing fields
    const result = await query(
      'SELECT id, name, email, storage_limit, accepted_offer, accepted_offer_at, accepted_offer_version, card_token, card_mask, card_brand FROM users WHERE id = $1', 
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден в системе.' });
    }

    // Asynchronously update last active timestamp
    query('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1', [decoded.userId])
      .catch(err => console.error('Failed to update user last_active_at:', err));

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('JWT validation error:', error);
    return res.status(403).json({ error: 'Недействительный или просроченный токен.' });
  }
}

export default authenticateJWT;
