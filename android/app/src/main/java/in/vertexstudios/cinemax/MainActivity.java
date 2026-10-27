package in.vertexstudios.cinemax;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        forwardDeepLinkIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        forwardDeepLinkIntent(intent);
    }

    private void forwardDeepLinkIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }
        final String dataUrl = intent.getDataString();
        if (dataUrl == null || dataUrl.isEmpty()) {
            return;
        }
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        final WebView webView = getBridge().getWebView();
        final String quotedUrl = JSONObject.quote(dataUrl);
        final String js =
            "window.__CINEMAX_INITIAL_DEEPLINK__ = " + quotedUrl + ";" +
            "window.dispatchEvent(new CustomEvent('cinemax:deeplink', { detail: { url: " + quotedUrl + " } }));";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}

