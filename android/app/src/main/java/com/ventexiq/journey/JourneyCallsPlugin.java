package com.ventexiq.journey;

import android.Manifest;
import android.app.role.RoleManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.os.Build;
import android.provider.CallLog;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;

/**
 * Journey's phone features for the Call Console:
 *  - caller ID while a call rings (the "caller ID & spam" role),
 *  - reading the call history so finished calls are logged in Journey,
 *  - keeping the company phone book on the phone.
 */
@CapacitorPlugin(
    name = "JourneyCalls",
    permissions = {
        @Permission(alias = "callLog", strings = { Manifest.permission.READ_CALL_LOG }),
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class JourneyCallsPlugin extends Plugin {

    @PluginMethod
    public void configure(PluginCall call) {
        JSArray dir = call.getArray("directory");
        JSONArray a = null;
        if (dir != null) a = dir;
        CallDirectory.save(getContext(), call.getString("deviceKey"), call.getString("apiUrl"), call.getString("apiKey"), a);
        call.resolve();
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        CallDirectory.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("callerId", hasScreeningRole());
        r.put("callerIdAvailable", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q);
        r.put("callLog", getPermissionState("callLog") == PermissionState.GRANTED);
        r.put("contacts", getPermissionState("contacts") == PermissionState.GRANTED);
        r.put("notifications", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(r);
    }

    private boolean hasScreeningRole() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false;
        RoleManager rm = (RoleManager) getContext().getSystemService(Context.ROLE_SERVICE);
        return rm != null && rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING);
    }

    /** Asks to become the phone's caller-ID app (shows Android's own prompt). */
    @PluginMethod
    public void requestCallerId(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) { call.reject("Needs Android 10 or newer."); return; }
        if (hasScreeningRole()) { JSObject r = new JSObject(); r.put("granted", true); call.resolve(r); return; }
        RoleManager rm = (RoleManager) getContext().getSystemService(Context.ROLE_SERVICE);
        if (rm == null || !rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) { call.reject("This phone doesn't offer a caller-ID setting."); return; }
        Intent i = rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING);
        startActivityForResult(call, i, "roleResult");
    }

    @ActivityCallback
    private void roleResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        r.put("granted", hasScreeningRole());
        call.resolve(r);
    }

    /** Asks for call history, contacts and notifications together. */
    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) requestPermissionForAliases(new String[] { "callLog", "contacts", "notifications" }, call, "accessResult");
        else requestPermissionForAliases(new String[] { "callLog", "contacts" }, call, "accessResult");
    }

    @PermissionCallback
    private void accessResult(PluginCall call) { status(call); }

    /** Calls since a time (ms), newest last. Personal calls (numbers in the phone's contacts but not in Journey) are flagged. */
    @PluginMethod
    public void recentCalls(PluginCall call) {
        if (getPermissionState("callLog") != PermissionState.GRANTED) { call.reject("No call history access."); return; }
        long since = call.getLong("since", System.currentTimeMillis() - 24L * 3600 * 1000);
        JSArray out = new JSArray();
        String[] cols = { CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION };
        try (Cursor c = getContext().getContentResolver().query(CallLog.Calls.CONTENT_URI, cols,
                CallLog.Calls.DATE + " > ?", new String[] { String.valueOf(since) }, CallLog.Calls.DATE + " ASC LIMIT 300")) {
            if (c != null) {
                while (c.moveToNext()) {
                    String num = c.getString(1);
                    int type = c.getInt(2);
                    String t;
                    switch (type) {
                        case CallLog.Calls.INCOMING_TYPE: t = "answered"; break;
                        case CallLog.Calls.MISSED_TYPE: t = "missed"; break;
                        case CallLog.Calls.REJECTED_TYPE: t = "missed"; break;
                        case CallLog.Calls.OUTGOING_TYPE: t = "outgoing"; break;
                        default: t = "other";
                    }
                    String[] who = CallDirectory.lookup(getContext(), num);
                    JSObject o = new JSObject();
                    o.put("id", c.getString(0));
                    o.put("phone", num);
                    o.put("event", t);
                    o.put("at", c.getLong(3));
                    o.put("duration", c.getInt(4));
                    o.put("known", who != null);
                    o.put("personal", who == null && CallDirectory.inPhoneContacts(getContext(), num));
                    out.put(o);
                }
            }
        } catch (Exception e) {
            call.reject("Couldn't read call history: " + e.getMessage());
            return;
        }
        JSObject r = new JSObject();
        r.put("calls", out);
        call.resolve(r);
    }
}
