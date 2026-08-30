package com.offlineai.dockit

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipInputStream

/**
 * DocKit — the one native surface this app needs.
 *
 * Deliberately dependency-light: everything here uses the Android platform
 * plus PDFBox. No extra React Native community packages, because every one
 * of those is another thing that can break the CI build on an RN upgrade.
 *
 * Responsibilities:
 *   1. Picking files/images with the system picker (SAF).
 *   2. Turning anything the user picks into something a local model can
 *      actually consume: downscaled JPEGs, or extracted plain text.
 *   3. Resumable model downloads over HTTP Range, so a flaky connection
 *      continues where it stopped instead of starting from zero.
 *   4. Finding .gguf files the user downloaded themselves.
 *   5. Small system bits: clipboard, immersive mode, device RAM.
 */
class DocKitModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), ActivityEventListener {

    override fun getName() = "DocKit"

    private val io = Executors.newFixedThreadPool(3)
    private val downloads = ConcurrentHashMap<String, AtomicBoolean>()
    private var pickPromise: Promise? = null
    private var pdfBoxReady = false

    init {
        ctx.addActivityEventListener(this)
    }

    private fun emit(event: String, payload: WritableMap) {
        try {
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, payload)
        } catch (_: Throwable) {
            // React context torn down mid-flight; nothing to deliver to.
        }
    }

    private fun ensurePdfBox() {
        if (!pdfBoxReady) {
            PDFBoxResourceLoader.init(ctx.applicationContext)
            pdfBoxReady = true
        }
    }

    // ---------------------------------------------------------------
    // 1. File picking
    // ---------------------------------------------------------------

    private val REQ_PICK = 0xD0C1

    @ReactMethod
    fun pickFiles(options: ReadableMap, promise: Promise) {
        val activity = ctx.currentActivity
        if (activity == null) {
            promise.reject("no_activity", "No foreground activity to show a picker from.")
            return
        }
        if (pickPromise != null) {
            promise.reject("busy", "A file picker is already open.")
            return
        }
        val mimeTypes = options.getArray("mimeTypes")?.let { arr ->
            Array(arr.size()) { arr.getString(it) ?: "*/*" }
        } ?: arrayOf("*/*")
        val multiple = if (options.hasKey("multiple")) options.getBoolean("multiple") else true

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
            if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        pickPromise = promise
        try {
            activity.startActivityForResult(intent, REQ_PICK)
        } catch (e: Throwable) {
            pickPromise = null
            promise.reject("no_picker", "No file picker available on this device.", e)
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {
        if (requestCode != REQ_PICK) return
        val promise = pickPromise ?: return
        pickPromise = null

        if (resultCode != Activity.RESULT_OK || data == null) {
            promise.resolve(Arguments.createArray()) // user cancelled — not an error
            return
        }
        val uris = mutableListOf<Uri>()
        data.clipData?.let { clip ->
            for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
        }
        if (uris.isEmpty()) data.data?.let { uris.add(it) }

        val out = Arguments.createArray()
        for (uri in uris) {
            try {
                ctx.contentResolver.takePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: Throwable) {
                // Not all providers grant persistable permission; the
                // one-shot grant is enough since we copy immediately.
            }
            out.pushMap(describeUri(uri))
        }
        promise.resolve(out)
    }

    override fun onNewIntent(intent: Intent) {}

    private fun describeUri(uri: Uri): WritableMap {
        val map = Arguments.createMap()
        map.putString("uri", uri.toString())
        var name = uri.lastPathSegment ?: "file"
        var size = 0.0
        try {
            ctx.contentResolver.query(uri, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (ni >= 0 && !c.isNull(ni)) name = c.getString(ni)
                    val si = c.getColumnIndex(OpenableColumns.SIZE)
                    if (si >= 0 && !c.isNull(si)) size = c.getLong(si).toDouble()
                }
            }
        } catch (_: Throwable) {
        }
        map.putString("name", name)
        map.putDouble("size", size)
        map.putString("mime", ctx.contentResolver.getType(uri) ?: guessMime(name))
        return map
    }

    private fun guessMime(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "pdf" -> "application/pdf"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "txt", "log" -> "text/plain"
        "md", "markdown" -> "text/markdown"
        "csv" -> "text/csv"
        "json" -> "application/json"
        "gguf" -> "application/octet-stream"
        "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else -> "application/octet-stream"
    }

    // ---------------------------------------------------------------
    // 2. Turning a picked file into model-ready input
    // ---------------------------------------------------------------

    /**
     * Resolves a SAF URI to a plain filesystem path when one exists.
     *
     * This matters more than it looks: llama.cpp mmaps the model by real
     * path and re-checks permissions against the symlink target, so
     * handing it a /proc/self/fd/N descriptor from shared storage always
     * fails. Only a genuine path works.
     */
    @ReactMethod
    fun resolveRealPath(uriString: String, promise: Promise) {
        promise.resolve(resolveRealPathSync(uriString))
    }

    private fun resolveRealPathSync(uriString: String): String? {
        try {
            val uri = Uri.parse(uriString)
            if (uri.scheme == "file") return uri.path
            if (!DocumentsContract.isDocumentUri(ctx, uri)) return null
            val docId = DocumentsContract.getDocumentId(uri)

            // "raw:/storage/emulated/0/Download/model.gguf" — the easy case.
            if (docId.startsWith("raw:")) {
                val p = docId.removePrefix("raw:")
                if (File(p).canRead()) return p
            }
            // "primary:Download/model.gguf" on the external storage provider.
            if (uri.authority == "com.android.externalstorage.documents") {
                val parts = docId.split(":", limit = 2)
                if (parts.size == 2 && parts[0].equals("primary", true)) {
                    val p = File(Environment.getExternalStorageDirectory(), parts[1])
                    if (p.canRead()) return p.absolutePath
                }
            }
            // Fall back to matching on name + size inside the usual folders.
            val meta = describeUri(uri)
            val name = meta.getString("name") ?: return null
            val size = meta.getDouble("size").toLong()
            for (dir in candidateDirs()) {
                val f = File(dir, name)
                if (f.canRead() && (size <= 0L || f.length() == size)) return f.absolutePath
            }
        } catch (_: Throwable) {
        }
        return null
    }

    private fun candidateDirs(): List<File> = listOfNotNull(
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS),
        File(Environment.getExternalStorageDirectory(), "Download"),
        File(Environment.getExternalStorageDirectory(), "Models"),
        ctx.getExternalFilesDir(null)
    ).filter { it.isDirectory }

    private fun cacheDir(sub: String): File =
        File(ctx.cacheDir, sub).also { it.mkdirs() }

    /**
     * Reads whatever the user picked and returns something usable:
     *   images -> a downscaled JPEG on disk (path)
     *   PDFs   -> extracted text, plus page images if there's no text layer
     *   office -> extracted text
     *   text   -> the text itself
     */
    @ReactMethod
    fun prepareAttachment(uriString: String, options: ReadableMap, promise: Promise) {
        io.execute {
            try {
                val uri = Uri.parse(uriString)
                val meta = describeUri(uri)
                val name = meta.getString("name") ?: "file"
                val mime = meta.getString("mime") ?: guessMime(name)
                val maxImageDim = if (options.hasKey("maxImageDim")) options.getInt("maxImageDim") else 896
                val maxChars = if (options.hasKey("maxChars")) options.getInt("maxChars") else 24000
                val maxPdfPages = if (options.hasKey("maxPdfPages")) options.getInt("maxPdfPages") else 8

                val result = Arguments.createMap()
                result.putString("name", name)
                result.putString("mime", mime)
                result.putDouble("size", meta.getDouble("size"))
                result.putString("uri", uriString)

                when {
                    mime.startsWith("image/") -> {
                        val path = downscaleImage(uri, maxImageDim, name)
                        result.putString("kind", "image")
                        result.putString("path", path)
                    }

                    mime == "application/pdf" || name.endsWith(".pdf", true) -> {
                        result.putString("kind", "pdf")
                        val local = copyToCache(uri, "docs", name)
                        val text = extractPdfText(local, maxChars)
                        result.putInt("pageCount", pdfPageCount(local))
                        if (text.trim().length >= 40) {
                            result.putString("text", text)
                            result.putBoolean("hasTextLayer", true)
                        } else {
                            // Scanned document — no text to pull out, so give
                            // the vision model page images instead.
                            result.putBoolean("hasTextLayer", false)
                            val pages = Arguments.createArray()
                            renderPdfToImages(local, maxPdfPages, maxImageDim).forEach {
                                pages.pushString(it)
                            }
                            result.putArray("pageImages", pages)
                        }
                        // Always give the first page as a thumbnail.
                        renderPdfToImages(local, 1, 320).firstOrNull()?.let {
                            result.putString("previewPath", it)
                        }
                    }

                    name.endsWith(".docx", true) || name.endsWith(".pptx", true) ||
                        name.endsWith(".xlsx", true) -> {
                        val local = copyToCache(uri, "docs", name)
                        result.putString("kind", "document")
                        result.putString("text", extractOfficeText(local, maxChars))
                    }

                    else -> {
                        result.putString("kind", "text")
                        result.putString("text", readText(uri, maxChars))
                    }
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                promise.reject("prepare_failed", e.message ?: "Could not read that file.", e)
            }
        }
    }

    private fun copyToCache(uri: Uri, sub: String, name: String): File {
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val out = File(cacheDir(sub), "${System.currentTimeMillis()}_$safe")
        ctx.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Could not open $name" }
            FileOutputStream(out).use { input.copyTo(it, 64 * 1024) }
        }
        return out
    }

    /**
     * Big photos are the single easiest way to make a phone-sized vision
     * model slow and hot — a 12MP image becomes thousands of tokens. We
     * cap the long edge before it ever reaches the model.
     */
    private fun downscaleImage(uri: Uri, maxDim: Int, name: String): String {
        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        ctx.contentResolver.openInputStream(uri).use {
            android.graphics.BitmapFactory.decodeStream(it, null, bounds)
        }
        var sample = 1
        while (bounds.outWidth / sample > maxDim * 2 || bounds.outHeight / sample > maxDim * 2) {
            sample *= 2
        }
        val opts = android.graphics.BitmapFactory.Options().apply { inSampleSize = sample }
        val decoded = ctx.contentResolver.openInputStream(uri).use {
            android.graphics.BitmapFactory.decodeStream(it, null, opts)
        } ?: throw IllegalStateException("Could not decode $name")

        val scale = maxDim.toFloat() / maxOf(decoded.width, decoded.height)
        val bmp = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                decoded, (decoded.width * scale).toInt().coerceAtLeast(1),
                (decoded.height * scale).toInt().coerceAtLeast(1), true
            )
        } else decoded

        val out = File(cacheDir("images"), "img_${System.currentTimeMillis()}.jpg")
        FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        if (bmp !== decoded) bmp.recycle()
        decoded.recycle()
        return out.absolutePath
    }

    private fun pdfPageCount(file: File): Int = try {
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
            PdfRenderer(pfd).use { it.pageCount }
        }
    } catch (_: Throwable) {
        0
    }

    private fun extractPdfText(file: File, maxChars: Int): String = try {
        ensurePdfBox()
        PDDocument.load(file).use { doc ->
            val stripper = PDFTextStripper()
            stripper.sortByPosition = true
            val sb = StringBuilder()
            var page = 1
            while (page <= doc.numberOfPages && sb.length < maxChars) {
                stripper.startPage = page
                stripper.endPage = page
                sb.append("\n--- Page $page ---\n").append(stripper.getText(doc))
                page++
            }
            if (sb.length > maxChars) sb.substring(0, maxChars) else sb.toString()
        }
    } catch (_: Throwable) {
        ""
    }

    private fun renderPdfToImages(file: File, maxPages: Int, maxDim: Int): List<String> {
        val paths = mutableListOf<String>()
        try {
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
                PdfRenderer(pfd).use { renderer ->
                    val n = minOf(renderer.pageCount, maxPages)
                    for (i in 0 until n) {
                        renderer.openPage(i).use { page ->
                            val scale = maxDim.toFloat() / maxOf(page.width, page.height)
                            val w = (page.width * scale).toInt().coerceAtLeast(1)
                            val h = (page.height * scale).toInt().coerceAtLeast(1)
                            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                            bmp.eraseColor(Color.WHITE) // PDFs render transparent otherwise
                            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            val out = File(cacheDir("images"), "pdf_${System.currentTimeMillis()}_$i.jpg")
                            FileOutputStream(out).use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it) }
                            bmp.recycle()
                            paths.add(out.absolutePath)
                        }
                    }
                }
            }
        } catch (_: Throwable) {
        }
        return paths
    }

    /** Pulls readable text out of an OOXML file by unzipping it and stripping tags. */
    private fun extractOfficeText(file: File, maxChars: Int): String {
        val sb = StringBuilder()
        try {
            ZipInputStream(file.inputStream().buffered()).use { zip ->
                var entry = zip.nextEntry
                while (entry != null && sb.length < maxChars) {
                    val n = entry.name
                    val wanted = n == "word/document.xml" ||
                        (n.startsWith("ppt/slides/slide") && n.endsWith(".xml")) ||
                        n == "xl/sharedStrings.xml" ||
                        (n.startsWith("xl/worksheets/sheet") && n.endsWith(".xml"))
                    if (wanted) {
                        val xml = zip.readBytes().toString(Charsets.UTF_8)
                        sb.append(stripXml(xml)).append('\n')
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
        } catch (_: Throwable) {
        }
        val text = sb.toString()
        return if (text.length > maxChars) text.substring(0, maxChars) else text
    }

    private fun stripXml(xml: String): String = xml
        .replace(Regex("</w:p>|</a:p>|</w:tr>"), "\n")
        .replace(Regex("<w:tab[^>]*/>"), "\t")
        .replace(Regex("<[^>]+>"), "")
        .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        .replace("&quot;", "\"").replace("&apos;", "'")
        .replace(Regex("[ \\t]{2,}"), " ")
        .replace(Regex("\n{3,}"), "\n\n")
        .trim()

    private fun readText(uri: Uri, maxChars: Int): String {
        val bytes = ctx.contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Could not open file" }
            val buf = ByteArray(maxChars * 2)
            var read = 0
            while (read < buf.size) {
                val r = input.read(buf, read, buf.size - read)
                if (r <= 0) break
                read += r
            }
            buf.copyOf(read)
        }
        val text = String(bytes, Charsets.UTF_8)
        return if (text.length > maxChars) text.substring(0, maxChars) else text
    }

    // ---------------------------------------------------------------
    // 3. Resumable downloads
    // ---------------------------------------------------------------

    /**
     * Downloads with an HTTP Range header so an interrupted transfer picks
     * up where it stopped. Multi-gigabyte model files over mobile data are
     * exactly the case where restarting from zero is unacceptable.
     */
    @ReactMethod
    fun startDownload(id: String, url: String, destPath: String) {
        val cancelled = AtomicBoolean(false)
        downloads[id] = cancelled
        io.execute {
            val part = File("$destPath.part")
            part.parentFile?.mkdirs()
            var attempt = 0
            var lastError = "Download failed."

            while (attempt < 4 && !cancelled.get()) {
                attempt++
                var conn: HttpURLConnection? = null
                try {
                    val have = if (part.exists()) part.length() else 0L
                    conn = (URL(url).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 30_000
                        readTimeout = 60_000
                        instanceFollowRedirects = true
                        setRequestProperty("User-Agent", "OfflineAI/2.0 (Android)")
                        setRequestProperty("Accept-Encoding", "identity")
                        if (have > 0) setRequestProperty("Range", "bytes=$have-")
                    }
                    val code = conn.responseCode
                    if (code == 416) { // already complete
                        finishDownload(id, part, File(destPath)); return@execute
                    }
                    if (code !in 200..299) {
                        lastError = "Server returned HTTP $code."
                        if (code in 400..499 && code != 429) break // not worth retrying
                        Thread.sleep(1500L * attempt); continue
                    }
                    val resuming = code == 206 && have > 0
                    if (!resuming && have > 0) part.delete() // server ignored Range
                    val startAt = if (resuming) have else 0L
                    val total = startAt + conn.contentLengthLong.coerceAtLeast(0L)

                    RandomAccessFile(part, "rw").use { raf ->
                        raf.seek(startAt)
                        conn.inputStream.use { input ->
                            val buf = ByteArray(256 * 1024)
                            var written = startAt
                            var lastEmit = 0L
                            while (true) {
                                if (cancelled.get()) return@execute
                                val n = input.read(buf)
                                if (n <= 0) break
                                raf.write(buf, 0, n)
                                written += n
                                val now = System.currentTimeMillis()
                                if (now - lastEmit > 250) {
                                    lastEmit = now
                                    emit("DocKitDownloadProgress", Arguments.createMap().apply {
                                        putString("id", id)
                                        putDouble("written", written.toDouble())
                                        putDouble("total", total.toDouble())
                                    })
                                }
                            }
                        }
                    }
                    finishDownload(id, part, File(destPath))
                    return@execute
                } catch (e: Throwable) {
                    lastError = e.message ?: "Network error."
                    try { Thread.sleep(1500L * attempt) } catch (_: InterruptedException) {}
                } finally {
                    conn?.disconnect()
                }
            }

            downloads.remove(id)
            if (!cancelled.get()) {
                emit("DocKitDownloadError", Arguments.createMap().apply {
                    putString("id", id)
                    putString("message", lastError)
                    putBoolean("resumable", part.exists() && part.length() > 0)
                })
            }
        }
    }

    private fun finishDownload(id: String, part: File, dest: File) {
        if (dest.exists()) dest.delete()
        val ok = part.renameTo(dest)
        downloads.remove(id)
        if (ok) {
            emit("DocKitDownloadDone", Arguments.createMap().apply {
                putString("id", id)
                putString("path", dest.absolutePath)
                putDouble("size", dest.length().toDouble())
            })
        } else {
            emit("DocKitDownloadError", Arguments.createMap().apply {
                putString("id", id)
                putString("message", "Could not move the finished file into place.")
                putBoolean("resumable", true)
            })
        }
    }

    /** Stops the transfer but keeps the .part file, so it can resume later. */
    @ReactMethod
    fun pauseDownload(id: String) {
        downloads.remove(id)?.set(true)
    }

    /** Stops the transfer and throws away the partial file. */
    @ReactMethod
    fun cancelDownload(id: String, destPath: String) {
        downloads.remove(id)?.set(true)
        io.execute {
            try { Thread.sleep(300) } catch (_: InterruptedException) {}
            File("$destPath.part").delete()
        }
    }

    @ReactMethod
    fun partialSize(destPath: String, promise: Promise) {
        val f = File("$destPath.part")
        promise.resolve(if (f.exists()) f.length().toDouble() else 0.0)
    }

    // ---------------------------------------------------------------
    // 4. Finding models the user downloaded themselves
    // ---------------------------------------------------------------

    @ReactMethod
    fun scanForModels(promise: Promise) {
        io.execute {
            val out = Arguments.createArray()
            val seen = HashSet<String>()
            for (dir in candidateDirs()) {
                try {
                    dir.walkTopDown().maxDepth(2).forEach { f ->
                        if (f.isFile && f.name.endsWith(".gguf", true) && seen.add(f.absolutePath)) {
                            out.pushMap(Arguments.createMap().apply {
                                putString("path", f.absolutePath)
                                putString("name", f.name)
                                putDouble("size", f.length().toDouble())
                                putBoolean("isMmproj", f.name.contains("mmproj", true))
                            })
                        }
                    }
                } catch (_: Throwable) {
                }
            }
            promise.resolve(out)
        }
    }

    @ReactMethod
    fun copyToModels(uriString: String, fileName: String, destDir: String, promise: Promise) {
        io.execute {
            try {
                val dir = File(destDir).also { it.mkdirs() }
                val dest = File(dir, fileName)
                ctx.contentResolver.openInputStream(Uri.parse(uriString)).use { input ->
                    requireNotNull(input) { "Could not open the selected file." }
                    FileOutputStream(dest).use { input.copyTo(it, 1 shl 20) }
                }
                promise.resolve(dest.absolutePath)
            } catch (e: Throwable) {
                promise.reject("copy_failed", e.message ?: "Copy failed.", e)
            }
        }
    }

    // ---------------------------------------------------------------
    // 5. System odds and ends
    // ---------------------------------------------------------------

    @ReactMethod
    fun setClipboard(text: String) {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("Offline AI", text))
    }

    @ReactMethod
    fun openUrl(url: String, promise: Promise) {
        try {
            val i = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("no_browser", "Nothing on this device can open that link.", e)
        }
    }

    /**
     * Immersive mode. The bars stay swipe-reachable rather than being gone
     * for good — losing the back gesture in a chat app would be worse than
     * the few pixels it reclaims.
     */
    @ReactMethod
    fun setImmersive(enabled: Boolean) {
        val activity = ctx.currentActivity ?: return
        activity.runOnUiThread {
            val window = activity.window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            if (enabled) {
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    @ReactMethod
    fun setKeepScreenOn(enabled: Boolean) {
        val activity = ctx.currentActivity ?: return
        activity.runOnUiThread {
            if (enabled) {
                activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val mi = android.app.ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        promise.resolve(Arguments.createMap().apply {
            putDouble("totalRamBytes", mi.totalMem.toDouble())
            putDouble("availRamBytes", mi.availMem.toDouble())
            putInt("cores", Runtime.getRuntime().availableProcessors())
            putString("model", "${Build.MANUFACTURER} ${Build.MODEL}")
            putInt("sdk", Build.VERSION.SDK_INT)
            putString(
                "downloadsDir",
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath
            )
            putDouble("freeDiskBytes", ctx.filesDir.usableSpace.toDouble())
        })
    }

    @ReactMethod
    fun hasAllFilesAccess(promise: Promise) {
        promise.resolve(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Environment.isExternalStorageManager()
            else true
        )
    }

    /**
     * Opens the system screen for all-files access. This is only needed to
     * load a .gguf straight from Downloads without copying it; the picker
     * path works without it, so the app never forces the user here.
     */
    @ReactMethod
    fun requestAllFilesAccess(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val i = Intent(
                    android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                    Uri.parse("package:${ctx.packageName}")
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(i)
            }
            promise.resolve(true)
        } catch (e: Throwable) {
            promise.reject("no_settings", e.message ?: "Could not open settings.", e)
        }
    }

    @ReactMethod fun addListener(eventName: String) {}

    @ReactMethod fun removeListeners(count: Int) {}
}
