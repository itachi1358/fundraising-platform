import multer from 'multer';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024;
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const storage = multer.memoryStorage();

function campaignFileFilter(req, file, callback) {
  const isBanner = file.fieldname === 'bannerImage';
  const allowedTypes = isBanner ? imageMimeTypes : documentMimeTypes;
  if (!allowedTypes.has(file.mimetype)) {
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  return callback(null, true);
}

export const uploadCampaignFiles = multer({
  storage,
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 6 },
  fileFilter: campaignFileFilter
}).fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'documents', maxCount: 5 }
]);

export function ensureUploadSize(file) {
  if (file.fieldname === 'bannerImage' && file.size > MAX_IMAGE_SIZE) {
    const error = new Error('Banner image must be 5 MB or smaller');
    error.statusCode = 400;
    throw error;
  }
}
