package com.ventexiq.journey;

import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

/**
 * The company phone book kept on the phone (synced from Journey while online), so an incoming
 * call can be named instantly — even with no signal — plus the device key used to report calls.
 */
public final class CallDirectory {
    static final String PREFS = "journey_calls";
    private static Map<String, String[]> cache;
    private static long cacheStamp = -1;

    private CallDirectory() {}

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static String last10(String phone) {
        if (phone == null) return "";
        String d = phone.replaceAll("\\D", "");
        return d.length() > 10 ? d.substring(d.length() - 10) : d;
    }

    static void save(Context c, String key, String apiUrl, String apiKey, JSONArray dir) {
        SharedPreferences.Editor e = prefs(c).edit();
        if (key != null) e.putString("deviceKey", key);
        if (apiUrl != null) e.putString("apiUrl", apiUrl);
        if (apiKey != null) e.putString("apiKey", apiKey);
        if (dir != null) e.putString("directory", dir.toString());
        e.putLong("stamp", System.currentTimeMillis());
        e.apply();
        cache = null;
    }

    static void clear(Context c) { prefs(c).edit().clear().apply(); cache = null; }

    /** Returns { name, type } for a number, or null when Journey doesn't know it. */
    static synchronized String[] lookup(Context c, String phone) {
        SharedPreferences p = prefs(c);
        long stamp = p.getLong("stamp", 0);
        if (cache == null || stamp != cacheStamp) {
            cache = new HashMap<>();
            try {
                JSONArray a = new JSONArray(p.getString("directory", "[]"));
                for (int i = 0; i < a.length(); i++) {
                    JSONObject o = a.getJSONObject(i);
                    String num = o.optString("p");
                    if (num.length() == 10 && !cache.containsKey(num)) cache.put(num, new String[] { o.optString("n"), o.optString("t") });
                }
            } catch (Exception ignored) { }
            cacheStamp = stamp;
        }
        return cache.get(last10(phone));
    }

    /** True when the number is saved in the phone's own contacts (personal or not). */
    static boolean inPhoneContacts(Context c, String phone) {
        if (phone == null || phone.isEmpty()) return false;
        try (Cursor cur = c.getContentResolver().query(
                Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phone)),
                new String[] { ContactsContract.PhoneLookup._ID }, null, null, null)) {
            return cur != null && cur.moveToFirst();
        } catch (Exception e) {
            return false; // no contacts permission
        }
    }

    static String label(String type) {
        if (type == null) return "";
        switch (type) {
            case "customer": return "Customer";
            case "vendor": return "Vendor";
            case "employee": return "Employee";
            case "known_other": return "Known contact";
            default: return "";
        }
    }

    static String pretty(String phone) {
        String d = last10(phone);
        return d.length() == 10 ? "(" + d.substring(0, 3) + ") " + d.substring(3, 6) + "-" + d.substring(6) : (phone == null ? "" : phone);
    }
}
