package com.zhio.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/** Persists the small, non-sensitive snapshot rendered by the launcher widget. */
@CapacitorPlugin(name = "CycleWidget")
public class CycleWidgetPlugin extends Plugin {
    static final String PREFS = "cycle_widget_snapshot";

    @PluginMethod
    public void updateWidget(PluginCall call) {
        JSObject data = call.getObject("snapshot");
        if (data == null) {
            call.reject("snapshot is required");
            return;
        }
        SharedPreferences.Editor editor = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        editor.putInt("schemaVersion", data.optInt("schemaVersion", 1));
        editor.putString("updatedAt", data.optString("updatedAt", ""));
        editor.putString("phase", data.optString("phase", ""));
        editor.putInt("phaseDay", data.optInt("phaseDay", 1));
        editor.putInt("daysUntilPeriod", data.optInt("daysUntilNextPeriod", 0));
        editor.putString("predictedDate", data.optString("nextPeriodStart", ""));
        editor.putBoolean("hasData", data.optBoolean("hasData", false));
        // SharedPreferences cannot hold arrays, so the comparison rows are
        // flattened to "cycle:period,cycle:period" (oldest first).
        editor.putString("recentCycles", flattenCycleRows(data.optJSONArray("recentCycles")));
        editor.putInt("averageCycleLength", data.optInt("averageCycleLength", 0));
        editor.putInt("barScale", data.optInt("barScale", 0));
        editor.apply();
        CycleWidgetProvider.updateAll(getContext());
        call.resolve();
    }

    /** Returns "" for a missing or unusable array so the widget falls back cleanly. */
    private static String flattenCycleRows(JSONArray rows) {
        if (rows == null) return "";
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < rows.length(); index += 1) {
            JSONObject row = rows.optJSONObject(index);
            if (row == null) continue;
            int cycleLength = row.optInt("cycleLength", 0);
            int periodLength = row.optInt("periodLength", 0);
            if (cycleLength <= 0 || periodLength <= 0) continue;
            if (builder.length() > 0) builder.append(',');
            builder.append(cycleLength).append(':').append(periodLength);
        }
        return builder.toString();
    }

    @PluginMethod
    public void clearWidget(PluginCall call) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        CycleWidgetProvider.updateAll(getContext());
        call.resolve();
    }
}
