// src/lib/watermark.ts
// Stamps a PDF on the server before it leaves: a large diagonal watermark on every page plus a small
// footer line. Originals in storage are never modified — every served copy is stamped fresh.
// Deterrence + traceability, not DRM: a determined viewer can still photograph the screen.

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

export class WatermarkError extends Error {}

// Standard PDF fonts only cover WinAnsi (Latin-1-ish); replace anything else so stamping never fails
function winAnsiSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}

export interface StampOptions {
  text: string;     // e.g. "Confidential · Book collaboration"
  footer: string;   // e.g. "Shared privately via abundancearchitecture.world · Oct 1, 2026"
}

export async function stampPdf(original: Buffer, options: StampOptions): Promise<Buffer> {
  // Any failure (encrypted/restricted, corrupt, odd structure) means we refuse to serve the file
  // rather than fall back to the unstamped original.
  try {
    return await stamp(original, options);
  } catch (err) {
    throw new WatermarkError(`Cannot watermark this PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function stamp(original: Buffer, { text, footer }: StampOptions): Promise<Buffer> {
  const doc = await PDFDocument.load(original);
  if (doc.getPageCount() === 0) throw new Error('PDF has no pages');

  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const small = await doc.embedFont(StandardFonts.Helvetica);
  const mark = winAnsiSafe(text);
  const foot = winAnsiSafe(footer);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const angle = Math.atan2(height, width); // corner-to-corner diagonal
    const diagonal = Math.hypot(width, height);
    // Size the text to ~70% of the diagonal
    const size = Math.max(18, Math.min(72, (diagonal * 0.7) / Math.max(1, font.widthOfTextAtSize(mark, 1))));
    const textWidth = font.widthOfTextAtSize(mark, size);
    // Start point so the rotated text is centred on the page
    const x = width / 2 - (Math.cos(angle) * textWidth) / 2 + (Math.sin(angle) * size) / 3;
    const y = height / 2 - (Math.sin(angle) * textWidth) / 2 - (Math.cos(angle) * size) / 3;
    page.drawText(mark, {
      x, y, size, font,
      color: rgb(0.4, 0.4, 0.4),
      opacity: 0.3, // strong enough to survive a screenshot, light enough to read through
      rotate: degrees((angle * 180) / Math.PI),
    });
    page.drawText(foot, {
      x: 24, y: 14, size: 7, font: small,
      color: rgb(0.45, 0.45, 0.45),
      opacity: 0.7,
    });
  }

  doc.setProducer(''); // don't advertise tooling in metadata
  return Buffer.from(await doc.save());
}
