import { v2 as cloudinary } from 'cloudinary';

const credentials = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  apiKey: process.env.CLOUDINARY_API_KEY?.trim(),
  apiSecret: process.env.CLOUDINARY_API_SECRET?.trim()
});

export function isCloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = credentials();
  return Boolean(cloudName && apiKey && apiSecret);
}

export function getCloudinary() {
  const { cloudName, apiKey, apiSecret } = credentials();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return cloudinary;
}
