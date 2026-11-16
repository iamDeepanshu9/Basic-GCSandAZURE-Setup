import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  gcsBucketName: string;
  gcpProjectId?: string;
  googleApplicationCredentials?: string;
  signedUrlExpirationMinutes: number;
  maxFileSizeBytes: number;
  azureStorageConnectionString: string;
  azureContainerName: string;
}

export function loadConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const gcsBucketName = process.env.GCS_BUCKET_NAME || '';
  const gcpProjectId = process.env.GCP_PROJECT_ID;
  const googleApplicationCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const signedUrlExpirationMinutes = parseInt(process.env.SIGNED_URL_EXPIRATION_MINUTES || '15', 10);
  const maxFileSizeBytes = parseInt(process.env.MAX_FILE_SIZE_BYTES || '52428800', 10); // default 50 MB
  const azureStorageConnectionString =
    process.env.AZURE_STORAGE_CONNECTION_STRING || 'UseDevelopmentStorage=true';
  const azureContainerName = process.env.AZURE_CONTAINER_NAME || 'scanned-documents';

  return {
    port,
    host,
    gcsBucketName,
    gcpProjectId,
    googleApplicationCredentials,
    signedUrlExpirationMinutes,
    maxFileSizeBytes,
    azureStorageConnectionString,
    azureContainerName,
  };
}

export const config = loadConfig();
