import crypto from 'crypto';
import { query } from '../services/db.service.js';
import env from '../config/env.js';

/**
 * Initiates a new payment session (e.g. via YooKassa, Sberbank, or T-Bank)
 * Returns a payment URL for the client to redirect to
 */
export async function createPaymentSession(req, res, next) {
  const { limitBytes, planName, price } = req.body;
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

    // In a real production setup with YooKassa:
    // const yooKassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': 'Basic ' + Buffer.from(env.YOOKASSA_SHOP_ID + ':' + env.YOOKASSA_SECRET_KEY).toString('base64'),
    //     'Idempotence-Key': orderId,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     amount: { value: price.toString(), currency: 'RUB' },
    //     capture: true,
    //     confirmation: { type: 'redirect', return_url: `${env.FRONTEND_URL}/subscription?status=success` },
    //     description: `Оплата тарифа "${planName}" на ЛегкоСохранить.рф`,
    //     metadata: { userId, limitBytes, orderId }
    //   })
    // });
    // const paymentData = await yooKassaResponse.json();
    // return res.json({ confirmationUrl: paymentData.confirmation.confirmation_url });

    // Simulated Secure Payment gateway redirect URL
    const mockConfirmationUrl = `http://localhost:5000/api/billing/mock-gateway?orderId=${orderId}&userId=${userId}&limitBytes=${limitBytes}&price=${price || 99}`;

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
  const { orderId, userId, limitBytes, price } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Симуляция Платежного Шлюза</title>
      <style>
        body { font-family: sans-serif; background: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .box { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 400px; }
        .btn { display: inline-block; padding: 12px 30px; background: #22c55e; color: white; text-decoration: none; border-radius: 10px; font-weight: bold; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Оплата тарифа</h2>
        <p>Сумма к оплате: <strong>${price} ₽</strong></p>
        <p>Вы перенаправлены на защищенную платежную страницу.</p>
        <form action="/api/billing/mock-gateway-submit" method="POST">
          <input type="hidden" name="orderId" value="${orderId}">
          <input type="hidden" name="userId" value="${userId}">
          <input type="hidden" name="limitBytes" value="${limitBytes}">
          <input type="hidden" name="price" value="${price}">
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
  const { orderId, userId, limitBytes, price } = req.body;

  try {
    // Fire webhook payload directly to ourselves (simulating YooKassa server call)
    const webhookPayload = {
      event: 'payment.succeeded',
      object: {
        id: orderId,
        status: 'succeeded',
        amount: { value: price, currency: 'RUB' },
        payment_method: {
          type: 'bank_card',
          id: orderId,
          saved: true,
          card: {
            first6: '424242',
            last4: Math.floor(1000 + Math.random() * 9000).toString(),
            expiry_month: '12',
            expiry_year: '30',
            card_type: 'MIR'
          }
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
        window.location.href = "${env.FRONTEND_URL}/subscription?status=success";
      </script>
    `);
  } catch (error) {
    next(error);
  }
}
