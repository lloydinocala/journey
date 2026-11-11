package com.ventexiq.journey;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Sends a call event to Journey from the background (no sign-in token needed — uses the device key). */
final class CallReporter {
    private CallReporter() {}

    static void report(Context c, String phone, String event, String extId) {
        SharedPreferences p = CallDirectory.prefs(c);
        final String key = p.getString("deviceKey", null);
        final String url = p.getString("apiUrl", null);
        final String apiKey = p.getString("apiKey", null);
        if (key == null || url == null || apiKey == null) return;
        new Thread(() -> {
            HttpURLConnection con = null;
            try {
                JSONObject body = new JSONObject();
                body.put("p_key", key);
                body.put("p_phone", phone);
                body.put("p_event", event);
                if (extId != null) body.put("p_ext_id", extId);
                con = (HttpURLConnection) new URL(url + "/rest/v1/rpc/report_call_event").openConnection();
                con.setRequestMethod("POST");
                con.setConnectTimeout(8000);
                con.setReadTimeout(8000);
                con.setDoOutput(true);
                con.setRequestProperty("Content-Type", "application/json");
                con.setRequestProperty("apikey", apiKey);
                try (OutputStream os = con.getOutputStream()) { os.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
                con.getResponseCode();
            } catch (Exception ignored) {
                // No signal: the call is still picked up from the call log once the app is back online.
            } finally {
                if (con != null) con.disconnect();
            }
        }).start();
    }
}
