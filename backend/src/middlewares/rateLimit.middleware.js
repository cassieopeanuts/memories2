import rateLimit from 'express-rate-limit';

/**
 * Limit requesting OTP codes by email to protect against email spamming
 * 1 request per 2 minutes per IP
 */
export const otpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 3, // Allow up to 3 requests in 2 minutes (in case of glitches)
  message: { error: 'Слишком много запросов кода. Пожалуйста, подождите 2 минуты.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limit PIN verification attempts to protect against brute forcing PIN codes
 * 5 attempts per 5 minutes per IP
 */
export const pinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 attempts
  message: { error: 'Превышено количество попыток ввода пин-кода. Пожалуйста, попробуйте через 5 минут.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General authentication API limiter
 * 20 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Слишком много попыток авторизации. Пожалуйста, попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});
