import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { DemoRequest, IDemoRequest } from '../models/DemoRequest';
import {
  sendDemoRequestNotification,
  sendDemoRequestConfirmation,
} from '../services/emailService';
import { asyncHandler } from '../middleware/errorHandler';

interface DemoRequestBody {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  country: string;
  jobTitle: string;
  companySize: string;
  competencies: string[];
  whatsapp?: boolean;
  privacyAgreed: boolean;
  marketingConsent?: boolean;
}

export const createDemoRequest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const body: DemoRequestBody = req.body;

    console.log('[DemoController] 📝 Creating new demo request:', {
      email: body.email,
      company: body.company,
      competencies: body.competencies,
    });

    // Check if user already exists in auth_db
    const normalizedEmail = body.email.trim().toLowerCase();
    
    try {
      // Connect to auth_db to check for existing user
      const authDb = mongoose.connection.useDb('auth_db');
      const usersCollection = authDb.collection('users');
      
      const existingUser = await usersCollection.findOne({
        email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
      });
      
      if (existingUser) {
        console.log('[DemoController] ⚠️ User already exists with email:', normalizedEmail);
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please sign in instead.',
        });
      }
    } catch (error) {
      console.error('[DemoController] ❌ Error checking for existing user:', error);
      // Continue with demo request creation even if check fails
      // This prevents blocking legitimate requests due to database issues
    }

    // Create demo request document
    const demoRequest = new DemoRequest({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      company: body.company,
      phone: body.phone,
      country: body.country,
      jobTitle: body.jobTitle,
      companySize: body.companySize,
      competencies: body.competencies,
      whatsapp: body.whatsapp || false,
      privacyAgreed: body.privacyAgreed,
      marketingConsent: body.marketingConsent || false,
      status: 'pending',
    });

    // Save to database
    const savedRequest = await demoRequest.save();
    console.log('[DemoController] ✅ Demo request saved to database:', savedRequest._id);

    // Send emails asynchronously (don't wait for them to complete)
    Promise.all([
      sendDemoRequestNotification(savedRequest),
      sendDemoRequestConfirmation(savedRequest),
    ]).catch((error) => {
      console.error('[DemoController] ⚠️ Error sending emails (non-blocking):', error);
      // Don't throw - we still want to return success even if emails fail
    });

    res.status(201).json({
      success: true,
      message: 'Demo request submitted successfully',
      data: {
        id: savedRequest._id,
        email: savedRequest.email,
        company: savedRequest.company,
        status: savedRequest.status,
      },
    });
  }
);

export const getDemoRequest = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const demoRequest = await DemoRequest.findById(id);

    if (!demoRequest) {
      return res.status(404).json({
        success: false,
        message: 'Demo request not found',
      });
    }

    res.json({
      success: true,
      data: demoRequest,
    });
  }
);

export const getAllDemoRequests = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, limit = 50, skip = 0 } = req.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const demoRequests = await DemoRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10))
      .skip(parseInt(skip as string, 10));

    const total = await DemoRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests: demoRequests,
        total,
        limit: parseInt(limit as string, 10),
        skip: parseInt(skip as string, 10),
      },
    });
  }
);

export const updateDemoRequestStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'contacted', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const demoRequest = await DemoRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!demoRequest) {
      return res.status(404).json({
        success: false,
        message: 'Demo request not found',
      });
    }

    res.json({
      success: true,
      message: 'Demo request status updated',
      data: demoRequest,
    });
  }
);

