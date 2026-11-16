import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { healthRoutes } from './routes/health.routes.js';
import { storageRoutes } from './routes/storage.routes.js';
import { config } from './config/env.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  // Register multipart plugin for streaming file uploads
  app.register(multipart, {
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: 1, // 1 file per upload request
    },
  });

  // Register routes
  app.register(healthRoutes);
  app.register(storageRoutes);

  return app;
}
