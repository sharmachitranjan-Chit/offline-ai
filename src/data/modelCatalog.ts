/**
 * Curated catalog of open-weight GGUF models that are actually usable on a
 * phone. Everything runs through llama.cpp on-device — once a file is on
 * the handset, no network is involved at any point.
 *
 * Two things are deliberate here:
 *
 * 1. Every entry exposes a plain, copyable https URL. In-app downloading
 *    is offered, but it is never the only route. A 3 GB transfer that
 *    stalls at 80% is a genuinely bad experience, and a browser or a
 *    download manager handles that far better than an app ever will.
 *    Grab the file however you like, drop it in Downloads, import it.
 *
 * 2. Vision models are listed with their projector (mmproj) file. A VLM is
 *    two files, not one, and the app treats them as a pair so you can't
 *    end up with half a working setup.
 *
 * If a link ever 404s, the repo page is one tap away and the app can
 * re-resolve the current filename from the Hugging Face file listing.
 */

export type ModelTag =
  | 'vision'
  | 'uncensored'
  | 'reasoning'
  | 'coding'
  | 'multilingual'
  | 'tiny'
  | 'recommended';

export type ModelEntry = {
  id: string;
  label: string;
  publisher: string;
  paramCount: string;
  quant: string;
  approxSizeGiB: number;
  /** Rough working-set requirement. Compared against real device RAM. */
  minRamGiB: number;
  license: string;
  description: string;
  repo: string;
  filename: string;
  recommendedContext: number;
  tags: ModelTag[];
  /** Present on vision models: the projector that decodes images. */
  mmproj?: { filename: string; approxSizeGiB: number };
};

const hf = (repo: string, filename: string) =>
  `https://huggingface.co/${repo}/resolve/main/${filename}?download=true`;

