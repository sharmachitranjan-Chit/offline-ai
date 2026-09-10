# Patch notes — 2.1

## How to apply this zip

Extract it over your working copy of the repository, then **delete one file
that no longer exists**:

```
rm src/components/NavBar.tsx
```

Extracting a zip cannot remove files, and the old bottom tab bar is gone —
nothing imports it, but it references a `colors` export that no longer
exists, so `npm run typecheck` and `npm run lint` will fail while it is still
there.

Then:

```
npm ci
npm run typecheck && npm run lint && npm test
cd android && ./gradlew assembleRelease
```

`package-lock.json` is unchanged: no dependency was added or removed.

## The four things you asked for

**1. Models no longer live in app memory.** They go to a shared folder,
`/storage/emulated/0/AIModels` by default, keeping their published filenames
so another app recognises them. Any `.gguf` dropped into that folder is
picked up automatically — no import step. The folder is a setting (internal
storage, Documents, Download, SD card, or app-private as a fallback), and
changing it moves the files you already have. An older install that still has
models trapped in app storage gets an offer, on the Models and Settings
screens, to move them out.

**2. Many more model links.** The catalog went from 15 entries to 39, each
one's repository and filename checked against the live Hugging Face file
listing, with real byte sizes rather than rounded guesses. Vision, text,
code, reasoning and unfiltered are all covered, from 400 MB to 7 GB, and
where a repository publishes several quantisations you can choose which to
fetch. Every entry has a **Links** button that copies the direct URL or opens
it in a browser, so you can download with anything you like and drop the file
in the folder. `MODELS.md` is the same list as one page.

One thing worth knowing: the old catalog's `bartowski/huihui-ai_Llama-3.2-3B-Instruct-abliterated-GGUF`
and `bartowski/NousResearch_Hermes-3-Llama-3.2-3B-GGUF` entries are dead —
those repositories return 401. They have been replaced with working
`mradermacher` builds of the same models.

**3. Light, dark and system.** Two full palettes, following the phone by
default (including its day/night schedule), with System / Light / Dark in
Settings. Nothing hard-codes a colour any more; the status and navigation
bars are repainted natively to match, and `values-night` keeps the launch
frame from flashing black in light mode.

**4. The interface.** Conversation history with a drawer (menu button or
swipe from the left edge), search, rename and delete; the model name in the
title bar is a switcher; a `+` sheet for attachments; edit-and-resend on your
own messages; copy and retry on replies; a jump-to-latest button; suggestion
chips on an empty chat; markdown with tables, links and scrollable code
blocks; and hand-drawn vector icons in place of emoji.

## Files

**Added**

```
src/context/ThemeContext.tsx      light/dark palettes, system following, makeStyles
src/services/storage.ts           storage locations, validation, migration
src/services/conversations.ts     chat history store
src/components/Icon.tsx           the icon set
src/components/Sheet.tsx          bottom sheets
src/components/Drawer.tsx         conversation drawer
src/components/TopBar.tsx         app bar
src/components/Composer.tsx       input row and attachment sheet
src/components/StorageCard.tsx    models-folder card, permission and migration
android/app/src/main/res/values/colors.xml
android/app/src/main/res/values-night/colors.xml
MODELS.md
__tests__/catalog.test.ts
__tests__/conversations.test.ts
```

**Removed**

```
src/components/NavBar.tsx         replaced by the drawer
```

**Rewritten or changed**

```
App.tsx                           shell, drawer, edge swipe
src/theme.ts                       two palettes + tokens
src/context/LlamaContext.tsx       conversations, auto-load, throttled streaming
src/services/modelManager.ts       shared folder, discovery, quant choice
src/data/modelCatalog.ts           39 verified models
src/native/DocKit.ts               storage and system-bar APIs
src/screens/*.tsx                  all three
src/components/{Markdown,MessageBubble,AttachmentChip,ProgressBar,ModelListItem}.tsx
android/app/src/main/java/com/offlineai/dockit/DocKitModule.kt
android/app/src/main/AndroidManifest.xml
android/app/src/main/res/values/styles.xml
android/app/build.gradle           versionCode 3, versionName 2.1
README.md
```

## Notes on the native side

`DocKitModule.kt` gained: `getStorageOptions`, `ensureDir` (which proves a
folder is writable by writing a byte to it, because `canWrite()` lies under
scoped storage), `moveFile` (rename, falling back to a size-verified copy
across volumes), `listGguf`, `deleteFile`, `freeSpace`,
`requestLegacyStoragePermission` and `setSystemBars`.

The manifest now also declares `WRITE_EXTERNAL_STORAGE` (maxSdk 29) and
`preserveLegacyExternalStorage`. `MANAGE_EXTERNAL_STORAGE` was already there.
That permission is what Play Store review objects to; for a sideloaded APK
from your own CI it is not an issue, and the app degrades to its own folder
if the permission is refused.

I could not build the APK here — no Android SDK in this environment — so the
Kotlin is checked for parse errors and reviewed rather than compiled. The
TypeScript side is fully typechecked, linted and tested (16 tests).
