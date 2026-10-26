package com.myphone.tvremote

import android.inputmethodservice.InputMethodService
import android.text.InputType
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.ExtractedTextRequest

/**
 * "מקלדת" בלתי נראית שמקבלת טקסט מהטלפון וכותבת אותו לשדה שבחרו בטלוויזיה.
 * ככה אפשר לכתוב בעברית (או כל שפה), מה ש-"input text" של אנדרואיד לא יודע לעשות.
 */
class RemoteIme : InputMethodService() {

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    // בלי מקלדת על המסך: מקלידים מהטלפון
    override fun onEvaluateInputViewShown() = false

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        hasTextField = attribute != null && attribute.inputType != InputType.TYPE_NULL
    }

    override fun onFinishInput() {
        hasTextField = false
        super.onFinishInput()
    }

    /** מחליף את כל מה שכתוב בשדה בטקסט החדש. */
    fun replaceText(text: String): Boolean {
        val ic = currentInputConnection ?: return false
        if (!hasTextField) return false
        ic.beginBatchEdit()
        val current = ic.getExtractedText(ExtractedTextRequest(), 0)?.text
        if (current != null) {
            ic.setSelection(0, current.length)
        } else {
            ic.deleteSurroundingText(1000, 1000)
        }
        ic.commitText(text, 1)
        ic.endBatchEdit()
        return true
    }

    /** כמו ללחוץ "חיפוש" / "אישור" במקלדת. */
    fun submit(): Boolean {
        if (!hasTextField) return false
        return sendDefaultEditorAction(true)
    }

    companion object {
        @Volatile var instance: RemoteIme? = null
            private set
        @Volatile var hasTextField = false
            private set
    }
}
