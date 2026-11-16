import { Storage, type Bucket, type GetSignedUrlConfig } from '@google-cloud/storage';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { config } from '../config/env.js';

export interface UploadResult {
  documentId: string;
  originalFileName: string;
  contentType: string;
  bucket: string;
  size?: number;
}

export interface SignedUrlResult {
  documentId: string;
  downloadUrl: string;
  expiresAt: string;
  contentType?: string;
  size?: number;
}

export class StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || config.gcsBucketName;

    const storageOptions: { projectId?: string; keyFilename?: string } = {};
    if (config.gcpProjectId) {
      storageOptions.projectId = config.gcpProjectId;
    }
    if (config.googleApplicationCredentials) {
      storageOptions.keyFilename = config.googleApplicationCredentials;
    }

    this.storage = new Storage(storageOptions);
  }

  private getBucket(): Bucket {
    if (!this.bucketName) {
      throw new Error(
        'GCS_BUCKET_NAME is not configured. Please set GCS_BUCKET_NAME in your environment.'
      );
    }
    return this.storage.bucket(this.bucketName);
  }

  /**
   * Streams a file directly to Google Cloud Storage.
   */
  async uploadStream(
    documentId: string,
    mimeType: string,
    inputStream: Readable,
    originalFileName: string
  ): Promise<UploadResult> {
    const bucket = this.getBucket();
    const file = bucket.file(documentId);

    const writeStream = file.createWriteStream({
      resumable: false,
      contentType: mimeType,
      metadata: {
        contentType: mimeType,
        metadata: {
          originalFileName,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    await pipeline(inputStream, writeStream);

    return {
      documentId,
      originalFileName,
      contentType: mimeType,
      bucket: this.bucketName,
    };
  }

  /**
   * Returns a readable stream and metadata for a document from GCS.
   */
  async getReadStream(documentId: string): Promise<{ stream: Readable; metadata: any }> {
    const bucket = this.getBucket();
    const file = bucket.file(documentId);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`Document with ID "${documentId}" was not found in bucket "${this.bucketName}".`);
    }

    const [metadata] = await file.getMetadata();
    const stream = file.createReadStream();
    return { stream, metadata };
  }

  /**
   * Checks if a document exists in the GCS bucket.
   */
  async documentExists(documentId: string): Promise<boolean> {
    const bucket = this.getBucket();
    const file = bucket.file(documentId);
    const [exists] = await file.exists();
    return exists;
  }

  /**
   * Fetches metadata for a document in GCS.
   */
  async getDocumentMetadata(documentId: string) {
    const bucket = this.getBucket();
    const file = bucket.file(documentId);
    const [metadata] = await file.getMetadata();
    return metadata;
  }

  /**
   * Generates a time-limited V4 signed URL for downloading a file from GCS.
   */
  async generateSignedDownloadUrl(
    documentId: string,
    expiresInMinutes?: number
  ): Promise<SignedUrlResult> {
    const bucket = this.getBucket();
    const file = bucket.file(documentId);

    // Verify document existence first
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`Document with ID "${documentId}" was not found in bucket "${this.bucketName}".`);
    }

    const [metadata] = await file.getMetadata();
    const durationMinutes = expiresInMinutes || config.signedUrlExpirationMinutes;
    const expires = Date.now() + durationMinutes * 60 * 1000;

    const originalFileName =
      (metadata.metadata?.originalFileName as string | undefined) || documentId;

    const signingOptions: GetSignedUrlConfig = {
      version: 'v4',
      action: 'read',
      expires,
      responseDisposition: `attachment; filename="${encodeURIComponent(originalFileName)}"`,
    };

    const [downloadUrl] = await file.getSignedUrl(signingOptions);

    return {
      documentId,
      downloadUrl,
      expiresAt: new Date(expires).toISOString(),
      contentType: metadata.contentType,
      size: metadata.size ? Number(metadata.size) : undefined,
    };
  }
}

export const storageService = new StorageService();
