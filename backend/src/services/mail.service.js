import nodemailer from 'nodemailer';
import env from '../config/env.js';

// Keep track of the last time we sent a specific notification to a user to throttle them
// Key format: `${userId}:${notificationType}` -> timestamp
const lastNotificationSent = new Map();

// 24 hours throttling duration in milliseconds
const THROTTLE_DURATION = 24 * 60 * 60 * 1000;

/**
 * Creates Nodemailer transport based on environment variables
 */
function getTransporter() {
  const smtpHost = env.SMTP_HOST;
  const smtpPort = env.SMTP_PORT || 465;
  // Default to secure if port is 465, 1127 (Selectel secure port), or SMTP_SECURE is explicitly true
  const smtpSecure = env.SMTP_SECURE || smtpPort === 465 || smtpPort === 1127;
  const smtpUser = env.SMTP_USER;
  const smtpPass = env.SMTP_PASS;

  if (!smtpHost) {
    return null;
  }

  const config = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
  };

  // Selectel Mail Service and other SMTP relays require authentication
  if (smtpUser || smtpPass) {
    config.auth = {
      user: smtpUser || '',
      pass: smtpPass || ''
    };
  }

  return nodemailer.createTransport(config);
}

/**
 * Generic function to send email (with offline simulation console logging if SMTP is not configured)
 */