export const MODEL_CATALOG: ModelEntry[] = [
  // ----- Vision-capable: these are what make "look at this photo" work -----
  {
    id: 'gemma-3-4b-it',
    label: 'Gemma 3 4B',
    publisher: 'Google DeepMind',
    paramCount: '4B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.5,
    minRamGiB: 6,
    license: 'Gemma License',
    description:
      'The best all-rounder here for a modern phone. Reads images, handles long documents, writes well, covers a lot of languages. Start with this one on an 8 GB device.',
    repo: 'ggml-org/gemma-3-4b-it-GGUF',
    filename: 'gemma-3-4b-it-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['vision', 'multilingual', 'recommended'],
    mmproj: { filename: 'mmproj-model-f16.gguf', approxSizeGiB: 0.85 },
  },
  {
    id: 'qwen2.5-vl-3b',
    label: 'Qwen2.5-VL 3B',
    publisher: 'Alibaba / Qwen',
    paramCount: '3B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.9,
    minRamGiB: 6,
    license: 'Qwen License',
    description:
      'Unusually good at reading text inside images — screenshots, receipts, forms, scanned pages. The one to pick for document work.',
    repo: 'ggml-org/Qwen2.5-VL-3B-Instruct-GGUF',
    filename: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['vision', 'recommended'],
    mmproj: {
      filename: 'mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf',
      approxSizeGiB: 1.34,
    },
  },
  {
    id: 'smolvlm2-2.2b',
    label: 'SmolVLM2 2.2B',
    publisher: 'Hugging Face',
    paramCount: '2.2B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.3,
    minRamGiB: 4,
    license: 'Apache 2.0',
    description:
      'Built for on-device vision. Noticeably lighter and cooler-running than the 3–4B options, at some cost in detail.',
    repo: 'ggml-org/SmolVLM2-2.2B-Instruct-GGUF',
    filename: 'SmolVLM2-2.2B-Instruct-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['vision', 'tiny'],
    mmproj: {
      filename: 'mmproj-SmolVLM2-2.2B-Instruct-f16.gguf',
      approxSizeGiB: 0.19,
    },
  },
  {
    id: 'gemma-3-12b-it',
    label: 'Gemma 3 12B',
    publisher: 'Google DeepMind',
    paramCount: '12B',
    quant: 'Q4_K_M',
    approxSizeGiB: 7.3,
    minRamGiB: 12,
    license: 'Gemma License',
    description:
      'Desktop-class quality. Only worth trying on a 12 GB+ device, and expect it to run slowly and warm. Listed for completeness rather than daily use.',
    repo: 'ggml-org/gemma-3-12b-it-GGUF',
    filename: 'gemma-3-12b-it-Q4_K_M.gguf',
    recommendedContext: 4096,
    tags: ['vision', 'multilingual'],
    mmproj: { filename: 'mmproj-model-f16.gguf', approxSizeGiB: 0.85 },
  },

  // ----- Text: fast, capable, small -----
  {
    id: 'qwen3-4b-instruct',
    label: 'Qwen3 4B Instruct',
    publisher: 'Alibaba / Qwen',
    paramCount: '4B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.5,
    minRamGiB: 6,
    license: 'Apache 2.0',
    description:
      'Strongest text-only model here for its size. Good at reasoning, code, and long instructions.',
    repo: 'unsloth/Qwen3-4B-Instruct-2507-GGUF',
    filename: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['reasoning', 'coding', 'multilingual', 'recommended'],
  },
  {
    id: 'qwen3-1.7b',
    label: 'Qwen3 1.7B',
    publisher: 'Alibaba / Qwen',
    paramCount: '1.7B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.1,
    minRamGiB: 4,
    license: 'Apache 2.0',
    description:
      'Fast and surprisingly sharp. A good default when you want replies to appear immediately.',
    repo: 'unsloth/Qwen3-1.7B-GGUF',
    filename: 'Qwen3-1.7B-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['reasoning', 'tiny'],
  },
  {
    id: 'llama-3.2-3b-instruct',
    label: 'Llama 3.2 3B Instruct',
    publisher: 'Meta',
    paramCount: '3B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.0,
    minRamGiB: 6,
    license: 'Llama 3.2 Community License',
    description:
      'Reliable, natural-sounding writing and summarising. A safe pick if other models feel stiff.',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: [],
  },
  {
    id: 'phi-4-mini-instruct',
    label: 'Phi-4 Mini',
    publisher: 'Microsoft',
    paramCount: '3.8B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.4,
    minRamGiB: 6,
    license: 'MIT',
    description:
      'Punches above its weight on maths and structured reasoning. MIT licensed, so no usage strings attached.',
    repo: 'bartowski/microsoft_Phi-4-mini-instruct-GGUF',
    filename: 'microsoft_Phi-4-mini-instruct-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['reasoning', 'coding'],
  },
  {
    id: 'llama-3.2-1b-instruct',
    label: 'Llama 3.2 1B Instruct',
    publisher: 'Meta',
    paramCount: '1B',
    quant: 'Q4_K_M',
    approxSizeGiB: 0.8,
    minRamGiB: 3,
    license: 'Llama 3.2 Community License',
    description:
      'Very small and very quick. Good for older phones, or when battery matters more than depth.',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
    tags: ['tiny'],
  },
  {
    id: 'qwen2.5-0.5b-instruct',
    label: 'Qwen2.5 0.5B Instruct',
    publisher: 'Alibaba / Qwen',
    paramCount: '0.5B',
    quant: 'Q4_K_M',
    approxSizeGiB: 0.4,
    minRamGiB: 2,
    license: 'Apache 2.0',
    description:
      'The smallest thing that still answers sensibly. Mostly useful for checking the app works before committing to a big download.',
    repo: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
    filename: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
    tags: ['tiny'],
  },
  {
    id: 'qwen2.5-coder-3b',
    label: 'Qwen2.5 Coder 3B',
    publisher: 'Alibaba / Qwen',
    paramCount: '3B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.9,
    minRamGiB: 6,
    license: 'Apache 2.0',
    description:
      'Tuned specifically for writing and explaining code. Clearly better than general models at that one job.',
    repo: 'bartowski/Qwen2.5-Coder-3B-Instruct-GGUF',
    filename: 'Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['coding'],
  },

  // ----- Unfiltered: fewer built-in refusals -----
  {
    id: 'josiefied-qwen3-4b',
    label: 'Josiefied Qwen3 4B',
    publisher: 'Goekdeniz-Guelmez (community)',
    paramCount: '4B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.5,
    minRamGiB: 6,
    license: 'Apache 2.0',
    description:
      'Qwen3 4B with its refusal behaviour removed. Keeps most of the base capability while declining far less. Best quality-per-byte in this group.',
    repo: 'mradermacher/Josiefied-Qwen3-4B-abliterated-v2-GGUF',
    filename: 'Josiefied-Qwen3-4B-abliterated-v2.Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['uncensored', 'reasoning'],
  },
  {
    id: 'dolphin3-llama3.2-3b',
    label: 'Dolphin 3.0 Llama 3.2 3B',
    publisher: 'Cognitive Computations',
    paramCount: '3B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.0,
    minRamGiB: 6,
    license: 'Llama 3.2 Community License',
    description:
      'A long-running unfiltered fine-tune. Steerable and neutral by default — it follows your system prompt rather than imposing its own.',
    repo: 'bartowski/Dolphin3.0-Llama3.2-3B-GGUF',
    filename: 'Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['uncensored'],
  },
  {
    id: 'llama-3.2-3b-abliterated',
    label: 'Llama 3.2 3B Abliterated',
    publisher: 'huihui-ai (community)',
    paramCount: '3B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.0,
    minRamGiB: 6,
    license: 'Llama 3.2 Community License',
    description:
      'Stock Llama 3.2 3B with refusals stripped out. Writing style stays close to the original.',
    repo: 'bartowski/huihui-ai_Llama-3.2-3B-Instruct-abliterated-GGUF',
    filename: 'huihui-ai_Llama-3.2-3B-Instruct-abliterated-Q4_K_M.gguf',
    recommendedContext: 8192,
    tags: ['uncensored'],
  },
  {
    id: 'dolphin3-llama3.2-1b',
    label: 'Dolphin 3.0 Llama 3.2 1B',
    publisher: 'Cognitive Computations',
    paramCount: '1B',
    quant: 'Q4_K_M',
    approxSizeGiB: 0.8,
    minRamGiB: 3,
    license: 'Llama 3.2 Community License',
    description:
      'The lightweight unfiltered option. Fits on almost anything and stays cool.',
    repo: 'bartowski/Dolphin3.0-Llama3.2-1B-GGUF',
    filename: 'Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf',
    recommendedContext: 4096,
    tags: ['uncensored', 'tiny'],
  },
];

