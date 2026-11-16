import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import type { Readable } from 'node:stream';
import { config } from '../config/env.js';

export interface AzureUploadResult {
  container: string;
  blobName: string;
  blobUrl: string;
  etag?: string;
  lastModified?: string;
  contentType: string;
  size?: number;
  defenderScanning: {
    status: 'Pending' | 'Completed';
    message: string;
    webhookEndpoint: string;
  };
}

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;

  constructor() {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      config.azureStorageConnectionString
    );
    this.containerName = config.azureContainerName;
  }

  private async getContainerClient(): Promise<ContainerClient> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    // Auto-create container if it does not exist yet (public access disabled by default)
    await containerClient.createIfNotExists();
    return containerClient;
  }

  /**
   * Streams a file from a Readable stream directly into an Azure Blob.
   *
   * After upload, Microsoft Defender for Storage scans the blob asynchronously.
   * Scan results are delivered via Event Grid webhook to POST /api/webhook/scan-result.
   * Query the result later with POST /api/scan-status { documentId }.
   */
  async uploadStream(
    blobName: string,
    stream: Readable,
    contentType: string,
    customMetadata?: Record<string, string>
  ): Promise<AzureUploadResult> {
    const containerClient = await this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const uploadedAt = new Date().toISOString();

    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: {
        ...customMetadata,
        uploadedAt,
      },
    };

    const uploadResponse = await blockBlobClient.uploadStream(
      stream,
      4 * 1024 * 1024, // 4MB buffer size
      4, // 4 concurrency
      uploadOptions
    );

    return {
      container: this.containerName,
      blobName,
      blobUrl: blockBlobClient.url,
      etag: uploadResponse.etag,
      lastModified: uploadResponse.lastModified
        ? uploadResponse.lastModified.toISOString()
        : uploadedAt,
      contentType,
      defenderScanning: {
        status: 'Pending',
        message:
          'Defender for Storage will scan this blob asynchronously. Results are delivered via Event Grid to POST /api/webhook/scan-result. Query scan status with POST /api/scan-status.',
        webhookEndpoint: '/api/webhook/scan-result',
      },
    };
  }
}

export const azureStorageService = new AzureStorageService();
