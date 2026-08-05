package com.zhio.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

public class CycleWidgetLargeProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, CycleWidgetProvider.buildLargeViews(context, manager, id));
        }
        CycleWidgetProvider.scheduleMidnightRefresh(context);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        CycleWidgetProvider.scheduleMidnightRefresh(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        CycleWidgetProvider.cancelMidnightRefreshIfUnused(context);
    }

    /**
     * Resizing does not trigger onUpdate, so without this the layout picked at
     * placement time would stick until the next data change.
     */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int widgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, manager, widgetId, newOptions);
        manager.updateAppWidget(widgetId, CycleWidgetProvider.buildLargeViews(context, manager, widgetId));
        CycleWidgetProvider.scheduleMidnightRefresh(context);
    }
}
