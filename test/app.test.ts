import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

describe('Fastify GCS Service API Endpoints', () => {
  const app = buildApp();

  test('GET /health should return 200 OK', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
    assert.ok(typeof body.uptimeSeconds === 'number');
  });

  test('POST /api/upload without file should return 400 Bad Request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/upload',
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.equal(body.error, 'Bad Request');
  });

  test('POST /api/download without documentId should return 400 Bad Request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/download',
      headers: {
        'content-type': 'application/json',
      },
      payload: {},
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.ok(body.message.includes('documentId'));
  });

  test('POST /api/download with documentId that does not exist should return 404 or 500 when bucket is unconfigured', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/download',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        documentId: 'non-existent-doc-12345.pdf',
      },
    });

    // In a test environment without GCS bucket configured, it safely rejects
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.ok([404, 500].includes(response.statusCode));
  });

  test('POST /api/uploadFromGCS without documentId should return 400 Bad Request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/uploadFromGCS',
      headers: {
        'content-type': 'application/json',
      },
      payload: {},
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.ok(body.message.includes('documentId'));
  });
});
