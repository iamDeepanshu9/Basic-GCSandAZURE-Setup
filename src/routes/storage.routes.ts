import type { FastifyPluginAsync } from 'fastify';
import {
  uploadDocument,
  downloadDocument,
  uploadFromGCS,
} from '../controllers/storage.controller.js';
import {
  downloadDocumentSchema,
  uploadFromGCSSchema,
  type DownloadBody,
  type UploadFromGCSBody,
} from '../schemas/storage.schema.js';

export const storageRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Route 1: Upload a document to Google Cloud Storage
   * Method: POST /api/upload
   * Content-Type: multipart/form-data
   */
  fastify.post('/api/upload', uploadDocument);

  /**
   * Route 2: Generate a signed URL to download a document from Google Cloud Storage
   * Method: POST /api/download
   * Content-Type: application/json
   */
  fastify.post<{ Body: DownloadBody }>(
    '/api/download',
    { schema: downloadDocumentSchema },
    downloadDocument
  );

  /**
   * Route 3: Transfer document from Google Cloud Storage to Azure Blob Storage
   * Method: POST /api/uploadFromGCS
   * Content-Type: application/json
   */
  fastify.post<{ Body: UploadFromGCSBody }>(
    '/api/uploadFromGCS',
    { schema: uploadFromGCSSchema },
    uploadFromGCS
  );
};
