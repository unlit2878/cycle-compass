package com.zhio.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.util.ArrayList;
import java.util.List;

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
    public void requestPinWidget(PluginCall call) {
        Class<?> providerClass = resolveProvider(call.getString("size", "medium"));
        if (providerClass == null) {
            call.reject("size must be medium or large");
            return;
        }

        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.put("supported", false);
            result.put("requested", false);
            result.put("pinnedCount", 0);
            call.resolve(result);
            return;
        }

        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        boolean supported = manager.isRequestPinAppWidgetSupported();
        // `requested` only means the system handed the request to the default
        // launcher's confirmation activity. It is NOT a promise that the dialog
        // was drawn, confirmed, or that anything landed on the home screen, so
        // the caller has to observe pinnedCount to learn the real outcome.
        boolean requested = supported && manager.requestPinAppWidget(
            new ComponentName(getContext(), providerClass),
            null,
            null
        );
        result.put("supported", supported);
        result.put("requested", requested);
        result.put("pinnedCount", countPinned(providerClass));
        call.resolve(result);
    }

    /**
     * Opens the OS page where the user can grant the OEM permissions that gate
     * the pin dialog ("桌面快捷方式" / "后台弹出界面"). There is no public API to
     * pop the individual grant prompt, so we deep-link to the most specific
     * editor we can and fall back to the standard app-details screen.
     *
     * `route` is best-effort telemetry: "miui" when the MIUI permission editor
     * accepted the intent, otherwise "details" for the universal fallback.
     */
    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        JSObject result = new JSObject();
        String route = launchMiuiPermissionEditor();
        if (route == null) {
            route = launchAppDetails() ? "details" : null;
        }
        if (route == null) {
            call.reject("no settings activity could be opened");
            return;
        }
        result.put("opened", true);
        result.put("route", route);
        call.resolve(result);
    }

    /** MIUI/HyperOS keep the per-app permission list behind a private activity. */
    private String launchMiuiPermissionEditor() {
        String packageName = getContext().getPackageName();
        List<Intent> candidates = new ArrayList<>();

        Intent editor = new Intent("miui.intent.action.APP_PERM_EDITOR");
        editor.setClassName(
            "com.miui.securitycenter",
            "com.miui.permcenter.permissions.PermissionsEditorActivity"
        );
        editor.putExtra("extra_pkgname", packageName);
        candidates.add(editor);

        Intent legacyEditor = new Intent("miui.intent.action.APP_PERM_EDITOR");
        legacyEditor.putExtra("extra_pkgname", packageName);
        candidates.add(legacyEditor);

        for (Intent intent : candidates) {
            if (startExternal(intent)) return "miui";
        }
        return null;
    }

    /** Universal fallback: the OS "App info" page, reachable on every OEM. */
    private boolean launchAppDetails() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        return startExternal(intent);
    }

    /** Widget settings are launched from outside an Activity task, so flag NEW_TASK. */
    private boolean startExternal(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) return false;
        try {
            getContext().startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /** How many instances of this size are currently on the home screen. */
    @PluginMethod
    public void getPinnedCount(PluginCall call) {
        Class<?> providerClass = resolveProvider(call.getString("size", "medium"));
        if (providerClass == null) {
            call.reject("size must be medium or large");
            return;
        }
        JSObject result = new JSObject();
        result.put("count", countPinned(providerClass));
        call.resolve(result);
    }

    private static Class<?> resolveProvider(String size) {
        if ("medium".equals(size)) return CycleWidgetProvider.class;
        if ("large".equals(size)) return CycleWidgetLargeProvider.class;
        return null;
    }

    private int countPinned(Class<?> providerClass) {
        int[] ids = AppWidgetManager.getInstance(getContext())
            .getAppWidgetIds(new ComponentName(getContext(), providerClass));
        return ids == null ? 0 : ids.length;
    }

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
        // Same flattening for the precomputed day table: "date:state:phase:number".
        editor.putString("dayTable", flattenDayTable(data.optJSONArray("dayTable")));
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

    /**
     * "date:state:phase:number,..." — dates are YYYY-MM-DD so neither delimiter
     * can appear inside a field. Malformed rows are dropped, not thrown; a
     * missing table just means the widget renders from the frozen fields.
     */
    private static String flattenDayTable(JSONArray rows) {
        if (rows == null) return "";
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < rows.length(); index += 1) {
            JSONObject row = rows.optJSONObject(index);
            if (row == null) continue;
            String date = row.optString("date", "");
            String state = row.optString("state", "");
            String phase = row.optString("phase", "");
            // -1 sentinel: "late" legitimately carries 0 (predicted-start day).
            int number = row.optInt("number", -1);
            if (date.isEmpty() || state.isEmpty() || phase.isEmpty() || number < 0) continue;
            if (builder.length() > 0) builder.append(',');
            builder.append(date).append(':').append(state).append(':').append(phase).append(':').append(number);
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
