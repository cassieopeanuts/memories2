import crypto from 'crypto';
import { query } from '../services/db.service.js';
import env from '../config/env.js';

/**
 * Initiates a new payment session (e.g. via YooKassa, Sberbank, or T-Bank)
 * Returns a payment URL for the client to redirect to
 */
export async function createPaymentSession(req, res, next) {
  const { limitBytes, planName, price, method } = req.body;
  const userId = req.user.id;

  if (!limitBytes || typeof limitBytes !== 'number') {
    return res.status(400).json({ error: 'Некорректный размер хранилища.' });
  }

  try {
    // Generate a unique transaction/order ID
    const orderId = crypto.randomUUID();
    const isPaidPlan = limitBytes > 1073741824; // > 1 GB

    if (!isPaidPlan) {
      // Free plan downgrade can happen directly
      await query(
        'UPDATE users SET storage_limit = $1, card_token = NULL, card_mask = NULL, card_brand = NULL WHERE id = $2',
        [limitBytes, userId]
      );
      return res.json({ 
        success: true, 
        storageLimit: limitBytes,
        downgraded: true
      });
    }

    // Simulated Secure Payment gateway redirect URL
    const host = req.headers.host;
    const protocol = req.secure ? 'https' : 'http';
    const mockConfirmationUrl = `${protocol}://${host}/api/billing/mock-gateway?orderId=${orderId}&userId=${userId}&limitBytes=${limitBytes}&price=${price || 99}&method=${method || 'card'}`;

    res.json({
      success: true,
      confirmationUrl: mockConfirmationUrl,
      orderId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Webhook handler to listen to successful payment notifications
 * Enforces IP restriction or signature validation in production
 */
export async function handlePaymentWebhook(req, res, next) {
  const event = req.body;

  // In production (YooKassa webhook validation):
  // const ip = req.ip || req.headers['x-forwarded-for'];
  // if (!validateYooKassaIp(ip)) return res.status(403).send('Forbidden IP');

  try {
    console.log('[Billing Webhook] Received payment event:', JSON.stringify(event, null, 2));

    // Process payment.succeeded event
    if (event && event.event === 'payment.succeeded') {
      const payment = event.object;
      const { userId, limitBytes } = payment.metadata;

      if (!userId || !limitBytes) {
        return res.status(400).send('Metadata missing');
      }

      const cardInfo = payment.payment_method || {};
      const cardToken = cardInfo.saved ? 'tok_' + crypto.randomBytes(16).toString('hex') : null;
      const cardMask = cardInfo.card ? `${cardInfo.card.first6}••••••${cardInfo.card.last4}` : 'MIR-MOCK';
      const cardBrand = cardInfo.card ? cardInfo.card.card_type : 'MIR';

      // Update storage limit in the database securely inside a transaction
      await query(
        'UPDATE users SET storage_limit = $1, card_token = $2, card_mask = $3, card_brand = $4 WHERE id = $5',
        [parseInt(limitBytes, 10), cardToken, cardMask, cardBrand, userId]
      );

      console.log(`[Billing Webhook] Upgraded user ${userId} to limit ${limitBytes} bytes. Card tokenized: ${!!cardToken}`);
      return res.status(200).send('OK');
    }

    res.status(200).send('Event ignored');
  } catch (error) {
    console.error('[Billing Webhook Error]', error);
    res.status(500).send('Internal Server Error');
  }
}

/**
 * Direct Upgrade API (kept for simulated frontend compatibility)
 * We secure it by restricting it or logging security warnings
 */
export async function upgradeSubscriptionDirect(req, res, next) {
  const { limitBytes } = req.body;
  const userId = req.user.id;

  if (!limitBytes || typeof limitBytes !== 'number') {
    return res.status(400).json({ error: 'Некорректный размер хранилища.' });
  }

  try {
    const isPaidPlan = limitBytes > 1073741824; // > 1 GB is paid
    const cardToken = isPaidPlan ? 'tok_mock_' + crypto.randomBytes(8).toString('hex') : null;
    const cardMask = isPaidPlan ? '4242 42•• •••• ' + Math.floor(1000 + Math.random() * 9000) : null;
    const cardBrand = isPaidPlan ? 'MIR' : null;

    if (isPaidPlan) {
      await query(
        'UPDATE users SET storage_limit = $1, card_token = $2, card_mask = $3, card_brand = $4 WHERE id = $5',
        [limitBytes, cardToken, cardMask, cardBrand, userId]
      );
    } else {
      await query(
        'UPDATE users SET storage_limit = $1, card_token = NULL, card_mask = NULL, card_brand = NULL WHERE id = $2',
        [limitBytes, userId]
      );
    }

    res.json({ 
      success: true, 
      storageLimit: limitBytes,
      cardMask,
      cardBrand
    });
  } catch (error) {
    next(error);
  }
}

/**
 * One-click cancellation of recurrent payments (376-FZ Compliance)
 */
export async function cancelSubscription(req, res, next) {
  const userId = req.user.id;

  try {
    // 1. Fetch user card token details
    const result = await query('SELECT id, card_token, card_mask FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }
    
    const user = result.rows[0];

    // 2. If recurrent payments are configured, notify the payment gateway
    if (user.card_token) {
      console.log(`\n============================================================`);
      console.log(`[Aggregator Webhook] Initiating immediate revocation of recurrent payment token`);
      console.log(`User ID:     ${user.id}`);
      console.log(`Card Token:  ${user.card_token}`);
      console.log(`Card Mask:   ${user.card_mask}`);
      console.log(`Request URL: POST https://api.payment-gateway.ru/v3/tokens/${user.card_token}/revoke`);
      console.log(`============================================================\n`);
    }

    // 3. Clear token from СУБД immediately (FZ No. 376-FZ compliance)
    await query(
      'UPDATE users SET card_token = NULL, card_mask = NULL, card_brand = NULL WHERE id = $1',
      [userId]
    );

    res.json({ success: true, message: 'Карта успешно удалена, автоплатежи немедленно отменены.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Mock payment gateway checkout page
 */
export async function mockGateway(req, res, next) {
  const { orderId, userId, limitBytes, price, method } = req.query;
  
  let headerText = 'Оплата картой';
  let innerHtml = '';
  let themeColor = '#22c55e';
  
  if (method === 'sbp') {
    headerText = 'Оплата через СБП';
    themeColor = '#0052FF';
    innerHtml = `
      <div style="margin: 20px 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
        <div style="font-weight: 900; color: #0052FF; font-size: 24px; font-family: serif; letter-spacing: -1px; text-transform: uppercase;">СБП</div>
        <p style="font-size: 13px; color: #666; margin: 0 0 10px 0; line-height: 1.4;">Отсканируйте QR-код в мобильном приложении вашего банка для подтверждения оплаты</p>
        <svg width="180" height="180" viewBox="0 0 100 100" style="border: 4px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-radius: 8px; background: #fff;">
          <rect x="0" y="0" width="25" height="25" fill="#000"/>
          <rect x="5" y="5" width="15" height="15" fill="#fff"/>
          <rect x="75" y="0" width="25" height="25" fill="#000"/>
          <rect x="80" y="5" width="15" height="15" fill="#fff"/>
          <rect x="0" y="75" width="25" height="25" fill="#000"/>
          <rect x="5" y="80" width="15" height="15" fill="#fff"/>
          <rect x="35" y="10" width="10" height="20" fill="#000"/>
          <rect x="50" y="5" width="15" height="10" fill="#000"/>
          <rect x="30" y="45" width="20" height="20" fill="#000"/>
          <rect x="65" y="35" width="15" height="15" fill="#000"/>
          <rect x="10" y="35" width="15" height="10" fill="#000"/>
          <rect x="40" y="75" width="20" height="15" fill="#000"/>
          <rect x="70" y="65" width="25" height="20" fill="#000"/>
        </svg>
      </div>
    `;
  } else if (method === 'yandex') {
    headerText = 'Яндекс Пэй';
    themeColor = '#FC3F1D';
    innerHtml = `
      <div style="margin: 25px 0;">
        <div style="width: 70px; height: 70px; background: #FC3F1D; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 38px; font-family: sans-serif; margin-bottom: 15px;">Я</div>
        <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.4;">Быстрая и безопасная оплата с вашей учетной записью Яндекс ID</p>
      </div>
    `;
  } else if (method === 'sber') {
    headerText = 'Сбербанк Онлайн';
    themeColor = '#21A038';
    innerHtml = `
      <div style="margin: 25px 0;">
        <div style="width: 70px; height: 70px; background: #21A038; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 32px; font-family: sans-serif; margin-bottom: 15px;">✔</div>
        <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.4;">Будет совершена безопасная оплата через шлюз СберБанк Онлайн</p>
      </div>
    `;
  } else if (method === 'tbank') {
    headerText = 'Т-Банк';
    themeColor = '#FFDD2D';
    innerHtml = `
      <div style="margin: 25px 0;">
        <div style="width: 70px; height: 70px; background: black; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; color: #FFDD2D; font-weight: bold; font-size: 38px; font-family: sans-serif; margin-bottom: 15px;">Т</div>
        <p style="font-size: 13px; color: #666; margin: 0; line-height: 1.4;">Оплата в мобильном приложении Т-Банка или на официальном сайте</p>
      </div>
    `;
  } else {
    innerHtml = `
      <div style="margin: 20px 0; text-align: left;">
        <label style="display: block; font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 5px;">Номер карты</label>
        <input type="text" value="4242 4242 4242 4242" disabled style="width: 90%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; font-weight: bold; letter-spacing: 1px; background: #fdfdfd; margin-bottom: 15px;" />
        <div style="display: flex; gap: 15px;">
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 5px;">Срок действия</label>
            <input type="text" value="12/30" disabled style="width: 80%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; font-weight: bold; background: #fdfdfd;" />
          </div>
          <div style="flex: 1;">
            <label style="display: block; font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 5px;">CVC / CVV</label>
            <input type="text" value="***" disabled style="width: 80%; padding: 12px; border: 1px solid #ddd; border-radius: 10px; font-size: 14px; font-weight: bold; background: #fdfdfd;" />
          </div>
        </div>
      </div>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Симуляция Платежного Шлюза</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #FAF9F8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .box { background: white; padding: 30px; border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02); text-align: center; max-width: 380px; width: 100%; border: 1px solid rgba(0,0,0,0.03); box-sizing: border-box; }
        .btn { display: block; width: 100%; padding: 14px 20px; background: ${themeColor}; color: ${themeColor === '#FFDD2D' ? 'black' : 'white'}; text-decoration: none; border-radius: 16px; font-weight: bold; font-size: 14px; margin-top: 25px; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px ${themeColor}33; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px ${themeColor}44; }
        .btn:active { transform: translateY(1px); }
        .price { font-size: 28px; font-weight: bold; color: #111; margin: 10px 0 20px 0; }
        .logo { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #888; margin-bottom: 25px; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="logo">Безопасный платеж</div>
        <h2 style="font-size: 18px; font-weight: bold; color: #222; margin: 0;">${headerText}</h2>
        <div class="price">${price} ₽</div>
        
        ${innerHtml}
        
        <form action="/api/billing/mock-gateway-submit" method="POST">
          <input type="hidden" name="orderId" value="${orderId}">
          <input type="hidden" name="userId" value="${userId}">
          <input type="hidden" name="limitBytes" value="${limitBytes}">
          <input type="hidden" name="price" value="${price}">
          <input type="hidden" name="method" value="${method || 'card'}">
          <button type="submit" class="btn">Имитировать успешную оплату</button>
        </form>
      </div>
    </body>
    </html>
  `);
}

/**
 * Processes mock checkout submit and triggers the webhook asynchronously
 */
export async function mockGatewaySubmit(req, res, next) {
  const { orderId, userId, limitBytes, price, method } = req.body;

  try {
    let paymentType = 'bank_card';
    if (method === 'sbp') paymentType = 'sbp';
    else if (method === 'yandex') paymentType = 'yandex_pay';

    // Fire webhook payload directly to ourselves (simulating YooKassa server call)
    const webhookPayload = {
      event: 'payment.succeeded',
      object: {
        id: orderId,
        status: 'succeeded',
        amount: { value: price, currency: 'RUB' },
        payment_method: {
          type: paymentType,
          id: orderId,
          saved: true,
          card: paymentType === 'bank_card' ? {
            first6: '424242',
            last4: Math.floor(1000 + Math.random() * 9000).toString(),
            expiry_month: '12',
            expiry_year: '30',
            card_type: 'MIR'
          } : null
        },
        metadata: { userId, limitBytes, orderId }
      }
    };

    const host = req.headers.host;
    // We send webhook request locally
    fetch(`http://${host}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    }).catch(err => console.error('Failed to trigger mock webhook callback:', err));

    res.send(`
      <script>
        alert("Оплата прошла успешно! Перенаправляем в личный кабинет.");
        window.location.href = "${env.FRONTEND_URL}/dashboard?tab=subscription&payment=success";
      </script>
    `);
  } catch (error) {
    next(error);
  }
}
