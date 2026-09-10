# Model links

Every model the app ships in its catalog, with the direct download URL for
each file. Sizes are the real byte counts from the Hugging Face file listing,
not estimates.

You do not have to download through the app. Copy a link below into any
browser or download manager, save the `.gguf` into your models folder
(Settings → Storage shows the path, `/storage/emulated/0/AIModels` by
default), and the app picks it up the next time you open the Models screen.
The same folder can be used by any other local-AI app on the phone, so one
copy of a model serves all of them.

**Vision models are two files.** The model *and* its `mmproj` projector must
both be in the folder before image input works. Text-only models are one file.


## Vision — models that can look at images

### Gemma 3 4B

The best all-rounder here for a modern phone. Reads images, handles long documents, writes well, covers a lot of languages including Hindi. Start with this one on an 8 GB device.

- Publisher: Google DeepMind · 4B · Gemma License
- Needs roughly 6 GB of RAM
- Repository: [ggml-org/gemma-3-4b-it-GGUF](https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| gemma-3-4b-it-Q4_K_M.gguf | 2.32 GB | [download](https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf?download=true) |
| gemma-3-4b-it-Q8_0.gguf | 3.85 GB | [download](https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q8_0.gguf?download=true) |
| mmproj-model-f16.gguf *(projector)* | 0.79 GB | [download](https://huggingface.co/ggml-org/gemma-3-4b-it-GGUF/resolve/main/mmproj-model-f16.gguf?download=true) |

### Qwen3-VL 4B

The newest vision model that still fits a phone. Better at charts, tables and dense screenshots than Gemma 3, and strong at reasoning about what it sees.

- Publisher: Alibaba / Qwen · 4B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [unsloth/Qwen3-VL-4B-Instruct-GGUF](https://huggingface.co/unsloth/Qwen3-VL-4B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-VL-4B-Instruct-Q4_K_M.gguf | 2.33 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3-VL-4B-Instruct-Q4_K_M.gguf?download=true) |
| Qwen3-VL-4B-Instruct-UD-Q4_K_XL.gguf | 2.37 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3-VL-4B-Instruct-UD-Q4_K_XL.gguf?download=true) |
| Qwen3-VL-4B-Instruct-UD-Q2_K_XL.gguf | 1.58 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-4B-Instruct-GGUF/resolve/main/Qwen3-VL-4B-Instruct-UD-Q2_K_XL.gguf?download=true) |
| mmproj-F16.gguf *(projector)* | 0.78 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-4B-Instruct-GGUF/resolve/main/mmproj-F16.gguf?download=true) |

### Qwen2.5-VL 3B

Unusually good at reading text inside images — screenshots, receipts, forms, salary slips, scanned pages. The one to pick for document work.

