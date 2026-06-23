import express from 'express';
import { z } from 'zod';
import { submitFeedback } from '../controllers/feedback.controller.js';
import { validate } from '../middlewares/validation.middleware.js';

const router = express.Router();

const feedbackSchema = z.object({
  body: z.object({
    message: z.string().min(1, 'Описание проблемы не может быть пустым.'),
    name: z.string().optional(),
    email: z.string().email('Некорректный формат email.').optional().or(z.literal('')),
    metadata: z.record(z.any()).optional()
  })
});

router.post('/', validate(feedbackSchema), submitFeedback);

export default router;
