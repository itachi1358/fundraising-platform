import multer from 'multer';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024;
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const storage = multer.memoryStorage();

function campaignFileFilter(req, file, callback) {
  const isImage = file.fieldname === 'bannerImage' || file.fieldname === 'photos';
  const allowedTypes = isImage ? imageMimeTypes : documentMimeTypes;
  if (!allowedTypes.has(file.mimetype)) {
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  return callback(null, true);
}

export const uploadCampaignFiles = multer({
  storage,
  limits: { fileSize: MAX_DOCUMENT_SIZE, files: 12 },
  fileFilter: campaignFileFilter
}).fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'documents', maxCount: 5 },
  { name: 'photos', maxCount: 6 }
]);

export function ensureUploadSize(file) {
  if (['bannerImage', 'photos'].includes(file.fieldname) && file.size > MAX_IMAGE_SIZE) {
    const error = new Error('Campaign images must be 5 MB or smaller');
    error.statusCode = 400;
    throw error;
  }
}
