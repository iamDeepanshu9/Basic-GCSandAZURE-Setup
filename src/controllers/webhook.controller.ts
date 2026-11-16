import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Azure Event Grid Subscription Validation Event
 * Sent when you first register a webhook endpoint with Event Grid.
 */
interface EventGridValidationEvent {
  id: string;
  topic: string;
  subject: string;
  eventType: 'Microsoft.EventGrid.SubscriptionValidationEvent';
  eventTime: string;
  data: {
    validationCode: string;
    validationUrl?: string;
  };
  metadataVersion: string;
  dataVersion: string;
}

/**
 * Azure Defender for Storage Malware Scanning Result Event
 * Sent by Event Grid after Defender finishes scanning a blob.
 */
interface MalwareScanningResultEvent {
  id: string;
  topic: string;
  subject: string;
  eventType: 'Microsoft.Security.MalwareScanningResult';
  eventTime: string;
  data: {
    correlationId: string;
    blobUri: string;
    eTag: string;
    scanFinishedTimeUtc: string;
    scanResultType: 'No threats found' | 'Malicious' | 'Error';
    scanResultDetails?: {
      malwareNamesFound?: string[];
      sha256?: string;
    };
  };
  metadataVersion: string;
  dataVersion: string;
}

type EventGridEvent = EventGridValidationEvent | MalwareScanningResultEvent;

/**
 * In-memory store for scan results (keyed by blob name).
 * Replace with a database or Redis in production.
 */
const scanResults = new Map<
  string,
  {
    blobUri: string;
    scanResult: string;
    scanFinishedAt: string;
    malwareNames: string[];
    sha256?: string;
    correlationId: string;
    receivedAt: string;
  }
>();

/**
 * Extracts the blob name (documentId) from an Azure Blob URI.
 * e.g. "https://account.blob.core.windows.net/container/doc-id.txt" → "doc-id.txt"
 * Also handles Azurite URLs: "http://127.0.0.1:10000/devstoreaccount1/container/doc-id.txt"
 */
function extractBlobNameFromUri(blobUri: string): string {
  try {
    const url = new URL(blobUri);
    // Path is like "/container/blob-name" or "/devstoreaccount1/container/blob-name"
    const parts = url.pathname.split('/').filter(Boolean);
    // For Azurite: [devstoreaccount1, container, ...blobName]
    // For Azure:  [container, ...blobName]
    // The blob name is everything after the container
    if (parts.length >= 3 && parts[0] === 'devstoreaccount1') {
      // Azurite URL format
      return parts.slice(2).join('/');
    }
    // Standard Azure URL format
    return parts.slice(1).join('/');
  } catch {
    // Fallback: return the last segment
    return blobUri.split('/').pop() || blobUri;
  }
}

/**
 * Controller: Handles Azure Event Grid webhook events
 * POST /api/webhook/scan-result
 *
 * This endpoint handles two types of events:
 * 1. SubscriptionValidationEvent - Azure Event Grid handshake (one-time during setup)
 * 2. MalwareScanningResult - Defender for Storage scan results (ongoing)
 */
export async function handleScanResultWebhook(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const events = request.body as EventGridEvent[];

  if (!Array.isArray(events) || events.length === 0) {
    return reply.status(400).send({
      success: false,
      error: 'Bad Request',
      message: 'Expected an array of Event Grid events.',
    });
  }

  for (const event of events) {
    // -------------------------------------------------------------------
    // Phase 1: Event Grid Subscription Validation Handshake
    // When you create an Event Grid subscription pointing to this webhook,
    // Azure sends a validation event. We must echo back the validationCode.
    // -------------------------------------------------------------------
    if (event.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
      const validationEvent = event as EventGridValidationEvent;
      request.log.info(
        { validationCode: validationEvent.data.validationCode },
        'Event Grid subscription validation handshake received'
      );

      return reply.status(200).send({
        validationResponse: validationEvent.data.validationCode,
      });
    }

    // -------------------------------------------------------------------
    // Phase 2: Malware Scanning Result from Microsoft Defender for Storage
    // This fires after Defender finishes scanning an uploaded blob.
    // -------------------------------------------------------------------
    if (event.eventType === 'Microsoft.Security.MalwareScanningResult') {
      const scanEvent = event as MalwareScanningResultEvent;
      const { blobUri, scanResultType, scanFinishedTimeUtc, correlationId, scanResultDetails } =
        scanEvent.data;

      const blobName = extractBlobNameFromUri(blobUri);
      const isMalicious = scanResultType === 'Malicious';

      // Store the result
      scanResults.set(blobName, {
        blobUri,
        scanResult: scanResultType,
        scanFinishedAt: scanFinishedTimeUtc,
        malwareNames: scanResultDetails?.malwareNamesFound || [],
        sha256: scanResultDetails?.sha256,
        correlationId,
        receivedAt: new Date().toISOString(),
      });

      if (isMalicious) {
        request.log.warn(
          {
            blobName,
            blobUri,
            malwareNames: scanResultDetails?.malwareNamesFound,
            correlationId,
          },
          '⚠️  MALWARE DETECTED by Microsoft Defender for Storage'
        );

        // TODO: Take action on malicious files:
        // - Soft-delete or quarantine the blob
        // - Notify upstream system (e.g., mark document as infected in your DB)
        // - Send alert via email/Slack/webhook
      } else {
        request.log.info(
          { blobName, blobUri, scanResult: scanResultType, correlationId },
          '✅ Defender scan complete — no threats found'
        );
      }
    }
  }

  // Event Grid expects 200 OK to acknowledge receipt
  return reply.status(200).send({ success: true, message: 'Event(s) processed' });
}

/**
 * Controller: Look up scan result for a specific document
 * POST /api/scan-status
 */
export async function getScanStatus(
  request: FastifyRequest<{ Body: { documentId: string } }>,
  reply: FastifyReply
) {
  const { documentId } = request.body;
  const result = scanResults.get(documentId);

  if (!result) {
    return reply.status(200).send({
      success: true,
      data: {
        documentId,
        scanStatus: 'Pending',
        message:
          'Scan result not yet received. Defender scanning is asynchronous — results typically arrive within seconds of upload.',
      },
    });
  }

  return reply.status(200).send({
    success: true,
    data: {
      documentId,
      scanStatus: result.scanResult === 'Malicious' ? 'Failed' : 'Passed',
      scanResult: result.scanResult,
      scanFinishedAt: result.scanFinishedAt,
      malwareNames: result.malwareNames,
      sha256: result.sha256,
      blobUri: result.blobUri,
      correlationId: result.correlationId,
      receivedAt: result.receivedAt,
    },
  });
}
