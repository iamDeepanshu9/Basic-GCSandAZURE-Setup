import type { FastifySchema } from 'fastify';

export interface DownloadBody {
  documentId: string;
  expiresInMinutes?: number;
}

export interface UploadFromGCSBody {
  documentId: string;
  targetBlobName?: string;
}

export const downloadDocumentSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['documentId'],
    properties: {
      documentId: { type: 'string', minLength: 1 },
      expiresInMinutes: { type: 'number', minimum: 1, maximum: 10080 }, // up to 7 days
    },
  },
};

export const uploadFromGCSSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['documentId'],
    properties: {
      documentId: { type: 'string', minLength: 1 },
      targetBlobName: { type: 'string' },
    },
  },
};
