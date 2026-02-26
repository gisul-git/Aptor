import { Router } from 'express';
import {
  createDemoRequest,
  getDemoRequest,
  getAllDemoRequests,
  updateDemoRequestStatus,
} from '../controllers/demoController';
import { validateDemoRequest, handleValidationErrors } from '../middleware/validation';
import { demoRequestRateLimiter } from '../middleware/rateLimiter';
import { normalizeRequestBody } from '../middleware/normalizeBody';

const router = Router();

// Public route - Create demo request (with rate limiting)
router.post(
  '/schedule',
  demoRequestRateLimiter,
  normalizeRequestBody,
  validateDemoRequest,
  handleValidationErrors,
  createDemoRequest
);

// Admin routes (should be protected with authentication in production)
router.get('/requests', getAllDemoRequests);
router.get('/requests/:id', getDemoRequest);
router.patch('/requests/:id/status', updateDemoRequestStatus);

export default router;

