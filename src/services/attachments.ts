import { DocKit, PICK_ANY, PICK_IMAGE, PreparedAttachment } from '../native/DocKit';

export type Attachment = {
  id: string;
  kind: 'image' | 'pdf' | 'document' | 'text';
  name: string;
  mime: string;
  size: number;
  /** Image path, for anything the vision encoder should see. */
  imagePath?: string;
  /** Extra page images, for scanned PDFs. */
  pageImages?: string[];
  /** Extracted text, for anything the model should read rather than look at. */
  text?: string;
  previewPath?: string;
  pageCount?: number;
  /** Set when we couldn't fully process the file — shown as a warning chip. */
  problem?: string;
};

let counter = 0;
const nextId = () => `att_${++counter}_${Date.now()}`;

function toAttachment(p: PreparedAttachment): Attachment {
  return {
    id: nextId(),
    kind: p.kind,
    name: p.name,
    mime: p.mime,
    size: p.size,
    imagePath: p.path,
    pageImages: p.pageImages,
    text: p.text,
    previewPath: p.previewPath ?? p.path,
    pageCount: p.pageCount,
    problem:
      p.kind === 'pdf' && p.hasTextLayer === false
        ? 'No text layer — this looks scanned, so it needs a vision model to read.'
        : p.kind !== 'image' && !p.text?.trim()
        ? 'Nothing readable could be extracted from this file.'
        : undefined,
  };
}

/** Opens the system picker for anything the app knows how to read. */
export async function pickAttachments(imagesOnly = false): Promise<Attachment[]> {
  const picked = await DocKit.pickFiles(imagesOnly ? PICK_IMAGE : PICK_ANY, true);
  const out: Attachment[] = [];
  for (const file of picked) {
    try {
      const prepared = await DocKit.prepareAttachment(file.uri, {
        maxImageDim: 896,
        maxChars: 24000,
        maxPdfPages: 6,
      });
      out.push(toAttachment(prepared));
    } catch (e: any) {
      out.push({
        id: nextId(),
        kind: 'text',
        name: file.name,
        mime: file.mime,
        size: file.size,
        problem: e?.message ?? 'Could not read this file.',
      });
    }
  }
  return out;
}

/** Every image path this attachment wants the vision encoder to look at. */
export function imagePathsOf(a: Attachment): string[] {
  if (a.imagePath) return [a.imagePath];
  return a.pageImages ?? [];
}

/**
 * Splits attachments into what the model can consume given its
 * capabilities, plus a list of things it simply can't handle. Being
 * explicit here beats silently dropping a file the user attached.
 */
export function planAttachments(
  attachments: Attachment[],
  visionAvailable: boolean,
): {
  imagePaths: string[];
  textBlocks: string[];
  skipped: string[];
} {
  const imagePaths: string[] = [];
  const textBlocks: string[] = [];
  const skipped: string[] = [];

  for (const a of attachments) {
    const images = imagePathsOf(a);
    const hasText = !!a.text?.trim();

    if (hasText) {
      textBlocks.push(
        `<file name="${a.name}"${a.pageCount ? ` pages="${a.pageCount}"` : ''}>\n${a.text!.trim()}\n</file>`,
      );
      continue;
    }
    if (images.length > 0) {
      if (visionAvailable) {
        imagePaths.push(...images);
      } else {
        skipped.push(
          `${a.name} — needs a model that can see images (try Gemma 3 4B or Qwen2.5-VL 3B).`,
        );
      }
      continue;
    }
    skipped.push(`${a.name} — ${a.problem ?? 'nothing readable inside.'}`);
  }

  return { imagePaths, textBlocks, skipped };
}

/** Rough token cost, so the composer can warn before a very slow turn. */
export function estimateTokens(
  imagePaths: string[],
  textBlocks: string[],
): number {
  const textTokens = textBlocks.reduce((n, t) => n + Math.ceil(t.length / 3.6), 0);
  return textTokens + imagePaths.length * 280;
}
