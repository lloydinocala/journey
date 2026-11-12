package com.ventexiq.journey;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Journey's own native features (caller ID + call logging) — registered before the bridge starts.
        registerPlugin(JourneyCallsPlugin.class);
        registerPlugin(JourneySpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
