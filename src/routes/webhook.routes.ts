import type { FastifyPluginAsync } from 'fastify';
import {
  handleScanResultWebhook,
  getScanStatus,
} from '../controllers/webhook.controller.js';
import { scanStatusSchema } from '../schemas/webhook.schema.js';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Azure Event Grid Webhook Endpoint
   *
   * Receives:
   * 1. SubscriptionValidationEvent (handshake during Event Grid setup)
   * 2. Microsoft.Security.MalwareScanningResult (Defender scan results)
   *
   * Setup in Azure Portal:
   *   Storage Account → Events → + Event Subscription
   *   - Filter to: Microsoft.Security.MalwareScanningResult
   *   - Endpoint Type: Webhook
   *   - Endpoint: https://<your-domain>/api/webhook/scan-result
   */
  fastify.post('/api/webhook/scan-result', handleScanResultWebhook);

  /**
   * Query the scan status for a specific document
   * POST /api/scan-status
   *
   * Returns the latest Defender scan result if received,
   * or "Pending" if the scan hasn't completed yet.
   */
  fastify.post<{ Body: { documentId: string } }>(
    '/api/scan-status',
    { schema: scanStatusSchema },
    getScanStatus
  );
};
