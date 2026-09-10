/**
 * Curated catalog of open-weight GGUF models that are actually usable on a
 * phone. Everything runs through llama.cpp on-device — once a file is on the
 * handset, no network is involved at any point.
 *
 * Three things are deliberate here:
 *
 * 1. Every entry exposes a plain, copyable https URL, and every file size is
 *    the real byte count read from the Hugging Face file listing rather than
 *    a rounded guess. In-app downloading is offered but is never the only
 *    route: a 3 GB transfer that stalls at 80% is a genuinely bad
 *    experience, and a browser or download manager handles that better than
 *    an app ever will. Fetch the file however you like, drop it in the
 *    models folder, and the app picks it up.
 *
 * 2. Vision models are listed with their projector (mmproj) file. A VLM is
 *    two files, not one, and the app treats them as a pair so you can't end
 *    up with half a working setup. Where a repo publishes a Q8_0 projector
 *    it is preferred over f16 — half the download, no visible quality cost.
 *
 * 3. Where a repo publishes several quantisations, the useful ones are
 *    listed so a 4 GB phone and a 16 GB phone aren't forced into the same
 *    download. The first entry is the recommended one.
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

export type QuantOption = {
  /** Short name, e.g. "Q4_K_M". */
  id: string;
  filename: string;
  sizeBytes: number;
  /** One line on what the trade-off is. */
  note?: string;
};

export type ProjectorOption = {
  id: string;
  filename: string;
  sizeBytes: number;
};

export type ModelEntry = {
  id: string;
  label: string;
  publisher: string;
  paramCount: string;
  license: string;
  description: string;
  repo: string;
  /** Recommended quant first. */
  quants: QuantOption[];
  /** Present on vision models: the projector that decodes images. */
  mmproj?: ProjectorOption[];
  /** Rough working-set requirement, compared against real device RAM. */
  minRamGiB: number;
  recommendedContext: number;
  tags: ModelTag[];
};

const hf = (repo: string, filename: string) =>
  `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(
    filename,
  )}?download=true`;

