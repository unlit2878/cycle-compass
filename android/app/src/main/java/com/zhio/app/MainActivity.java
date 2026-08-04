package com.zhio.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int APP_SURFACE = Color.rgb(255, 253, 249);

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CycleWidgetPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }

        Window window = getWindow();
        window.setStatusBarColor(APP_SURFACE);
        window.setNavigationBarColor(APP_SURFACE);

        int systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            systemUiVisibility |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(systemUiVisibility);
    }
}