export const TAG_LABELS: Record<ModelTag, string> = {
  vision: 'Sees images',
  uncensored: 'Unfiltered',
  reasoning: 'Reasoning',
  coding: 'Code',
  multilingual: 'Multilingual',
  tiny: 'Lightweight',
  recommended: 'Recommended',
};

export function getModelById(id: string): ModelEntry | undefined {
  return MODEL_CATALOG.find(m => m.id === id);
}

export function getModelDownloadUrl(model: ModelEntry): string {
  return hf(model.repo, model.filename);
}

export function getMmprojDownloadUrl(model: ModelEntry): string | undefined {
  return model.mmproj ? hf(model.repo, model.mmproj.filename) : undefined;
}

export function getRepoPageUrl(model: ModelEntry): string {
  return `https://huggingface.co/${model.repo}/tree/main`;
}

export function totalSizeGiB(model: ModelEntry): number {
  return model.approxSizeGiB + (model.mmproj?.approxSizeGiB ?? 0);
}

export function supportsVision(model: ModelEntry): boolean {
  return !!model.mmproj;
}

/**
 * Asks Hugging Face which files a repo currently holds, so a renamed quant
 * can be recovered from without shipping an app update. Purely a fallback —
 * never on the path of anything that has to work offline.
 */
export async function resolveCurrentFilename(
  model: ModelEntry,
  wantMmproj = false,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://huggingface.co/api/models/${model.repo}/tree/main`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const files: Array<{ path: string; type: string }> = await res.json();
    const ggufs = files
      .filter(f => f.type === 'file' && f.path.toLowerCase().endsWith('.gguf'))
      .map(f => f.path);

    if (wantMmproj) {
      return ggufs.find(p => p.toLowerCase().includes('mmproj')) ?? null;
    }
    const candidates = ggufs.filter(p => !p.toLowerCase().includes('mmproj'));
    return (
      candidates.find(p => p.toLowerCase().includes('q4_k_m')) ??
      candidates.find(p => p.toLowerCase().includes('q4')) ??
      candidates[0] ??
      null
    );
  } catch {
    return null;
  }
}
