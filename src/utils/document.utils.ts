import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';

/**
 * Extracts the file extension from a filename.
 */
export function extractFileExtension(filename?: string): string {
  if (!filename) return '';
  return path.extname(filename);
}

/**
 * Generates a unique UUID-based document identifier preserving the original file extension.
 * Example: "e6c49820-2f3c-48f4-81af-04158f7a5876.pdf"
 */
export function generateDocumentId(originalFileName?: string): string {
  const ext = extractFileExtension(originalFileName);
  return `${uuidv4()}${ext}`;
}
