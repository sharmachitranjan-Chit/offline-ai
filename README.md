# Offline AI

A local-first assistant for Android. Text, images, PDFs and office documents
— all processed on the device by llama.cpp. The only time the app touches
the network is when you ask it to fetch a model file, and even that is
optional.

## What it does

**Chat with any GGUF model.** Text models, vision models, unfiltered models.
The catalog covers all three, and anything else in GGUF format can be
imported.

**Read what you give it.** Attach a photo, a screenshot, a PDF, a Word
document, a spreadsheet, a slide deck, a CSV or a code file. Text-based PDFs
have their text layer extracted directly; scanned ones are rendered to page
images and handed to a vision model. Nothing is uploaded anywhere.

**Get models however suits you.** Every catalog entry shows its direct
Hugging Face URL, copyable and openable in a browser. Download in-app if
that's convenient, or fetch the file with a browser or download manager,
drop it in Downloads, and import it. In-app transfers resume from where they
stopped rather than restarting.

## Getting a model

Three routes, all equivalent:

1. **In-app** — Models tab, pick one, tap Download. Vision models pull their
   projector automatically once the main file lands. Pause and resume freely.
2. **Direct link** — tap "Get link" on any model, copy the URL or open it in
   a browser. Save to Downloads, then tap "Import a .gguf".
3. **Scan storage** — if you grant all-files access, the app finds every
   `.gguf` already sitting in Downloads, Documents or a `Models` folder.

Imported files are used where they sit when possible, so a 3 GB model isn't
stored twice. That requires a real filesystem path: llama.cpp maps the model
by path and revalidates permissions against the target, so a content URI
alone won't do. When a real path can't be resolved, the app copies instead
and tells you it did.

### Which model

| If you want | Pick |
|---|---|
| One model for everything, 8 GB phone | Gemma 3 4B |
| Reading text inside images | Qwen2.5-VL 3B |
| Vision on a smaller phone | SmolVLM2 2.2B |
| Best text quality | Qwen3 4B Instruct |
| Speed above all | Qwen3 1.7B |
| Code | Qwen2.5 Coder 3B |
| No built-in refusals | Josiefied Qwen3 4B, or Dolphin 3.0 |

Vision models are two files — the model and its `mmproj` projector. Both are
needed before image input works; the app tracks the pair and won't report a
model as ready until it has both.

## Settings worth knowing

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

## Not included

On-device image *generation* (stable-diffusion.cpp) isn't here. It would
need a second native library carrying its own copy of ggml, which collides
at link time with the one inside llama.rn. Solving that properly means
building both against a single shared ggml — worth doing, but it's a native
build problem rather than an app-code problem, and it doesn't belong in the
same change as everything above.
