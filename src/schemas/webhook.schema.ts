import type { FastifySchema } from 'fastify';

export const scanStatusSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['documentId'],
    properties: {
      documentId: { type: 'string', minLength: 1 },
    },
  },
};