export async function sendEmail({ to, subject, text, html, attachments }) {
  if (!to) {
    console.warn('[Email] Cannot send email: recipient address is empty.');
    return { success: false, error: 'Recipient address is empty' };
  }

  const transporter = getTransporter();
  const smtpUser = env.SMTP_USER;
  
  // Sender email must be verified. If SMTP_USER is empty or doesn't have @, default to a verified domain address
  const fromEmail = (smtpUser && smtpUser.includes('@'))
    ? smtpUser
    : 'no-reply@xn--80affoidsgaujr8a0h.xn--p1ai'; // default: no-reply@легкосохранить.рф

  if (!transporter) {
    console.log(`
============================================================
[EMAIL SIMULATION] (SMTP not configured)
To:      ${to}
From:    "ЛегкоСохранить.РФ" <${fromEmail}>
Subject: ${subject}
Attachments: ${attachments ? attachments.length : 0}
------------------------------------------------------------
TEXT BODY:
${text}
------------------------------------------------------------
HTML BODY:
${html}
============================================================
`);
    return { simulated: true, success: true };
  }

  try {
    const mailOptions = {
      from: `"ЛегкоСохранить.РФ" <${fromEmail}>`,
      to,
      subject,
      text,
      html
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Sent successfully to ${to}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email] Failed to send email to ${to}:`, error);
    throw error;
  }
}

/**
 * Sends a 6-digit confirmation/OTP code to the user's email
 */
export async function sendVerificationCode(email, name, code) {
  const subject = `Код подтверждения входа: ${code} — ЛегкоСохранить.рф`;
  
  const text = `Здравствуйте, ${name}!
Ваш одноразовый код для входа на сайт ЛегкоСохранить.рф: ${code}
Код действителен в течение 10 минут. Если вы не запрашивали этот код, просто проигнорируйте это письмо.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcf9f8;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #a45a44; font-family: Georgia, serif; font-size: 24px; margin: 0;">ЛегкоСохранить.РФ</h1>
      </div>
      <h2 style="color: #1c2b2a; text-align: center;">Код подтверждения входа</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.6;">Здравствуйте, ${name}!</p>
      <p style="color: #333; font-size: 14px; line-height: 1.6;">Вы запросили одноразовый код для входа в ваше фотохранилище. Введите его на сайте для подтверждения:</p>
      
      <div style="background-color: #f0eae6; border-radius: 8px; padding: 15px; margin: 25px 0; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #a45a44; font-family: monospace;">${code}</span>
      </div>
      
      <p style="color: #666; font-size: 12px; line-height: 1.6;">Код действителен в течение 10 минут и может быть использован только один раз.</p>
      <p style="color: #666; font-size: 12px; line-height: 1.6;">Если вы не запрашивали этот код, пожалуйста, проигнорируйте это письмо.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
      <p style="font-size: 10px; color: #999; text-align: center; margin: 0;">Письмо сгенерировано автоматически системой ЛегкоСохранить.рф</p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
}

/**
 * Sends a notification if storage space is running out (>=90%) or completely full
 * Implements throttling to avoid spamming user on every file upload
 */
export async function sendStorageWarning(userId, email, name, currentBytes, limitBytes, isOverLimit = false) {
  if (!email) return { success: false, error: 'No email address for user' };

  const notificationType = isOverLimit ? 'full' : 'warning';
  const throttleKey = `${userId}:${notificationType}`;
  const now = Date.now();
  const lastSent = lastNotificationSent.get(throttleKey) || 0;

  if (now - lastSent < THROTTLE_DURATION) {
    console.log(`[Email] Throttled storage notification of type "${notificationType}" for user ${userId}`);
    return { throttled: true };
  }

  const currentGb = (currentBytes / (1024 * 1024 * 1024)).toFixed(2);
  const limitGb = (limitBytes / (1024 * 1024 * 1024)).toFixed(2);
  const percentage = Math.min(100, Math.round((currentBytes / limitBytes) * 100));

  const subject = isOverLimit 
    ? 'Заполнено место в вашем хранилище — ЛегкоСохранить.рф' 
    : 'Заканчивается свободное место в вашем хранилище — ЛегкоСохранить.рф';

  const text = isOverLimit
    ? `Здравствуйте, ${name}!
Место в вашем хранилище ЛегкоСохранить.рф полностью заполнено (${currentGb} ГБ из ${limitGb} ГБ). Загрузка новых фотографий временно приостановлена. Пожалуйста, удалите ненужные снимки или перейдите на расширенный тариф.`
    : `Здравствуйте, ${name}!
Место в вашем хранилище ЛегкоСохранить.рф подходит к концу (${currentGb} ГБ из ${limitGb} ГБ). Чтобы загружать новые фотографии без перебоев, вы можете удалить старые снимки или увеличить объем диска.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcf9f8;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #a45a44; font-family: Georgia, serif; font-size: 24px; margin: 0;">ЛегкоСохранить.РФ</h1>
      </div>
      <h2 style="color: ${isOverLimit ? '#d32f2f' : '#a45a44'}; text-align: center; margin-bottom: 10px;">
        ${isOverLimit ? 'Хранилище переполнено!' : 'Заканчивается место'}
      </h2>
      <p style="color: #333; font-size: 14px; line-height: 1.6;">Здравствуйте, ${name}!</p>
      
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        ${isOverLimit 
          ? 'Вы использовали весь доступный объем памяти в вашем аккаунте. Новые фотографии не смогут быть сохранены, пока вы не освободите место или не увеличите лимит.' 
          : 'Свободное место в вашем хранилище почти закончилось. Рекомендуем освободить место или расширить лимит диска, чтобы загрузка продолжалась без сбоев.'}
      </p>

      <div style="background-color: #f0eae6; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
        <div style="font-size: 16px; font-weight: bold; color: #1c2b2a; margin-bottom: 10px;">
          Использовано: <span style="color: #a45a44;">${currentGb} ГБ</span> из ${limitGb} ГБ (${percentage}%)
        </div>
        <div style="background-color: #e5dcd6; border-radius: 6px; height: 12px; width: 100%; overflow: hidden;">
          <div style="background-color: ${isOverLimit ? '#d32f2f' : '#a45a44'}; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
        </div>
      </div>

      <p style="color: #333; font-size: 14px; line-height: 1.6; text-align: center; margin: 25px 0;">
        Вы можете увеличить объем хранилища в разделе тарифов вашего личного кабинета.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
      <p style="font-size: 10px; color: #999; text-align: center; margin: 0;">Письмо сгенерировано автоматически системой ЛегкоСохранить.рф</p>
    </div>
  `;

  // Update sending timestamp before sending
  lastNotificationSent.set(throttleKey, now);

  try {
    return await sendEmail({ to: email, subject, text, html });
  } catch (err) {
    // If it fails to send, clear the throttling timestamp so we try again next time
    lastNotificationSent.delete(throttleKey);
    throw err;
  }
}

/**
 * Sends a warning notification to users who have been inactive for 150 days
 */
export async function sendInactivityWarning(email, name, daysInactive = 150) {
  const subject = `Ваш аккаунт неактивен ${daysInactive} дней — ЛегкоСохранить.рф`;
  
  const text = `Здравствуйте, ${name}!
Ваш аккаунт в фотохранилище ЛегкоСохранить.рф неактивен уже ${daysInactive} дней.
Чтобы сохранить ваши фотографии и видеоматериалы, пожалуйста, совершите вход в аккаунт в течение следующих 30 дней.
Если вы не выполните вход, через 30 дней (по истечении 180 дней неактивности) все ваши данные и файлы будут автоматически удалены навсегда из нашего хранилища в соответствии с политикой хранения.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fcf9f8;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #a45a44; font-family: Georgia, serif; font-size: 24px; margin: 0;">ЛегкоСохранить.РФ</h1>
      </div>
      <h2 style="color: #d32f2f; text-align: center; margin-bottom: 15px;">Ваш аккаунт неактивен</h2>
      <p style="color: #333; font-size: 14px; line-height: 1.6;">Здравствуйте, ${name}!</p>
      
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Мы заметили, что вы не пользовались вашим хранилищем ЛегкоСохранить.рф уже <strong>${daysInactive} дней</strong>.
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Для защиты конфиденциальности и автоматической очистки ресурсов неиспользуемые аккаунты удаляются.
        Чтобы сохранить все ваши снимки и видеозаписи, просто выполните вход в свой аккаунт:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://легкосохранить.рф" style="background-color: #a45a44; color: white; padding: 12px 30px; text-decoration: none; border-radius: 20px; font-weight: bold; font-size: 14px; display: inline-block;">Войти в хранилище</a>
      </div>
      
      <p style="color: #d32f2f; font-size: 13px; font-weight: bold; line-height: 1.6;">
        Внимание: если вы не авторизуетесь на сайте, через 30 дней (по истечении 180 дней неактивности) все ваши альбомы, фотографии и видео файлы будут безвозвратно удалены из хранилища Selectel S3.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
      <p style="font-size: 10px; color: #999; text-align: center; margin: 0;">Письмо сгенерировано автоматически системой ЛегкоСохранить.рф</p>
    </div>
  `;

  return sendEmail({ to: email, subject, text, html });
}
