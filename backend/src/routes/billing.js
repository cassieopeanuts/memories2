import express from 'express';
import { 
  createPaymentSession, 
  handlePaymentWebhook, 
  upgradeSubscriptionDirect, 
  cancelSubscription,
  mockGateway,
  mockGatewaySubmit
} from '../controllers/billing.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';
import express_urlencoded from 'express';

const router = express.Router();

// Public Webhook route
router.post('/webhook', handlePaymentWebhook);

// Public Mock Gateway checkout pages
router.get('/mock-gateway', mockGateway);
router.post('/mock-gateway-submit', express.urlencoded({ extended: true }), mockGatewaySubmit);

// Protected routes (require JWT)
router.post('/session', authenticateJWT, createPaymentSession);
router.post('/upgrade', authenticateJWT, upgradeSubscriptionDirect);
router.delete('/card', authenticateJWT, cancelSubscription);

export default router;
