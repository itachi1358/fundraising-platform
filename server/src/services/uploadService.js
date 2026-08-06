import { Readable } from 'stream';
import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';
import { ensureUploadSize } from '../middleware/upload.js';

function uploadBuffer(file, options) {
  return new Promise((resolve, reject) => {
    const upload = getCloudinary().uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      return resolve({
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        originalName: file.originalname,
        mimeType: file.mimetype
      });
    });
    Readable.from(file.buffer).pipe(upload);
  });
}

export async function uploadCampaignAssets(files = {}) {
  const bannerFile = files.bannerImage?.[0];
  const documentFiles = files.documents || [];
  if (!bannerFile && documentFiles.length === 0) return { bannerImage: null, documents: [] };
  if (!isCloudinaryConfigured()) {
    const error = new Error('File uploads are unavailable until Cloudinary credentials are configured');
    error.statusCode = 503;
    throw error;
  }

  for (const file of [bannerFile, ...documentFiles].filter(Boolean)) ensureUploadSize(file);

  const [bannerImage, documents] = await Promise.all([
    bannerFile
      ? uploadBuffer(bannerFile, { folder: 'careconnect/campaigns/banners', resource_type: 'image' })
      : null,
    Promise.all(
      documentFiles.map((file) =>
        uploadBuffer(file, {
          folder: 'careconnect/campaigns/documents',
          resource_type: file.mimetype === 'application/pdf' ? 'raw' : 'image'
        })
      )
    )
  ]);

  return { bannerImage, documents };
}
