import crypto from 'crypto';
import env from '../config/env.js';
import { query } from '../services/db.service.js';
import { 
  findOrCreateUser, 
  generateToken, 
  getMockProfile 
} from '../services/auth.service.js';
import { sendVerificationCode } from '../services/mail.service.js';
import { sendPushNotification, vapidPublicKey } from '../services/push.service.js';

// In-memory store for verification codes (OTP)
// email -> { code, name, expiresAt, attempts }
const verificationCodes = new Map();

// Origin validation helper (prevent Open Redirect vulnerability)
function isValidOrigin(originUrl) {
  if (!originUrl) return true;
  try {
    const parsed = new URL(originUrl);
    const frontendHost = new URL(env.FRONTEND_URL).host;
    if (parsed.host === frontendHost) return true;
    
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
    
    if (env.NODE_ENV === 'development') {
      if (/^192\.168\./.test(parsed.hostname) || /^10\./.test(parsed.hostname) || /^172\./.test(parsed.hostname)) {
        return true;
      }
    }
  } catch (e) {
    return false;
  }
  return false;
}

// HTML OAuth template generator
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

// 1. Yandex SSO Initiation
export async function yandexAuth(req, res, next) {
  try {
    const { origin } = req.query;
    const targetOrigin = isValidOrigin(origin) ? (origin || env.FRONTEND_URL) : env.FRONTEND_URL;
    const clientId = env.YANDEX_CLIENT_ID;
    const redirectUri = encodeURIComponent(env.REDIRECT_URI);
    
    if (clientId === 'mock_yandex_client_id' || !clientId) {
      const mockProfile = getMockProfile('yandex');
      return res.send(getMockOauthHtml('yandex', mockProfile, targetOrigin));
    }
    
    const yandexUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
    res.redirect(yandexUrl);
  } catch (err) {
    next(err);
  }
}

// Yandex SSO Callback (Used only for real Yandex integration)
export async function yandexCallback(req, res, next) {
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
        client_id: env.YANDEX_CLIENT_ID,
        client_secret: env.YANDEX_CLIENT_SECRET,
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
    
    // Trigger welcome push
    sendPushNotification(user.id, 'Hey hello!', 'its a test push', '/')
      .catch(err => console.error('Test login push failed:', err));

    res.redirect(`${env.FRONTEND_URL}/auth-callback?token=${token}`);
  } catch (error) {
    next(error);
  }
}

// 2. Sber ID OIDC Simulation
export async function sberAuth(req, res, next) {
  try {
    const { origin } = req.query;
    const targetOrigin = isValidOrigin(origin) ? (origin || env.FRONTEND_URL) : env.FRONTEND_URL;
    const mockProfile = getMockProfile('sber');
    res.send(getMockOauthHtml('sber', mockProfile, targetOrigin));
  } catch (err) {
    next(err);
  }
}

// 2b. T-Bank ID OIDC Simulation
export async function tbankAuth(req, res, next) {
  try {
    const { origin } = req.query;
    const targetOrigin = isValidOrigin(origin) ? (origin || env.FRONTEND_URL) : env.FRONTEND_URL;
    const mockProfile = getMockProfile('tbank');
    res.send(getMockOauthHtml('tbank', mockProfile, targetOrigin));
  } catch (err) {
    next(err);
  }
}

// 3. Confirm Mock SSO Authorization
export async function mockLoginConfirm(req, res, next) {
  const { provider, origin } = req.query;
  const targetOrigin = isValidOrigin(origin) ? (origin || env.FRONTEND_URL) : env.FRONTEND_URL;
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
    
    // Trigger welcome push
    sendPushNotification(user.id, 'Hey hello!', 'its a test push', '/')
      .catch(err => console.error('Test login push failed:', err));

    res.redirect(`${targetOrigin}/auth-callback?token=${token}`);
  } catch (error) {
    next(error);
  }
}

// 4. One-click Demo Login
export async function demoLogin(req, res, next) {
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
    
    // Trigger welcome push
    sendPushNotification(user.id, 'Hey hello!', 'its a test push', '/')
      .catch(err => console.error('Test login push failed:', err));

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        hasPin: !!user.pin_code,
        acceptedOffer: user.accepted_offer === true || user.accepted_offer === 'true',
        acceptedOfferAt: user.accepted_offer_at,
        acceptedOfferVersion: user.accepted_offer_version,
        cardMask: user.card_mask,
        cardBrand: user.card_brand
      } 
    });
  } catch (error) {
    next(error);
  }
}

// 5. Check if email is already registered
export async function checkEmail(req, res, next) {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: 'Пожалуйста, укажите адрес электронной почты.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    res.json({ exists: result.rows.length > 0 });
  } catch (error) {
    next(error);
  }
}

