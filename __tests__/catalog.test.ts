import {
  MODEL_CATALOG,
  downloadUrl,
  getModelById,
  projectorById,
  quantById,
  totalBytes,
} from '../src/data/modelCatalog';
import { storedFilename } from '../src/services/modelManager';

/**
 * The catalog is data, and data rots quietly. These checks catch the two
 * mistakes that actually happen when editing it: a duplicate id, and two
 * models whose files would land on top of each other in the shared folder
 * (several repos publish their projector as a plain "mmproj-F16.gguf").
 */
describe('model catalog', () => {
  it('has unique ids', () => {
    const ids = MODEL_CATALOG.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every model at least one quantisation with a real size', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.quants.length).toBeGreaterThan(0);
      for (const q of model.quants) {
        expect(q.filename).toMatch(/\.gguf$/);
        expect(q.sizeBytes).toBeGreaterThan(1_000_000);
      }
    }
  });

  it('never lets two models claim the same filename on disk', () => {
    const taken = new Map<string, string>();
    for (const model of MODEL_CATALOG) {
      const files = [
        ...model.quants.map(q => q.filename),
        ...(model.mmproj ?? []).map(p => p.filename),
      ];
      for (const file of files) {
        const stored = storedFilename(model.id, file);
        const owner = taken.get(stored);
        if (owner && owner !== model.id) {
          throw new Error(
            `${stored} is claimed by both ${owner} and ${model.id}`,
          );
        }
        taken.set(stored, model.id);
      }
    }
  });

  it('builds Hugging Face URLs that point at the repo and file', () => {
    const model = getModelById('gemma-3-4b-it')!;
    const quant = quantById(model);
    expect(downloadUrl(model, quant.filename)).toBe(
      `https://huggingface.co/${model.repo}/resolve/main/${quant.filename}?download=true`,
    );
  });

  it('counts the projector into the download size of a vision model', () => {
    const model = getModelById('qwen2.5-vl-3b')!;
    const projector = projectorById(model)!;
    expect(totalBytes(model)).toBe(
      quantById(model).sizeBytes + projector.sizeBytes,
    );
  });

  it('prefers the smaller projector where a repo publishes two', () => {
    for (const model of MODEL_CATALOG) {
      if ((model.mmproj?.length ?? 0) < 2) continue;
      const [first, ...rest] = model.mmproj!;
      for (const other of rest) {
        expect(first.sizeBytes).toBeLessThanOrEqual(other.sizeBytes);
      }
    }
  });
});

describe('shared-folder filenames', () => {
  it('keeps published names, so other apps recognise them', () => {
    expect(storedFilename('gemma-3-4b-it', 'gemma-3-4b-it-Q4_K_M.gguf')).toBe(
      'gemma-3-4b-it-Q4_K_M.gguf',
    );
  });

  it('disambiguates projectors published under a generic name', () => {
    expect(storedFilename('qwen3-vl-4b', 'mmproj-F16.gguf')).toBe(
      'qwen3-vl-4b-mmproj-F16.gguf',
    );
    expect(storedFilename('gemma-3-4b-it', 'mmproj-model-f16.gguf')).toBe(
      'gemma-3-4b-it-mmproj-model-f16.gguf',
    );
  });

  it('leaves an already-distinct projector name alone', () => {
    expect(
      storedFilename('qwen2.5-vl-3b', 'mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf'),
    ).toBe('mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf');
  });
});
