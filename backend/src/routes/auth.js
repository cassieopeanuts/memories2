import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import { 
  yandexAuth, 
  yandexCallback, 
  sberAuth, 
  sberCallback,
  tbankAuth, 
  tbankCallback,
  vkAuth,
  vkCallback,
  vkTokenAuth,
  mockLoginConfirm, 
  demoLogin, 
  checkEmail, 
  requestEmailOTP, 
  verifyEmailOTP, 
  setPin, 
  verifyPin, 
  getProfile, 
  acceptOffer, 
  getVapidPublicKey, 
  savePushSubscription,
  updateAvatar,
  deleteAvatar
} from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';
import { otpLimiter, pinLimiter, authLimiter } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for avatars
});

const router = express.Router();

// Validation Schemas
const emailOtpRequestSchema = z.object({
  body: z.object({
    email: z.string().email('Некорректный формат адреса электронной почты.'),
    name: z.string().optional()
  })
});

const emailOtpVerifySchema = z.object({
  body: z.object({
    email: z.string().email('Некорректный формат адреса электронной почты.'),
    code: z.string().regex(/^\d{6}$/, 'Код подтверждения должен состоять из 6 цифр.')
  })
});

const pinCodeSchema = z.object({
  body: z.object({
    pinCode: z.string().regex(/^\d{4}$/, 'Пин-код должен состоять из 4 цифр.')
  })
});

const acceptOfferSchema = z.object({
  body: z.object({
    version: z.string().min(1, 'Не указана версия оферты.')
  })
});

// SSO Initiation & Callbacks (Rate limited generally)
router.get('/yandex', authLimiter, yandexAuth);
router.get('/yandex/callback', yandexCallback);
router.get('/sber', authLimiter, sberAuth);
router.get('/sber/callback', sberCallback);
router.get('/tbank', authLimiter, tbankAuth);
router.get('/tbank/callback', tbankCallback);
router.get('/vk', authLimiter, vkAuth);
router.get('/vk/callback', vkCallback);
router.post('/vk/token', authLimiter, vkTokenAuth);
router.get('/mock-login-confirm', mockLoginConfirm);

// Demo Login
router.post('/demo', authLimiter, demoLogin);

// Email OTP flow
router.get('/check-email', checkEmail);
router.post('/email', otpLimiter, validate(emailOtpRequestSchema), requestEmailOTP);
router.post('/email/verify', authLimiter, validate(emailOtpVerifySchema), verifyEmailOTP);

// Protected routes (require JWT)
router.get('/me', authenticateJWT, getProfile);
router.post('/set-pin', authenticateJWT, validate(pinCodeSchema), setPin);
router.post('/verify-pin', authenticateJWT, pinLimiter, validate(pinCodeSchema), verifyPin);
router.post('/accept-offer', authenticateJWT, validate(acceptOfferSchema), acceptOffer);
router.post('/avatar', authenticateJWT, upload.single('avatar'), updateAvatar);
router.delete('/avatar', authenticateJWT, deleteAvatar);

// Push Notifications
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/push-subscription', authenticateJWT, savePushSubscription);

export default router;
