import mongoose, { Schema, Document } from 'mongoose';

export interface IDemoRequest extends Document {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  country: string;
  jobTitle: string;
  companySize: string;
  competencies: string[];
  whatsapp: boolean;
  privacyAgreed: boolean;
  marketingConsent: boolean;
  status: 'pending' | 'contacted' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const DemoRequestSchema = new Schema<IDemoRequest>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
    },
    companySize: {
      type: String,
      required: true,
      trim: true,
    },
    competencies: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one competency must be selected',
      },
    },
    whatsapp: {
      type: Boolean,
      default: false,
    },
    privacyAgreed: {
      type: Boolean,
      required: true,
      validate: {
        validator: (v: boolean) => v === true,
        message: 'Privacy policy agreement is required',
      },
    },
    marketingConsent: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
DemoRequestSchema.index({ email: 1, createdAt: -1 });
DemoRequestSchema.index({ status: 1 });
DemoRequestSchema.index({ createdAt: -1 });

export const DemoRequest = mongoose.model<IDemoRequest>(
  'DemoRequest',
  DemoRequestSchema
);

