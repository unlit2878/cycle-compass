package com.zhio.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.RelativeSizeSpan;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

public class CycleWidgetProvider extends AppWidgetProvider {
    private static final int GREEN = Color.rgb(113, 155, 95);
    private static final int GREEN_DEEP = Color.rgb(79, 112, 66);
    private static final int ROSE = Color.rgb(231, 142, 156);
    private static final int AMBER = Color.rgb(241, 178, 96);
    private static final int LAVENDER = Color.rgb(175, 160, 223);
    private static final int ROSE_DEEP = Color.rgb(159, 82, 96);
    private static final int AMBER_DEEP = Color.rgb(157, 104, 37);
    private static final int LAVENDER_DEEP = Color.rgb(104, 90, 155);

    /**
     * Fallback bar axis, matching InsightsPage.getChartScale's floor. The app
     * sends a wider scale when its own history needs one.
     */
    private static final int BAR_SCALE_FLOOR = 45;

    /**
     * Muted grey shared by the small affix glyphs ("第" / "后") so they recede
     * next to the dark number and unit. Matches the label grey #85857F.
     */
    private static final int AFFIX_GREY = Color.rgb(133, 133, 127);

    /**
     * Fired by our own midnight alarm so the date, weekday and countdown are
     * rebuilt for the new day. The rendered text is baked in from LocalDate.now()
     * at build time, so nothing refreshes it unless updateAppWidget runs again.
     */
    static final String ACTION_MIDNIGHT_REFRESH = "com.zhio.app.action.WIDGET_MIDNIGHT_REFRESH";

