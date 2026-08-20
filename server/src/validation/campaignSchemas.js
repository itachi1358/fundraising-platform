import { z } from 'zod';

const emptyToUndefined = (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalText = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().trim().url().max(2048).optional());
const futureDate = z.coerce.date().refine((date) => date.getTime() > Date.now(), {
  message: 'Deadline must be in the future'
});
const amount = z.coerce.number().finite().positive().max(100000000);
const documentUrl = z.string().trim().url().max(2048);

const campaignDataShape = {
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(5000),
  category: z.string().trim().min(2).max(60),
  goalAmount: amount,
  deadline: futureDate,
  bannerImage: optionalUrl,
  documents: z.array(documentUrl).max(10).default([]),
  photos: z.array(documentUrl).max(10).default([]),
  upiId: optionalText(160),
  bankDetails: optionalText(1000),
  contactNumber: z.string().trim().regex(/^[+()\d\s-]{7,25}$/, 'Enter a valid contact number'),
  reason: z.string().trim().min(10).max(3000)
};

export const campaignRequestSchema = z.object(campaignDataShape).strict();

export const campaignDataPatchSchema = z
  .object({
    title: campaignDataShape.title.optional(),
    description: campaignDataShape.description.optional(),
    category: campaignDataShape.category.optional(),
    goalAmount: campaignDataShape.goalAmount.optional(),
    deadline: campaignDataShape.deadline.optional(),
    bannerImage: optionalUrl,
    documents: z.array(documentUrl).max(10).optional(),
    photos: z.array(documentUrl).max(10).optional(),
    publicDocuments: z.array(documentUrl).max(10).optional(),
    upiId: optionalText(160),
    bankDetails: optionalText(1000),
    contactNumber: campaignDataShape.contactNumber.optional(),
    reason: campaignDataShape.reason.optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

export const adminApprovalSchema = z
  .object({
    adminRemarks: optionalText(1000),
    campaignData: campaignDataPatchSchema.optional(),
    publicDocuments: z.array(documentUrl).max(10).optional()
  })
  .strict();

export const adminRemarksSchema = z.object({ adminRemarks: optionalText(1000) }).strict();
export const adminCampaignPatchSchema = campaignDataPatchSchema;

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(12);
const search = optionalText(100);
const category = optionalText(60);

export const campaignListQuerySchema = z
  .object({
    page,
    limit,
    search,
    category,
    sort: z.enum(['newest', 'endingSoon', 'mostFunded']).default('newest')
  })
  .strict();

export const adminRequestListQuerySchema = z
  .object({
    page,
    limit,
    search,
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    sort: z.enum(['newest', 'oldest']).default('newest')
  })
  .strict();

export const adminCampaignListQuerySchema = z
  .object({
    page,
    limit,
    search,
    category,
    status: z.enum(['active', 'closed', 'rejected', 'stopped']).optional(),
    sort: z.enum(['newest', 'endingSoon', 'mostFunded']).default('newest')
  })
  .strict();
