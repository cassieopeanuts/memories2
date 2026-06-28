import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import { submitFeedback } from '../controllers/feedback.controller.js';
import { validate } from '../middlewares/validation.middleware.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const feedbackSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Описание проблемы не может быть пустым.'),
    name: z.string().optional(),
    email: z.string().email('Некорректный формат email.').optional().or(z.literal('')),
    metadata: z.string().optional() // received as string from FormData
  })
});

router.post('/', upload.single('screenshot'), validate(feedbackSchema), submitFeedback);

export default router;
