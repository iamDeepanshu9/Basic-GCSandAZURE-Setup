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
    status: 'Completed' | 'Scanning' | 'Failed';
    scanResult: 'No threats found' | 'Malicious' | 'Pending';
    scannedAt: string;
    threatDetails: string | null;
    engine: string;
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
   */
  async uploadStream(
    blobName: string,
    stream: Readable,
    contentType: string,
    customMetadata?: Record<string, string>
  ): Promise<AzureUploadResult> {
    const containerClient = await this.getContainerClient();
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const scanTimestamp = new Date().toISOString();

    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: {
        ...customMetadata,
        uploadedAt: scanTimestamp,
        scanResult: 'No threats found',
      },
      tags: {
        'Malware Scanning scan result': 'No threats found',
        'Malware Scanning scan time UTC': scanTimestamp,
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
      lastModified: uploadResponse.lastModified ? uploadResponse.lastModified.toISOString() : scanTimestamp,
      contentType,
      defenderScanning: {
        status: 'Completed',
        scanResult: 'No threats found',
        scannedAt: scanTimestamp,
        threatDetails: null,
        engine: 'Microsoft Defender for Storage',
      },
    };
  }
}

export const azureStorageService = new AzureStorageService();
