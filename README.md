# Fastify Multi-Cloud Storage Service (GCS & Azure Blob)

A production-ready Fastify microservice written in TypeScript for:
1. Streaming file uploads directly to **Google Cloud Storage (GCS)**.
2. Generating secure, time-limited V4 signed URLs for downloading GCS documents via `documentId`.
3. Transferring documents from **GCS to Azure Blob Storage** (`POST /uploadFromGCS`) with **Microsoft Defender for Storage** malware scanning metadata simulation.
4. 100% free local testing for Azure using **Azurite** emulator.

---

## Features

- **GCS Multipart Upload (`POST /api/upload`)**: Streams incoming files directly to Google Cloud Storage without disk buffering.
- **Signed URL Download (`POST /api/download`)**: Time-limited GCS V4 signed download URLs generated via `documentId`.
- **GCS to Azure Transfer (`POST /uploadFromGCS`)**: Streams a file directly from GCS to Azure Blob Storage container (`scanned-documents`), attaching Microsoft Defender for Storage scan tags and metadata.
- **Zero-Cost Azure Testing**: Uses Azurite local emulator with zero cloud costs or credit card required.
- **Health Check Endpoint (`GET /health`)**: For uptime monitoring.

---

## Prerequisites

- **Node.js**: v20 or v22+
- **Google Cloud Platform**:
  - GCS Bucket name.
  - Service Account credentials.
- **Azure**:
  - Local testing: Azurite (installed as dev dependency, runs with `npm run azurite`).
  - Production Azure: Azure Storage connection string.

---

## Setup & Configuration

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` (or configure your `.env`):
   ```bash
   cp .env.example .env
   ```

   Variables in `.env`:
   ```env
   PORT=3000
   HOST=0.0.0.0
   GCS_BUCKET_NAME=your-gcs-bucket-name
   GCP_PROJECT_ID=your-gcp-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   SIGNED_URL_EXPIRATION_MINUTES=15

   # Azure Blob Storage Configuration (Azurite emulator default)
   AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
   AZURE_CONTAINER_NAME=scanned-documents
   ```

---

## Running the Application

### 1. Start Azurite (Azure Emulator)
Run Azurite in a separate terminal:
```bash
npm run azurite
```
*Azurite Blob service will listen on `http://127.0.0.1:10000`.*

### 2. Start Fastify Dev Server
```bash
npm run dev
```

### 3. Run Tests
```bash
npm test
```

---

## API Endpoints

### 1. Upload to GCS (`POST /api/upload`)
- **Method**: `POST`
- **Path**: `/api/upload`
- **Content-Type**: `multipart/form-data`
- **Field Name**: `file`

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test-file.txt"
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "File successfully uploaded to Google Cloud Storage",
  "data": {
    "documentId": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt",
    "originalFileName": "test-file.txt",
    "contentType": "text/plain",
    "bucket": "test-bucket-dk-001426"
  }
}
```

---

### 2. Generate GCS Signed Download URL (`POST /api/download`)
- **Method**: `POST`
- **Path**: `/api/download`
- **Content-Type**: `application/json`

```bash
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{
    "documentId": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt",
    "expiresInMinutes": 15
  }'
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Signed download URL generated successfully",
  "data": {
    "documentId": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt",
    "downloadUrl": "https://storage.googleapis.com/test-bucket-dk-001426/53948ca4...?X-Goog-Algorithm=...",
    "expiresAt": "2026-11-16T10:22:50.357Z",
    "contentType": "text/plain",
    "size": 41
  }
}
```

---

### 3. Transfer from GCS to Azure Blob (`POST /api/uploadFromGCS`)
Streams a document from Google Cloud Storage directly into Azure Blob Storage and performs Microsoft Defender malware scanning metadata tagging.

- **Method**: `POST`
- **Path**: `/api/uploadFromGCS`
- **Content-Type**: `application/json`

#### Request Body:
```json
{
  "documentId": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt"
}
```

#### cURL Example:
```bash
curl -X POST http://localhost:3000/api/uploadFromGCS \
  -H "Content-Type: application/json" \
  -d '{"documentId": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt"}'
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "message": "File successfully transferred from GCS to Azure Blob Storage and scanned by Defender",
  "data": {
    "documentId": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt",
    "source": {
      "provider": "Google Cloud Storage",
      "bucket": "test-bucket-dk-001426",
      "originalFileName": "test-file.txt",
      "contentType": "text/plain",
      "size": 41
    },
    "destination": {
      "provider": "Azure Blob Storage",
      "container": "scanned-documents",
      "blobName": "53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt",
      "blobUrl": "http://127.0.0.1:10000/devstoreaccount1/scanned-documents/53948ca4-8ee0-4ce0-b5c3-646acbcfdb4e.txt",
      "etag": "\"0x2768686A562C080\"",
      "lastModified": "2026-11-16T19:05:19.000Z",
      "defenderScanning": {
        "status": "Completed",
        "scanResult": "No threats found",
        "scannedAt": "2026-11-16T19:05:19.492Z",
        "threatDetails": null,
        "engine": "Microsoft Defender for Storage"
      }
    }
  }
}
```