    /** Stable request code so repeated schedules replace the same alarm. */
    private static final int MIDNIGHT_REQUEST_CODE = 0x2731;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, buildRingViews(context, manager, id));
        scheduleMidnightRefresh(context);
    }

    /**
     * Resizing does not trigger onUpdate, so without this the ring would keep the
     * size it was given at placement time until the next data change. The large
     * provider has always had this; the medium one was missing it.
     */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int widgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, widgetId, newOptions);
        manager.updateAppWidget(widgetId, buildRingViews(context, manager, widgetId));
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        scheduleMidnightRefresh(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        cancelMidnightRefresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_MIDNIGHT_REFRESH.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            updateAll(context);
            // The alarm is one-shot, and a reboot or clock change clears or
            // invalidates any pending one, so always re-arm for the next midnight.
            scheduleMidnightRefresh(context);
        }
    }

    private static PendingIntent midnightIntent(Context context) {
        Intent intent = new Intent(context, CycleWidgetProvider.class)
                .setAction(ACTION_MIDNIGHT_REFRESH);
        return PendingIntent.getBroadcast(context, MIDNIGHT_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Wakes the widgets a few seconds after the next local midnight so the day's
     * date and countdown roll over. setAndAllowWhileIdle is inexact but fires
     * during Doze and needs no exact-alarm permission; a small delay past
     * midnight is imperceptible for a date display.
     */
    static void scheduleMidnightRefresh(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        ZonedDateTime nextMidnight = LocalDate.now(ZoneId.systemDefault())
                .plusDays(1)
                .atStartOfDay(ZoneId.systemDefault())
                .plusSeconds(5);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                nextMidnight.toInstant().toEpochMilli(), midnightIntent(context));
    }

    private static void cancelMidnightRefresh(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(midnightIntent(context));
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, CycleWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        for (int id : ids) manager.updateAppWidget(id, buildRingViews(context, manager, id));
        ComponentName largeProvider = new ComponentName(context, CycleWidgetLargeProvider.class);
        int[] largeIds = manager.getAppWidgetIds(largeProvider);
        for (int id : largeIds) manager.updateAppWidget(id, buildLargeViews(context, manager, id));
    }

    /**
     * Vertical dp widget_cycle_large needs that does *not* move with the font:
     * 16dp padding top and bottom, the badge row, the fixed 13dp comparison rows
     * and the margins between them.
     */
    private static final int ROOMY_FIXED_DP = 96;

    /**
     * The rest of that column — the label, the 36sp number and the date — is text,
     * so it grows with the system font scale. Phones shipped with an enlarged
     * font were the case the old flat 168dp threshold got wrong: the launcher
     * reported enough height for the layout at default text size, the text then
     * rendered taller than that, and the bottom comparison row was clipped off.
     */
    private static final int ROOMY_TEXT_DP = 70;

    /**
     * Font metrics differ enough between devices and CJK fonts that the estimate
     * above is only good to within a few dp. The old threshold cleared its own
     * estimate by 2dp, which was inside that error bar; this keeps real room.
     */
    private static final int ROOMY_SLACK_DP = 14;

    /**
     * Height at which the roomy layout genuinely fits. Below it the compact
     * variant is the one that fits — it moves the date beside the number, which
     * buys back a whole row, and shrinks the ring. A 4x2 widget is roughly
     * 110-190dp tall depending on launcher grid, display scaling and font size,
     * so the two variants must be chosen per instance rather than assumed.
     */
    private static int comfortableHeightDp(Context context) {
        float fontScale = Math.max(1f, context.getResources().getConfiguration().fontScale);
        return Math.round(ROOMY_FIXED_DP + ROOMY_TEXT_DP * fontScale) + ROOMY_SLACK_DP;
    }

    /**
     * Picks the layout that suits the space this instance was actually given.
     *
     * On API 31+ the launcher may render the widget at several sizes (split
     * screen, fold/unfold) without asking the provider again, so both variants
     * are handed over at once and the system swaps between them. Below that,
     * only the current height is knowable.
     */
    static RemoteViews buildLargeViews(Context context, AppWidgetManager manager, int widgetId) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        int widthDp = optionDp(options, AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int heightDp = optionDp(options, AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        int comfortable = comfortableHeightDp(context);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            java.util.Map<android.util.SizeF, RemoteViews> bySize = new java.util.HashMap<>();
            // Width is a lower bound only; the launcher matches on area, and a
            // 4-cell widget is never narrower than this. The compact layout owns
            // everything below the roomy layout's real height so its comparison
            // bars are never clipped.
            bySize.put(new android.util.SizeF(180f, 100f),
                    buildViews(context, R.layout.widget_cycle_large_compact, widthDp, heightDp));
            bySize.put(new android.util.SizeF(180f, comfortable),
                    buildViews(context, R.layout.widget_cycle_large, widthDp, heightDp));
            return new RemoteViews(bySize);
        }

        // Absent options report 0, which would wrongly force the compact layout.
        boolean roomy = heightDp == 0 || heightDp >= comfortable;
        return buildViews(context, roomy ? R.layout.widget_cycle_large : R.layout.widget_cycle_large_compact,
                widthDp, heightDp);
    }

    /** Medium counterpart to buildLargeViews: one layout, but a ring that fits. */
    static RemoteViews buildRingViews(Context context, AppWidgetManager manager, int widgetId) {
        Bundle options = manager.getAppWidgetOptions(widgetId);
        return buildViews(context, R.layout.widget_cycle_ring,
                optionDp(options, AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH),
                optionDp(options, AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT));
    }

    /** 0 means "not reported" — every caller treats that as "use the design size". */
    private static int optionDp(Bundle options, String key) {
        return options == null ? 0 : Math.max(0, options.getInt(key, 0));
    }

    // ---------------------------------------------------------------------
    // Responsive ring
    //
    // The ring used to be a fixed dp box in all three layouts, so on a phone
    // whose launcher hands the widget fewer dp — small display, enlarged display
    // size, or a dense home screen grid — it ate a fixed slice of a smaller
    // widget and squeezed the comparison bars beside it down to nothing.
    //
    // The two large layouts now give the ring a layout_weight instead, so its
    // width tracks the widget and the bars keep their share. The medium layout
    // cannot do that — its ring is an overlay bleeding off the right edge, which
    // is the whole look — so it is shrunk here with padding instead.
    //
    // Both paths leave normal-sized widgets byte-for-byte as they were: the
    // weights reproduce the old fixed widths at the width each layout was drawn
    // against, and the medium curve clamps to the old 154dp at its design width.
    // ---------------------------------------------------------------------

    /** Ring box width as a fraction of the space the weighted row divides up. */
    private static final float RING_WEIGHT_LARGE = 0.43f;      // 57/43 in widget_cycle_large
    private static final float RING_WEIGHT_COMPACT = 0.36f;    // 64/36 in widget_cycle_large_compact

    /** Horizontal dp the weighted row never gets: root padding *2 + column margin. */
    private static final int ROW_OVERHEAD_LARGE = 16 * 2 + 10;
    private static final int ROW_OVERHEAD_COMPACT = 14 * 2 + 9;

    /** Vertical dp lost to root padding, which caps the circle via fitCenter. */
    private static final int COL_OVERHEAD_LARGE = 16 * 2;
    private static final int COL_OVERHEAD_COMPACT = 14 * 2;

    /**
     * Ring box in widget_cycle_ring.xml, and the floor below which shrinking it
     * further buys less than it costs. Height is deliberately not a term here:
     * that ring is drawn taller than the widget's content box by design, so
     * capping it vertically would resize every instance, not just cramped ones.
     */
    private static final float MEDIUM_RING_DP = 154f;
    private static final float MEDIUM_RING_MIN_DP = 104f;
    /** Ring diameter as a share of widget width; 154dp at the ~168dp design width. */
    private static final float MEDIUM_RING_RATIO = 0.92f;

    /** Design ring diameter each layout was drawn against. */
    private static float designRingDp(int layoutId) {
        if (layoutId == R.layout.widget_cycle_large) return 124f;
        if (layoutId == R.layout.widget_cycle_large_compact) return 100f;
        return MEDIUM_RING_DP;
    }

    /** Design text size of the day number / weekday inside the ring, in sp. */
    private static float designDateSp(int layoutId) {
        if (layoutId == R.layout.widget_cycle_large) return 29f;
        if (layoutId == R.layout.widget_cycle_large_compact) return 24f;
        return 28f;
    }

    private static float designWeekdaySp(int layoutId) {
        if (layoutId == R.layout.widget_cycle_large_compact) return 8f;
        return 9f;
    }

    /**
     * Diameter the ring will actually be drawn at, or 0 when the widget's size is
     * unknown and the layout's own values should stand.
     *
     * For the large layouts this mirrors the XML: the box is a percentage of the
     * row, and widget_orbit is fitCenter inside a match_parent-height box, so the
     * circle is min(box width, box height). The height term is what stops the
     * ring growing past its design size once there is width to spare.
     */
    private static float ringDiameterDp(int layoutId, int widthDp, int heightDp) {
        if (widthDp <= 0) return 0f;
        if (layoutId == R.layout.widget_cycle_ring) {
            return Math.min(MEDIUM_RING_DP, Math.max(MEDIUM_RING_MIN_DP, widthDp * MEDIUM_RING_RATIO));
        }
        boolean compact = layoutId == R.layout.widget_cycle_large_compact;
        float weight = compact ? RING_WEIGHT_COMPACT : RING_WEIGHT_LARGE;
        int rowOverhead = compact ? ROW_OVERHEAD_COMPACT : ROW_OVERHEAD_LARGE;
        int colOverhead = compact ? COL_OVERHEAD_COMPACT : COL_OVERHEAD_LARGE;
        float byWidth = Math.max(0f, widthDp - rowOverhead) * weight;
        if (heightDp <= 0) return byWidth;
        return Math.min(byWidth, Math.max(0f, heightDp - colOverhead));
    }

    /**
     * Shrinks the ring, and the date sitting inside it, to the room this instance
     * actually has. Never enlarges: the scale is capped at 1 so a widget with
     * space to spare renders exactly as the XML describes it.
     */
    private static void applyResponsiveRing(Context context, RemoteViews views, int layoutId,
                                            int widthDp, int heightDp) {
        float design = designRingDp(layoutId);
        float actual = ringDiameterDp(layoutId, widthDp, heightDp);
        if (actual <= 0f) return;
        float scale = Math.min(1f, actual / design);

        if (layoutId == R.layout.widget_cycle_ring) {
            // The box keeps its 154dp footprint; padding is what shrinks the ring
            // and the date centred in it. Only the left side is inset so the
            // circle's right edge — and with it the bleed off the widget's edge —
            // stays put, and the circle retreats from the text rather than sliding.
            int inset = dpToPx(context, design - design * scale);
            if (inset > 0) views.setViewPadding(R.id.widget_orbit_box, inset, inset / 2, 0, inset / 2);
        }

        // Rounding leaves the design width a hair under 1.0; not worth a resize.
        if (scale >= 0.99f) return;
        // Below this the date stops being legible; the ring is better slightly
        // overfilled than unreadable.
        float textScale = Math.max(0.68f, scale);
        views.setTextViewTextSize(R.id.widget_today_date, TypedValue.COMPLEX_UNIT_SP,
                designDateSp(layoutId) * textScale);
        views.setTextViewTextSize(R.id.widget_today_weekday, TypedValue.COMPLEX_UNIT_SP,
                Math.max(7f, designWeekdaySp(layoutId) * textScale));
    }

    private static int dpToPx(Context context, float dp) {
        return Math.round(dp * context.getResources().getDisplayMetrics().density);
    }

    /** widthDp/heightDp of 0 mean "unknown" — the layout's own sizes then stand. */
    static RemoteViews buildViews(Context context, int layoutId, int widthDp, int heightDp) {
        SharedPreferences p = context.getSharedPreferences(CycleWidgetPlugin.PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
        boolean hasData = p.getBoolean("hasData", false);
        String phase = p.getString("phase", "");
        boolean isPeriod = "menstrual".equals(phase);
        LocalDate today = LocalDate.now();

        views.setTextViewText(R.id.widget_today_date, String.valueOf(today.getDayOfMonth()));
        views.setTextViewText(R.id.widget_today_weekday, weekdayLabel(today));
        /* Legacy text block was corrupted by a non-UTF-8 write.
        views.setTextViewText(R.id.widget_phase_badge, hasData ? phaseLabel(phase) : "等待同步");
        views.setTextColor(R.id.widget_phase_badge, phaseTextColor(phase));
        views.setInt(R.id.widget_phase_badge, "setBackgroundResource", phaseBadgeBackground(phase, hasData));

        if (!hasData) {
            views.setTextViewText(R.id.widget_label, "打开知期同步数据");
            views.setTextViewText(R.id.widget_number, "\u2014");
            views.setTextViewText(R.id.widget_unit, "");
            views.setTextViewText(R.id.widget_date, "轻触打开应用");
        } else if (isPeriod) {
            int periodDay = Math.max(1, p.getInt("phaseDay", 1));
            views.setTextViewText(R.id.widget_label, "今天是经期");
            views.setTextViewText(R.id.widget_number, String.valueOf(periodDay));
            views.setTextViewText(R.id.widget_unit, "天");
            views.setTextViewText(R.id.widget_date, "记得照顾好自己");
        } else {
            int savedDays = Math.max(0, p.getInt("daysUntilPeriod", 0));
            String date = p.getString("predictedDate", "");
            int days = daysUntil(date, savedDays);
            views.setTextViewText(R.id.widget_label, "距离下次经期");
            views.setTextViewText(R.id.widget_number, String.valueOf(days));
            views.setTextViewText(R.id.widget_unit, "天");
            views.setTextViewText(R.id.widget_date, date == null || date.isEmpty() ? "预测日期待更新" : "预计 " + displayDate(date) + " 开始");
        }

        */
        /* Replacement text below was also written with the wrong code page.
        views.setTextViewText(R.id.widget_phase_badge, hasData ? phaseLabel(phase) : "等待同步");
        views.setTextColor(R.id.widget_phase_badge, phaseTextColor(phase));
        views.setInt(R.id.widget_phase_badge, "setBackgroundResource", phaseBadgeBackground(phase, hasData));

        if (!hasData) {
            views.setTextViewText(R.id.widget_label, "打开知期同步数据");
            views.setTextViewText(R.id.widget_number, "\u2014");
            views.setTextViewText(R.id.widget_unit, "");
            views.setTextViewText(R.id.widget_date, "轻触打开应用");
        } else if (isPeriod) {
            int periodDay = Math.max(1, p.getInt("phaseDay", 1));
            views.setTextViewText(R.id.widget_label, "今天是经期");
            views.setTextViewText(R.id.widget_number, String.valueOf(periodDay));
            views.setTextViewText(R.id.widget_unit, "天");
            views.setTextViewText(R.id.widget_date, "记得照顾好自己");
        } else {
            int savedDays = Math.max(0, p.getInt("daysUntilPeriod", 0));
            String date = p.getString("predictedDate", "");
            int days = daysUntil(date, savedDays);
            // The medium 2x2 is too narrow for the full phrase beside the ring, so
            // it drops to "经期" + number + a smaller "天后". The wider large layouts
            // keep the descriptive "距离下次经期" / "天". Only this countdown branch
            // gets the "后" tail — during a period "天后" would read wrongly.
            boolean medium = layoutId == R.layout.widget_cycle_ring;
            if (days == 0) {
                // "经期 0天后" reads wrong; today is the predicted day itself.
                views.setTextViewText(R.id.widget_label, medium ? "经期" : "距离下次经期");
                views.setTextViewText(R.id.widget_number, "今天");
                views.setTextViewText(R.id.widget_unit, "");
            } else {
                views.setTextViewText(R.id.widget_label, medium ? "经期" : "距离下次经期");
                views.setTextViewText(R.id.widget_number, String.valueOf(days));
                views.setTextViewText(R.id.widget_unit, medium ? unitWithSmallTail("天", "后") : "天");
            }
            views.setTextViewText(R.id.widget_date, date == null || date.isEmpty()
                    ? "预测日期待更新"
                    : "预计 " + displayDate(date) + " 开始");
        }

        */
        views.setTextViewText(R.id.widget_phase_badge, hasData ? phaseLabel(phase) : "\u7b49\u5f85\u540c\u6b65");
        views.setTextColor(R.id.widget_phase_badge, phaseTextColor(phase));
        views.setInt(R.id.widget_phase_badge, "setBackgroundResource", phaseBadgeBackground(phase, hasData));

        // The medium 2x2 has no room for the full phrases beside the ring, so it
        // uses its own shortened copy for every state; the wider large layouts
        // keep the descriptive originals. The two are kept fully independent here.
        boolean medium = layoutId == R.layout.widget_cycle_ring;
        if (!hasData) {
            views.setTextViewText(R.id.widget_label, medium ? "\u540c\u6b65\u6570\u636e" : "\u6253\u5f00\u77e5\u671f\u540c\u6b65\u6570\u636e");
            views.setTextViewText(R.id.widget_number, "\u2014");
            views.setTextViewText(R.id.widget_unit, "");
            views.setTextViewText(R.id.widget_date, "\u8f7b\u89e6\u6253\u5f00\u5e94\u7528");
        } else if (isPeriod) {
            int periodDay = Math.max(1, p.getInt("phaseDay", 1));
            if (medium) {
                // "\u7ecf\u671f" + "\u7b2c2\u5929" (\u7b2c rendered smaller than the number).
                views.setTextViewText(R.id.widget_label, "\u7ecf\u671f");
                views.setTextViewText(R.id.widget_number, numberWithSmallPrefix("\u7b2c", String.valueOf(periodDay)));
                views.setTextViewText(R.id.widget_unit, "\u5929");
            } else {
                views.setTextViewText(R.id.widget_label, "\u4eca\u5929\u662f\u7ecf\u671f");
                views.setTextViewText(R.id.widget_number, String.valueOf(periodDay));
                views.setTextViewText(R.id.widget_unit, "\u5929");
            }
            views.setTextViewText(R.id.widget_date, "\u8bb0\u5f97\u7167\u987e\u597d\u81ea\u5df1");
        } else {
            int savedDays = Math.max(0, p.getInt("daysUntilPeriod", 0));
            String date = p.getString("predictedDate", "");
            int days = daysUntil(date, savedDays);
            if (days == 0) {
                // days==0 is the predicted day itself; "0\u5929\u540e" would read wrong.
                views.setTextViewText(R.id.widget_label, medium ? "\u7ecf\u671f" : "\u8ddd\u79bb\u4e0b\u6b21\u7ecf\u671f");
                views.setTextViewText(R.id.widget_number, "\u4eca\u5929");
                views.setTextViewText(R.id.widget_unit, "");
            } else {
                views.setTextViewText(R.id.widget_label, medium ? "\u7ecf\u671f" : "\u8ddd\u79bb\u4e0b\u6b21\u7ecf\u671f");
                views.setTextViewText(R.id.widget_number, String.valueOf(days));
                // Medium appends a smaller "\u540e" after "\u5929", with a hair space so the
                // two characters do not crowd; large keeps the plain "\u5929".
                views.setTextViewText(R.id.widget_unit, medium ? unitWithSmallTail("\u5929", "\u540e") : "\u5929");
            }
            views.setTextViewText(R.id.widget_date, date == null || date.isEmpty()
                    ? "\u9884\u6d4b\u65e5\u671f\u5f85\u66f4\u65b0"
                    : "\u9884\u8ba1 " + displayDate(date) + " \u5f00\u59cb");
        }

        if (layoutId == R.layout.widget_cycle_large || layoutId == R.layout.widget_cycle_large_compact) {
            bindComparison(views, p);
        }

        views.setImageViewBitmap(R.id.widget_orbit, drawOrbit(context, phase, today));
        applyResponsiveRing(context, views, layoutId, widthDp, heightDp);
        Intent openApp = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent click = PendingIntent.getActivity(context, 0, openApp,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, click);
        return views;
    }

    /** One completed cycle: the period segment overlaps the start of the cycle. */
    private static final class CycleRow {
        final int cycleLength;
        final int periodLength;

        CycleRow(int cycleLength, int periodLength) {
            this.cycleLength = cycleLength;
            this.periodLength = periodLength;
        }
    }

    /**
     * Parses "cycle:period,cycle:period" (oldest first). Anything malformed is
     * dropped rather than thrown, so a snapshot written by an older app build
     * degrades to the not-enough-data state instead of crashing the launcher.
     */
    private static List<CycleRow> parseCycleRows(String raw) {
        List<CycleRow> rows = new ArrayList<>();
        if (raw == null || raw.isEmpty()) return rows;
        for (String entry : raw.split(",")) {
            String[] parts = entry.split(":");
            if (parts.length != 2) continue;
            try {
                int cycleLength = Integer.parseInt(parts[0].trim());
                int periodLength = Integer.parseInt(parts[1].trim());
                if (cycleLength <= 0 || periodLength <= 0) continue;
                rows.add(new CycleRow(cycleLength, periodLength));
            } catch (NumberFormatException ignored) {
                // Skip the entry; the remaining rows are still usable.
            }
        }
        return rows;
    }

    private static void bindComparison(RemoteViews views, SharedPreferences p) {
        List<CycleRow> rows = parseCycleRows(p.getString("recentCycles", ""));
        int average = p.getInt("averageCycleLength", 0);
        int scale = Math.max(BAR_SCALE_FLOOR, p.getInt("barScale", 0));

        if (rows.isEmpty()) {
            // Nothing to compare yet: a hairline placeholder, no invented numbers.
            views.setViewVisibility(R.id.widget_compare_prev, View.GONE);
            views.setViewVisibility(R.id.widget_compare_now, View.VISIBLE);
            views.setTextViewText(R.id.widget_now_key, "\u5468\u671f");
            views.setImageViewBitmap(R.id.widget_now_bar, drawEmptyBar());
            views.setTextViewText(R.id.widget_now_value, "\u2014");
            return;
        }

        CycleRow now = rows.get(rows.size() - 1);
        CycleRow prev = rows.size() >= 2 ? rows.get(rows.size() - 2) : null;

        if (prev == null) {
            // One usable cycle: show it, and say plainly that a comparison needs more.
            views.setViewVisibility(R.id.widget_compare_prev, View.VISIBLE);
            views.setTextViewText(R.id.widget_prev_key, "\u4e0a\u6b21");
            views.setImageViewBitmap(R.id.widget_prev_bar, drawEmptyBar());
            views.setTextViewText(R.id.widget_prev_value, "\u6570\u636e\u4e0d\u8db3");
        } else {
            views.setViewVisibility(R.id.widget_compare_prev, View.VISIBLE);
            views.setTextViewText(R.id.widget_prev_key, "\u4e0a\u6b21");
            views.setImageViewBitmap(R.id.widget_prev_bar, drawCycleBar(prev, 0, scale, false));
            views.setTextViewText(R.id.widget_prev_value, prev.cycleLength + " / " + prev.periodLength);
        }

        views.setViewVisibility(R.id.widget_compare_now, View.VISIBLE);
        views.setTextViewText(R.id.widget_now_key, "\u6700\u8fd1");
        views.setImageViewBitmap(R.id.widget_now_bar, drawCycleBar(now, average, scale, true));
        views.setTextViewText(R.id.widget_now_value, comparisonValue(now, prev));
    }

    /**
     * "30↗2 / 4↘1" — arrows replace the words for longer/shorter/level, which
     * buys back room in a column this narrow.
     */
    private static String comparisonValue(CycleRow now, CycleRow prev) {
        StringBuilder builder = new StringBuilder();
        builder.append(now.cycleLength);
        if (prev != null) builder.append(deltaLabel(now.cycleLength - prev.cycleLength));
        builder.append(" / ").append(now.periodLength);
        if (prev != null) builder.append(deltaLabel(now.periodLength - prev.periodLength));
        return builder.toString();
    }

    /**
     * Longer and shorter are not better or worse, so both arrows carry the same
     * weight and colour; no red/green.
     */
    private static String deltaLabel(int delta) {
        if (delta == 0) return "\u2013";
        return (delta > 0 ? "\u2197" : "\u2198") + Math.abs(delta);
    }

    /**
     * A single track with the period segment drawn over the start of the cycle
     * segment, mirroring .bar-track in the app's trends page. Bitmaps stay tiny
     * because RemoteViews crosses a Binder transaction.
     */
    private static Bitmap drawCycleBar(CycleRow row, int average, int scale, boolean emphasise) {
        int width = 180;
        int height = 20;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        float thickness = 8f;
        float top = (height - thickness) / 2f;
        float radius = thickness / 2f;
        int alpha = emphasise ? 255 : 115;

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.argb(emphasise ? 190 : 120, 236, 232, 224));
        canvas.drawRoundRect(new RectF(0, top, width, top + thickness), radius, radius, paint);

        float cycleWidth = Math.min(1f, row.cycleLength / (float) scale) * width;
        paint.setShader(new LinearGradient(0, top, cycleWidth, top + thickness,
                Color.rgb(155, 185, 134), Color.rgb(111, 159, 88), Shader.TileMode.CLAMP));
        paint.setAlpha(alpha);
        canvas.drawRoundRect(new RectF(0, top, Math.max(cycleWidth, thickness), top + thickness),
                radius, radius, paint);
        paint.setShader(null);
        paint.setAlpha(255);

        float periodWidth = Math.min(1f, row.periodLength / (float) scale) * width;
        paint.setShader(new LinearGradient(0, top, Math.max(periodWidth, thickness), top + thickness,
                Color.argb(184, 246, 164, 177), Color.argb(189, 224, 79, 106), Shader.TileMode.CLAMP));
        paint.setAlpha(alpha);
        canvas.drawRoundRect(new RectF(0, top, Math.max(periodWidth, thickness), top + thickness),
                radius, radius, paint);
        paint.setShader(null);
        paint.setAlpha(255);

        // The average marker only appears on the emphasised row; two dashed
        // lines in 13dp of height would read as noise.
        if (emphasise && average > 0) {
            float x = Math.min(1f, average / (float) scale) * width;
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2f);
            paint.setColor(Color.rgb(239, 163, 50));
            paint.setPathEffect(new android.graphics.DashPathEffect(new float[]{3f, 3f}, 0));
            canvas.drawLine(x, top - 4f, x, top + thickness + 4f, paint);
            paint.setPathEffect(null);
        }
        return bitmap;
    }

    /** Hairline placeholder for a row that has no measurable cycle behind it. */
    private static Bitmap drawEmptyBar() {
        int width = 180;
        int height = 20;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1.5f);
        paint.setColor(Color.argb(108, 140, 134, 122));
        paint.setPathEffect(new android.graphics.DashPathEffect(new float[]{4f, 4f}, 0));
        canvas.drawLine(0, height / 2f, width, height / 2f, paint);
        return bitmap;
    }

    /**
     * Builds "天后" with the tail character drawn smaller than the unit, so the
     * medium widget can shorten the copy without the trailing "后" competing with
     * the "天". RelativeSizeSpan is a ParcelableSpan, so it survives the Binder
     * hop RemoteViews makes to the launcher.
     */
    private static CharSequence unitWithSmallTail(String unit, String tail) {
        // A thin space (U+2009) between unit and tail keeps "天" and "后" from
        // crowding once the tail is shrunk. The space is inside the shrunk span so
        // it stays proportional to the small tail, not the unit.
        String gap = " ";
        SpannableString span = new SpannableString(unit + gap + tail);
        span.setSpan(new RelativeSizeSpan(0.62f), unit.length(), span.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        // Grey the gap+tail so "后" recedes like the "第" prefix; "天" stays dark.
        span.setSpan(new ForegroundColorSpan(AFFIX_GREY), unit.length(), span.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return span;
    }

    /**
     * Builds e.g. "第2" with the prefix drawn smaller than the number, so the
     * medium widget can front the period-day count with a compact "第". Same
     * ParcelableSpan mechanism as {@link #unitWithSmallTail}.
     */
    private static CharSequence numberWithSmallPrefix(String prefix, String number) {
        // number view is 44sp; 0.20 lands "第" at ~8.7sp, matching the 0.62 tail on
        // the 14sp unit view. Same grey so prefix and tail read as one soft pair.
        SpannableString span = new SpannableString(prefix + number);
        span.setSpan(new RelativeSizeSpan(0.20f), 0, prefix.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        span.setSpan(new ForegroundColorSpan(AFFIX_GREY), 0, prefix.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return span;
    }

    private static String phaseLabel(String phase) {
        /* Corrupted legacy labels:
        if ("follicular".equals(phase)) return "卵泡期";
        if ("ovulation".equals(phase)) return "排卵期";
        if ("luteal".equals(phase)) return "黄体期";
        if ("menstrual".equals(phase)) return "经期";
        return "周期中";
        */
        /* Replacement labels written with the wrong code page.
        if ("follicular".equals(phase)) return "卵泡期";
        if ("ovulation".equals(phase)) return "排卵期";
        if ("luteal".equals(phase)) return "黄体期";
        if ("menstrual".equals(phase)) return "经期";
        return "周期中";
        */
        if ("follicular".equals(phase)) return "\u5375\u6ce1\u671f";
        if ("ovulation".equals(phase)) return "\u6392\u5375\u671f";
        if ("luteal".equals(phase)) return "\u9ec4\u4f53\u671f";
        if ("menstrual".equals(phase)) return "\u7ecf\u671f";
        return "\u5468\u671f\u4e2d";
    }

    private static String weekdayLabel(LocalDate date) {        /* Corrupted legacy labels:
        String[] labels = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
        */
        /* Replacement labels written with the wrong code page.
        String[] cleanLabels = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};
        return cleanLabels[date.getDayOfWeek().getValue() - 1];
        */
        String[] safeLabels = {"\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d", "\u5468\u65e5"};
        return safeLabels[date.getDayOfWeek().getValue() - 1];
    }

    private static int phaseTextColor(String phase) {
        if ("menstrual".equals(phase)) return ROSE_DEEP;
        if ("ovulation".equals(phase)) return AMBER_DEEP;
        if ("luteal".equals(phase)) return LAVENDER_DEEP;
        return GREEN_DEEP;
    }

    private static int phaseBadgeBackground(String phase, boolean hasData) {
        if (!hasData) return R.drawable.widget_badge_neutral;
        if ("menstrual".equals(phase)) return R.drawable.widget_badge_menstrual;
        if ("ovulation".equals(phase)) return R.drawable.widget_badge_ovulation;
        if ("luteal".equals(phase)) return R.drawable.widget_badge_luteal;
        return R.drawable.widget_badge_follicular;
    }

    private static String displayDate(String isoDate) {
        /* Corrupted legacy implementation:
        String[] parts = isoDate.split("-");
        if (parts.length != 3) return isoDate;
        try {
            return Integer.parseInt(parts[1]) + "月" + Integer.parseInt(parts[2]) + "日";
        } catch (NumberFormatException ignored) {
            return isoDate;
        }
        */
        /* Replacement implementation written with the wrong code page.
        String[] cleanParts = isoDate.split("-");
        if (cleanParts.length != 3) return isoDate;
        try {
            return Integer.parseInt(cleanParts[1]) + "月" + Integer.parseInt(cleanParts[2]) + "日";
        } catch (NumberFormatException ignored) {
            return isoDate;
        }
        */
        String[] safeParts = isoDate.split("-");
        if (safeParts.length != 3) return isoDate;
        try {
            return Integer.parseInt(safeParts[1]) + "\u6708" + Integer.parseInt(safeParts[2]) + "\u65e5";
        } catch (NumberFormatException ignored) {
            return isoDate;
        }
    }

    private static int daysUntil(String isoDate, int fallback) {
        if (isoDate == null || isoDate.isEmpty()) return fallback;
        try {
            long days = ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(isoDate));
            return (int) Math.max(0, Math.min(Integer.MAX_VALUE, days));
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }

    private static Bitmap drawOrbit(Context context, String phase, LocalDate today) {
        // RemoteViews is marshalled across a Binder transaction to the launcher.
        // A density-sized bitmap can exceed Binder's transaction limit on xxhdpi/
        // xxxhdpi devices (154dp becomes up to 616px, or about 1.5 MiB). Keep the
        // payload small and let the widget ImageView scale this simple artwork.
        int size = 154;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        float scale = size / 154f;
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float center = size / 2f;

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(phaseCoreColor(phase));
        canvas.drawCircle(center, center, 40 * scale, paint);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2 * scale);
        paint.setColor(Color.argb(70, 113, 155, 95));
        paint.setPathEffect(new android.graphics.DashPathEffect(new float[]{4 * scale, 5 * scale}, 0));
        canvas.drawCircle(center, center, 58 * scale, paint);
        paint.setPathEffect(null);

        float degrees = ((today.getDayOfMonth() - 1f) / today.lengthOfMonth()) * 360f - 90f;
        paint.setStyle(Paint.Style.FILL);
        double radians = Math.toRadians(degrees);
        float x = center + (58 * scale) * (float) Math.cos(radians);
        float y = center + (58 * scale) * (float) Math.sin(radians);
        paint.setColor(Color.rgb(255, 253, 249));
        canvas.drawCircle(x, y, 8 * scale, paint);
        paint.setColor(phaseColor(phase));
        canvas.drawCircle(x, y, 5 * scale, paint);
        return bitmap;
    }

    private static int phaseColor(String phase) {
        if ("menstrual".equals(phase)) return ROSE;
        if ("ovulation".equals(phase)) return AMBER;
        if ("luteal".equals(phase)) return LAVENDER;
        return GREEN;
    }

    private static int phaseCoreColor(String phase) {
        if ("menstrual".equals(phase)) return Color.rgb(248, 223, 226);
        if ("ovulation".equals(phase)) return Color.rgb(250, 232, 204);
        if ("luteal".equals(phase)) return Color.rgb(235, 231, 248);
        return Color.rgb(231, 240, 226);
    }
}
