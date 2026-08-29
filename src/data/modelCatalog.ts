/**
 * Curated catalog of free, open-weight, instruction-tuned LLMs in GGUF
 * format. These run fully on-device via llama.cpp (through llama.rn) —
 * nothing is sent to any server, and once a model file is downloaded the
 * app needs no internet connection at all to chat with it.
 *
 * Every entry links straight to a quantized .gguf file hosted on Hugging
 * Face. Quantization is Q4_K_M unless noted — a good default trade-off
 * between quality, speed and file size for phones.
 *
 * NOTE: Hugging Face repos occasionally get renamed or reorganized by
 * their maintainers. If a download ever 404s, open the `repo` on
 * huggingface.co, find the current .gguf file under "Files", and update
 * `filename`/`url` below — everything else in the app (chat, storage,
 * model switching) keeps working unchanged.
 */

export type ModelEntry = {
  id: string;
  label: string;
  publisher: string;
  paramCount: string;
  quant: string;
  approxSizeGiB: number;
  minRamGiB: number;
  license: string;
  description: string;
  repo: string;
  filename: string;
  recommendedContext: number;
};

const hfUrl = (repo: string, filename: string) =>
  `https://huggingface.co/${repo}/resolve/main/${filename}?download=true`;

export const MODEL_CATALOG: ModelEntry[] = [
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
      'Tiny and very fast. Good for older or low-RAM phones, quick replies, and testing the app. Less capable at reasoning or long context.',
    repo: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
    filename: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
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
      'Meta’s small on-device model. Solid all-rounder for chat, summarizing, and short writing tasks on mid-range phones.',
    repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
  },
  {
    id: 'smollm2-1.7b-instruct',
    label: 'SmolLM2 1.7B Instruct',
    publisher: 'Hugging Face',
    paramCount: '1.7B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.1,
    minRamGiB: 4,
    license: 'Apache 2.0',
    description:
      'Purpose-built for on-device use. A good balance of speed and quality for everyday chat.',
    repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF',
    filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
  },
  {
    id: 'qwen2.5-1.5b-instruct',
    label: 'Qwen2.5 1.5B Instruct',
    publisher: 'Alibaba / Qwen',
    paramCount: '1.5B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.0,
    minRamGiB: 4,
    license: 'Apache 2.0',
    description:
      'Strong for its size, especially at following instructions and basic coding/reasoning questions.',
    repo: 'bartowski/Qwen2.5-1.5B-Instruct-GGUF',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
  },
  {
    id: 'gemma-2-2b-it',
    label: 'Gemma 2 2B Instruct',
    publisher: 'Google DeepMind',
    paramCount: '2B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.7,
    minRamGiB: 6,
    license: 'Gemma License',
    description:
      'Google’s small open model, tuned for helpful, well-formatted chat. Noticeably more capable, needs a beefier phone.',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    recommendedContext: 4096,
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
      'The bigger sibling of Llama 3.2 1B — noticeably better reasoning and writing quality. Best on flagship or upper-mid-range phones.',
    repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
  },
  {
    id: 'qwen2.5-3b-instruct',
    label: 'Qwen2.5 3B Instruct',
    publisher: 'Alibaba / Qwen',
    paramCount: '3B',
    quant: 'Q4_K_M',
    approxSizeGiB: 1.9,
    minRamGiB: 6,
    license: 'Qwen Research/Apache (see repo)',
    description:
      'A capable general-purpose model with good multilingual support, at a similar footprint to Llama 3.2 3B.',
    repo: 'bartowski/Qwen2.5-3B-Instruct-GGUF',
    filename: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
  },
  {
    id: 'phi-3.5-mini-instruct',
    label: 'Phi-3.5 Mini Instruct',
    publisher: 'Microsoft',
    paramCount: '3.8B',
    quant: 'Q4_K_M',
    approxSizeGiB: 2.3,
    minRamGiB: 6,
    license: 'MIT',
    description:
      'Strong reasoning-for-size, MIT licensed. The largest, slowest option in this list — best on newer/flagship phones.',
    repo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    recommendedContext: 4096,
  },
];

export function getModelById(id: string): ModelEntry | undefined {
  return MODEL_CATALOG.find(m => m.id === id);
}

export function getModelDownloadUrl(model: ModelEntry): string {
  return hfUrl(model.repo, model.filename);
}