// 6. Request Email OTP Code (Uses otpLimiter on route)
export async function requestEmailOTP(req, res, next) {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Пожалуйста, укажите адрес электронной почты.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Пожалуйста, введите корректный адрес электронной почты.' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Look up if user already exists
    const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const existingUser = result.rows[0];
    
    // Default name: provided name, existing user's name, or email prefix
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
    next(error);
  }
}

// 7. Verify OTP Code and login
export async function verifyEmailOTP(req, res, next) {
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

    if (Date.now() > record.expiresAt) {
      verificationCodes.delete(normalizedEmail);
      return res.status(400).json({ error: 'Срок действия кода подтверждения истек. Пожалуйста, запросите код повторно.' });
    }

    if (record.attempts >= 3) {
      verificationCodes.delete(normalizedEmail);
      return res.status(400).json({ error: 'Превышено число попыток ввода. Пожалуйста, запросите новый код.' });
    }

    if (record.code !== code.trim()) {
      record.attempts += 1;
      return res.status(400).json({ error: `Неверный код. Осталось попыток: ${3 - record.attempts}` });
    }

    verificationCodes.delete(normalizedEmail);

    const user = await findOrCreateUser({
      name: record.name,
      email: normalizedEmail
    });

    const token = generateToken(user);
    
    // Trigger push
    sendPushNotification(user.id, 'Hey hello!', 'its a test push', '/')
      .catch(err => console.error('Test login push failed:', err));

    res.json({
      token,
      status: user.pin_code ? 'verify_pin' : 'create_pin',
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        acceptedOffer: user.accepted_offer === true || user.accepted_offer === 'true',
        acceptedOfferAt: user.accepted_offer_at,
        acceptedOfferVersion: user.accepted_offer_version,
        cardMask: user.card_mask,
        cardBrand: user.card_brand
      }
    });
  } catch (error) {
    next(error);
  }
}

// 8. Set PIN Code
export async function setPin(req, res, next) {
  const { pinCode } = req.body;
  if (!pinCode || pinCode.length !== 4 || !/^\d+$/.test(pinCode)) {
    return res.status(400).json({ error: 'Некорректный формат пин-кода. Требуется 4 цифры.' });
  }

  try {
    await query('UPDATE users SET pin_code = $1 WHERE id = $2', [pinCode, req.user.id]);
    res.json({ success: true, message: 'Пин-код успешно установлен.' });
  } catch (error) {
    next(error);
  }
}

// 9. Verify PIN Code (Uses pinLimiter on route)
export async function verifyPin(req, res, next) {
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
    next(error);
  }
}

// 10. Get Profile Details
export async function getProfile(req, res, next) {
  try {
    const result = await query('SELECT id, name, email, yandex_id, pin_code, storage_limit, accepted_offer, accepted_offer_at, accepted_offer_version, card_mask, card_brand FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      yandexId: user.yandex_id,
      hasPin: !!user.pin_code,
      storageLimit: parseInt(user.storage_limit, 10),
      acceptedOffer: user.accepted_offer === true || user.accepted_offer === 'true',
      acceptedOfferAt: user.accepted_offer_at,
      acceptedOfferVersion: user.accepted_offer_version,
      cardMask: user.card_mask,
      cardBrand: user.card_brand
    });
  } catch (error) {
    next(error);
  }
}

// 11. Accept Public Offer agreement
export async function acceptOffer(req, res, next) {
  const { version } = req.body;
  const userId = req.user.id;

  if (!version) {
    return res.status(400).json({ error: 'Не указана версия оферты.' });
  }

  try {
    await query(
      'UPDATE users SET accepted_offer = $1, accepted_offer_at = CURRENT_TIMESTAMP, accepted_offer_version = $2 WHERE id = $3',
      [true, version, userId]
    );
    res.json({ success: true, message: 'Оферта успешно принята.' });
  } catch (error) {
    next(error);
  }
}

// 12. Get Push Public Key
export async function getVapidPublicKey(req, res, next) {
  res.json({ publicKey: vapidPublicKey });
}

// 13. Register Device Push Subscription
export async function savePushSubscription(req, res, next) {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Некорректный формат подписки push-уведомлений.' });
  }
  const userId = req.user.id;

  try {
    const result = await query('SELECT id, name, email, push_subscriptions FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    let subscriptions = [];
    if (user.push_subscriptions) {
      subscriptions = typeof user.push_subscriptions === 'string'
        ? JSON.parse(user.push_subscriptions)
        : user.push_subscriptions;
    }
    if (!Array.isArray(subscriptions)) {
      subscriptions = [];
    }

    const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
    if (!exists) {
      subscriptions.push(subscription);
      await query('UPDATE users SET push_subscriptions = $1 WHERE id = $2', [JSON.stringify(subscriptions), userId]);
      console.log(`[Push] Registered new device push subscription for user ${userId}`);
    }

    // Trigger push confirmation
    sendPushNotification(userId, 'Hey hello!', 'its a test push', '/')
      .catch(err => console.error('[Push] Failed to send welcome confirmation push:', err));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
