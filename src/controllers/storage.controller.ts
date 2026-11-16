import type { FastifyRequest, FastifyReply } from 'fastify';
import { storageService } from '../services/storage.service.js';
import { azureStorageService } from '../services/azure.service.js';
import { generateDocumentId } from '../utils/document.utils.js';
import type { DownloadBody, UploadFromGCSBody } from '../schemas/storage.schema.js';

/**
 * Controller: Handles file upload to Google Cloud Storage
 * POST /api/upload
 */
export async function uploadDocument(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!request.isMultipart()) {
      return reply.status(400).send({
        success: false,
        error: 'Bad Request',
        message: 'Expected multipart/form-data request.',
      });
    }

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        success: false,
        error: 'Bad Request',
        message: 'No file uploaded. Please provide a file in the multipart field "file".',
      });
    }

    const originalName = data.filename || 'unknown_file';
    const documentId = generateDocumentId(originalName);

    const uploadResult = await storageService.uploadStream(
      documentId,
      data.mimetype || 'application/octet-stream',
      data.file,
      originalName
    );

    return reply.status(201).send({
      success: true,
      message: 'File successfully uploaded to Google Cloud Storage',
      data: uploadResult,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) {
      request.log.error(err);
    }
    return reply.status(statusCode).send({
      success: false,
      error: statusCode === 400 || statusCode === 406 ? 'Bad Request' : 'Upload Failed',
      message: err.message || 'An error occurred during file upload.',
    });
  }
}

/**
 * Controller: Handles generating a signed URL for GCS document download
 * POST /api/download
 */
export async function downloadDocument(
  request: FastifyRequest<{ Body: DownloadBody }>,
  reply: FastifyReply
) {
  const { documentId, expiresInMinutes } = request.body;

  try {
    const result = await storageService.generateSignedDownloadUrl(documentId, expiresInMinutes);

    return reply.status(200).send({
      success: true,
      message: 'Signed download URL generated successfully',
      data: result,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('was not found')) {
      return reply.status(404).send({
        success: false,
        error: 'Document Not Found',
        message: err.message,
      });
    }

    request.log.error(err);
    return reply.status(500).send({
      success: false,
      error: 'Signed URL Generation Failed',
      message: err.message || 'An error occurred while generating the signed URL.',
    });
  }
}

/**
 * Controller: Handles streaming a document from GCS into Azure Blob Storage
 * POST /api/uploadFromGCS & POST /uploadFromGCS
 */
export async function uploadFromGCS(
  request: FastifyRequest<{ Body: UploadFromGCSBody }>,
  reply: FastifyReply
) {
  const { documentId, targetBlobName } = request.body;

  try {
    // 1. Fetch read stream and metadata from GCS
    const { stream, metadata } = await storageService.getReadStream(documentId);

    const contentType = metadata.contentType || 'application/octet-stream';
    const originalFileName =
      (metadata.metadata?.originalFileName as string | undefined) || documentId;
    const blobName = targetBlobName || documentId;

    // 2. Stream directly into Azure Blob Storage
    const azureResult = await azureStorageService.uploadStream(
      blobName,
      stream,
      contentType,
      {
        originalFileName,
        sourceGcsBucket: metadata.bucket || '',
        sourceDocumentId: documentId,
      }
    );

    return reply.status(200).send({
      success: true,
      message: 'File successfully transferred from GCS to Azure Blob Storage and scanned by Defender',
      data: {
        documentId,
        source: {
          provider: 'Google Cloud Storage',
          bucket: metadata.bucket,
          originalFileName,
          contentType,
          size: metadata.size ? Number(metadata.size) : undefined,
        },
        destination: {
          provider: 'Azure Blob Storage',
          container: azureResult.container,
          blobName: azureResult.blobName,
          blobUrl: azureResult.blobUrl,
          etag: azureResult.etag,
          lastModified: azureResult.lastModified,
          defenderScanning: azureResult.defenderScanning,
        },
      },
    });
  } catch (err: any) {
    if (err.message && err.message.includes('was not found')) {
      return reply.status(404).send({
        success: false,
        error: 'Document Not Found in GCS',
        message: err.message,
      });
    }

    request.log.error(err);
    return reply.status(500).send({
      success: false,
      error: 'Azure Transfer Failed',
      message: err.message || 'An error occurred while transferring file to Azure Blob Storage.',
    });
  }
}
