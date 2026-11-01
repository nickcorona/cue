package com.nickcorona.cue

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.concurrent.thread

// Quick capture as a sheet over whatever's on screen: Home's + capture, the widget's +, the
// launcher icon's long-press shortcut, or text shared from another app. Enter saves and keeps
// the sheet open for the next thing, so a brain dump is type, Enter, type; each line shows what
// Cue made of it. Speak transcribes on the phone itself, since the usual voice popup belongs to
// the Google app, which the guard may block.
class CaptureActivity : Activity() {
    private lateinit var box: EditText
    private lateinit var log: LinearLayout
    private lateinit var mic: TextView
    private var speech: SpeechRecognizer? = null
    private var shared = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Cue.key(this) == null) {
            startActivity(Intent(this, MainActivity::class.java))
            finish(); return
        }
        window.setGravity(Gravity.BOTTOM)
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val text = listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT))
            .filter { it.isNotBlank() }.distinct().joinToString(" ")
        shared = text.isNotEmpty()

        box = EditText(this).apply {
            hint = "What's on your mind?"
            textSize = 20f
            setTextColor(FG)
            setHintTextColor(DIM)
            background = null
            setPadding(0, dp(6), 0, dp(6))
            // Wraps like a multi-line box, but Enter is "save" rather than a new line.
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setHorizontallyScrolling(false)
            maxLines = 5
            imeOptions = EditorInfo.IME_ACTION_DONE
            setText(text)
            setSelection(this.text.length)
            setOnEditorActionListener { _, id, _ -> if (id == EditorInfo.IME_ACTION_DONE) { add(); true } else false }
        }
        mic = text("speak", 16f, DIM) { listen() }.apply { setPadding(0, dp(10), dp(24), dp(10)) }
        log = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(18), dp(24), dp(12))
            background = GradientDrawable().apply {
                setColor(SHEET)
                cornerRadii = FloatArray(8) { if (it < 4) dp(20).toFloat() else 0f }
            }
            addView(label("Capture").apply { setPadding(0, 0, 0, dp(2)) })
            addView(box)
            addView(LinearLayout(context).apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(mic)
                addView(text("Enter saves · tap outside when done", 12f, DIM),
                    LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                addView(text("add", 17f, ACCENT) { add() }.apply { setPadding(dp(16), dp(10), 0, dp(10)) })
            })
            addView(log)
        })
        box.requestFocus()
    }

    override fun onDestroy() {
        speech?.destroy()
        super.onDestroy()
    }

    // Saved in the background while he types the next one; the line under the box fills in
    // with what Cue made of it (or says it failed, with the text kept so nothing is lost).
    private fun add() {
        val t = box.text.toString().trim()
        if (t.isEmpty()) return finish()
        box.setText("")
        val row = text("…  $t", 14f, DIM).apply { setPadding(0, dp(4), 0, dp(4)); maxLines = 2 }
        log.addView(row, 0)
        val app = applicationContext
        thread {
            val r = runCatching { Capture.send(app, t) }
            runOnUiThread {
                row.text = r.fold({ "✓  $it" }, { "✗  Couldn't save \"$t\": ${it.message?.take(40)}" })
                row.setTextColor(if (r.isSuccess) FG else 0xFFE07A6F.toInt())
                if (shared && r.isSuccess) finish()
            }
            NowWidget.refresh(app)
        }
    }

    private fun listen() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 1)
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            mic.text = "no voice input on this phone"
            return
        }
        val before = box.text.toString().trim()
        val sr = speech ?: SpeechRecognizer.createSpeechRecognizer(this).also { speech = it }
        fun put(words: String?) {
            if (words.isNullOrBlank()) return
            box.setText(listOf(before, words).filter { it.isNotEmpty() }.joinToString(" "))
            box.setSelection(box.text.length)
        }
        sr.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) { mic.text = "listening…"; mic.setTextColor(FG) }
            override fun onPartialResults(b: Bundle?) = put(b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull())
            override fun onResults(b: Bundle?) { put(b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()); idle() }
            override fun onError(e: Int) = idle()
            override fun onEndOfSpeech() {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEvent(t: Int, b: Bundle?) {}
            private fun idle() { mic.text = "speak"; mic.setTextColor(DIM) }
        })
        sr.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true))
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, perms, results)
        if (results.firstOrNull() == PackageManager.PERMISSION_GRANTED) listen()
    }
}
