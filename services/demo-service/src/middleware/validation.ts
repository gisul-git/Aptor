import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

const COMPETENCY_OPTIONS = [
  'general',
  'dsa',
  'aiml',
  'cloud',
  'devops',
  'data',
  'design',
  'custom',
];

export const validateDemoRequest = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must be less than 255 characters'),

  body('company')
    .trim()
    .notEmpty()
    .withMessage('Company/Organization is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Company name must be between 1 and 200 characters'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 5, max: 20 })
    .withMessage('Phone number must be between 5 and 20 characters'),

  body('country')
    .trim()
    .notEmpty()
    .withMessage('Country is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters'),

  body('jobTitle')
    .trim()
    .notEmpty()
    .withMessage('Job title/role is required')
    .isIn(['ceo', 'vp', 'hr', 'ld', 'recruiter', 'engineer', 'other'])
    .withMessage('Invalid job title selected'),

  body('companySize')
    .trim()
    .notEmpty()
    .withMessage('Company size is required')
    .isIn(['1-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'])
    .withMessage('Invalid company size selected'),

  body('competencies')
    .isArray({ min: 1 })
    .withMessage('At least one competency must be selected')
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('Competencies must be an array');
      }
      if (value.length === 0) {
        throw new Error('At least one competency must be selected');
      }
      const invalidCompetencies = value.filter(
        (c) => !COMPETENCY_OPTIONS.includes(c)
      );
      if (invalidCompetencies.length > 0) {
        throw new Error(
          `Invalid competencies: ${invalidCompetencies.join(', ')}`
        );
      }
      return true;
    }),

  body('whatsapp').optional().isBoolean().withMessage('WhatsApp preference must be a boolean'),

  body('privacyAgreed')
    .custom((value) => {
      // Accept true (boolean), "true" (string), or 1 (number)
      if (value === true || value === 'true' || value === 1 || value === '1') {
        return true;
      }
      throw new Error('You must agree to the Privacy Policy and Terms of Service');
    }),

  body('marketingConsent')
    .optional()
    .isBoolean()
    .withMessage('Marketing consent must be a boolean'),
];

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => {
      if ('msg' in error) {
        return error.msg;
      }
      return 'Validation error';
    });

    // Log validation errors for debugging
    console.error('[Validation] Validation failed:', {
      errors: errors.array(),
      body: req.body,
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages,
    });
    return;
  }

  next();
};

