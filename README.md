# Offline AI

An Android app for chatting with free, open-weight LLMs entirely **on your
phone** — no account, no server, no internet needed once a model is
downloaded. Inference runs locally via [llama.cpp](https://github.com/ggml-org/llama.cpp)
(through the [llama.rn](https://github.com/mybigday/llama.rn) binding).

## What it does

- **Models tab** — browse a curated list of small, free, instruction-tuned
  models (Llama 3.2, Qwen2.5, Gemma 2, SmolLM2, Phi-3.5), download the one
  that fits your phone, and switch between downloaded models any time.
- **Chat tab** — a normal chat UI with streaming responses, running the
  currently loaded model.
- Everything after the initial download works with **no internet
  connection at all** — put the phone in airplane mode and it still works.

See `src/data/modelCatalog.ts` for the exact list, sizes, and licenses.
Bigger/newer phones can comfortably run the 2–4B models; older or
lower-RAM phones should stick to the 0.5–1.5B options.

## Why there's no APK attached

This project was built in a sandboxed environment whose network access is
locked to a small allowlist — it can reach npm, but not Google's Maven
repo or Maven Central, which the actual Android/Gradle compile step
requires. So instead of a broken build attempt, you get:

1. A complete, real project — scaffolded with the official React Native
   CLI, not hand-typed from scratch — with the on-device LLM chat feature
   fully implemented.
2. Everything short of the native compile already verified here:
   `npm install`, TypeScript type-checking (`npx tsc --noEmit`), ESLint,
   and a Jest smoke test that renders the whole app tree all pass clean.
3. A GitHub Actions workflow (`.github/workflows/android-build.yml`) that
   builds a debug APK for you automatically — GitHub's runners have
   normal internet access, so this is the easiest way to get an
   installable file without setting up Android Studio at all.

## Get an APK — pick one

### Option A: GitHub Actions (no local setup)

1. Push this project to a new GitHub repo.
2. GitHub Actions builds automatically (see the "Actions" tab), or trigger
   it manually via "Run workflow".
3. When it finishes, open the run and download the `OfflineAI-debug-apk`
   artifact — that's your installable APK.
4. Transfer it to your phone and install it (you'll need to allow
   "install from unknown sources" for whichever app you use to open it).

### Option B: Android Studio locally

1. Install [Android Studio](https://developer.android.com/studio) (it
   bundles the Android SDK) and Node.js 22+.
2. `npm install`
3. Plug in a phone (with USB debugging on) or start an emulator.
4. `npm run android`

Either way produces a debug build, which is fine for personal use. See
[React Native's signing docs](https://reactnative.dev/docs/signed-apk-android)
if you want a release build to share more widely.

## Project structure

```
App.tsx                        # entry point, tab switching
src/theme.ts                   # shared colors/spacing
src/data/modelCatalog.ts        # curated list of downloadable models
src/services/modelManager.ts    # download/delete/list model files on disk
src/context/LlamaContext.tsx    # loads models into llama.rn, drives chat
src/components/                 # MessageBubble, ModelListItem, ProgressBar, TabBar
src/screens/ChatScreen.tsx      # chat UI
src/screens/ModelsScreen.tsx    # model library / download manager
.github/workflows/android-build.yml  # CI build → downloadable APK
```

## Notes & things to try next

- **Swap in your own model**: add an entry to `MODEL_CATALOG` with any
  GGUF file's Hugging Face URL — no other code changes needed, since chat
  templates are read automatically from each model's own metadata.
- **Model links move sometimes.** If a download 404s, check the model's
  Hugging Face repo page for the current filename and update the catalog
  entry.
- **Performance**: `n_threads` is fixed at 4 in `LlamaContext.tsx` — tune
  it (and `n_ctx`, the context window) per device if you want to
  experiment with speed/memory trade-offs.
- **GPU offload**: llama.rn's `n_gpu_layers` is iOS-only for now; Android
  inference here runs on CPU, using the ARM NEON/dotprod/i8mm-optimized
  builds llama.cpp ships for each device automatically.
- **Everything is on-device**: prompts, chat history, and model files
  never leave the phone — there's no backend at all.
