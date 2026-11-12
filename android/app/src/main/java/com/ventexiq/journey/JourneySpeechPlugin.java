package com.ventexiq.journey;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

/**
 * Voice typing with Android's own speech input (the Google voice box). The app's web view
 * can't do speech-to-text by itself, so the mic buttons in Journey come here.
 */
@CapacitorPlugin(name = "JourneySpeech")
public class JourneySpeechPlugin extends Plugin {

    @PluginMethod
    public void listen(PluginCall call) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        String lang = call.getString("lang", "en-US");
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        String prompt = call.getString("prompt");
        if (prompt != null) i.putExtra(RecognizerIntent.EXTRA_PROMPT, prompt);
        try {
            startActivityForResult(call, i, "heard");
        } catch (ActivityNotFoundException e) {
            call.reject("Voice input isn't available on this phone. Install or turn on the Google app.", "UNAVAILABLE");
        }
    }

    @ActivityCallback
    private void heard(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            ArrayList<String> words = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            r.put("text", words != null && !words.isEmpty() ? words.get(0) : "");
        } else {
            r.put("text", "");
            r.put("cancelled", true);
        }
        call.resolve(r);
    }
}