- Publisher: Alibaba / Qwen · 3B · Qwen License
- Needs roughly 6 GB of RAM
- Repository: [ggml-org/Qwen2.5-VL-3B-Instruct-GGUF](https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf | 1.80 GB | [download](https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf?download=true) |
| Qwen2.5-VL-3B-Instruct-Q8_0.gguf | 3.06 GB | [download](https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q8_0.gguf?download=true) |
| mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf *(projector)* | 0.79 GB | [download](https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf?download=true) |
| mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf *(projector)* | 1.25 GB | [download](https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf?download=true) |

### Qwen3-VL 2B

Same family as Qwen3-VL 4B at half the weight. A good vision option for a 4–6 GB phone.

- Publisher: Alibaba / Qwen · 2B · Apache 2.0
- Needs roughly 4 GB of RAM
- Repository: [unsloth/Qwen3-VL-2B-Instruct-GGUF](https://huggingface.co/unsloth/Qwen3-VL-2B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-VL-2B-Instruct-Q4_K_M.gguf | 1.03 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3-VL-2B-Instruct-Q4_K_M.gguf?download=true) |
| Qwen3-VL-2B-Instruct-UD-Q4_K_XL.gguf | 1.05 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-2B-Instruct-GGUF/resolve/main/Qwen3-VL-2B-Instruct-UD-Q4_K_XL.gguf?download=true) |
| mmproj-F16.gguf *(projector)* | 0.76 GB | [download](https://huggingface.co/unsloth/Qwen3-VL-2B-Instruct-GGUF/resolve/main/mmproj-F16.gguf?download=true) |

### InternVL3 2B

The smallest projector in the catalog at ~340 MB, so the whole vision setup lands in about 1.5 GB. Solid on photos and diagrams.

- Publisher: OpenGVLab · 2B · Apache 2.0 / Qwen License
- Needs roughly 4 GB of RAM
- Repository: [ggml-org/InternVL3-2B-Instruct-GGUF](https://huggingface.co/ggml-org/InternVL3-2B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| InternVL3-2B-Instruct-Q4_K_M.gguf | 1.04 GB | [download](https://huggingface.co/ggml-org/InternVL3-2B-Instruct-GGUF/resolve/main/InternVL3-2B-Instruct-Q4_K_M.gguf?download=true) |
| InternVL3-2B-Instruct-Q8_0.gguf | 1.76 GB | [download](https://huggingface.co/ggml-org/InternVL3-2B-Instruct-GGUF/resolve/main/InternVL3-2B-Instruct-Q8_0.gguf?download=true) |
| mmproj-InternVL3-2B-Instruct-Q8_0.gguf *(projector)* | 0.31 GB | [download](https://huggingface.co/ggml-org/InternVL3-2B-Instruct-GGUF/resolve/main/mmproj-InternVL3-2B-Instruct-Q8_0.gguf?download=true) |
| mmproj-InternVL3-2B-Instruct-f16.gguf *(projector)* | 0.59 GB | [download](https://huggingface.co/ggml-org/InternVL3-2B-Instruct-GGUF/resolve/main/mmproj-InternVL3-2B-Instruct-f16.gguf?download=true) |

### SmolVLM2 2.2B

Built for on-device vision. Noticeably lighter and cooler-running than the 3–4B options, at some cost in detail.

- Publisher: Hugging Face · 2.2B · Apache 2.0
- Needs roughly 4 GB of RAM
- Repository: [ggml-org/SmolVLM2-2.2B-Instruct-GGUF](https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| SmolVLM2-2.2B-Instruct-Q4_K_M.gguf | 1.04 GB | [download](https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/resolve/main/SmolVLM2-2.2B-Instruct-Q4_K_M.gguf?download=true) |
| SmolVLM2-2.2B-Instruct-Q8_0.gguf | 1.80 GB | [download](https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/resolve/main/SmolVLM2-2.2B-Instruct-Q8_0.gguf?download=true) |
| mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf *(projector)* | 0.55 GB | [download](https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/resolve/main/mmproj-SmolVLM2-2.2B-Instruct-Q8_0.gguf?download=true) |
| mmproj-SmolVLM2-2.2B-Instruct-f16.gguf *(projector)* | 0.81 GB | [download](https://huggingface.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF/resolve/main/mmproj-SmolVLM2-2.2B-Instruct-f16.gguf?download=true) |

### LFM2-VL 1.6B

Designed from the start for phones rather than shrunk down to fit one. Fast first token, low heat.

- Publisher: Liquid AI · 1.6B · LFM Open License
- Needs roughly 4 GB of RAM
- Repository: [LiquidAI/LFM2-VL-1.6B-GGUF](https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| LFM2-VL-1.6B-Q4_0.gguf | 0.65 GB | [download](https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/resolve/main/LFM2-VL-1.6B-Q4_0.gguf?download=true) |
| LFM2-VL-1.6B-Q8_0.gguf | 1.16 GB | [download](https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/resolve/main/LFM2-VL-1.6B-Q8_0.gguf?download=true) |
| mmproj-LFM2-VL-1.6B-Q8_0.gguf *(projector)* | 0.53 GB | [download](https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/resolve/main/mmproj-LFM2-VL-1.6B-Q8_0.gguf?download=true) |
| mmproj-LFM2-VL-1.6B-F16.gguf *(projector)* | 0.77 GB | [download](https://huggingface.co/LiquidAI/LFM2-VL-1.6B-GGUF/resolve/main/mmproj-LFM2-VL-1.6B-F16.gguf?download=true) |

### SmolVLM 500M

The smallest thing here that can see. Under 600 MB for model and projector together — it fits anywhere, and it answers simple "what is in this picture" questions.

- Publisher: Hugging Face · 0.5B · Apache 2.0
- Needs roughly 2 GB of RAM
- Repository: [ggml-org/SmolVLM-500M-Instruct-GGUF](https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| SmolVLM-500M-Instruct-Q8_0.gguf | 0.41 GB | [download](https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/main/SmolVLM-500M-Instruct-Q8_0.gguf?download=true) |
| mmproj-SmolVLM-500M-Instruct-Q8_0.gguf *(projector)* | 0.10 GB | [download](https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF/resolve/main/mmproj-SmolVLM-500M-Instruct-Q8_0.gguf?download=true) |

### Qwen2.5-VL 7B

The document-reading model with room to think. Worth it only on a 12 GB phone, and expect it to run warm.

- Publisher: Alibaba / Qwen · 7B · Qwen License
- Needs roughly 10 GB of RAM
- Repository: [ggml-org/Qwen2.5-VL-7B-Instruct-GGUF](https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf | 4.36 GB | [download](https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf?download=true) |
| mmproj-Qwen2.5-VL-7B-Instruct-Q8_0.gguf *(projector)* | 0.79 GB | [download](https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-7B-Instruct-Q8_0.gguf?download=true) |

### Gemma 3 12B

Desktop-class quality. Only worth trying on a 12 GB+ device, and expect it to run slowly and warm. Listed for completeness rather than daily use.

- Publisher: Google DeepMind · 12B · Gemma License
- Needs roughly 12 GB of RAM
- Repository: [ggml-org/gemma-3-12b-it-GGUF](https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| gemma-3-12b-it-Q4_K_M.gguf | 6.80 GB | [download](https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF/resolve/main/gemma-3-12b-it-Q4_K_M.gguf?download=true) |
| mmproj-model-f16.gguf *(projector)* | 0.80 GB | [download](https://huggingface.co/ggml-org/gemma-3-12b-it-GGUF/resolve/main/mmproj-model-f16.gguf?download=true) |

## Unfiltered — fewer built-in refusals

### Gemma 3 4B Abliterated

Gemma 3 4B with its refusal behaviour removed, projector included — so it is both unfiltered and able to look at images. The only entry here that is both.

- Publisher: huihui-ai (community) · 4B · Gemma License
- Needs roughly 6 GB of RAM
- Repository: [mradermacher/gemma-3-4b-it-abliterated-GGUF](https://huggingface.co/mradermacher/gemma-3-4b-it-abliterated-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| gemma-3-4b-it-abliterated.Q4_K_M.gguf | 2.32 GB | [download](https://huggingface.co/mradermacher/gemma-3-4b-it-abliterated-GGUF/resolve/main/gemma-3-4b-it-abliterated.Q4_K_M.gguf?download=true) |
| gemma-3-4b-it-abliterated.Q6_K.gguf | 2.97 GB | [download](https://huggingface.co/mradermacher/gemma-3-4b-it-abliterated-GGUF/resolve/main/gemma-3-4b-it-abliterated.Q6_K.gguf?download=true) |
| gemma-3-4b-it-abliterated.mmproj-Q8_0.gguf *(projector)* | 0.55 GB | [download](https://huggingface.co/mradermacher/gemma-3-4b-it-abliterated-GGUF/resolve/main/gemma-3-4b-it-abliterated.mmproj-Q8_0.gguf?download=true) |
| gemma-3-4b-it-abliterated.mmproj-f16.gguf *(projector)* | 0.79 GB | [download](https://huggingface.co/mradermacher/gemma-3-4b-it-abliterated-GGUF/resolve/main/gemma-3-4b-it-abliterated.mmproj-f16.gguf?download=true) |

### Josiefied Qwen3 4B

Qwen3 4B with its refusal behaviour removed. Keeps most of the base capability while declining far less. Best quality-per-byte in this group.

- Publisher: Goekdeniz-Guelmez (community) · 4B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [mradermacher/Josiefied-Qwen3-4B-abliterated-v2-GGUF](https://huggingface.co/mradermacher/Josiefied-Qwen3-4B-abliterated-v2-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Josiefied-Qwen3-4B-abliterated-v2.Q4_K_M.gguf | 2.33 GB | [download](https://huggingface.co/mradermacher/Josiefied-Qwen3-4B-abliterated-v2-GGUF/resolve/main/Josiefied-Qwen3-4B-abliterated-v2.Q4_K_M.gguf?download=true) |

### Qwen3 4B Abliterated

A plainer abliteration of Qwen3 4B — closer to stock behaviour than Josiefied, with the refusal direction removed.

- Publisher: huihui-ai (community) · 4B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [mradermacher/Qwen3-4B-abliterated-GGUF](https://huggingface.co/mradermacher/Qwen3-4B-abliterated-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-4B-abliterated.Q4_K_M.gguf | 2.33 GB | [download](https://huggingface.co/mradermacher/Qwen3-4B-abliterated-GGUF/resolve/main/Qwen3-4B-abliterated.Q4_K_M.gguf?download=true) |

### Dolphin 3.0 Llama 3.2 3B

A long-running unfiltered fine-tune. Steerable and neutral by default — it follows your system prompt rather than imposing its own.

- Publisher: Cognitive Computations · 3B · Llama 3.2 Community License
- Needs roughly 6 GB of RAM
- Repository: [bartowski/Dolphin3.0-Llama3.2-3B-GGUF](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf | 1.88 GB | [download](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF/resolve/main/Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf?download=true) |

### Dolphin 3.0 Qwen2.5 3B

The Qwen-based Dolphin. Sharper at reasoning and code than the Llama one, same unfiltered behaviour.

- Publisher: Cognitive Computations · 3B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [bartowski/Dolphin3.0-Qwen2.5-3b-GGUF](https://huggingface.co/bartowski/Dolphin3.0-Qwen2.5-3b-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Dolphin3.0-Qwen2.5-3b-Q4_K_M.gguf | 1.80 GB | [download](https://huggingface.co/bartowski/Dolphin3.0-Qwen2.5-3b-GGUF/resolve/main/Dolphin3.0-Qwen2.5-3b-Q4_K_M.gguf?download=true) |

### Llama 3.2 3B Abliterated

Stock Llama 3.2 3B with refusals stripped out. Writing style stays close to the original.

- Publisher: huihui-ai (community) · 3B · Llama 3.2 Community License
- Needs roughly 6 GB of RAM
- Repository: [mradermacher/Llama-3.2-3B-Instruct-abliterated-GGUF](https://huggingface.co/mradermacher/Llama-3.2-3B-Instruct-abliterated-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Llama-3.2-3B-Instruct-abliterated.Q4_K_M.gguf | 2.09 GB | [download](https://huggingface.co/mradermacher/Llama-3.2-3B-Instruct-abliterated-GGUF/resolve/main/Llama-3.2-3B-Instruct-abliterated.Q4_K_M.gguf?download=true) |

### Hermes 3 Llama 3.2 3B

Nous Research's tune: neutral, follows the system prompt closely, good at staying in a role over a long conversation.

- Publisher: Nous Research · 3B · Llama 3.2 Community License
- Needs roughly 6 GB of RAM
- Repository: [mradermacher/Hermes-3-Llama-3.2-3B-GGUF](https://huggingface.co/mradermacher/Hermes-3-Llama-3.2-3B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Hermes-3-Llama-3.2-3B.Q4_K_M.gguf | 1.88 GB | [download](https://huggingface.co/mradermacher/Hermes-3-Llama-3.2-3B-GGUF/resolve/main/Hermes-3-Llama-3.2-3B.Q4_K_M.gguf?download=true) |

### Dolphin 3.0 Llama 3.2 1B

The lightweight unfiltered option. Fits on almost anything and stays cool.

- Publisher: Cognitive Computations · 1B · Llama 3.2 Community License
- Needs roughly 3 GB of RAM
- Repository: [bartowski/Dolphin3.0-Llama3.2-1B-GGUF](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-1B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf | 0.75 GB | [download](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-1B-GGUF/resolve/main/Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf?download=true) |

### Llama 3.2 1B Abliterated

Under a gigabyte and unfiltered. The smallest model here that will not lecture you.

- Publisher: huihui-ai (community) · 1B · Llama 3.2 Community License
- Needs roughly 3 GB of RAM
- Repository: [mradermacher/Llama-3.2-1B-Instruct-abliterated-GGUF](https://huggingface.co/mradermacher/Llama-3.2-1B-Instruct-abliterated-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Llama-3.2-1B-Instruct-abliterated.Q4_K_M.gguf | 0.89 GB | [download](https://huggingface.co/mradermacher/Llama-3.2-1B-Instruct-abliterated-GGUF/resolve/main/Llama-3.2-1B-Instruct-abliterated.Q4_K_M.gguf?download=true) |

### Dolphin 3.0 Llama 3.1 8B

The full-size Dolphin. Distinctly more capable than the 3B, and it needs a 10 GB+ phone to be usable.

- Publisher: Cognitive Computations · 8B · Llama 3.1 Community License
- Needs roughly 10 GB of RAM
- Repository: [bartowski/Dolphin3.0-Llama3.1-8B-GGUF](https://huggingface.co/bartowski/Dolphin3.0-Llama3.1-8B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf | 4.58 GB | [download](https://huggingface.co/bartowski/Dolphin3.0-Llama3.1-8B-GGUF/resolve/main/Dolphin3.0-Llama3.1-8B-Q4_K_M.gguf?download=true) |

### Llama 3.1 8B Lexi Uncensored V2

An uncensored 8B that keeps Llama 3.1's instruction-following intact. Strong on long, open-ended writing.

- Publisher: Orenguteng (community) · 8B · Llama 3.1 Community License
- Needs roughly 10 GB of RAM
- Repository: [bartowski/Llama-3.1-8B-Lexi-Uncensored-V2-GGUF](https://huggingface.co/bartowski/Llama-3.1-8B-Lexi-Uncensored-V2-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Llama-3.1-8B-Lexi-Uncensored-V2-Q4_K_M.gguf | 4.58 GB | [download](https://huggingface.co/bartowski/Llama-3.1-8B-Lexi-Uncensored-V2-GGUF/resolve/main/Llama-3.1-8B-Lexi-Uncensored-V2-Q4_K_M.gguf?download=true) |

### Tiger Gemma 9B v3

Gemma 2 9B with the guardrails removed, well regarded for creative writing. The heaviest entry in this group — 12 GB of RAM or don't bother.

- Publisher: TheDrummer (community) · 9B · Gemma License
- Needs roughly 12 GB of RAM
- Repository: [mradermacher/Tiger-Gemma-9B-v3-GGUF](https://huggingface.co/mradermacher/Tiger-Gemma-9B-v3-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Tiger-Gemma-9B-v3.Q4_K_M.gguf | 5.37 GB | [download](https://huggingface.co/mradermacher/Tiger-Gemma-9B-v3-GGUF/resolve/main/Tiger-Gemma-9B-v3.Q4_K_M.gguf?download=true) |

## Code

### Qwen3 4B Instruct

Strongest text-only model here for its size. Good at reasoning, code, long instructions and Indian languages. Answers straight away rather than thinking first.

- Publisher: Alibaba / Qwen · 4B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [unsloth/Qwen3-4B-Instruct-2507-GGUF](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-4B-Instruct-2507-Q4_K_M.gguf | 2.33 GB | [download](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf?download=true) |
| Qwen3-4B-Instruct-2507-UD-Q4_K_XL.gguf | 2.37 GB | [download](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-UD-Q4_K_XL.gguf?download=true) |

### Phi-4 Mini

Punches above its weight on maths and structured reasoning. MIT licensed, so no usage strings attached.

- Publisher: Microsoft · 3.8B · MIT
- Needs roughly 6 GB of RAM
- Repository: [bartowski/microsoft_Phi-4-mini-instruct-GGUF](https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| microsoft_Phi-4-mini-instruct-Q4_K_M.gguf | 2.32 GB | [download](https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_K_M.gguf?download=true) |

### Qwen2.5 Coder 3B

Tuned specifically for writing and explaining code. Clearly better than general models at that one job.

- Publisher: Alibaba / Qwen · 3B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [bartowski/Qwen2.5-Coder-3B-Instruct-GGUF](https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf | 1.80 GB | [download](https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf?download=true) |

### Qwen2.5 Coder 1.5B

Code help under a gigabyte. Fine for snippets, regexes and explaining an error message.

- Publisher: Alibaba / Qwen · 1.5B · Apache 2.0
- Needs roughly 4 GB of RAM
- Repository: [bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF](https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf | 0.92 GB | [download](https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf?download=true) |

### Qwen2.5 Coder 7B

The best code model that will still load on a phone. Needs 10 GB+ of RAM and patience.

- Publisher: Alibaba / Qwen · 7B · Apache 2.0
- Needs roughly 10 GB of RAM
- Repository: [bartowski/Qwen2.5-Coder-7B-Instruct-GGUF](https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf | 4.36 GB | [download](https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf?download=true) |

## Text

### Qwen3 4B Thinking

The same model tuned to reason step by step before answering. Better on maths and multi-step problems, slower on everything else — the thinking is real tokens.

- Publisher: Alibaba / Qwen · 4B · Apache 2.0
- Needs roughly 6 GB of RAM
- Repository: [unsloth/Qwen3-4B-Thinking-2507-GGUF](https://huggingface.co/unsloth/Qwen3-4B-Thinking-2507-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-4B-Thinking-2507-Q4_K_M.gguf | 2.33 GB | [download](https://huggingface.co/unsloth/Qwen3-4B-Thinking-2507-GGUF/resolve/main/Qwen3-4B-Thinking-2507-Q4_K_M.gguf?download=true) |

### Qwen3 1.7B

Fast and surprisingly sharp. A good default when you want replies to appear immediately.

- Publisher: Alibaba / Qwen · 1.7B · Apache 2.0
- Needs roughly 4 GB of RAM
- Repository: [unsloth/Qwen3-1.7B-GGUF](https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-1.7B-Q4_K_M.gguf | 1.03 GB | [download](https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf?download=true) |

### Qwen3 0.6B

Under 400 MB. Useful for checking the app works before committing to a big download, and genuinely quick for short tasks.

- Publisher: Alibaba / Qwen · 0.6B · Apache 2.0
- Needs roughly 2 GB of RAM
- Repository: [unsloth/Qwen3-0.6B-GGUF](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Qwen3-0.6B-Q4_K_M.gguf | 0.37 GB | [download](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf?download=true) |

### Llama 3.2 3B Instruct

Reliable, natural-sounding writing and summarising. A safe pick if other models feel stiff.

- Publisher: Meta · 3B · Llama 3.2 Community License
- Needs roughly 6 GB of RAM
- Repository: [bartowski/Llama-3.2-3B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Llama-3.2-3B-Instruct-Q4_K_M.gguf | 1.88 GB | [download](https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf?download=true) |

### Llama 3.2 1B Instruct

Very small and very quick. Good for older phones, or when battery matters more than depth.

- Publisher: Meta · 1B · Llama 3.2 Community License
- Needs roughly 3 GB of RAM
- Repository: [bartowski/Llama-3.2-1B-Instruct-GGUF](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Llama-3.2-1B-Instruct-Q4_K_M.gguf | 0.75 GB | [download](https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf?download=true) |

### Gemma 3 1B

Text-only Gemma. Handles Hindi and other Indian languages better than most models this size.

- Publisher: Google DeepMind · 1B · Gemma License
- Needs roughly 3 GB of RAM
- Repository: [unsloth/gemma-3-1b-it-GGUF](https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| gemma-3-1b-it-Q4_K_M.gguf | 0.75 GB | [download](https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf?download=true) |

### Granite 3.3 2B

Built for business documents — summarising, extracting fields, following a format exactly. Less chatty than the rest, which is usually what you want on a form.

- Publisher: IBM · 2B · Apache 2.0
- Needs roughly 4 GB of RAM
- Repository: [ibm-granite/granite-3.3-2b-instruct-GGUF](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| granite-3.3-2b-instruct-Q4_K_M.gguf | 1.44 GB | [download](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct-GGUF/resolve/main/granite-3.3-2b-instruct-Q4_K_M.gguf?download=true) |
| granite-3.3-2b-instruct-Q6_K.gguf | 1.94 GB | [download](https://huggingface.co/ibm-granite/granite-3.3-2b-instruct-GGUF/resolve/main/granite-3.3-2b-instruct-Q6_K.gguf?download=true) |

### SmolLM2 1.7B

A clean, well-behaved small model. Good at everyday questions and rewriting, and about a gigabyte.

- Publisher: Hugging Face · 1.7B · Apache 2.0
- Needs roughly 4 GB of RAM
- Repository: [HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| smollm2-1.7b-instruct-q4_k_m.gguf | 0.98 GB | [download](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf?download=true) |

### LFM2 1.2B

One of the fastest models per watt on a phone. Under 750 MB and it starts replying almost instantly.

- Publisher: Liquid AI · 1.2B · LFM Open License
- Needs roughly 3 GB of RAM
- Repository: [LiquidAI/LFM2-1.2B-GGUF](https://huggingface.co/LiquidAI/LFM2-1.2B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| LFM2-1.2B-Q4_K_M.gguf | 0.68 GB | [download](https://huggingface.co/LiquidAI/LFM2-1.2B-GGUF/resolve/main/LFM2-1.2B-Q4_K_M.gguf?download=true) |
| LFM2-1.2B-Q6_K.gguf | 0.90 GB | [download](https://huggingface.co/LiquidAI/LFM2-1.2B-GGUF/resolve/main/LFM2-1.2B-Q6_K.gguf?download=true) |

### DeepSeek-R1 Distill 1.5B

A reasoning model small enough for any phone. It writes out its thinking before answering — the app folds that away unless you ask to see it.

- Publisher: DeepSeek · 1.5B · MIT
- Needs roughly 4 GB of RAM
- Repository: [unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF](https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf | 1.04 GB | [download](https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf?download=true) |

### Gemma 3n E2B

Google's on-device architecture: a 5B model that only keeps ~2B active. Strong for its speed. Runs text-only here — llama.cpp does not yet use its image and audio towers.

- Publisher: Google DeepMind · 2B effective · Gemma License
- Needs roughly 8 GB of RAM
- Repository: [unsloth/gemma-3n-E2B-it-GGUF](https://huggingface.co/unsloth/gemma-3n-E2B-it-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| gemma-3n-E2B-it-Q4_K_M.gguf | 2.82 GB | [download](https://huggingface.co/unsloth/gemma-3n-E2B-it-GGUF/resolve/main/gemma-3n-E2B-it-Q4_K_M.gguf?download=true) |

### Mistral 7B Instruct v0.3

The dependable 7B. Even-tempered, good long-form writing, and it rarely refuses reasonable requests.

- Publisher: Mistral AI · 7B · Apache 2.0
- Needs roughly 10 GB of RAM
- Repository: [bartowski/Mistral-7B-Instruct-v0.3-GGUF](https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/tree/main)

| File | Size | Link |
|---|---|---|
| Mistral-7B-Instruct-v0.3-Q4_K_M.gguf | 4.07 GB | [download](https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf?download=true) |

## Anything else in GGUF format

The catalog is a starting point, not a limit. Any GGUF that llama.cpp can
load will work: put it in the models folder, or use **Import a .gguf** on the
Models screen. Good places to look:

- [ggml-org](https://huggingface.co/ggml-org) — the llama.cpp team's own conversions, always current
- [unsloth](https://huggingface.co/unsloth) — dynamic quants, usually the first with new models
- [bartowski](https://huggingface.co/bartowski) — the widest coverage of quantisation levels
- [mradermacher](https://huggingface.co/mradermacher) — huge coverage, including community fine-tunes
- [Hugging Face GGUF search](https://huggingface.co/models?library=gguf&sort=trending)

For a phone, look for **Q4_K_M**: it is the usual balance between size and
quality. Below Q4 the model starts making mistakes it otherwise would not;
above it you pay in RAM and speed for a difference you will rarely notice on
a 4B model.
