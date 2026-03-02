import { Request, Response, NextFunction } from 'express';

/**
 * Normalize request body values before validation
 * Converts string booleans to actual booleans
 */
export const normalizeRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) {
    // Log original body for debugging
    console.log('[NormalizeBody] Original request body:', {
      whatsapp: req.body.whatsapp,
      privacyAgreed: req.body.privacyAgreed,
      marketingConsent: req.body.marketingConsent,
      jobTitle: req.body.jobTitle,
      companySize: req.body.companySize,
      competencies: req.body.competencies,
    });

    // Normalize boolean fields
    const booleanFields = ['whatsapp', 'privacyAgreed', 'marketingConsent'];
    
    booleanFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const value = req.body[field];
        // Convert string "true"/"false" to boolean
        if (value === 'true' || value === true || value === 1 || value === '1') {
          req.body[field] = true;
        } else if (value === 'false' || value === false || value === 0 || value === '0' || value === null || value === undefined) {
          req.body[field] = false;
        }
      }
    });

    // Log normalized body for debugging
    console.log('[NormalizeBody] Normalized request body:', {
      whatsapp: req.body.whatsapp,
      privacyAgreed: req.body.privacyAgreed,
      marketingConsent: req.body.marketingConsent,
    });
  }

  next();
};

