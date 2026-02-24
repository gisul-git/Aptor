import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes default
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10); // 5 requests default

export const demoRequestRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many demo requests from this IP, please try again later.',
    retryAfter: Math.ceil(WINDOW_MS / 1000 / 60), // minutes
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use IP address as the key
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    console.warn(`[RateLimiter] ⚠️ Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many demo requests from this IP, please try again later.',
      retryAfter: Math.ceil(WINDOW_MS / 1000 / 60), // minutes
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting in development (optional)
    return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
  },
});

