# Offline AI

A local-first assistant for Android. Text, images, PDFs and office documents
— all processed on the device by llama.cpp. The only time the app touches
the network is when you ask it to fetch a model file, and even that is
optional.

## What it does

**Chat with any GGUF model.** Text models, vision models, unfiltered models.
The catalog covers all three — 39 entries with verified direct links — and
anything else in GGUF format can be dropped in.

**Keep conversations.** Chats are a list, not a single scratchpad: start a
new one, search old ones, rename them, delete them. The drawer opens with the
menu button or a swipe from the left edge.

**Read what you give it.** Attach a photo, a screenshot, a PDF, a Word
document, a spreadsheet, a slide deck, a CSV or a code file. Text-based PDFs
have their text layer extracted directly; scanned ones are rendered to page
images and handed to a vision model. Nothing is uploaded anywhere.

**Light and dark.** Follows the system by default, including its automatic
day/night schedule, and can be pinned to either in Settings.

## Where models are kept

Model files live in a **shared folder**, `/storage/emulated/0/AIModels` by
default. This is the single most important thing to know about the app:

- Any other local-AI app on the phone can load the same `.gguf`. One copy of
  a 3 GB model serves every app you point at that folder, rather than each
  app hoarding its own.
- A file manager can see them, so you can move, back up or delete them
  yourself.
- Anything you drop in the folder — from a browser, a download manager, a PC
  over USB, or another app — shows up in Offline AI on its own. There is no
  import step.
- Uninstalling the app no longer takes several gigabytes of downloads with
  it.

Settings → Storage shows the current folder and lets you change it: internal
storage, Documents, Download, an SD card, or the app's own folder. Changing
it moves the files you already have. If you are upgrading from an older
version, that screen also offers to move models out of the app's private
storage, where they used to be trapped.

Shared folders need **all-files access** on Android 11 and later. The app
asks once, explains why, and falls back to its own folder if you say no —
everything still works, it just cannot be shared.

## Getting a model

Four routes, all equivalent:

1. **In-app** — Models screen, pick one, tap Download. Vision models pull
   their projector automatically once the main file lands. Pause and resume
   freely; a dropped connection costs seconds, not gigabytes.
2. **Direct link** — tap **Links** on any model to copy the URL or open it in
   a browser. `MODELS.md` in this repository lists every link in one page.
3. **Drop it in** — put any `.gguf` in the models folder by whatever means
   you like. It appears by itself.
4. **Import** — for a file somewhere else on the phone. Used in place when a
   real path can be resolved, copied otherwise (llama.cpp maps the model by
   path and revalidates permissions against the target, so a content URI
   alone won't do).

### Which model

| If you want | Pick |
|---|---|
| One model for everything, 8 GB phone | Gemma 3 4B |
| The newest vision model that fits | Qwen3-VL 4B |
| Reading text inside images | Qwen2.5-VL 3B |
| Vision on a smaller phone | InternVL3 2B, SmolVLM2 2.2B |
| Best text quality | Qwen3 4B Instruct |
| Step-by-step reasoning | Qwen3 4B Thinking |
| Speed above all | LFM2 1.2B, Qwen3 1.7B |
| Code | Qwen2.5 Coder 3B |
| No built-in refusals | Josiefied Qwen3 4B, Dolphin 3.0 |
| Unfiltered *and* able to see images | Gemma 3 4B Abliterated |

Vision models are two files — the model and its `mmproj` projector. Both are
needed before image input works; the app tracks the pair and won't report a
model as ready until it has both.

Where a repository publishes several quantisations, the download button has a
size chooser next to it. **Q4_K_M** is the sensible default on a phone.

## Settings worth knowing

- **Theme** — System, Light or Dark.
- **Reopen the last model on start** — the app comes up ready instead of
  asking every time.
- **CPU threads** — using every core is rarely fastest, since the phone
  throttles. About half is usually the sweet spot.
- **Image detail** — tokens spent per image. Lowering it is the single most
  effective way to keep generation fast and the phone cool.
- **Context window** — larger costs meaningfully more RAM. Applied on the
  next model load.
- **Full screen** — hides the system bars; swipe from an edge to bring them
  back.

## Layout

The UI is driven by the measured window width rather than a device-type
guess, so rotation, split screen and foldables all work without special
cases. System bar insets are read at runtime, so the app sits correctly on
gesture navigation, three-button navigation, and displays with cutouts.

There is no navigation, gesture, icon or markdown library in the dependency
list. The drawer, sheets, icons and markdown renderer are all in `src/`,
because three destinations and a few dozen glyphs are not worth four native
dependencies that can break a CI build on an upgrade.

## Building

```
npm ci
cd android && ./gradlew assembleRelease
```

CI builds a release APK on every push; the artifact is attached to the run.
A debug build would need Metro running to serve the JS bundle, which is why
release is the default here.

Restricted to `arm64-v8a` and `x86_64` — llama.rn only ships prebuilt native
libraries for those, and including 32-bit ABIs would produce an APK that
crashes on launch.

## Layout of the code

```
App.tsx                     shell: drawer, screens, edge swipe
src/context/ThemeContext    light/dark palettes, system following
src/context/LlamaContext    engine, settings, conversations
src/services/storage.ts     where models live, and moving them
src/services/modelManager   registry, downloads, folder discovery
src/services/conversations  chat history
src/data/modelCatalog.ts    the 39 models and their verified links
src/components/             icons, sheets, drawer, composer, markdown
android/.../DocKitModule.kt the one native module: files, downloads, storage
```

## Not included

On-device image *generation* (stable-diffusion.cpp) isn't here. It would
need a second native library carrying its own copy of ggml, which collides
at link time with the one inside llama.rn. Solving that properly means
building both against a single shared ggml — worth doing, but it's a native
build problem rather than an app-code problem, and it doesn't belong in the
same change as everything above.
