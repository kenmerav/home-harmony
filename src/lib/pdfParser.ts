import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
// Vite will bundle the worker and give us a URL string.
// eslint-disable-next-line import/no-unresolved
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/**
 * Extract text from a PDF in the browser.
 * We do this client-side because the AI gateway does not reliably accept arbitrary file payloads.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pageCount: number }> {
  GlobalWorkerOptions.workerSrc = workerSrc;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    // pdf.js types are a bit loose here across builds; keep it safe.
    const items = (textContent.items ?? []) as Array<{ str?: string }>;
    const pageText = items
      .map((i) => (typeof i.str === 'string' ? i.str : ''))
      .filter(Boolean)
      .join('\n');

    pages.push(`----- PAGE ${pageNum} / ${pageCount} -----\n${pageText}`);
  }

  return { text: pages.join('\n\n'), pageCount };
}

/**
 * Convert a PDF file to base64.
 * (Kept as a utility, but text extraction is preferred for recipe parsing.)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
