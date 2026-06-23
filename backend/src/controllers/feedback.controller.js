import jwt from 'jsonwebtoken';
import { query } from '../services/db.service.js';
import { sendEmail } from '../services/mail.service.js';
import env from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;

/**
 * Collect tester feedback, save it to СУБД, and send email notification
 */
export async function submitFeedback(req, res, next) {
  const { name, email, message, metadata } = req.body;
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Пожалуйста, введите описание проблемы.' });
  }

  // Try to extract userId from optional JWT token
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
    // Save to Database
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

    // Send email notification
    const feedbackReceiver = env.FEEDBACK_RECEIVER || env.SMTP_USER || 'admin@xn--80affoidsgaujr8a0h.xn--p1ai';
    
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
    next(error);
  }
}