export const MODEL_CATALOG: ModelEntry[] = [
  // ------------------------------------------------------------------
  // Vision — these are what make "look at this photo" work
  // ------------------------------------------------------------------
  {
    id: 'gemma-3-4b-it',
    label: 'Gemma 3 4B',
    publisher: 'Google DeepMind',
    paramCount: '4B',
    license: 'Gemma License',
    description:
      'The best all-rounder here for a modern phone. Reads images, handles long documents, writes well, covers a lot of languages including Hindi. Start with this one on an 8 GB device.',
    repo: 'ggml-org/gemma-3-4b-it-GGUF',
    quants: [
      { id: 'Q4_K_M', filename: 'gemma-3-4b-it-Q4_K_M.gguf', sizeBytes: 2489757856 },
      {
        id: 'Q8_0',
        filename: 'gemma-3-4b-it-Q8_0.gguf',
        sizeBytes: 4130226336,
        note: 'Noticeably sharper, needs 12 GB RAM to be comfortable.',
      },
    ],
    mmproj: [
      { id: 'f16', filename: 'mmproj-model-f16.gguf', sizeBytes: 851251104 },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['vision', 'multilingual', 'recommended'],
  },
  {
    id: 'qwen3-vl-4b',
    label: 'Qwen3-VL 4B',
    publisher: 'Alibaba / Qwen',
    paramCount: '4B',
    license: 'Apache 2.0',
    description:
      'The newest vision model that still fits a phone. Better at charts, tables and dense screenshots than Gemma 3, and strong at reasoning about what it sees.',
    repo: 'unsloth/Qwen3-VL-4B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen3-VL-4B-Instruct-Q4_K_M.gguf',
        sizeBytes: 2497282336,
      },
      {
        id: 'UD-Q4_K_XL',
        filename: 'Qwen3-VL-4B-Instruct-UD-Q4_K_XL.gguf',
        sizeBytes: 2546342176,
        note: 'Unsloth dynamic quant — slightly larger, slightly more accurate.',
      },
      {
        id: 'UD-Q2_K_XL',
        filename: 'Qwen3-VL-4B-Instruct-UD-Q2_K_XL.gguf',
        sizeBytes: 1695725856,
        note: 'Last resort for a 4 GB phone. Quality drops off.',
      },
    ],
    mmproj: [{ id: 'F16', filename: 'mmproj-F16.gguf', sizeBytes: 836180640 }],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['vision', 'reasoning', 'multilingual', 'recommended'],
  },
  {
    id: 'qwen2.5-vl-3b',
    label: 'Qwen2.5-VL 3B',
    publisher: 'Alibaba / Qwen',
    paramCount: '3B',
    license: 'Qwen License',
    description:
      'Unusually good at reading text inside images — screenshots, receipts, forms, salary slips, scanned pages. The one to pick for document work.',
    repo: 'ggml-org/Qwen2.5-VL-3B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1929901056,
      },
      {
        id: 'Q8_0',
        filename: 'Qwen2.5-VL-3B-Instruct-Q8_0.gguf',
        sizeBytes: 3285474304,
      },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf',
        sizeBytes: 844757728,
      },
      {
        id: 'f16',
        filename: 'mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf',
        sizeBytes: 1338428128,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['vision', 'recommended'],
  },
  {
    id: 'qwen3-vl-2b',
    label: 'Qwen3-VL 2B',
    publisher: 'Alibaba / Qwen',
    paramCount: '2B',
    license: 'Apache 2.0',
    description:
      'Same family as Qwen3-VL 4B at half the weight. A good vision option for a 4–6 GB phone.',
    repo: 'unsloth/Qwen3-VL-2B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen3-VL-2B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1107410624,
      },
      {
        id: 'UD-Q4_K_XL',
        filename: 'Qwen3-VL-2B-Instruct-UD-Q4_K_XL.gguf',
        sizeBytes: 1129709248,
      },
    ],
    mmproj: [{ id: 'F16', filename: 'mmproj-F16.gguf', sizeBytes: 819395232 }],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['vision', 'tiny'],
  },
  {
    id: 'internvl3-2b',
    label: 'InternVL3 2B',
    publisher: 'OpenGVLab',
    paramCount: '2B',
    license: 'Apache 2.0 / Qwen License',
    description:
      'The smallest projector in the catalog at ~340 MB, so the whole vision setup lands in about 1.5 GB. Solid on photos and diagrams.',
    repo: 'ggml-org/InternVL3-2B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'InternVL3-2B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1116758816,
      },
      {
        id: 'Q8_0',
        filename: 'InternVL3-2B-Instruct-Q8_0.gguf',
        sizeBytes: 1893671520,
      },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'mmproj-InternVL3-2B-Instruct-Q8_0.gguf',
        sizeBytes: 337012000,
      },
      {
        id: 'f16',
        filename: 'mmproj-InternVL3-2B-Instruct-f16.gguf',
        sizeBytes: 628237600,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['vision', 'tiny'],
  },
  {
    id: 'smolvlm2-2.2b',
    label: 'SmolVLM2 2.2B',
    publisher: 'Hugging Face',
    paramCount: '2.2B',
    license: 'Apache 2.0',
    description:
      'Built for on-device vision. Noticeably lighter and cooler-running than the 3–4B options, at some cost in detail.',
    repo: 'ggml-org/SmolVLM2-2.2B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'SmolVLM2-2.2B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1112602656,
      },
      {
        id: 'Q8_0',
        filename: 'SmolVLM2-2.2B-Instruct-Q8_0.gguf',
        sizeBytes: 1927933984,
      },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf',
        sizeBytes: 592523200,
      },
      {
        id: 'f16',
        filename: 'mmproj-SmolVLM2-2.2B-Instruct-f16.gguf',
        sizeBytes: 872303680,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['vision', 'tiny'],
  },
  {
    id: 'lfm2-vl-1.6b',
    label: 'LFM2-VL 1.6B',
    publisher: 'Liquid AI',
    paramCount: '1.6B',
    license: 'LFM Open License',
    description:
      'Designed from the start for phones rather than shrunk down to fit one. Fast first token, low heat.',
    repo: 'LiquidAI/LFM2-VL-1.6B-GGUF',
    quants: [
      { id: 'Q4_0', filename: 'LFM2-VL-1.6B-Q4_0.gguf', sizeBytes: 695750048 },
      { id: 'Q8_0', filename: 'LFM2-VL-1.6B-Q8_0.gguf', sizeBytes: 1246252448 },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'mmproj-LFM2-VL-1.6B-Q8_0.gguf',
        sizeBytes: 564115648,
      },
      {
        id: 'F16',
        filename: 'mmproj-LFM2-VL-1.6B-F16.gguf',
        sizeBytes: 830339008,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['vision', 'tiny'],
  },
  {
    id: 'smolvlm-500m',
    label: 'SmolVLM 500M',
    publisher: 'Hugging Face',
    paramCount: '0.5B',
    license: 'Apache 2.0',
    description:
      'The smallest thing here that can see. Under 600 MB for model and projector together — it fits anywhere, and it answers simple "what is in this picture" questions.',
    repo: 'ggml-org/SmolVLM-500M-Instruct-GGUF',
    quants: [
      {
        id: 'Q8_0',
        filename: 'SmolVLM-500M-Instruct-Q8_0.gguf',
        sizeBytes: 436806912,
      },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'mmproj-SmolVLM-500M-Instruct-Q8_0.gguf',
        sizeBytes: 108783360,
      },
    ],
    minRamGiB: 2,
    recommendedContext: 4096,
    tags: ['vision', 'tiny'],
  },
  {
    id: 'gemma-3-4b-abliterated',
    label: 'Gemma 3 4B Abliterated',
    publisher: 'huihui-ai (community)',
    paramCount: '4B',
    license: 'Gemma License',
    description:
      'Gemma 3 4B with its refusal behaviour removed, projector included — so it is both unfiltered and able to look at images. The only entry here that is both.',
    repo: 'mradermacher/gemma-3-4b-it-abliterated-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'gemma-3-4b-it-abliterated.Q4_K_M.gguf',
        sizeBytes: 2489894464,
      },
      {
        id: 'Q6_K',
        filename: 'gemma-3-4b-it-abliterated.Q6_K.gguf',
        sizeBytes: 3190740544,
      },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'gemma-3-4b-it-abliterated.mmproj-Q8_0.gguf',
        sizeBytes: 588612384,
      },
      {
        id: 'f16',
        filename: 'gemma-3-4b-it-abliterated.mmproj-f16.gguf',
        sizeBytes: 851251104,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['vision', 'uncensored'],
  },
  {
    id: 'qwen2.5-vl-7b',
    label: 'Qwen2.5-VL 7B',
    publisher: 'Alibaba / Qwen',
    paramCount: '7B',
    license: 'Qwen License',
    description:
      'The document-reading model with room to think. Worth it only on a 12 GB phone, and expect it to run warm.',
    repo: 'ggml-org/Qwen2.5-VL-7B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
        sizeBytes: 4683072032,
      },
    ],
    mmproj: [
      {
        id: 'Q8_0',
        filename: 'mmproj-Qwen2.5-VL-7B-Instruct-Q8_0.gguf',
        sizeBytes: 853119712,
      },
    ],
    minRamGiB: 10,
    recommendedContext: 4096,
    tags: ['vision'],
  },
  {
    id: 'gemma-3-12b-it',
    label: 'Gemma 3 12B',
    publisher: 'Google DeepMind',
    paramCount: '12B',
    license: 'Gemma License',
    description:
      'Desktop-class quality. Only worth trying on a 12 GB+ device, and expect it to run slowly and warm. Listed for completeness rather than daily use.',
    repo: 'ggml-org/gemma-3-12b-it-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'gemma-3-12b-it-Q4_K_M.gguf',
        sizeBytes: 7300574976,
      },
    ],
    mmproj: [
      { id: 'f16', filename: 'mmproj-model-f16.gguf', sizeBytes: 854200224 },
    ],
    minRamGiB: 12,
    recommendedContext: 4096,
    tags: ['vision', 'multilingual'],
  },

  // ------------------------------------------------------------------
  // Text — fast, capable, small
  // ------------------------------------------------------------------
  {
    id: 'qwen3-4b-instruct',
    label: 'Qwen3 4B Instruct',
    publisher: 'Alibaba / Qwen',
    paramCount: '4B',
    license: 'Apache 2.0',
    description:
      'Strongest text-only model here for its size. Good at reasoning, code, long instructions and Indian languages. Answers straight away rather than thinking first.',
    repo: 'unsloth/Qwen3-4B-Instruct-2507-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
        sizeBytes: 2497281120,
      },
      {
        id: 'UD-Q4_K_XL',
        filename: 'Qwen3-4B-Instruct-2507-UD-Q4_K_XL.gguf',
        sizeBytes: 2546340960,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['reasoning', 'coding', 'multilingual', 'recommended'],
  },
  {
    id: 'qwen3-4b-thinking',
    label: 'Qwen3 4B Thinking',
    publisher: 'Alibaba / Qwen',
    paramCount: '4B',
    license: 'Apache 2.0',
    description:
      'The same model tuned to reason step by step before answering. Better on maths and multi-step problems, slower on everything else — the thinking is real tokens.',
    repo: 'unsloth/Qwen3-4B-Thinking-2507-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen3-4B-Thinking-2507-Q4_K_M.gguf',
        sizeBytes: 2497281152,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['reasoning'],
  },
  {
    id: 'qwen3-1.7b',
    label: 'Qwen3 1.7B',
    publisher: 'Alibaba / Qwen',
    paramCount: '1.7B',
    license: 'Apache 2.0',
    description:
      'Fast and surprisingly sharp. A good default when you want replies to appear immediately.',
    repo: 'unsloth/Qwen3-1.7B-GGUF',
    quants: [
      { id: 'Q4_K_M', filename: 'Qwen3-1.7B-Q4_K_M.gguf', sizeBytes: 1107409472 },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['reasoning', 'tiny'],
  },
  {
    id: 'qwen3-0.6b',
    label: 'Qwen3 0.6B',
    publisher: 'Alibaba / Qwen',
    paramCount: '0.6B',
    license: 'Apache 2.0',
    description:
      'Under 400 MB. Useful for checking the app works before committing to a big download, and genuinely quick for short tasks.',
    repo: 'unsloth/Qwen3-0.6B-GGUF',
    quants: [
      { id: 'Q4_K_M', filename: 'Qwen3-0.6B-Q4_K_M.gguf', sizeBytes: 396705472 },
    ],
    minRamGiB: 2,
    recommendedContext: 4096,
    tags: ['tiny'],
  },
  {
    id: 'llama-3.2-3b-instruct',
    label: 'Llama 3.2 3B Instruct',
    publisher: 'Meta',
    paramCount: '3B',
    license: 'Llama 3.2 Community License',
    description:
      'Reliable, natural-sounding writing and summarising. A safe pick if other models feel stiff.',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        sizeBytes: 2019377696,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: [],
  },
  {
    id: 'llama-3.2-1b-instruct',
    label: 'Llama 3.2 1B Instruct',
    publisher: 'Meta',
    paramCount: '1B',
    license: 'Llama 3.2 Community License',
    description:
      'Very small and very quick. Good for older phones, or when battery matters more than depth.',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        sizeBytes: 807694464,
      },
    ],
    minRamGiB: 3,
    recommendedContext: 4096,
    tags: ['tiny'],
  },
  {
    id: 'phi-4-mini-instruct',
    label: 'Phi-4 Mini',
    publisher: 'Microsoft',
    paramCount: '3.8B',
    license: 'MIT',
    description:
      'Punches above its weight on maths and structured reasoning. MIT licensed, so no usage strings attached.',
    repo: 'bartowski/microsoft_Phi-4-mini-instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'microsoft_Phi-4-mini-instruct-Q4_K_M.gguf',
        sizeBytes: 2491874688,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['reasoning', 'coding'],
  },
  {
    id: 'gemma-3-1b-it',
    label: 'Gemma 3 1B',
    publisher: 'Google DeepMind',
    paramCount: '1B',
    license: 'Gemma License',
    description:
      'Text-only Gemma. Handles Hindi and other Indian languages better than most models this size.',
    repo: 'unsloth/gemma-3-1b-it-GGUF',
    quants: [
      { id: 'Q4_K_M', filename: 'gemma-3-1b-it-Q4_K_M.gguf', sizeBytes: 806058272 },
    ],
    minRamGiB: 3,
    recommendedContext: 4096,
    tags: ['tiny', 'multilingual'],
  },
  {
    id: 'granite-3.3-2b',
    label: 'Granite 3.3 2B',
    publisher: 'IBM',
    paramCount: '2B',
    license: 'Apache 2.0',
    description:
      'Built for business documents — summarising, extracting fields, following a format exactly. Less chatty than the rest, which is usually what you want on a form.',
    repo: 'ibm-granite/granite-3.3-2b-instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'granite-3.3-2b-instruct-Q4_K_M.gguf',
        sizeBytes: 1545303328,
      },
      {
        id: 'Q6_K',
        filename: 'granite-3.3-2b-instruct-Q6_K.gguf',
        sizeBytes: 2080568608,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['tiny'],
  },
  {
    id: 'smollm2-1.7b',
    label: 'SmolLM2 1.7B',
    publisher: 'Hugging Face',
    paramCount: '1.7B',
    license: 'Apache 2.0',
    description:
      'A clean, well-behaved small model. Good at everyday questions and rewriting, and about a gigabyte.',
    repo: 'HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'smollm2-1.7b-instruct-q4_k_m.gguf',
        sizeBytes: 1055609536,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 4096,
    tags: ['tiny'],
  },
  {
    id: 'lfm2-1.2b',
    label: 'LFM2 1.2B',
    publisher: 'Liquid AI',
    paramCount: '1.2B',
    license: 'LFM Open License',
    description:
      'One of the fastest models per watt on a phone. Under 750 MB and it starts replying almost instantly.',
    repo: 'LiquidAI/LFM2-1.2B-GGUF',
    quants: [
      { id: 'Q4_K_M', filename: 'LFM2-1.2B-Q4_K_M.gguf', sizeBytes: 730893248 },
      { id: 'Q6_K', filename: 'LFM2-1.2B-Q6_K.gguf', sizeBytes: 962841536 },
    ],
    minRamGiB: 3,
    recommendedContext: 4096,
    tags: ['tiny'],
  },
  {
    id: 'deepseek-r1-qwen-1.5b',
    label: 'DeepSeek-R1 Distill 1.5B',
    publisher: 'DeepSeek',
    paramCount: '1.5B',
    license: 'MIT',
    description:
      'A reasoning model small enough for any phone. It writes out its thinking before answering — the app folds that away unless you ask to see it.',
    repo: 'unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
        sizeBytes: 1117321312,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['reasoning', 'tiny'],
  },
  {
    id: 'gemma-3n-e2b',
    label: 'Gemma 3n E2B',
    publisher: 'Google DeepMind',
    paramCount: '2B effective',
    license: 'Gemma License',
    description:
      'Google\'s on-device architecture: a 5B model that only keeps ~2B active. Strong for its speed. Runs text-only here — llama.cpp does not yet use its image and audio towers.',
    repo: 'unsloth/gemma-3n-E2B-it-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'gemma-3n-E2B-it-Q4_K_M.gguf',
        sizeBytes: 3026881888,
      },
    ],
    minRamGiB: 8,
    recommendedContext: 4096,
    tags: ['multilingual'],
  },
  {
    id: 'mistral-7b-v0.3',
    label: 'Mistral 7B Instruct v0.3',
    publisher: 'Mistral AI',
    paramCount: '7B',
    license: 'Apache 2.0',
    description:
      'The dependable 7B. Even-tempered, good long-form writing, and it rarely refuses reasonable requests.',
    repo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
        sizeBytes: 4372812000,
      },
    ],
    minRamGiB: 10,
    recommendedContext: 4096,
    tags: [],
  },

  // ------------------------------------------------------------------
  // Code
  // ------------------------------------------------------------------
  {
    id: 'qwen2.5-coder-3b',
    label: 'Qwen2.5 Coder 3B',
    publisher: 'Alibaba / Qwen',
    paramCount: '3B',
    license: 'Apache 2.0',
    description:
      'Tuned specifically for writing and explaining code. Clearly better than general models at that one job.',
    repo: 'bartowski/Qwen2.5-Coder-3B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
        sizeBytes: 1929903360,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['coding'],
  },
  {
    id: 'qwen2.5-coder-1.5b',
    label: 'Qwen2.5 Coder 1.5B',
    publisher: 'Alibaba / Qwen',
    paramCount: '1.5B',
    license: 'Apache 2.0',
    description:
      'Code help under a gigabyte. Fine for snippets, regexes and explaining an error message.',
    repo: 'bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
        sizeBytes: 986048800,
      },
    ],
    minRamGiB: 4,
    recommendedContext: 8192,
    tags: ['coding', 'tiny'],
  },
  {
    id: 'qwen2.5-coder-7b',
    label: 'Qwen2.5 Coder 7B',
    publisher: 'Alibaba / Qwen',
    paramCount: '7B',
    license: 'Apache 2.0',
    description:
      'The best code model that will still load on a phone. Needs 10 GB+ of RAM and patience.',
    repo: 'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
        sizeBytes: 4683074336,
      },
    ],
    minRamGiB: 10,
    recommendedContext: 8192,
    tags: ['coding'],
  },

  // ------------------------------------------------------------------
  // Unfiltered — fewer built-in refusals
  // ------------------------------------------------------------------
  {
    id: 'josiefied-qwen3-4b',
    label: 'Josiefied Qwen3 4B',
    publisher: 'Goekdeniz-Guelmez (community)',
    paramCount: '4B',
    license: 'Apache 2.0',
    description:
      'Qwen3 4B with its refusal behaviour removed. Keeps most of the base capability while declining far less. Best quality-per-byte in this group.',
    repo: 'mradermacher/Josiefied-Qwen3-4B-abliterated-v2-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Josiefied-Qwen3-4B-abliterated-v2.Q4_K_M.gguf',
        sizeBytes: 2497281248,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['uncensored', 'reasoning'],
  },
  {
    id: 'qwen3-4b-abliterated',
    label: 'Qwen3 4B Abliterated',
    publisher: 'huihui-ai (community)',
    paramCount: '4B',
    license: 'Apache 2.0',
    description:
      'A plainer abliteration of Qwen3 4B — closer to stock behaviour than Josiefied, with the refusal direction removed.',
    repo: 'mradermacher/Qwen3-4B-abliterated-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Qwen3-4B-abliterated.Q4_K_M.gguf',
        sizeBytes: 2497280704,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['uncensored', 'reasoning'],
  },
  {
    id: 'dolphin3-llama3.2-3b',
    label: 'Dolphin 3.0 Llama 3.2 3B',
    publisher: 'Cognitive Computations',
    paramCount: '3B',
    license: 'Llama 3.2 Community License',
    description:
      'A long-running unfiltered fine-tune. Steerable and neutral by default — it follows your system prompt rather than imposing its own.',
    repo: 'bartowski/Dolphin3.0-Llama3.2-3B-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf',
        sizeBytes: 2019382400,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['uncensored'],
  },
  {
    id: 'dolphin3-qwen2.5-3b',
    label: 'Dolphin 3.0 Qwen2.5 3B',
    publisher: 'Cognitive Computations',
    paramCount: '3B',
    license: 'Apache 2.0',
    description:
      'The Qwen-based Dolphin. Sharper at reasoning and code than the Llama one, same unfiltered behaviour.',
    repo: 'bartowski/Dolphin3.0-Qwen2.5-3b-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Dolphin3.0-Qwen2.5-3b-Q4_K_M.gguf',
        sizeBytes: 1929906144,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['uncensored', 'coding'],
  },
  {
    id: 'llama-3.2-3b-abliterated',
    label: 'Llama 3.2 3B Abliterated',
    publisher: 'huihui-ai (community)',
    paramCount: '3B',
    license: 'Llama 3.2 Community License',
    description:
      'Stock Llama 3.2 3B with refusals stripped out. Writing style stays close to the original.',
    repo: 'mradermacher/Llama-3.2-3B-Instruct-abliterated-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Llama-3.2-3B-Instruct-abliterated.Q4_K_M.gguf',
        sizeBytes: 2241004512,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['uncensored'],
  },
  {
    id: 'hermes-3-llama-3.2-3b',
    label: 'Hermes 3 Llama 3.2 3B',
    publisher: 'Nous Research',
    paramCount: '3B',
    license: 'Llama 3.2 Community License',
    description:
      'Nous Research\'s tune: neutral, follows the system prompt closely, good at staying in a role over a long conversation.',
    repo: 'mradermacher/Hermes-3-Llama-3.2-3B-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Hermes-3-Llama-3.2-3B.Q4_K_M.gguf',
        sizeBytes: 2019374336,
      },
    ],
    minRamGiB: 6,
    recommendedContext: 8192,
    tags: ['uncensored'],
  },
  {
    id: 'dolphin3-llama3.2-1b',
    label: 'Dolphin 3.0 Llama 3.2 1B',
    publisher: 'Cognitive Computations',
    paramCount: '1B',
    license: 'Llama 3.2 Community License',
    description:
      'The lightweight unfiltered option. Fits on almost anything and stays cool.',
    repo: 'bartowski/Dolphin3.0-Llama3.2-1B-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf',
        sizeBytes: 807697440,
      },
    ],
    minRamGiB: 3,
    recommendedContext: 4096,
    tags: ['uncensored', 'tiny'],
  },
  {
    id: 'llama-3.2-1b-abliterated',
    label: 'Llama 3.2 1B Abliterated',
    publisher: 'huihui-ai (community)',
    paramCount: '1B',
    license: 'Llama 3.2 Community License',
    description:
      'Under a gigabyte and unfiltered. The smallest model here that will not lecture you.',
    repo: 'mradermacher/Llama-3.2-1B-Instruct-abliterated-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Llama-3.2-1B-Instruct-abliterated.Q4_K_M.gguf',
        sizeBytes: 955445792,
      },
    ],
    minRamGiB: 3,
    recommendedContext: 4096,
    tags: ['uncensored', 'tiny'],
  },
  {
    id: 'dolphin3-llama3.1-8b',
    label: 'Dolphin 3.0 Llama 3.1 8B',
    publisher: 'Cognitive Computations',
    paramCount: '8B',
    license: 'Llama 3.1 Community License',
    description:
      'The full-size Dolphin. Distinctly more capable than the 3B, and it needs a 10 GB+ phone to be usable.',
    repo: 'bartowski/Dolphin3.0-Llama3.1-8B-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf',
        sizeBytes: 4920749472,
      },
    ],
    minRamGiB: 10,
    recommendedContext: 4096,
    tags: ['uncensored'],
  },
  {
    id: 'lexi-llama-3.1-8b',
    label: 'Llama 3.1 8B Lexi Uncensored V2',
    publisher: 'Orenguteng (community)',
    paramCount: '8B',
    license: 'Llama 3.1 Community License',
    description:
      'An uncensored 8B that keeps Llama 3.1\'s instruction-following intact. Strong on long, open-ended writing.',
    repo: 'bartowski/Llama-3.1-8B-Lexi-Uncensored-V2-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Llama-3.1-8B-Lexi-Uncensored-V2-Q4_K_M.gguf',
        sizeBytes: 4920739104,
      },
    ],
    minRamGiB: 10,
    recommendedContext: 4096,
    tags: ['uncensored'],
  },
  {
    id: 'tiger-gemma-9b',
    label: 'Tiger Gemma 9B v3',
    publisher: 'TheDrummer (community)',
    paramCount: '9B',
    license: 'Gemma License',
    description:
      'Gemma 2 9B with the guardrails removed, well regarded for creative writing. The heaviest entry in this group — 12 GB of RAM or don\'t bother.',
    repo: 'mradermacher/Tiger-Gemma-9B-v3-GGUF',
    quants: [
      {
        id: 'Q4_K_M',
        filename: 'Tiger-Gemma-9B-v3.Q4_K_M.gguf',
        sizeBytes: 5761058176,
      },
    ],
    minRamGiB: 12,
    recommendedContext: 4096,
    tags: ['uncensored'],
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

export function defaultQuant(model: ModelEntry): QuantOption {
  return model.quants[0];
}

export function quantById(model: ModelEntry, id?: string): QuantOption {
  if (!id) return defaultQuant(model);
  return model.quants.find(q => q.id === id) ?? defaultQuant(model);
}

export function defaultProjector(model: ModelEntry): ProjectorOption | undefined {
  return model.mmproj?.[0];
}

export function projectorById(
  model: ModelEntry,
  id?: string,
): ProjectorOption | undefined {
  if (!model.mmproj) return undefined;
  if (!id) return model.mmproj[0];
  return model.mmproj.find(p => p.id === id) ?? model.mmproj[0];
}

export function downloadUrl(model: ModelEntry, filename: string): string {
  return hf(model.repo, filename);
}

export function getRepoPageUrl(model: ModelEntry): string {
  return `https://huggingface.co/${model.repo}/tree/main`;
}

/** Model plus projector, in bytes — what the download actually costs. */
export function totalBytes(
  model: ModelEntry,
  quantId?: string,
  projectorId?: string,
): number {
  return (
    quantById(model, quantId).sizeBytes +
    (projectorById(model, projectorId)?.sizeBytes ?? 0)
  );
}

export function supportsVision(model: ModelEntry): boolean {
  return !!model.mmproj?.length;
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
