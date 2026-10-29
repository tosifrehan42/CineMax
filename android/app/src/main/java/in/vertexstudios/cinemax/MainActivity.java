package in.vertexstudios.cinemax;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String pendingDeepLinkUrl = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        captureDeepLinkIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureDeepLinkIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (pendingDeepLinkUrl != null) {
            dispatchDeepLinkToWebView(pendingDeepLinkUrl);
        }
    }

    private void captureDeepLinkIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }
        final String dataUrl = intent.getDataString();
        if (dataUrl == null || dataUrl.isEmpty()) {
            return;
        }
        pendingDeepLinkUrl = dataUrl;
        dispatchDeepLinkToWebView(dataUrl);
    }

    private void dispatchDeepLinkToWebView(final String dataUrl) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        final WebView webView = getBridge().getWebView();
        final String quotedUrl = JSONObject.quote(dataUrl);
        final String js =
            "window.__CINEMAX_INITIAL_DEEPLINK__ = " + quotedUrl + ";" +
            "window.dispatchEvent(new CustomEvent('cinemax:deeplink', { detail: { url: " + quotedUrl + " } }));";
        webView.post(() -> webView.evaluateJavascript(js, null));
        webView.postDelayed(() -> webView.evaluateJavascript(js, null), 650);
        webView.postDelayed(() -> {
            webView.evaluateJavascript(js, null);
            if (dataUrl.equals(pendingDeepLinkUrl)) {
                pendingDeepLinkUrl = null;
            }
        }, 1500);
    }
}

