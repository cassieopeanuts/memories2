import webpush from 'web-push';
import { query } from './db.service.js';
import env from '../config/env.js';

let vapidPublicKey = env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('⚠️  VAPID keys not configured in env. Generating temporary one-off keys for push notifications...');
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  console.log(`
============================================================
GENERATED VAPID KEYS FOR PRODUCTION .env:
Paste these into your Selectel .env:
VAPID_PUBLIC_KEY=${vapidPublicKey}
VAPID_PRIVATE_KEY=${vapidPrivateKey}
============================================================
`);
}

webpush.setVapidDetails(
  'mailto:admin@xn--80affoidsgaujr8a0h.xn--p1ai',
  vapidPublicKey,
  vapidPrivateKey
);

export { vapidPublicKey, vapidPrivateKey };

/**
 * Send web push notification to a user's registered devices
 */
export async function sendPushNotification(userId, title, body, url = '/') {
  try {
    const result = await query('SELECT id, name, email, push_subscriptions FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) {
      console.warn(`[Push] User ${userId} not found, skipping push.`);
      return;
    }

    let subscriptions = [];
    if (user.push_subscriptions) {
      subscriptions = typeof user.push_subscriptions === 'string'
        ? JSON.parse(user.push_subscriptions)
        : user.push_subscriptions;
    }

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      console.log(`[Push] User ${userId} has no registered push subscriptions.`);
      return;
    }

    const payload = JSON.stringify({ title, body, url });
    console.log(`[Push] Dispatched push notification payload to ${subscriptions.length} devices for user ${userId}`);

    const failedSubscriptions = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          console.log(`[Push] Attempting to send push to device endpoint: ${sub.endpoint}`);
          const pushResult = await webpush.sendNotification(sub, payload);
          console.log(`[Push] Successfully sent push notification! Status code: ${pushResult.statusCode || 201}`);
        } catch (error) {
          console.error(`[Push] Failed to send push to device endpoint ${sub.endpoint}:`, error.message);
          if (error.statusCode === 410 || error.statusCode === 404) {
            failedSubscriptions.push(sub.endpoint);
          }
        }
      })
    );

    if (failedSubscriptions.length > 0) {
      const remainingSubscriptions = subscriptions.filter(sub => !failedSubscriptions.includes(sub.endpoint));
      await query('UPDATE users SET push_subscriptions = $1 WHERE id = $2', [JSON.stringify(remainingSubscriptions), userId]);
      console.log(`[Push] Cleaned up ${failedSubscriptions.length} expired push subscriptions for user ${userId}`);
    }
  } catch (error) {
    console.error(`[Push] Error sending push notification for user ${userId}:`, error);
  }
}
