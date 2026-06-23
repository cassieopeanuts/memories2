// Verification script to check for import errors or syntax errors
import { query } from '../src/services/db.service.js';
import { generatePresignedUploadUrl } from '../src/services/s3.service.js';
import { sendEmail } from '../src/services/mail.service.js';
import { sendPushNotification } from '../src/services/push.service.js';

import authRouter from '../src/routes/auth.js';
import albumsRouter from '../src/routes/albums.js';
import photosRouter from '../src/routes/photos.js';
import billingRouter from '../src/routes/billing.js';
import feedbackRouter from '../src/routes/feedback.js';

console.log('✅ All services, routers, and configurations imported successfully! No import or syntax errors found.');
process.exit(0);
