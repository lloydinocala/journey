package com.ventexiq.journey;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import androidx.annotation.RequiresApi;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Sees each incoming call while it rings (Android only lets the phone's chosen caller-ID app do this).
 * Never blocks or changes the call — it names the caller from the Journey phone book, shows a
 * notification that opens the Call Console on that caller, and tells Journey a call is ringing.
 * Numbers saved in the phone's own contacts are treated as personal and left alone.
 */
@RequiresApi(api = Build.VERSION_CODES.N)
public class JourneyScreeningService extends CallScreeningService {
    static final String CHANNEL = "journey_calls";

    @Override
    public void onScreenCall(Call.Details details) {
        // Always let the call through, untouched.
        respondToCall(details, new CallResponse.Builder().build());
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && details.getCallDirection() != Call.Details.DIRECTION_INCOMING) return;
            Uri handle = details.getHandle();
            String phone = handle == null ? null : handle.getSchemeSpecificPart();
            if (phone == null || CallDirectory.last10(phone).length() < 10) return;
            if (CallDirectory.prefs(this).getString("deviceKey", null) == null) return; // not signed in to Journey on this phone
            String[] who = CallDirectory.lookup(this, phone);
            if (who == null && CallDirectory.inPhoneContacts(this, phone)) return; // personal contact
            notifyRinging(this, phone, who);
            CallReporter.report(this, phone, "ringing", null);
        } catch (Exception ignored) { }
    }

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Names business callers and opens the Call Console");
            NotificationManager nm = c.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    static void notifyRinging(Context c, String phone, String[] who) {
        ensureChannel(c);
        String d = CallDirectory.last10(phone);
        String title = who != null ? "📞 " + who[0] : "📞 " + CallDirectory.pretty(phone);
        String text = who != null
                ? CallDirectory.label(who[1]) + " · " + CallDirectory.pretty(phone) + " · tap to open the Call Console"
                : "Not in Journey yet · tap to open the Call Console";
        Intent open = new Intent(c, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.setData(Uri.parse("https://journey-hvac.app/tech/field/calls?phone=" + d));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, d.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setTimeoutAfter(10 * 60 * 1000)
                .setContentIntent(pi);
        try { NotificationManagerCompat.from(c).notify(7000 + Math.abs(d.hashCode() % 1000), b.build()); } catch (SecurityException ignored) { }
    }
}
