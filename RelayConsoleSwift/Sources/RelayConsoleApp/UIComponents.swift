import AppKit
import SwiftUI
import UniformTypeIdentifiers
import WebKit
import MarkdownUI
import RelayConsoleCore

enum RCTheme {
    static let page = Color(red: 0.025, green: 0.031, blue: 0.036)
    static let railSurface = Color(red: 0.034, green: 0.043, blue: 0.052)
    static let sidebarSurface = Color(red: 0.041, green: 0.051, blue: 0.063)
    static let sidebarSurfaceAlt = Color(red: 0.065, green: 0.081, blue: 0.098)
    static let surfaceGreen = Color(red: 0.098, green: 0.149, blue: 0.157)
    static let surfaceInset = Color(red: 0.057, green: 0.074, blue: 0.093)
    static let surfaceRaised = Color(red: 0.122, green: 0.151, blue: 0.184)
    static let surfaceHover = Color(red: 0.142, green: 0.174, blue: 0.210)
    static let sidebarSelected = Color(red: 0.110, green: 0.184, blue: 0.270)
    static let surfaceLevel0 = page
    static let surfaceLevel1 = sidebarSurface
    static let surfaceLevel2 = sidebarSurfaceAlt
    static let surfaceLevel3 = surfaceRaised
    static let surfaceLevel4 = sidebarSelected
    static let text = Color(red: 0.862, green: 0.846, blue: 0.792)
    static let muted = Color(red: 0.590, green: 0.600, blue: 0.620)
    static let border = Color(red: 0.230, green: 0.255, blue: 0.280)
    static let accentBlue = Color(red: 0.314, green: 0.553, blue: 0.843)
    static let accentGreen = Color(red: 0.392, green: 0.843, blue: 0.553)
    static let accentPurple = Color(red: 0.608, green: 0.541, blue: 0.843)
    static let accentAmber = Color(red: 0.839, green: 0.725, blue: 0.404)
    static let accentRed = Color(red: 0.882, green: 0.435, blue: 0.392)
    static let relayBlue = Color(red: 14 / 255, green: 108 / 255, blue: 253 / 255)
    static let relayPurple = Color(red: 130 / 255, green: 43 / 255, blue: 244 / 255)
    static let relayIndigo = Color(red: 76 / 255, green: 73 / 255, blue: 246 / 255)
    static let relayCyan = Color(red: 0 / 255, green: 184 / 255, blue: 193 / 255)
    static let relayAmber = Color(red: 255 / 255, green: 184 / 255, blue: 0 / 255)
    static let borderLow = border.opacity(0.30)
    static let borderSoft = border.opacity(0.46)
    static let borderStandard = border.opacity(0.62)
    static let borderStrong = border.opacity(0.78)
    static let borderActive = borderStrong
    static let borderFocus = accentBlue.opacity(0.68)
    static let fieldBackground = Color(red: 0.060, green: 0.075, blue: 0.092)
    static let fieldBorder = borderStandard
    static let fieldBorderActive = borderFocus
    static let agentCardBackground = Color(red: 0.097, green: 0.145, blue: 0.158)
    static let userCardBackground = Color(red: 0.120, green: 0.123, blue: 0.183)
    static let agentCardBorder = accentGreen.opacity(0.32)
    static let userCardBorder = accentPurple.opacity(0.26)
    static let agentCardLabel = Color(red: 0.784, green: 0.953, blue: 0.843)
    static let userCardLabel = Color(red: 0.847, green: 0.816, blue: 0.953)
    static let agentAvatarFill = accentGreen.opacity(0.14)
    static let userAvatarFill = accentPurple.opacity(0.12)
    static let chatCanvas = Color(red: 0.018, green: 0.024, blue: 0.028)
    static let chatChrome = Color(red: 0.045, green: 0.056, blue: 0.068)
    static let chatComposer = Color(red: 0.058, green: 0.071, blue: 0.087)
    static let chatComposerBorder = Color(red: 0.226, green: 0.256, blue: 0.292)
    static let chatText = Color(red: 0.805, green: 0.790, blue: 0.760)
    static let chatTextStrong = Color(red: 0.900, green: 0.875, blue: 0.815)
    static let chatAccent = Color(red: 0.525, green: 0.695, blue: 0.900)
    static let chatMuted = Color(red: 0.570, green: 0.575, blue: 0.575)
    static let chatCodeBackground = Color(red: 0.128, green: 0.143, blue: 0.145)
    static let chatInlineCodeBackground = Color(red: 0.165, green: 0.182, blue: 0.188)
}

enum RCTypography {
    static let chatBodySize: CGFloat = 13.5
    static let chatBody = Font.system(size: chatBodySize, weight: .regular)
    static let chatMeta = Font.system(size: 11.5, weight: .regular)
    static let chatName = Font.system(size: 13.5, weight: .semibold)
    static let sidebarName = Font.system(size: 13, weight: .semibold)
    static let sidebarLabel = Font.system(size: 13, weight: .semibold)
    static let agentSectionTitle = Font.system(size: 15, weight: .bold)

    static func markdownTheme(compact: Bool) -> Theme {
        let bodySize = compact ? chatBodySize : 13.5
        return Theme()
            .text {
                ForegroundColor(RCTheme.chatText)
                FontFamily(.system())
                FontSize(bodySize)
                FontWeight(.regular)
            }
            .code {
                FontFamilyVariant(.monospaced)
                FontSize(.em(0.88))
                FontWeight(.semibold)
                ForegroundColor(RCTheme.chatTextStrong)
                BackgroundColor(RCTheme.chatInlineCodeBackground)
            }
            .strong {
                FontWeight(.semibold)
                ForegroundColor(RCTheme.chatTextStrong)
            }
            .link {
                ForegroundColor(RCTheme.chatAccent)
            }
            .heading1 { configuration in
                configuration.label
                    .markdownMargin(top: compact ? 20 : 24, bottom: compact ? 8 : 10)
                    .markdownTextStyle {
                        FontWeight(.bold)
                        FontSize(.em(1.18))
                        ForegroundColor(RCTheme.chatTextStrong)
                    }
            }
            .heading2 { configuration in
                configuration.label
                    .markdownMargin(top: compact ? 20 : 24, bottom: compact ? 8 : 10)
                    .markdownTextStyle {
                        FontWeight(.bold)
                        FontSize(.em(1.12))
                        ForegroundColor(RCTheme.chatTextStrong)
                    }
            }
            .heading3 { configuration in
                configuration.label
                    .markdownMargin(top: compact ? 18 : 20, bottom: compact ? 7 : 9)
                    .markdownTextStyle {
                        FontWeight(.semibold)
                        FontSize(.em(1.04))
                        ForegroundColor(RCTheme.chatTextStrong)
                    }
            }
            .heading4 { configuration in
                configuration.label
                    .markdownMargin(top: compact ? 16 : 18, bottom: compact ? 6 : 8)
                    .markdownTextStyle {
                        FontWeight(.semibold)
                        ForegroundColor(RCTheme.chatTextStrong)
                    }
            }
            .heading5 { configuration in
                configuration.label
                    .markdownMargin(top: compact ? 12 : 14, bottom: compact ? 5 : 7)
                    .markdownTextStyle {
                        FontWeight(.semibold)
                        FontSize(.em(0.95))
                        ForegroundColor(RCTheme.chatTextStrong)
                    }
            }
            .heading6 { configuration in
                configuration.label
                    .markdownMargin(top: compact ? 12 : 14, bottom: compact ? 5 : 7)
                    .markdownTextStyle {
                        FontWeight(.semibold)
                        FontSize(.em(0.9))
                        ForegroundColor(RCTheme.chatMuted)
                    }
            }
            .paragraph { configuration in
                configuration.label
                    .fixedSize(horizontal: false, vertical: true)
                    .relativeLineSpacing(.em(0.32))
                    .markdownMargin(top: 0, bottom: compact ? 14 : 16)
            }
            .listItem { configuration in
                configuration.label
                    .relativeLineSpacing(.em(0.30))
                    .markdownMargin(top: .em(0.36))
            }
            .blockquote { configuration in
                HStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(RCTheme.chatAccent.opacity(0.46))
                        .relativeFrame(width: .em(0.18))
                    configuration.label
                        .markdownTextStyle { ForegroundColor(RCTheme.chatMuted) }
                        .relativePadding(.horizontal, length: .em(0.95))
                }
                .fixedSize(horizontal: false, vertical: true)
                .markdownMargin(top: compact ? 2 : 4, bottom: compact ? 14 : 16)
            }
            .codeBlock { configuration in
                ScrollView(.horizontal) {
                    configuration.label
                        .fixedSize(horizontal: false, vertical: true)
                        .relativeLineSpacing(.em(0.24))
                        .markdownTextStyle {
                            FontFamilyVariant(.monospaced)
                            FontSize(.em(0.86))
                            ForegroundColor(RCTheme.chatTextStrong)
                        }
                        .padding(compact ? 12 : 14)
                }
                .background(RCTheme.chatCodeBackground.opacity(0.86))
                .clipShape(RoundedRectangle(cornerRadius: 5))
                .overlay(RoundedRectangle(cornerRadius: 5).stroke(RCTheme.borderLow))
                .markdownMargin(top: compact ? 4 : 6, bottom: compact ? 14 : 16)
            }
    }
}

struct RelayMarkdownView: View {
    let markdown: String
    var compact: Bool = false

    var body: some View {
        Markdown(markdown)
            .markdownTheme(RCTypography.markdownTheme(compact: compact))
            .font(RCTypography.chatBody)
            .lineSpacing(compact ? 6 : 7)
            .foregroundStyle(RCTheme.chatText)
            .tint(RCTheme.chatAccent)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel(markdown)
    }
}

struct RelayMarkdownChatView: View {
    let markdown: String
    @State private var renderedHeight: CGFloat = 24

    var body: some View {
        RelayMarkdownChatWebView(
            html: RelayMarkdownHTMLRenderer.chatHTML(markdown: markdown),
            renderedHeight: $renderedHeight
        )
        .frame(height: max(renderedHeight, 24))
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel(markdown)
    }
}

private struct RelayMarkdownChatWebView: NSViewRepresentable {
    let html: String
    @Binding var renderedHeight: CGFloat

    func makeCoordinator() -> Coordinator {
        Coordinator(renderedHeight: $renderedHeight)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = context.coordinator
        webView.allowsMagnification = false
        webView.allowsBackForwardNavigationGestures = false
        webView.loadHTMLString(html, baseURL: nil)
        context.coordinator.lastHTML = html
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.renderedHeight = $renderedHeight
        guard context.coordinator.lastHTML != html else {
            context.coordinator.measure(webView)
            return
        }
        context.coordinator.lastHTML = html
        webView.loadHTMLString(html, baseURL: nil)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lastHTML = ""
        var renderedHeight: Binding<CGFloat>

        init(renderedHeight: Binding<CGFloat>) {
            self.renderedHeight = renderedHeight
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            measure(webView)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func measure(_ webView: WKWebView) {
            webView.evaluateJavaScript("Math.ceil(document.documentElement.scrollHeight)") { [weak self] result, _ in
                guard let self else { return }
                let height: CGFloat
                if let number = result as? NSNumber {
                    height = CGFloat(truncating: number)
                } else if let value = result as? CGFloat {
                    height = value
                } else {
                    return
                }
                DispatchQueue.main.async {
                    if abs(self.renderedHeight.wrappedValue - height) > 0.5 {
                        self.renderedHeight.wrappedValue = height
                    }
                }
            }
        }
    }
}

struct RelayMarkdownSurface: View {
    let markdown: String
    var compact: Bool = false

    var body: some View {
        ScrollView([.vertical, .horizontal]) {
            RelayMarkdownView(markdown: markdown, compact: compact)
                .padding(compact ? 12 : 22)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: compact ? 0 : 420)
        .background(
            LinearGradient(
                colors: [
                    RCTheme.surfaceInset,
                    RCTheme.sidebarSurfaceAlt.opacity(0.78)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: compact ? 4 : 6))
        .overlay(RoundedRectangle(cornerRadius: compact ? 4 : 6).stroke(RCTheme.borderSoft))
        .accessibilityLabel("Rendered markdown")
    }
}

struct RelayMarkdownDocumentSurface: View {
    let markdown: String
    var metadata: [(key: String, value: String)] = []

    var body: some View {
        RelayMarkdownDocumentWebView(html: RelayMarkdownHTMLRenderer.htmlDocument(markdown: markdown, metadata: metadata))
            .frame(minHeight: 420, maxHeight: .infinity)
            .background(RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(RCTheme.borderSoft))
            .accessibilityLabel("Rendered markdown document")
    }
}

private struct RelayMarkdownDocumentWebView: NSViewRepresentable {
    let html: String

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.setValue(false, forKey: "drawsBackground")
        webView.navigationDelegate = context.coordinator
        webView.allowsMagnification = false
        webView.allowsBackForwardNavigationGestures = false
        webView.loadHTMLString(html, baseURL: nil)
        context.coordinator.lastHTML = html
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastHTML != html else { return }
        context.coordinator.lastHTML = html
        webView.loadHTMLString(html, baseURL: nil)
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lastHTML = ""

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

private enum RelayMarkdownHTMLRenderer {
    static func chatHTML(markdown: String) -> String {
        """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              color-scheme: dark;
              --text: #cdc9c2;
              --strong: #e6dfd2;
              --muted: #929292;
              --pill-bg: #293033;
              --pill-border: rgba(185, 190, 186, 0.22);
              --pill-text: #e9e3d6;
              --accent: #86b1e6;
              --code-block: #202426;
              --code-border: rgba(160, 166, 165, 0.20);
            }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              min-height: 0;
              overflow: hidden;
              background: transparent;
              color: var(--text);
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
              font-size: 13.5px;
              line-height: 1.68;
              font-weight: 400;
              letter-spacing: 0;
            }
            body {
              padding-bottom: 1px;
            }
            p {
              margin: 0 0 16px;
            }
            p:last-child {
              margin-bottom: 0;
            }
            h1, h2, h3, h4, h5, h6 {
              margin: 26px 0 9px;
              color: var(--strong);
              line-height: 1.25;
              font-weight: 700;
            }
            h1:first-child, h2:first-child, h3:first-child, h4:first-child, h5:first-child, h6:first-child {
              margin-top: 0;
            }
            h1 { font-size: 1.22em; }
            h2 { font-size: 1.18em; }
            h3 { font-size: 1.10em; }
            h4, h5, h6 { font-size: 1em; }
            strong {
              color: var(--strong);
              font-weight: 700;
            }
            em {
              color: var(--text);
            }
            ul, ol {
              margin: 0 0 20px 1.34em;
              padding: 0;
            }
            li {
              margin: 7px 0;
              padding-left: 0.15em;
            }
            li > ul, li > ol {
              margin-top: 7px;
              margin-bottom: 7px;
            }
            blockquote {
              margin: 18px 0 20px;
              border-left: 3px solid rgba(134, 177, 230, 0.55);
              padding: 3px 0 3px 16px;
              color: var(--muted);
              font-style: italic;
            }
            code {
              display: inline-block;
              position: relative;
              top: -0.03em;
              max-width: 100%;
              margin: 0 1px;
              border: 1px solid var(--pill-border);
              border-radius: 5px;
              background: var(--pill-bg);
              padding: 0.03em 0.40em 0.08em;
              color: var(--pill-text);
              font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
              font-size: 0.88em;
              font-weight: 650;
              line-height: 1.28;
              white-space: normal;
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            pre {
              margin: 18px 0 20px;
              overflow-x: auto;
              border: 1px solid var(--code-border);
              border-radius: 6px;
              background: var(--code-block);
              padding: 13px 15px;
            }
            pre code {
              display: block;
              top: 0;
              max-width: none;
              margin: 0;
              border: 0;
              border-radius: 0;
              background: transparent;
              padding: 0;
              white-space: pre;
              overflow-wrap: normal;
              word-break: normal;
              line-height: 1.55;
            }
            a {
              color: var(--accent);
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          \(markdownToHTML(markdown))
        </body>
        </html>
        """
    }

    static func htmlDocument(markdown: String, metadata: [(key: String, value: String)]) -> String {
        """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              color-scheme: dark;
              --page: #0e1319;
              --panel: #151c24;
              --panel-2: #1c2530;
              --text: #e0e0da;
              --muted: #94979d;
              --border: rgba(147, 156, 166, 0.38);
              --border-strong: rgba(147, 156, 166, 0.62);
              --blue: #508dd7;
              --green: #64d78d;
              --purple: #9b8ad7;
              --amber: #d6b966;
              --code: #111820;
            }
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              min-height: 100%;
              background: var(--page);
              color: var(--text);
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
              font-size: 15px;
              line-height: 1.62;
            }
            body { padding: 28px 34px 42px; }
            main {
              max-width: 980px;
              margin: 0 auto;
            }
            .frontmatter {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 12px;
              margin: 0 0 28px;
              padding: 18px;
              background: linear-gradient(135deg, rgba(155, 138, 215, 0.16), rgba(80, 141, 215, 0.10));
              border: 1px solid rgba(155, 138, 215, 0.34);
              border-radius: 8px;
            }
            .meta-item { min-width: 0; }
            .meta-key {
              display: block;
              margin-bottom: 4px;
              color: var(--purple);
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.05em;
              text-transform: uppercase;
            }
            .meta-value {
              color: var(--text);
              font-weight: 600;
              overflow-wrap: anywhere;
            }
            h1, h2, h3, h4, h5, h6 {
              margin: 1.45em 0 0.45em;
              line-height: 1.22;
              color: #f0f0eb;
              font-weight: 760;
            }
            h1 {
              margin-top: 0;
              padding-bottom: 0.38em;
              border-bottom: 1px solid var(--border);
              font-size: 2.0rem;
            }
            h2 {
              padding-top: 0.25em;
              padding-bottom: 0.25em;
              border-bottom: 1px solid rgba(147, 156, 166, 0.22);
              font-size: 1.45rem;
            }
            h3 { font-size: 1.18rem; }
            h4 { font-size: 1.05rem; color: #e9e9e3; }
            p { margin: 0 0 1em; }
            a { color: var(--blue); text-decoration: none; }
            a:hover { text-decoration: underline; }
            strong { font-weight: 760; color: #f2f2ed; }
            em { color: #ededdf; }
            ul, ol { margin: 0 0 1em 1.4em; padding: 0; }
            li { margin: 0.28em 0; padding-left: 0.15em; }
            li > ul, li > ol { margin-top: 0.25em; margin-bottom: 0.25em; }
            blockquote {
              margin: 1.1em 0;
              padding: 0.78em 1em;
              color: var(--muted);
              background: rgba(255, 255, 255, 0.025);
              border-left: 3px solid var(--border-strong);
              border-radius: 0 6px 6px 0;
            }
            code {
              padding: 0.12em 0.34em;
              background: rgba(255, 255, 255, 0.055);
              border: 1px solid rgba(147, 156, 166, 0.18);
              border-radius: 4px;
              color: #f2efe6;
              font-family: "SF Mono", Menlo, Consolas, monospace;
              font-size: 0.92em;
            }
            pre {
              margin: 1.1em 0 1.25em;
              padding: 15px 16px;
              overflow-x: auto;
              background: var(--code);
              border: 1px solid rgba(147, 156, 166, 0.24);
              border-radius: 7px;
            }
            pre code {
              display: block;
              padding: 0;
              background: transparent;
              border: 0;
              white-space: pre;
              line-height: 1.52;
            }
            table {
              display: block;
              width: max-content;
              max-width: 100%;
              margin: 1.15em 0 1.4em;
              overflow-x: auto;
              border-collapse: separate;
              border-spacing: 0;
              border: 1px solid var(--border);
              border-radius: 7px;
              background: rgba(255, 255, 255, 0.018);
            }
            th, td {
              padding: 8px 11px;
              border-right: 1px solid rgba(147, 156, 166, 0.30);
              border-bottom: 1px solid rgba(147, 156, 166, 0.30);
              vertical-align: top;
              text-align: left;
            }
            th {
              position: sticky;
              top: 0;
              background: var(--panel-2);
              color: #f0f0eb;
              font-weight: 720;
            }
            tr:last-child td { border-bottom: 0; }
            th:last-child, td:last-child { border-right: 0; }
            hr {
              border: 0;
              border-top: 1px solid var(--border);
              margin: 1.7em 0;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 6px;
              border: 1px solid var(--border);
            }
          </style>
        </head>
        <body>
          <main>
            \(metadataHTML(metadata))
            \(markdownToHTML(markdown))
          </main>
        </body>
        </html>
        """
    }

    private static func metadataHTML(_ metadata: [(key: String, value: String)]) -> String {
        guard !metadata.isEmpty else { return "" }
        let items = metadata.map { item in
            """
            <div class="meta-item">
              <span class="meta-key">\(escapeHTML(item.key))</span>
              <div class="meta-value">\(inlineMarkdownHTML(item.value))</div>
            </div>
            """
        }.joined(separator: "\n")
        return "<section class=\"frontmatter\">\n\(items)\n</section>"
    }

    private static func markdownToHTML(_ markdown: String) -> String {
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let lines = normalized.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var html: [String] = []
        var index = 0
        var paragraph: [String] = []
        var listStack: [(tag: String, indent: Int)] = []

        func flushParagraph() {
            guard !paragraph.isEmpty else { return }
            html.append("<p>\(inlineMarkdownHTML(paragraph.joined(separator: " ")))</p>")
            paragraph.removeAll()
        }

        func closeLists(to level: Int = 0) {
            while listStack.count > level {
                html.append("</\(listStack.removeLast().tag)>")
            }
        }

        func adjustLists(for tag: String, indent: Int) {
            while let last = listStack.last, indent < last.indent {
                html.append("</\(listStack.removeLast().tag)>")
            }
            if let last = listStack.last, indent == last.indent, tag != last.tag {
                html.append("</\(listStack.removeLast().tag)>")
            }
            if listStack.last?.indent != indent || listStack.last?.tag != tag {
                listStack.append((tag: tag, indent: indent))
                html.append("<\(tag)>")
            }
        }

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if trimmed.hasPrefix("```") {
                flushParagraph()
                closeLists()
                var code: [String] = []
                index += 1
                while index < lines.count, !lines[index].trimmingCharacters(in: .whitespaces).hasPrefix("```") {
                    code.append(lines[index])
                    index += 1
                }
                html.append("<pre><code>\(escapeHTML(code.joined(separator: "\n")))</code></pre>")
            } else if trimmed.isEmpty {
                flushParagraph()
                closeLists()
            } else if let heading = headingHTML(trimmed) {
                flushParagraph()
                closeLists()
                html.append(heading)
            } else if isTableStart(lines, index: index) {
                flushParagraph()
                closeLists()
                let table = tableHTML(lines, start: index)
                html.append(table.html)
                index = table.endIndex
                continue
            } else if trimmed.hasPrefix(">") {
                flushParagraph()
                closeLists()
                var quote: [String] = [trimmed.dropFirst().trimmingCharacters(in: .whitespaces)]
                index += 1
                while index < lines.count {
                    let next = lines[index].trimmingCharacters(in: .whitespaces)
                    guard next.hasPrefix(">") else { break }
                    quote.append(next.dropFirst().trimmingCharacters(in: .whitespaces))
                    index += 1
                }
                html.append("<blockquote>\(markdownToHTML(quote.joined(separator: "\n")))</blockquote>")
                continue
            } else if let item = listItem(line) {
                flushParagraph()
                let tag = item.ordered ? "ol" : "ul"
                adjustLists(for: tag, indent: item.indent)
                html.append("<li>\(inlineMarkdownHTML(item.text))</li>")
            } else if trimmed == "---" || trimmed == "***" || trimmed == "___" {
                flushParagraph()
                closeLists()
                html.append("<hr>")
            } else {
                paragraph.append(trimmed)
            }
            index += 1
        }
        flushParagraph()
        closeLists()
        return html.joined(separator: "\n")
    }

    private static func headingHTML(_ trimmed: String) -> String? {
        var level = 0
        for char in trimmed {
            if char == "#" { level += 1 } else { break }
        }
        guard (1...6).contains(level),
              trimmed.dropFirst(level).first == " "
        else { return nil }
        let text = String(trimmed.dropFirst(level + 1))
        return "<h\(level)>\(inlineMarkdownHTML(text))</h\(level)>"
    }

    private static func listItem(_ line: String) -> (ordered: Bool, indent: Int, text: String)? {
        let indent = line.prefix { $0 == " " || $0 == "\t" }.reduce(0) { count, char in
            count + (char == "\t" ? 4 : 1)
        }
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") || trimmed.hasPrefix("+ ") {
            return (false, indent, String(trimmed.dropFirst(2)))
        }
        guard let dot = trimmed.firstIndex(of: ".") else { return nil }
        let prefix = trimmed[..<dot]
        guard !prefix.isEmpty, prefix.allSatisfy(\.isNumber) else { return nil }
        let after = trimmed.index(after: dot)
        guard after < trimmed.endIndex, trimmed[after] == " " else { return nil }
        return (true, indent, String(trimmed[trimmed.index(after: after)...]))
    }

    private static func isTableStart(_ lines: [String], index: Int) -> Bool {
        guard index + 1 < lines.count else { return false }
        let first = lines[index].trimmingCharacters(in: .whitespaces)
        let second = lines[index + 1].trimmingCharacters(in: .whitespaces)
        return first.contains("|") && second.range(of: #"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$"#, options: .regularExpression) != nil
    }

    private static func tableHTML(_ lines: [String], start: Int) -> (html: String, endIndex: Int) {
        let headers = tableCells(lines[start])
        var rows: [[String]] = []
        var index = start + 2
        while index < lines.count {
            let line = lines[index].trimmingCharacters(in: .whitespaces)
            guard line.contains("|"), !line.isEmpty else { break }
            rows.append(tableCells(line))
            index += 1
        }
        let head = headers.map { "<th>\(inlineMarkdownHTML($0))</th>" }.joined()
        let body = rows.map { row in
            "<tr>\(row.map { "<td>\(inlineMarkdownHTML($0))</td>" }.joined())</tr>"
        }.joined(separator: "\n")
        return ("<table><thead><tr>\(head)</tr></thead><tbody>\(body)</tbody></table>", index)
    }

    private static func tableCells(_ line: String) -> [String] {
        var text = line.trimmingCharacters(in: .whitespaces)
        if text.hasPrefix("|") { text.removeFirst() }
        if text.hasSuffix("|") { text.removeLast() }
        return text.split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private static func inlineMarkdownHTML(_ source: String) -> String {
        var output = escapeHTML(source)
        output = replaceRegex(output, pattern: #"`([^`]+)`"#, template: #"<code>$1</code>"#)
        output = replaceRegex(output, pattern: #"\*\*([^*]+)\*\*"#, template: #"<strong>$1</strong>"#)
        output = replaceRegex(output, pattern: #"__([^_]+)__"#, template: #"<strong>$1</strong>"#)
        output = replaceRegex(output, pattern: #"(?<!\*)\*([^*]+)\*(?!\*)"#, template: #"<em>$1</em>"#)
        output = replaceRegex(output, pattern: #"(?<!_)_([^_]+)_(?!_)"#, template: #"<em>$1</em>"#)
        output = replaceRegex(output, pattern: #"\[([^\]]+)\]\((https?://[^)\s]+)\)"#, template: #"<a href="$2">$1</a>"#)
        output = replaceRegex(output, pattern: #"(?<!href=")(https?://[^\s<]+)"#, template: #"<a href="$1">$1</a>"#)
        return output
    }

    private static func replaceRegex(_ source: String, pattern: String, template: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return source }
        let range = NSRange(source.startIndex..<source.endIndex, in: source)
        return regex.stringByReplacingMatches(in: source, range: range, withTemplate: template)
    }

    private static func escapeHTML(_ source: String) -> String {
        source
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}

struct ComponentInventoryItem: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var owner: String
    var sourceFile: String
    var activeSurfaces: [String]
    var stateCoverage: [String]
    var accessibilityEvidence: String
    var visualEvidence: String
    var residualStatus: String
}

struct VisualSystemAuditItem: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var nativeValue: String
    var webSourceEvidence: String
    var activeUseSites: [String]
    var evidenceStatus: String
    var residualStatus: String
}

struct AssetManifestItem: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var family: String
    var sourceRoot: String
    var bundledCount: Int?
    var visibleCount: Int?
    var hiddenCount: Int?
    var fallbackContract: String
    var decisionStatus: String
    var releaseDisposition: String
    var evidence: String
}

struct AccessibilityEvidenceMatrixItem: Identifiable, Equatable {
    var id: String { key }
    var key: String
    var surfaceFamily: String
    var surfaceScope: [String]
    var keyboardEvidence: String
    var voiceOverHelpEvidence: String
    var visualEvidence: String
    var manualEvidence: String
    var unavailableEvidence: String
    var residualStatus: String
}

enum RCComponentBaseline {
    static let cornerRadius: CGFloat = 4
    static let iconButtonSize: CGFloat = 32
    static let compactIconButtonSize: CGFloat = 28
    static let messageIconButtonSize: CGFloat = 24
    static let sidebarWidth: CGFloat = 370
    static let minimumWindowSize = CGSize(width: 980, height: 640)
    static let standardWindowSize = CGSize(width: 1280, height: 820)
    static let appIconAssetRoot = "Assets/AppIcon"
    static let avatarAssetRoot = "Assets/avatars/illustrated"
    static let broaderAssetDecisionId = "D-0005"

    static let inventory: [ComponentInventoryItem] = [
        ComponentInventoryItem(
            key: "icon-button",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Sidebar", "Message actions", "Composer", "Harness auth"],
            stateCoverage: ["normal", "pressed", "disabled", "help-labeled"],
            accessibilityEvidence: "Icon-only buttons expose help and accessibility labels at call sites.",
            visualEvidence: "Compact controls use fixed dimensions and 4 px radius.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "status-badge",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Harnesses", "Messages", "Runtime status"],
            stateCoverage: ["connected", "pending", "warning", "error", "role"],
            accessibilityEvidence: "StatusBadge carries a text label and optional accessibility label.",
            visualEvidence: "Status uses text plus tone, not color alone.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "search-field",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Conversations", "Agents"],
            stateCoverage: ["empty", "typed", "clear-action"],
            accessibilityEvidence: "Search fields and clear buttons expose labels/help.",
            visualEvidence: "Search field has stable 48 px height.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "avatar-editor",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Agent edit", "Agent create", "Account"],
            stateCoverage: ["bundled", "selected", "upload", "remove", "fallback"],
            accessibilityEvidence: "Avatar choices, upload, and remove actions expose labels.",
            visualEvidence: "Bundled illustrated avatars and initials fallback are deterministic.",
            residualStatus: "D-0005 broader assets remain decision-gated"
        ),
        ComponentInventoryItem(
            key: "form-card",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Account", "Harnesses", "Agent forms"],
            stateCoverage: ["normal", "disabled", "error", "long-content"],
            accessibilityEvidence: "LabeledTextField supplies labels for native text fields.",
            visualEvidence: "Form cards use shared surface, border, spacing, and 4 px radius.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "empty-loading-state",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Chat", "Agents", "App loading"],
            stateCoverage: ["empty", "loading", "no-match", "action"],
            accessibilityEvidence: "Empty and loading states expose stable labels.",
            visualEvidence: "Reusable state views constrain copy width and center content.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "composer",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Chat"],
            stateCoverage: ["empty", "typed", "disabled", "busy"],
            accessibilityEvidence: "Composer editor and send action expose labels and disabled hints.",
            visualEvidence: "Composer keeps stable height and scrollable text input.",
            residualStatus: "HTML-native rendering remains out of scope"
        ),
        ComponentInventoryItem(
            key: "guarded-nav",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["Sidebar", "Shell navigation"],
            stateCoverage: ["active", "selected", "unavailable", "excluded"],
            accessibilityEvidence: "Guarded nav uses resolver labels, hints, help, and non-color glyph state.",
            visualEvidence: "Guarded nav buttons use fixed height and shared shell tokens.",
            residualStatus: "verified-unavailable for future sections"
        ),
        ComponentInventoryItem(
            key: "asset-manifest",
            owner: "native-ui",
            sourceFile: "UIComponents.swift",
            activeSurfaces: ["App icon", "Avatar editor", "Applications", "AgentOps"],
            stateCoverage: ["bundled", "visible", "hidden", "missing", "decision-gated"],
            accessibilityEvidence: "Asset fallback rows require accessible text or native labels.",
            visualEvidence: "RCAssetManifest records source roots, counts, fallback contracts, and D-0005 residuals.",
            residualStatus: "D-0005 broader asset parity remains decision-gated"
        ),
        ComponentInventoryItem(
            key: "app-icon-fallback",
            owner: "native-ui",
            sourceFile: "UIComponents.swift, ApplicationsService.swift, Views.swift",
            activeSurfaces: ["Shell header", "Applications marketplace", "Provider connections"],
            stateCoverage: ["bundled", "generated", "missing-logo", "read-only"],
            accessibilityEvidence: "Generated marketplace icons expose initials and a deterministic fallback label.",
            visualEvidence: "ApplicationsIconFallbackView uses shared 4 px radius and deterministic palette names.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "badge-meta-row",
            owner: "native-ui",
            sourceFile: "UIComponents.swift, Views.swift",
            activeSurfaces: ["Messages", "Applications", "AgentOps", "Insights", "Settings"],
            stateCoverage: ["status", "risk", "role", "meta", "sensitive", "read-only"],
            accessibilityEvidence: "StatusBadge and role/meta rows include text labels instead of color-only state.",
            visualEvidence: "Shared badge geometry covers status, risk, app, and runtime meta rows.",
            residualStatus: "verified-baseline"
        ),
        ComponentInventoryItem(
            key: "retry-error-state",
            owner: "native-ui",
            sourceFile: "UIComponents.swift, Views.swift",
            activeSurfaces: ["Applications", "Insights", "Runtime dispatch", "AgentOps", "Agent tasks"],
            stateCoverage: ["error", "retry", "stale", "blocked", "read-only", "permission-needed"],
            accessibilityEvidence: "Retry buttons and unavailable states expose help/accessibility labels at call sites.",
            visualEvidence: "Error, retry, and unavailable states reuse EmptyMini, EmptyMiniLight, StatusBadge, and shared button styles.",
            residualStatus: "manual visual matrix deferred to ITC-0054"
        )
    ]
}

enum RCVisualSystemAudit {
    static let branchScope = "ITC-0053 asset-manifest visual-system component-polish"
    static let sourceMapId = "SM-0267"
    static let webSourceBaseline = [
        "web/app/globals.css",
        "web/components/app-shell/app-sidebar.tsx",
        "web/components/shared/empty-state.tsx",
        "web/components/shared/risk-badge.tsx",
        "web/components/shared/agent-app-badge-strip.tsx",
        "web/lib/participant-message-style.ts"
    ]
    static let macOSDivergence = "Native SwiftUI controls keep system focus rings, text fields, pickers, and ProgressView behavior while mapping Claw Classic colors, 4 px radii, dense spacing, badge text, and non-color status semantics."

    static let tokenAudit: [VisualSystemAuditItem] = [
        VisualSystemAuditItem(
            key: "page-sidebar-surface",
            nativeValue: "RCTheme.page/sidebarSurface/sidebarSurfaceAlt/surfaceInset/surfaceHover/sidebarSelected",
            webSourceEvidence: "globals.css shell and app-sidebar Claw Classic dark surface tokens",
            activeUseSites: ["Shell", "Sidebar", "Forms", "Settings", "Applications", "AgentOps"],
            evidenceStatus: "source-audited",
            residualStatus: "standard/minimum-window visual capture deferred to ITC-0054"
        ),
        VisualSystemAuditItem(
            key: "text-muted-border",
            nativeValue: "RCTheme.text/muted/border/borderSoft/borderStrong",
            webSourceEvidence: "globals.css foreground, muted foreground, and border tokens",
            activeUseSites: ["Meta rows", "Badges", "Message cards", "Search", "Forms"],
            evidenceStatus: "source-audited",
            residualStatus: "contrast measurement deferred to ITC-0054"
        ),
        VisualSystemAuditItem(
            key: "accent-status-risk",
            nativeValue: "RCTheme.accentBlue/accentGreen/accentPurple/accentAmber/accentRed with ComponentTone",
            webSourceEvidence: "risk-badge, app badge strip, participant message styles, runtime status rows",
            activeUseSites: ["StatusBadge", "Risk badge rows", "Runtime rows", "AgentOps state", "Insights state"],
            evidenceStatus: "source-audited",
            residualStatus: "manual badge contrast review deferred to ITC-0054"
        ),
        VisualSystemAuditItem(
            key: "radius-density",
            nativeValue: "RCComponentBaseline.cornerRadius 4, iconButtonSize 32, compactIconButtonSize 28, messageIconButtonSize 24",
            webSourceEvidence: "compact web message, marketplace, and operational panel controls",
            activeUseSites: ["Icon buttons", "StatusBadge", "FormCard", "ApplicationsIconFallbackView", "Guarded nav"],
            evidenceStatus: "source-audited",
            residualStatus: "one-off legacy radii require future screenshot review"
        ),
        VisualSystemAuditItem(
            key: "focus-disabled-selected",
            nativeValue: "Native SwiftUI focus plus selected overlays, disabled buttons, reason-backed help, and guarded route notices",
            webSourceEvidence: "app-sidebar selected/disabled states and shared empty/unavailable state patterns",
            activeUseSites: ["ShellIconRail", "SearchField", "AvatarEditor", "Composer", "Applications", "AgentOps"],
            evidenceStatus: "source-audited",
            residualStatus: "keyboard and VoiceOver matrix deferred to ITC-0054"
        )
    ]
}

enum RCAssetManifest {
    static let decisionId = RCComponentBaseline.broaderAssetDecisionId
    static let sourceMapId = "SM-0267"
    static let appIconBundleCount = 3
    static let appIconVisibleRasterCount = 2
    static let curatedIllustratedAvatarBundleCount = 42
    static let curatedIllustratedAvatarVisibleCount = 41
    static let hiddenIllustratedAvatarCount = 1
    static let broaderWebAvatarDecisionClaim = "full-359-avatar-bundle-claim-blocked-by-D-0005"
    static let broaderWebAvatarCurrentReference = "PRD-027-002 records current web public/avatars counts as source references only; future branches must recount before any bundle claim."
    static let fallbackDeterminism = "stable-seed-no-network-redacted"
    static let avatarUploadValidationSummary = "png-jpeg-only; max-3145728-bytes; crop-positioning; data-url-persistence; private-path-excluded"

    static let manifest: [AssetManifestItem] = [
        AssetManifestItem(
            key: "app-icons",
            family: "bundled-app-icons",
            sourceRoot: RCComponentBaseline.appIconAssetRoot,
            bundledCount: appIconBundleCount,
            visibleCount: appIconVisibleRasterCount,
            hiddenCount: 0,
            fallbackContract: "appIconImage() loads source.png, then icon.png, while RelayLogo remains generated native fallback.",
            decisionStatus: "approved-current",
            releaseDisposition: "verified-source-counts-visual-review-pending",
            evidence: "Package.swift processes Resources; UIComponents.swift owns bundle lookup."
        ),
        AssetManifestItem(
            key: "curated-illustrated-avatars",
            family: "curated-native-avatars",
            sourceRoot: RCComponentBaseline.avatarAssetRoot,
            bundledCount: curatedIllustratedAvatarBundleCount,
            visibleCount: curatedIllustratedAvatarVisibleCount,
            hiddenCount: hiddenIllustratedAvatarCount,
            fallbackContract: "defaultIllustratedAvatarURL(seed:) uses stableAvatarIndex and excludes hiddenIllustratedAvatarResourceName.",
            decisionStatus: "approved-current-with-hidden-row",
            releaseDisposition: "verified-source-counts-visual-review-pending",
            evidence: "AvatarEditor lists illustratedAvatarResourceNames; AgentAvatarView falls back to initials."
        ),
        AssetManifestItem(
            key: "uploaded-avatar-validation",
            family: "user-uploaded-avatar",
            sourceRoot: "NSOpenPanel user selection",
            bundledCount: nil,
            visibleCount: nil,
            hiddenCount: nil,
            fallbackContract: avatarUploadValidationSummary,
            decisionStatus: "local-first-current",
            releaseDisposition: "type-size-validation-source-backed",
            evidence: "chooseAvatarFile validates PNG/JPEG and maximumAvatarUploadBytes; AvatarCropEditor positions and renders cropped data URLs before persistence."
        ),
        AssetManifestItem(
            key: "deterministic-marketplace-icons",
            family: "app-integration-fallback-icons",
            sourceRoot: "ApplicationsService.iconFallback",
            bundledCount: nil,
            visibleCount: nil,
            hiddenCount: nil,
            fallbackContract: "slug/name initials plus deterministic palette colorName, no network logo dependency.",
            decisionStatus: "approved-current-fallback",
            releaseDisposition: "source-backed-visual-review-pending",
            evidence: "MarketplaceIconFallback.source is deterministic-slug-fallback; ApplicationsIconFallbackView exposes accessible text."
        ),
        AssetManifestItem(
            key: "agentops-floor-worker-assets",
            family: "agentops-native-scene-assets",
            sourceRoot: "Assets/agent-ops-hq and RelayConsoleCore/Resources/AgentOps",
            bundledCount: 7,
            visibleCount: 4,
            hiddenCount: 3,
            fallbackContract: "bundled_web_agentops_floor_worker_assets; deterministic visual fallback only when a bundled image cannot load",
            decisionStatus: "D-0005-resolved-for-agentops-floor-worker-assets",
            releaseDisposition: "bundled-floor-active-worker-sprites",
            evidence: "AgentOpsService loads default-operations-floor-layout.json; AgentOpsVisualSceneView loads the floor PNG and worker sprite frames from the processed app resource bundle."
        ),
        AssetManifestItem(
            key: "brand-landing-broader-assets",
            family: "broader-web-assets",
            sourceRoot: "web/public/avatars, web/public/brand, web/public/landing, web/public/agent-ops-hq",
            bundledCount: 0,
            visibleCount: 0,
            hiddenCount: 0,
            fallbackContract: broaderWebAvatarDecisionClaim,
            decisionStatus: "decision_gated_d0005",
            releaseDisposition: "not-bundled-no-parity-claim",
            evidence: broaderWebAvatarCurrentReference
        )
    ]
}

enum RCAccessibilityEvidenceMatrix {
    static let branchScope = "ITC-0054 accessibility-keyboard-manual-visual-evidence-matrix"
    static let sourceMapId = "SM-0268"
    static let demoId = "Demo 8"
    static let standardWindow = RCComponentBaseline.standardWindowSize
    static let minimumWindow = RCComponentBaseline.minimumWindowSize
    static let visualArtifactStatus = "standard-minimum-window-screenshots-planned-not-captured"
    static let keyboardReviewStatus = "keyboard-traversal-source-anchored-manual-review-planned"
    static let voiceOverReviewStatus = "voiceover-help-labels-source-anchored-manual-review-planned"
    static let manualReviewStatus = "manual-demo-8-review-planned-partial"
    static let retainedSurfaceRule = "retained-surfaces-only-excluded-surfaces-stay-unavailable"

    static let automationLayerStatus = [
        "build: source-verified",
        "smoke: source-verified",
        "migration: dependency-verified",
        "model-contract: dependency-verified",
        "service: dependency-verified",
        "event-relaunch: dependency-verified",
        "real-harness: residual-manual",
        "ui: source-verified",
        "visual: planned-partial",
        "accessibility: planned-partial",
        "manual: planned-partial",
        "aggregation: pending-ITC-0055",
        "deployment: not-applicable-no-backend-change"
    ]

    static let activeSurfaceMatrix: [AccessibilityEvidenceMatrixItem] = [
        AccessibilityEvidenceMatrixItem(
            key: "shell-navigation",
            surfaceFamily: "Shell/sidebar/navigation",
            surfaceScope: ["WindowGroup", "ShellIconRail", "AccountCard", "New Chat command", "GuardedShellNotice"],
            keyboardEvidence: "Command-N, guarded nav buttons, account settings, and dismissible guarded notice are source-visible.",
            voiceOverHelpEvidence: "Shell icon rail uses resolver labels/help; New Chat and guarded notices have text labels.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "Approvals and any excluded shell routes stay unavailable or omitted.",
            residualStatus: "manual keyboard/focus/window capture required"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "chats-thread-detail-composer",
            surfaceFamily: "Chats/thread list/detail/messages/composer",
            surfaceScope: ["Thread list", "Message bubbles", "Composer", "Attachments", "References", "Runtime dispatch rows"],
            keyboardEvidence: "Composer submit, attach, remove, copy, retry, cancel, jump, and search controls are source-visible.",
            voiceOverHelpEvidence: "Copy, attachment, composer, runtime, redacted reference, and badge labels are source-visible.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "html_native remains blocked_action rendering.unavailable.",
            residualStatus: "long-message, code, markdown, disabled send, and copy feedback manual review required"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "agents-org-work",
            surfaceFamily: "Agents/org/work dashboard",
            surfaceScope: ["Agent picker", "Agent instructions", "Agent memory", "Agent skills", "Create/edit", "Avatar editor", "Work", "Calendar and schedule", "Team memory"],
            keyboardEvidence: "Search, create, edit, direct chat, calendar navigation, task, manager, and save controls are source-visible.",
            voiceOverHelpEvidence: "Avatar choices, status badges, task controls, manager state, and unavailable panels expose labels/help.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "Task mutation, approvals, and memory writes stay guarded until authority evidence passes.",
            residualStatus: "avatar picker/upload, long names, task states, and focus order manual review required"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "applications-runtime",
            surfaceFamily: "Applications marketplace",
            surfaceScope: ["Marketplace", "Provider connections"],
            keyboardEvidence: "Search, category filtering, app selection, retry catalogue, and provider auth controls are source-visible.",
            voiceOverHelpEvidence: "Branded app icons, status badges, provider setup controls, secret references, and connection details expose text labels.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "Local app/source-host/generated-pack and Paperclip scope remain excluded unless reinstated.",
            residualStatus: "marketplace list, provider panels, read-only/member state, and OAuth setup manual review required"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "settings-insights-reports",
            surfaceFamily: "Settings/Insights/reports/wrap-ups",
            surfaceScope: ["Account", "Appearance", "Workspace", "Team routing", "Integrations", "Alerts", "Security", "Insights list/detail/analytics"],
            keyboardEvidence: "Settings rows, save buttons, mark read/all read, local export, confirmed cleanup, archive, retry, and CSV/JSON copy controls are source-visible.",
            voiceOverHelpEvidence: "Read-only badges, decision gates, local-first security, alert states, report status, and archive/retry labels are source-visible.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "D-0001 support/legal/status and D-0004 cloud account remain decision_gated. D-0006 local lifecycle cleanup is approved with typed confirmation.",
            residualStatus: "settings/report minimum-window, long report names, and decision-gate manual review required"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "agentops-native-scene",
            surfaceFamily: "AgentOps native visual scene",
            surfaceScope: ["Scene", "HUD", "Room labels", "Entity nodes", "Paths", "Event feed", "Selected panel", "Read-only layout editor"],
            keyboardEvidence: "Refresh, bounds, paths, layout editor, selected entity rows, sidebar filters, and retry controls are source-visible.",
            voiceOverHelpEvidence: "Scene, room, path, entity, status, source-record, fallback, and layout editor labels are source-visible.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "D-0005 floor/worker asset parity and writable layout editing remain unavailable.",
            residualStatus: "scene screenshot, selected/empty/error states, keyboard, and VoiceOver manual review required"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "work-safety-local-files-high-risk",
            surfaceFamily: "Retained local file and high-risk action states",
            surfaceScope: ["Native file permission", "Controlled write actions", "Task-scoped approval states", "Permission policy", "Audit/security"],
            keyboardEvidence: "Permission-needed, read-only, blocked, approval-required, dry-run, retry, and copy evidence controls are source-visible where retained.",
            voiceOverHelpEvidence: "Status badges, denied/blocked reasons, permission labels, and audit-safe copy labels are source-visible.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "Standalone Approvals and local app autonomy remain excluded unless reinstated.",
            residualStatus: "high-risk retained action manual/a11y review and real-harness observation remain residual"
        )
    ]

    static let guardedUnavailableMatrix: [AccessibilityEvidenceMatrixItem] = [
        AccessibilityEvidenceMatrixItem(
            key: "decision-gated-support-cloud-assets-lifecycle",
            surfaceFamily: "Decision-gated support, cloud, assets, lifecycle",
            surfaceScope: ["D-0001 support/legal/status", "D-0004 cloud account", "D-0005 broader assets", "D-0006 export/reset/removal"],
            keyboardEvidence: "Unavailable rows remain non-executable and source-visible.",
            voiceOverHelpEvidence: "Decision-required badges and unavailable copy are text-bearing.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: "manual-evidence/decision-gates/support-cloud-assets-001 plus ITC-0054 manual review planned",
            unavailableEvidence: "decision.required with explicit activation requirements and release impact.",
            residualStatus: "verified-unavailable-source manual-review-planned"
        ),
        AccessibilityEvidenceMatrixItem(
            key: "excluded-renderer-app-paperclip-approvals",
            surfaceFamily: "Excluded or unsupported surfaces",
            surfaceScope: ["html_native", "Paperclip", "local app/source-host/generated-pack", "standalone Approvals", "Mission Control host-control"],
            keyboardEvidence: "Excluded or blocked controls remain absent, disabled, or unavailable.",
            voiceOverHelpEvidence: "Unavailable renderer and excluded scope notes are text-bearing where surfaced.",
            visualEvidence: visualArtifactStatus,
            manualEvidence: manualReviewStatus,
            unavailableEvidence: "rendering.unavailable, feature.unavailable, or explicit excluded-scope evidence.",
            residualStatus: "not-active-parity"
        )
    ]
}

enum ComponentTone {
    case neutral
    case blue
    case green
    case purple
    case amber
    case red

    var color: Color {
        switch self {
        case .neutral:
            return RCTheme.muted
        case .blue:
            return RCTheme.accentBlue
        case .green:
            return RCTheme.accentGreen
        case .purple:
            return RCTheme.accentPurple
        case .amber:
            return RCTheme.accentAmber
        case .red:
            return RCTheme.accentRed
        }
    }

    var background: Color {
        color.opacity(0.14)
    }
}

struct IconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RCIconButtonInteractionBody(
            label: configuration.label,
            isPressed: configuration.isPressed,
            variant: .standard
        )
    }
}

struct IconLightButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RCIconButtonInteractionBody(
            label: configuration.label,
            isPressed: configuration.isPressed,
            variant: .light
        )
    }
}

private enum RCIconButtonInteractionVariant {
    case standard
    case light
    case message

    var fontSize: CGFloat {
        switch self {
        case .standard, .light:
            return 14
        case .message:
            return 13
        }
    }

    var size: CGFloat {
        switch self {
        case .standard:
            return RCComponentBaseline.iconButtonSize
        case .light:
            return RCComponentBaseline.compactIconButtonSize
        case .message:
            return RCComponentBaseline.messageIconButtonSize
        }
    }

    func foreground(isEnabled: Bool, isActive: Bool) -> Color {
        guard isEnabled else { return RCTheme.muted.opacity(0.58) }
        switch self {
        case .standard:
            return RCTheme.text
        case .light, .message:
            return isActive ? RCTheme.text : RCTheme.muted
        }
    }

    func background(isEnabled: Bool, isPressed: Bool, isHovered: Bool, isFocused: Bool) -> Color {
        guard isEnabled else {
            return self == .message ? Color.clear : RCTheme.sidebarSurfaceAlt.opacity(0.62)
        }
        let active = isPressed || isHovered || isFocused
        switch self {
        case .standard:
            return active ? RCTheme.surfaceHover : RCTheme.sidebarSurfaceAlt
        case .light:
            if isPressed || isFocused {
                return Color.white.opacity(0.055)
            }
            return isHovered ? Color.white.opacity(0.035) : RCTheme.sidebarSurfaceAlt
        case .message:
            if isPressed || isFocused {
                return Color.white.opacity(0.055)
            }
            return isHovered ? Color.white.opacity(0.035) : Color.clear
        }
    }

    func border(isEnabled: Bool, isPressed: Bool, isHovered: Bool, isFocused: Bool) -> Color {
        guard isEnabled else { return self == .message ? Color.clear : RCTheme.borderSoft.opacity(0.62) }
        if isFocused {
            return RCTheme.accentBlue.opacity(0.68)
        }
        if isPressed || isHovered {
            return RCTheme.borderStrong
        }
        return self == .message ? Color.clear : RCTheme.borderSoft
    }
}

private struct RCIconButtonInteractionBody<Label: View>: View {
    let label: Label
    let isPressed: Bool
    let variant: RCIconButtonInteractionVariant

    var body: some View {
        RCHoverFocusReader { state in
            label
                .font(.system(size: variant.fontSize, weight: .semibold))
                .foregroundStyle(variant.foreground(isEnabled: state.isEnabled, isActive: state.isActive(isPressed: isPressed)))
                .frame(width: variant.size, height: variant.size)
                .background(
                    variant.background(
                        isEnabled: state.isEnabled,
                        isPressed: isPressed,
                        isHovered: state.isHovered,
                        isFocused: state.isFocused
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius)
                        .stroke(
                            variant.border(
                                isEnabled: state.isEnabled,
                                isPressed: isPressed,
                                isHovered: state.isHovered,
                                isFocused: state.isFocused
                            ),
                            lineWidth: state.isFocused ? 1.4 : 1
                        )
                )
                .contentShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
                .animation(state.animation, value: isPressed)
        }
    }
}

struct RCHoverFocusState {
    var isHovered: Bool
    var isFocused: Bool
    var isEnabled: Bool
    var reduceMotion: Bool

    var animation: Animation? {
        reduceMotion ? nil : .easeOut(duration: 0.12)
    }

    func isActive(isPressed: Bool = false) -> Bool {
        isPressed || isHovered || isFocused
    }
}

struct RCHoverFocusReader<Content: View>: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.isFocused) private var isFocused
    @State private var isHovered = false

    var content: (RCHoverFocusState) -> Content

    init(@ViewBuilder content: @escaping (RCHoverFocusState) -> Content) {
        self.content = content
    }

    var body: some View {
        let state = RCHoverFocusState(
            isHovered: isHovered,
            isFocused: isFocused,
            isEnabled: isEnabled,
            reduceMotion: reduceMotion
        )
        content(state)
            .onHover { hovering in
                isHovered = isEnabled && hovering
            }
            .animation(state.animation, value: isHovered)
            .animation(state.animation, value: isFocused)
            .animation(state.animation, value: isEnabled)
    }
}

struct RCHoverFocusSurfaceModifier: ViewModifier {
    var selected: Bool = false
    var disabled: Bool = false
    var cornerRadius: CGFloat = RCComponentBaseline.cornerRadius
    var idleBackground: Color = Color.clear
    var selectedBackground: Color = RCTheme.surfaceLevel4.opacity(0.50)
    var hoverBackground: Color = RCTheme.surfaceLevel2.opacity(0.32)
    var idleBorder: Color = Color.clear
    var selectedBorder: Color = Color.clear
    var hoverBorder: Color = Color.clear
    var focusedBorder: Color = RCTheme.borderFocus
    var disabledOpacity: Double = 0.56

    func body(content: Content) -> some View {
        RCHoverFocusReader { state in
            let enabled = state.isEnabled && !disabled
            let hovered = enabled && state.isHovered
            let focused = enabled && state.isFocused
            content
                .background(background(isHovered: hovered))
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .stroke(
                            border(isHovered: hovered, isFocused: focused),
                            lineWidth: focused ? 1.4 : 1
                        )
                )
                .contentShape(RoundedRectangle(cornerRadius: cornerRadius))
                .opacity(enabled ? 1 : disabledOpacity)
        }
    }

    private func background(isHovered: Bool) -> Color {
        if selected {
            return selectedBackground
        }
        return isHovered ? hoverBackground : idleBackground
    }

    private func border(isHovered: Bool, isFocused: Bool) -> Color {
        if isFocused {
            return focusedBorder
        }
        if selected {
            return selectedBorder
        }
        return isHovered ? hoverBorder : idleBorder
    }
}

extension View {
    func rcHoverFocusSurface(
        selected: Bool = false,
        disabled: Bool = false,
        cornerRadius: CGFloat = RCComponentBaseline.cornerRadius,
        idleBackground: Color = Color.clear,
        selectedBackground: Color = RCTheme.surfaceLevel4.opacity(0.50),
        hoverBackground: Color = RCTheme.surfaceLevel2.opacity(0.32),
        idleBorder: Color = Color.clear,
        selectedBorder: Color = Color.clear,
        hoverBorder: Color = Color.clear,
        focusedBorder: Color = RCTheme.borderFocus,
        disabledOpacity: Double = 0.56
    ) -> some View {
        modifier(
            RCHoverFocusSurfaceModifier(
                selected: selected,
                disabled: disabled,
                cornerRadius: cornerRadius,
                idleBackground: idleBackground,
                selectedBackground: selectedBackground,
                hoverBackground: hoverBackground,
                idleBorder: idleBorder,
                selectedBorder: selectedBorder,
                hoverBorder: hoverBorder,
                focusedBorder: focusedBorder,
                disabledOpacity: disabledOpacity
            )
        )
    }
}

struct PrimaryDarkButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Color.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
            .background(configuration.isPressed ? RCTheme.accentBlue.opacity(0.72) : RCTheme.accentBlue)
            .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
    }
}

struct PrimaryLightButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RCHoverFocusReader { state in
            let active = state.isActive(isPressed: configuration.isPressed)
            configuration.label
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(configuration.isPressed ? RCTheme.accentBlue.opacity(0.74) : (active ? RCTheme.accentBlue.opacity(0.92) : RCTheme.accentBlue.opacity(0.86)))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(state.isFocused ? RCTheme.borderFocus : Color.clear, lineWidth: state.isFocused ? 1.4 : 1))
                .opacity(state.isEnabled ? (configuration.isPressed ? 0.92 : 1) : 0.52)
                .animation(state.animation, value: configuration.isPressed)
        }
    }
}

struct SecondaryLightButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RCHoverFocusReader { state in
            let active = state.isActive(isPressed: configuration.isPressed)
            configuration.label
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(active ? RCTheme.text : RCTheme.muted)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(configuration.isPressed ? RCTheme.surfaceHover.opacity(0.72) : (active ? RCTheme.surfaceLevel2.opacity(0.72) : Color.clear))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(state.isFocused ? RCTheme.borderFocus : (active ? RCTheme.borderLow : Color.clear), lineWidth: state.isFocused ? 1.4 : 1))
                .opacity(state.isEnabled ? 1 : 0.52)
                .animation(state.animation, value: configuration.isPressed)
        }
    }
}

struct TintedActionButtonStyle: ButtonStyle {
    let tone: ComponentTone

    func makeBody(configuration: Configuration) -> some View {
        RCHoverFocusReader { state in
            let active = state.isActive(isPressed: configuration.isPressed)
            configuration.label
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(tone.color)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    tone.color.opacity(
                        configuration.isPressed ? 0.18 : (active ? 0.14 : 0.09)
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(
                            state.isFocused ? RCTheme.borderFocus : tone.color.opacity(active ? 0.52 : 0.32),
                            lineWidth: state.isFocused ? 1.4 : 1
                        )
                )
                .opacity(state.isEnabled ? 1 : 0.52)
                .animation(state.animation, value: configuration.isPressed)
        }
    }
}

struct StablePlainButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RCHoverFocusReader { state in
            let active = state.isActive(isPressed: configuration.isPressed)
            configuration.label
                .opacity(state.isEnabled ? (configuration.isPressed ? 0.88 : 1) : 0.56)
                .background(
                    RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius)
                        .fill(Color.white.opacity(active && state.isEnabled && !configuration.isPressed ? 0.045 : 0))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius)
                        .stroke(state.isFocused && state.isEnabled ? RCTheme.accentBlue.opacity(0.68) : Color.clear, lineWidth: state.isFocused ? 1.4 : 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
                .contentShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
                .animation(state.animation, value: configuration.isPressed)
        }
    }
}

struct SidebarBrandHeader: View {
    var body: some View {
        Color.clear
            .accessibilityHidden(true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: RCChromeMetrics.topReservedHeight, alignment: .center)
    }
}

struct SidebarSectionHeader<Accessory: View>: View {
    var title: String
    var subtitle: String? = nil
    var icon: String? = nil
    @ViewBuilder var accessory: () -> Accessory

    init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        @ViewBuilder accessory: @escaping () -> Accessory = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.accessory = accessory
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(RCTheme.muted)
                    .frame(width: 24, height: 24)
                    .background(RCTheme.surfaceInset)
                    .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
                    .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(RCTheme.borderLow))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(RCTheme.muted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            accessory()
        }
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(subtitle.map { "\(title), \($0)" } ?? title)
    }
}

struct SidebarPanelChrome: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.vertical, 2)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.clear)
    }
}

extension View {
    func sidebarPanelChrome() -> some View {
        modifier(SidebarPanelChrome())
    }

    func rcTextFieldChrome(height: CGFloat = 40) -> some View {
        padding(.horizontal, 12)
            .frame(height: height)
            .background(RCTheme.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(RCTheme.fieldBorder))
    }

    func rcTextEditorChrome() -> some View {
        background(RCTheme.fieldBackground)
            .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(RCTheme.fieldBorder))
    }
}

struct SearchField: View {
    @Binding var text: String
    var placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RCTheme.muted)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .foregroundStyle(RCTheme.text)
                .accessibilityLabel(placeholder)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                }
                .buttonStyle(.plain)
                .foregroundStyle(RCTheme.muted)
                .help("Clear")
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 48)
        .background(RCTheme.fieldBackground)
        .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
        .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(RCTheme.fieldBorder))
    }
}

struct AccountCard: View {
    @EnvironmentObject var model: AppViewModel

    var body: some View {
        Button {
            model.selectNav(.settings)
            model.selectSettingsPanel(.account)
        } label: {
            HStack(spacing: 10) {
                AgentAvatarView(name: model.profileName, avatarURL: model.userProfile.avatarUrl, size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.profileName)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                    Text(model.userProfile.email.nilIfEmpty ?? "Local profile")
                        .font(.caption)
                        .foregroundStyle(RCTheme.muted)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(RCTheme.muted)
            }
            .padding(12)
            .rcHoverFocusSurface(
                selected: model.activeShellSection == .settings && model.settingsPanel == .account,
                idleBackground: Color.clear,
                selectedBackground: RCTheme.surfaceLevel4.opacity(0.48),
                hoverBackground: RCTheme.surfaceLevel2.opacity(0.30),
                idleBorder: Color.clear,
                selectedBorder: Color.clear,
                hoverBorder: Color.clear
            )
        }
        .buttonStyle(StablePlainButtonStyle())
        .help("Open Account settings")
        .accessibilityLabel("Open Account settings")
        .accessibilityValue("\(model.profileName), \(model.userProfile.email.nilIfEmpty ?? "Local profile")")
    }
}

struct AgentDeleteActionButton: View {
    @EnvironmentObject var model: AppViewModel
    let agent: AgentWithBinding
    @State private var showingConfirmation = false

    private var deleteBusy: Bool {
        model.busy == "delete-agent-\(agent.id)"
    }

    var body: some View {
        Button(role: .destructive) {
            model.prepareAgentDeletion(agent)
            showingConfirmation = true
        } label: {
            Image(systemName: deleteBusy ? "hourglass" : "trash")
        }
        .buttonStyle(IconLightButtonStyle())
        .disabled(deleteBusy)
        .help(deleteBusy ? "Deleting agent" : "Delete agent")
        .accessibilityLabel(deleteBusy ? "Deleting agent" : "Delete agent")
        .alert(
            "Delete \(model.resolveAgentDisplayName(agent))?",
            isPresented: $showingConfirmation
        ) {
            Button("Delete agent", role: .destructive) {
                model.showToast("Deleting agent", message: model.resolveAgentDisplayName(agent), tone: .info)
                model.deleteAgent(agent)
            }
            Button("Cancel", role: .cancel) {
                model.pendingAgentDeletionImpact = nil
            }
        } message: {
            Text(model.agentDeletionConfirmationMessage(for: agent))
        }
    }
}

struct ShellIconRail: View {
    @EnvironmentObject var model: AppViewModel
    @EnvironmentObject var updateController: RelayConsoleUpdateController
    private let railWidth = RCChromeMetrics.railWidth
    private let itemSize = CGSize(width: 48, height: 44)
    private let itemCornerRadius: CGFloat = 8

    var body: some View {
        VStack(spacing: 0) {
            railBrandMark
                .padding(.top, RCChromeMetrics.topReservedHeight + 22)

            VStack(spacing: 10) {
                ForEach(model.shellSections) { section in
                    shellRailButton(section)
                }
            }
            .padding(.top, 26)

            Spacer(minLength: 16)

            if updateController.snapshot.showsUpdatePill
                || updateController.snapshot.state == .updatingBackend
            {
                updatePill
                    .padding(.bottom, 18)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(minWidth: railWidth, idealWidth: railWidth, maxWidth: railWidth, maxHeight: .infinity)
        .background(RCTheme.railSurface)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("App sections")
        .animation(.easeInOut(duration: 0.18), value: updateController.snapshot.showsUpdatePill)
    }

    private var updatePill: some View {
        let version = updateController.snapshot.availableVersion ?? ""
        let updatingBackend = updateController.snapshot.state == .updatingBackend
        return Button {
            updateController.showDiscoveredUpdate()
        } label: {
            RCHoverFocusReader { state in
                Label(
                    updatingBackend ? "Updating" : "Update both",
                    systemImage: updatingBackend ? "arrow.triangle.2.circlepath" : "arrow.down.circle.fill"
                )
                    .font(.system(size: 11, weight: .semibold))
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(state.isActive() ? RCTheme.text : RCTheme.accentBlue)
                    .padding(.horizontal, 8)
                    .frame(width: 88, height: 30)
                    .background(state.isActive() ? RCTheme.surfaceHover : RCTheme.accentBlue.opacity(0.13))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule().stroke(
                            state.isFocused ? RCTheme.accentBlue : RCTheme.accentBlue.opacity(0.46),
                            lineWidth: state.isFocused ? 1.5 : 1
                        )
                    )
                    .contentShape(Capsule())
                    .animation(state.animation, value: state.isActive())
            }
        }
        .buttonStyle(.plain)
        .disabled(updatingBackend)
        .help(updatingBackend
            ? (updateController.snapshot.progressMessage ?? "Updating the Railway backend")
            : "Update the Railway backend, then Relay Console \(version)")
        .accessibilityLabel(updatingBackend
            ? "Updating Railway backend"
            : "Update Relay Console and Railway backend")
        .accessibilityValue(updateController.snapshot.updateAccessibilityValue)
        .accessibilityHint("Updates and verifies the Railway backend before opening the secure app installer")
    }

    private var railBrandMark: some View {
        Group {
            if let image = appIconImage() {
                Image(nsImage: image)
                    .resizable()
                    .frame(width: 30, height: 30)
            } else {
                RelayLogo()
                    .frame(width: 30, height: 30)
            }
        }
        .accessibilityLabel("Relay Console")
    }

    private func shellRailButton(_ section: ShellSectionState) -> some View {
        let accent = navAccent(for: section)
        return Button {
            model.selectShellSection(section.key)
        } label: {
            ShellIconRailItem(
                section: section,
                accent: accent,
                isSelected: isSelected(section),
                itemSize: itemSize,
                cornerRadius: itemCornerRadius
            )
        }
        .buttonStyle(.plain)
        .help(section.helpText)
        .accessibilityLabel(section.accessibilityLabel)
        .accessibilityHint(section.accessibilityHint)
        .accessibilityValue(isSelected(section) ? "Selected" : section.statusText)
    }

    private func isSelected(_ section: ShellSectionState) -> Bool {
        model.activeShellSection == section.key
    }

    private func navAccent(for section: ShellSectionState) -> Color {
        switch section.key {
        case .chats:
            return RCTheme.accentBlue
        case .agents:
            return RCTheme.accentPurple
        case .artifacts:
            return RCTheme.accentGreen
        case .applications:
            return RCTheme.relayCyan
        case .approvals:
            return RCTheme.accentAmber
        case .settings:
            return RCTheme.muted
        case .agentOpsHQ, .insights:
            return RCTheme.muted
        }
    }
}

private struct ShellIconRailItem: View {
    let section: ShellSectionState
    let accent: Color
    let isSelected: Bool
    let itemSize: CGSize
    let cornerRadius: CGFloat

    var body: some View {
        RCHoverFocusReader { state in
            let active = state.isActive()
            let selectable = section.isSelectable
            let foreground = foregroundColor(isActive: active, isSelectable: selectable)
            let border = borderColor(isFocused: state.isFocused, isActive: active, isSelectable: selectable)

            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(isSelected ? accent : Color.clear)
                    .frame(width: 3, height: 22)
                    .opacity(isSelected ? 1 : 0)
                    .offset(x: -8)

                ZStack(alignment: .topTrailing) {
                    Image(systemName: section.iconName)
                        .font(.system(size: 17, weight: isSelected ? .bold : .semibold))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(foreground)
                        .frame(width: itemSize.width, height: itemSize.height)
                        .background(backgroundColor(isActive: active, isSelectable: selectable))
                        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                        .overlay(
                            RoundedRectangle(cornerRadius: cornerRadius)
                                .stroke(border, lineWidth: state.isFocused || isSelected ? 1.4 : 1)
                        )

                    if !selectable {
                        Image(systemName: section.policy == .excluded ? "slash.circle.fill" : "lock.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(section.policy == .excluded ? RCTheme.accentRed : RCTheme.accentBlue)
                            .padding(.top, 5)
                            .padding(.trailing, 6)
                    }
                }
            }
            .frame(width: itemSize.width, height: itemSize.height)
            .contentShape(RoundedRectangle(cornerRadius: cornerRadius))
            .opacity(selectable ? 1 : 0.62)
            .animation(state.animation, value: isSelected)
        }
    }

    private func foregroundColor(isActive: Bool, isSelectable: Bool) -> Color {
        if !isSelectable {
            return RCTheme.muted
        }
        if isSelected || isActive {
            return accent
        }
        return RCTheme.muted
    }

    private func backgroundColor(isActive: Bool, isSelectable: Bool) -> Color {
        if isSelected {
            return accent.opacity(0.22)
        }
        if !isSelectable {
            return RCTheme.surfaceInset.opacity(0.72)
        }
        return isActive ? RCTheme.surfaceHover : Color.clear
    }

    private func borderColor(isFocused: Bool, isActive: Bool, isSelectable: Bool) -> Color {
        if isFocused {
            return RCTheme.accentBlue.opacity(0.72)
        }
        if isSelected {
            return accent.opacity(0.66)
        }
        if !isSelectable {
            return RCTheme.borderSoft.opacity(0.58)
        }
        return isActive ? RCTheme.borderSoft : Color.clear
    }
}

struct GuardedShellNotice: View {
    @EnvironmentObject var model: AppViewModel

    var body: some View {
        if let notice = model.guardedShellNotice {
            HStack(spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: notice.outcome == .deniedExcluded ? "slash.circle" : "lock")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(notice.outcome == .deniedExcluded ? RCTheme.accentRed : RCTheme.accentBlue)
                        .frame(width: 20, height: 20)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(notice.section.label)
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                        Text(notice.section.statusText)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(RCTheme.muted)
                            .lineLimit(1)
                    }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(notice.section.accessibilityLabel). \(notice.section.statusText).")
                Spacer(minLength: 8)
                Button {
                    model.dismissGuardedShellNotice()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .bold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(RCTheme.muted)
                .help("Dismiss guarded section status")
                .accessibilityLabel("Dismiss guarded section status")
            }
            .padding(10)
            .background(RCTheme.accentAmber.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
    }
}

struct SettingsNavRow: View {
    var title: String
    var subtitle: String?
    var icon: String
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .frame(width: 28, height: 28)
                    .foregroundStyle(selected ? RCTheme.text : RCTheme.muted)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(RCTheme.muted)
                            .lineLimit(1)
                    }
                }
                Spacer()
            }
            .padding(10)
            .rcHoverFocusSurface(selected: selected)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open \(title)")
        .accessibilityHint(subtitle ?? "")
        .accessibilityValue(selected ? "Selected" : "")
    }
}

struct AgentAvatarView: View {
    var name: String
    var avatarURL: String?
    var size: CGFloat

    var body: some View {
        ZStack {
            if let image = loadAvatarImage(avatarURL) {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
            } else if let url = remoteAvatarURL(avatarURL) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        avatarFallback
                    }
                }
            } else {
                avatarFallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.white.opacity(0.35), lineWidth: 1))
        .accessibilityLabel("\(name) avatar")
    }

    private var avatarGradient: LinearGradient {
        LinearGradient(
            colors: [RCTheme.accentBlue, RCTheme.accentGreen],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var avatarFallback: some View {
        ZStack {
            Circle().fill(avatarGradient)
            Text(initials(name))
                .font(.system(size: max(10, size * 0.34), weight: .bold))
                .foregroundStyle(Color.white)
        }
    }
}

struct RuntimeBrandIconView: View {
    var runtimeType: RuntimeType
    var size: CGFloat = 14

    var body: some View {
        Group {
            if let image = runtimeBrandImage(runtimeType) {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: fallbackSymbolName)
                    .font(.system(size: max(9, size * 0.72), weight: .semibold))
                    .symbolRenderingMode(.monochrome)
                    .foregroundStyle(RCTheme.muted)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(RCTheme.borderSoft.opacity(0.65), lineWidth: 0.8))
        .accessibilityLabel("\(runtimeLabel(runtimeType)) agent")
    }

    private var fallbackSymbolName: String {
        switch runtimeType {
        case .openclaw:
            return "pawprint.fill"
        case .hermes:
            return "antenna.radiowaves.left.and.right"
        default:
            return "terminal"
        }
    }
}

struct AvatarEditor: View {
    var value: String?
    var onChange: (String?) -> Void
    @State private var customURL = ""
    @State private var avatarCropSource: AvatarCropSource?
    @State private var selectedAvatarCategoryId = "illustrated"

    private var selectedCategory: AvatarCategory {
        avatarCategories.first { $0.id == selectedAvatarCategoryId } ?? avatarCategories.first ?? AvatarCategory(id: "illustrated", title: "Illustrated", resourceNames: illustratedAvatarResourceNames)
    }

    var body: some View {
        FormCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 16) {
                    AvatarEditorPreview(value: value, size: 96)
                    Text("Avatar")
                        .font(.headline)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Avatar type")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(RCTheme.muted)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], alignment: .leading, spacing: 8) {
                        ForEach(avatarCategories) { category in
                            AvatarCategoryMenuRow(
                                category: category,
                                selected: selectedAvatarCategoryId == category.id
                            ) {
                                selectedAvatarCategoryId = category.id
                            }
                        }
                    }
                }
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Avatar type")

                ScrollView {
                    LazyVGrid(columns: Array(repeating: GridItem(.fixed(58), spacing: 10), count: 8), spacing: 10) {
                        ForEach(selectedCategory.resourceNames, id: \.self) { name in
                            let avatarReference = selectedCategory.reference(for: name)
                            Button {
                                onChange(avatarReference)
                            } label: {
                                AgentAvatarView(name: name, avatarURL: avatarReference, size: 52)
                                    .overlay(Circle().stroke(value == avatarReference ? RCTheme.accentBlue : Color.clear, lineWidth: 3))
                            }
                            .buttonStyle(.plain)
                            .help("Use avatar \(name)")
                            .accessibilityLabel("Use avatar \(name)")
                        }
                    }
                    .padding(.vertical, 2)
                }
                .frame(maxHeight: 300)

                HStack {
                    Button("Upload") {
                        chooseAvatarFile { dataURL in
                            if let dataURL {
                                avatarCropSource = AvatarCropSource(dataURL: dataURL)
                            }
                        }
                    }
                    .buttonStyle(SecondaryLightButtonStyle())
                    .help("Upload avatar")
                    .accessibilityLabel("Upload avatar")
                }
            }
        }
        .sheet(item: $avatarCropSource) { source in
            AvatarCropEditor(source: source) {
                avatarCropSource = nil
            } onApply: { dataURL in
                onChange(dataURL)
                avatarCropSource = nil
            }
        }
        .onAppear {
            selectedAvatarCategoryId = avatarCategoryId(for: value) ?? selectedAvatarCategoryId
        }
        .onChange(of: value) { _, next in
            if let categoryId = avatarCategoryId(for: next) {
                selectedAvatarCategoryId = categoryId
            }
        }
    }
}

struct AvatarCategoryMenuRow: View {
    var category: AvatarCategory
    var selected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(selected ? RCTheme.accentBlue : RCTheme.muted)
                Text(category.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(RCTheme.text)
                    .lineLimit(1)
                Spacer(minLength: 4)
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? RCTheme.sidebarSelected : RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(selected ? RCTheme.borderStrong : RCTheme.borderSoft))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(category.title)
        .accessibilityValue(selected ? "Selected" : "")
    }
}

struct AvatarCropSource: Identifiable, Equatable {
    let id = UUID()
    var dataURL: String
}

struct AvatarCropEditor: View {
    var source: AvatarCropSource
    var onCancel: () -> Void
    var onApply: (String) -> Void

    @State private var zoom: Double = 1
    @State private var offset: CGSize = .zero
    @State private var dragOrigin: CGSize?

    private let previewSize: CGFloat = 280
    private let outputPixels = 512

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Position avatar")
                    .font(.title3.weight(.semibold))
                Spacer()
                Button("Cancel") {
                    onCancel()
                }
                .buttonStyle(SecondaryLightButtonStyle())
                Button("Use avatar") {
                    applyCrop()
                }
                .buttonStyle(PrimaryLightButtonStyle())
            }

            if let image = loadAvatarImage(source.dataURL) {
                VStack(spacing: 16) {
                    cropPreview(image)
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Zoom")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(RCTheme.muted)
                            Slider(
                                value: Binding(
                                    get: { zoom },
                                    set: { nextZoom in
                                        zoom = nextZoom
                                        offset = clampedOffset(offset, image: image, zoom: CGFloat(nextZoom), previewSize: previewSize)
                                    }
                                ),
                                in: 1...3
                            )
                        }
                        offsetSlider(label: "Horizontal", axis: .horizontal, image: image)
                        offsetSlider(label: "Vertical", axis: .vertical, image: image)
                    }
                    Button("Reset position") {
                        zoom = 1
                        offset = .zero
                    }
                    .buttonStyle(SecondaryLightButtonStyle())
                }
                .frame(maxWidth: .infinity)
            } else {
                Text("Avatar image could not be loaded.")
                    .font(.callout)
                    .foregroundStyle(RCTheme.accentRed)
            }
        }
        .padding(20)
        .frame(width: 430)
        .background(RCTheme.page)
        .foregroundStyle(RCTheme.text)
    }

    private enum OffsetAxis {
        case horizontal
        case vertical
    }

    private func cropPreview(_ image: NSImage) -> some View {
        let displaySize = displaySize(for: image, previewSize: previewSize, zoom: CGFloat(zoom))
        return ZStack {
            RCTheme.surfaceInset
            Image(nsImage: image)
                .resizable()
                .frame(width: displaySize.width, height: displaySize.height)
                .offset(offset)
        }
        .frame(width: previewSize, height: previewSize)
        .clipShape(Circle())
        .overlay(Circle().stroke(RCTheme.borderStrong, lineWidth: 1.4))
        .gesture(
            DragGesture()
                .onChanged { value in
                    let origin = dragOrigin ?? offset
                    dragOrigin = origin
                    let next = CGSize(
                        width: origin.width + value.translation.width,
                        height: origin.height + value.translation.height
                    )
                    offset = clampedOffset(next, image: image, zoom: CGFloat(zoom), previewSize: previewSize)
                }
                .onEnded { _ in
                    dragOrigin = nil
                }
        )
        .accessibilityLabel("Avatar crop preview")
    }

    @ViewBuilder
    private func offsetSlider(label: String, axis: OffsetAxis, image: NSImage) -> some View {
        let bounds = maxOffset(for: image, previewSize: previewSize, zoom: CGFloat(zoom))
        let limit = axis == .horizontal ? bounds.width : bounds.height
        if limit > 0 {
            HStack {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(RCTheme.muted)
                Slider(
                    value: Binding(
                        get: { axis == .horizontal ? Double(offset.width) : Double(offset.height) },
                        set: { nextValue in
                            var next = offset
                            if axis == .horizontal {
                                next.width = CGFloat(nextValue)
                            } else {
                                next.height = CGFloat(nextValue)
                            }
                            offset = clampedOffset(next, image: image, zoom: CGFloat(zoom), previewSize: previewSize)
                        }
                    ),
                    in: -Double(limit)...Double(limit)
                )
            }
        }
    }

    private func applyCrop() {
        guard let image = loadAvatarImage(source.dataURL) else {
            NSSound.beep()
            return
        }
        do {
            let dataURL = try croppedAvatarDataURL(
                from: image,
                offset: clampedOffset(offset, image: image, zoom: CGFloat(zoom), previewSize: previewSize),
                zoom: CGFloat(zoom),
                previewSize: previewSize,
                outputPixels: outputPixels
            )
            onApply(dataURL)
        } catch {
            NSSound.beep()
        }
    }
}

struct AvatarEditorPreview: View {
    var value: String?
    var size: CGFloat

    var body: some View {
        Group {
            if let value {
                AgentAvatarView(name: "Agent", avatarURL: value, size: size)
            } else {
                ZStack {
                    Circle()
                        .fill(RCTheme.surfaceInset)
                    Image(systemName: "person.crop.circle.badge.plus")
                        .symbolRenderingMode(.hierarchical)
                        .font(.system(size: max(24, size * 0.34), weight: .semibold))
                        .foregroundStyle(RCTheme.accentBlue)
                }
                .frame(width: size, height: size)
                .overlay(
                    Circle()
                        .stroke(
                            RCTheme.borderStrong,
                            style: StrokeStyle(lineWidth: 1.2, dash: [5, 5])
                        )
                )
                .accessibilityLabel("Pick an avatar")
            }
        }
    }
}

struct FormCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            content
        }
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(RCTheme.text)
    }
}

struct NativeGroupedSection<Content: View>: View {
    var title: String?
    var subtitle: String?
    var showsDivider: Bool
    let content: Content

    init(
        title: String? = nil,
        subtitle: String? = nil,
        showsDivider: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.showsDivider = showsDivider
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 3) {
                    if let title {
                        Text(title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(RCTheme.text)
                    }
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(RCTheme.muted)
                    }
                }
                .padding(.bottom, 8)
            }
            VStack(alignment: .leading, spacing: 0) {
                content
            }
            .padding(.bottom, 10)
            if showsDivider {
                NativeDivider()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NativeSettingsRow<Accessory: View>: View {
    var title: String
    var subtitle: String?
    var value: String?
    let accessory: Accessory

    init(
        title: String,
        subtitle: String? = nil,
        value: String? = nil,
        @ViewBuilder accessory: () -> Accessory = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.accessory = accessory()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(RCTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 12)
            if let value {
                Text(value)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(RCTheme.muted)
                    .lineLimit(1)
            }
            accessory
        }
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NativeDivider: View {
    var body: some View {
        Rectangle()
            .fill(RCTheme.borderLow.opacity(0.50))
            .frame(height: 1)
    }
}

struct LabeledTextField: View {
    var title: String
    @Binding var text: String
    var placeholder: String

    init(_ title: String, text: Binding<String>, placeholder: String) {
        self.title = title
        self._text = text
        self.placeholder = placeholder
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(RCTheme.muted)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .foregroundStyle(RCTheme.text)
                .rcTextFieldChrome(height: 38)
                .frame(minWidth: 260)
                .help(title)
                .accessibilityLabel(title)
        }
    }
}

struct EmptyStage: View {
    var title: String
    var bodyText: String
    var actionTitle: String
    var action: (() -> Void)?

    init(title: String, body: String, actionTitle: String = "Open Harnesses", action: (() -> Void)? = nil) {
        self.title = title
        self.bodyText = body
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        VStack(spacing: 14) {
            RelayLogo()
                .frame(width: 58, height: 58)
            Text(title)
                .font(.title2.weight(.semibold))
            Text(bodyText)
                .font(.callout)
                .foregroundStyle(RCTheme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 460)
            if let action {
                Button(actionTitle, action: action)
                    .buttonStyle(PrimaryLightButtonStyle())
                    .help(actionTitle)
                    .accessibilityLabel(actionTitle)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
        .accessibilityLabel(title)
    }
}

struct EmptyMini: View {
    var title: String
    var bodyText: String

    init(title: String, body: String) {
        self.title = title
        self.bodyText = body
    }

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
            if !bodyText.isEmpty {
                Text(bodyText)
                    .font(.caption)
                    .foregroundStyle(RCTheme.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(title)
    }
}

struct EmptyMiniLight: View {
    var title: String
    var bodyText: String

    init(title: String, body: String) {
        self.title = title
        self.bodyText = body
    }

    var body: some View {
        VStack(spacing: 5) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
            Text(bodyText)
                .font(.system(size: 13))
                .foregroundStyle(RCTheme.muted)
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .foregroundStyle(RCTheme.text)
        .accessibilityLabel(title)
    }
}

struct LoadingView: View {
    var title: String

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.large)
            Text(title)
                .font(.headline)
        }
        .accessibilityLabel(title)
    }
}

struct RelayLogo: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(LinearGradient(colors: [RCTheme.accentBlue, RCTheme.accentGreen], startPoint: .topLeading, endPoint: .bottomTrailing))
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)
        }
        .frame(width: 32, height: 32)
        .accessibilityLabel("Relay Console")
    }
}

struct ThinkingDots: View {
    var body: some View {
        TimelineView(.periodic(from: Date(), by: 0.35)) { context in
            let active = Int(context.date.timeIntervalSinceReferenceDate / 0.35) % 3
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(RCTheme.accentBlue.opacity(index == active ? 0.95 : 0.30))
                        .frame(width: 5, height: 5)
                }
            }
        }
        .frame(width: 24, height: 8)
        .accessibilityLabel("Thinking")
    }
}

struct ComposerSendingIndicator: View {
    let statusText: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.24)) { context in
            let tick = reduceMotion
                ? 0
                : Int(context.date.timeIntervalSinceReferenceDate / 0.24)
            HStack(spacing: 9) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    RCTheme.accentBlue.opacity(0.24),
                                    RCTheme.accentPurple.opacity(0.18),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(RCTheme.chatAccent)
                }
                .frame(width: 20, height: 20)

                Text(statusText)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(RCTheme.chatText)

                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(RCTheme.chatAccent)
                            .frame(width: 5, height: 5)
                            .scaleEffect((tick + index) % 3 == 0 ? 1 : 0.72)
                            .opacity((tick + index) % 3 == 0 ? 1 : 0.38)
                    }
                }
                .frame(width: 21)
            }
            .padding(.horizontal, 9)
            .frame(height: 28)
            .background(RCTheme.chatAccent.opacity(0.09))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(RCTheme.chatAccent.opacity(0.28)))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(statusText)
    }
}

struct ComposerTextView: View {
    @Binding var text: String
    var placeholder: String
    var disabled: Bool
    var disabledReason: String?
    var statusText: String?
    var attachments: [ChatAttachment]
    var canSend: Bool
    var isSending: Bool = false
    var approvalMode: RuntimeApprovalMode
    var modelSelection: String? = nil
    var modelOptions: [HarnessModelOption] = []
    var isUpdatingModel: Bool = false
    var onAttachFiles: () -> Void
    var onAttachMedia: () -> Void
    var onSelectApprovalMode: (RuntimeApprovalMode) -> Void
    var onSelectModel: ((String) -> Void)? = nil
    var onRemoveAttachment: (ChatAttachment) -> Void
    var onSubmit: () -> Void
    @State private var editorHeight = ComposerEditor.minimumHeight
    private let editorInset = EdgeInsets(top: 8, leading: 4, bottom: 0, trailing: 4)

    var body: some View {
        VStack(spacing: 8) {
            if !attachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(attachments) { attachment in
                            ComposerAttachmentChip(
                                attachment: attachment,
                                onRemove: { onRemoveAttachment(attachment) }
                            )
                        }
                    }
                    .padding(.vertical, 1)
                }
                .frame(height: 32)
            }
            ZStack(alignment: .topLeading) {
                if isSending {
                    ComposerSendingIndicator(
                        statusText: statusText ?? "Sending your message"
                    )
                    .padding(editorInset)
                } else if text.isEmpty {
                    Text(placeholder)
                        .foregroundStyle(RCTheme.muted)
                        .font(.system(size: 14))
                        .padding(editorInset)
                }
                ComposerEditor(
                    text: $text,
                    measuredHeight: $editorHeight,
                    disabled: disabled,
                    textInset: NSSize(width: 4, height: 8),
                    onSubmit: onSubmit
                )
            }
            .frame(maxWidth: .infinity)
            .frame(height: editorHeight)
            HStack {
                HStack(spacing: 6) {
                    Button {
                        onAttachFiles()
                    } label: {
                        Image(systemName: "doc.badge.plus")
                    }
                    .buttonStyle(IconLightButtonStyle())
                    .help("Attach files")
                    .accessibilityLabel("Attach files")
                    .disabled(disabled)
                    Button {
                        onAttachMedia()
                    } label: {
                        Image(systemName: "photo.on.rectangle.angled")
                    }
                    .buttonStyle(IconLightButtonStyle())
                    .help("Attach images or videos")
                    .accessibilityLabel("Attach images or videos")
                    .disabled(disabled)
                    ComposerApprovalModeMenu(
                        selection: approvalMode,
                        onSelect: onSelectApprovalMode
                    )
                    .disabled(disabled)
                    if let onSelectModel, !modelOptions.isEmpty {
                        ComposerModelMenu(
                            selection: modelSelection,
                            options: modelOptions,
                            isUpdating: isUpdatingModel,
                            onSelect: onSelectModel
                        )
                        .disabled(disabled || isUpdatingModel)
                    }
                }
                if let statusText, !statusText.isEmpty, !isSending {
                    Text(statusText)
                        .font(.system(size: 11))
                        .foregroundStyle(disabled ? RCTheme.accentAmber : RCTheme.muted)
                        .lineLimit(1)
                        .help(statusText)
                        .accessibilityLabel(statusText)
                }
                Spacer()
                Button {
                    onSubmit()
                } label: {
                    Image(systemName: "paperplane.fill")
                }
                .buttonStyle(IconLightButtonStyle())
                .help(disabledReason ?? "Send message")
                .accessibilityLabel("Send message")
                .accessibilityHint(disabledReason ?? "Sends the message.")
                .disabled(disabled || !canSend)
            }
            .frame(height: 28)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(RCTheme.chatComposer)
        .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.chatComposerBorder))
    }
}

struct ComposerModelMenu: View {
    let selection: String?
    let options: [HarnessModelOption]
    let isUpdating: Bool
    let onSelect: (String) -> Void

    var body: some View {
        Menu {
            ForEach(options) { option in
                Button {
                    if option.id != selection {
                        onSelect(option.id)
                    }
                } label: {
                    Label(
                        option.isDefault ? "\(option.label) — Harness default" : option.label,
                        systemImage: option.id == selection ? "checkmark" : "circle"
                    )
                }
            }
        } label: {
            HStack(spacing: 6) {
                if isUpdating {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: "cpu")
                        .font(.system(size: 12, weight: .semibold))
                }
                Text(selection ?? "Runtime default")
                    .fontWeight(.semibold)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .layoutPriority(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
            }
            .font(.system(size: 12))
            .foregroundStyle(RCTheme.text)
            .padding(.horizontal, 9)
            .frame(height: 28)
            .background(RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(RCTheme.chatComposerBorder))
        }
        .menuStyle(.borderlessButton)
        .help("Select the model used by this agent on future runs.")
        .accessibilityLabel("Agent model \(selection ?? "not pinned")")
    }
}

struct ComposerApprovalModeMenu: View {
    let selection: RuntimeApprovalMode
    let onSelect: (RuntimeApprovalMode) -> Void

    var body: some View {
        Menu {
            ForEach(RuntimeApprovalMode.allCases, id: \.rawValue) { mode in
                Button {
                    onSelect(mode)
                } label: {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(composerApprovalModeTitle(mode))
                            Text(composerApprovalModeSubtitle(mode))
                                .font(.caption)
                                .foregroundStyle(RCTheme.muted)
                        }
                    } icon: {
                        Image(systemName: mode == selection ? "checkmark.circle.fill" : composerApprovalModeIcon(mode))
                    }
                }
                .disabled(mode == selection)
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: composerApprovalModeIcon(selection))
                    .font(.system(size: 12, weight: .semibold))
                Text(composerApprovalModeTitle(selection))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(composerApprovalModeTone(selection))
            .padding(.horizontal, 9)
            .frame(height: 28)
            .background(RCTheme.surfaceInset)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(composerApprovalModeTone(selection).opacity(0.24)))
        }
        .menuStyle(.borderlessButton)
        .help(composerApprovalModeSubtitle(selection))
        .accessibilityLabel("Agent approval mode \(composerApprovalModeTitle(selection))")
    }
}

func composerApprovalModeTitle(_ mode: RuntimeApprovalMode) -> String {
    switch mode {
    case .askForApproval:
        return "Ask for approval"
    case .approveForMe:
        return "Approve for me"
    case .fullAccess:
        return "Full access"
    }
}

func composerApprovalModeSubtitle(_ mode: RuntimeApprovalMode) -> String {
    switch mode {
    case .askForApproval:
        return "Start conversations immediately and ask before tools or external actions run."
    case .approveForMe:
        return "Start conversations immediately and ask only for potentially unsafe actions."
    case .fullAccess:
        return "Unrestricted access to the internet and any file on your computer."
    }
}

func composerApprovalModeIcon(_ mode: RuntimeApprovalMode) -> String {
    switch mode {
    case .askForApproval:
        return "hand.raised"
    case .approveForMe:
        return "checkmark.shield"
    case .fullAccess:
        return "exclamationmark.shield"
    }
}

func composerApprovalModeTone(_ mode: RuntimeApprovalMode) -> Color {
    switch mode {
    case .askForApproval:
        return RCTheme.muted
    case .approveForMe:
        return RCTheme.accentBlue
    case .fullAccess:
        return RCTheme.accentAmber
    }
}

struct ComposerAttachmentChip: View {
    let attachment: ChatAttachment
    var onRemove: () -> Void

    var statusText: String {
        switch attachment.status {
        case .uploaded:
            return "uploaded"
        case .failed:
            return "failed"
        case .cancelled:
            return "cancelled"
        case .importing, .staged:
            return "\(attachment.progress)%"
        }
    }

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: iconName(for: attachment.kind))
                .foregroundStyle(RCTheme.accentBlue)
            Text(attachment.fileName)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(RCTheme.text)
                .lineLimit(1)
            Text(statusText)
                .font(.system(size: 10))
                .foregroundStyle(attachment.status == .failed ? RCTheme.accentRed : RCTheme.muted)
                .lineLimit(1)
            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark")
            }
            .buttonStyle(.plain)
            .foregroundStyle(RCTheme.muted)
            .help("Remove attachment")
            .accessibilityLabel("Remove attachment")
        }
        .padding(.horizontal, 9)
        .frame(height: 30)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(attachment.fileName), \(statusText), attachment")
    }

    private func iconName(for kind: ChatAttachmentKind) -> String {
        switch kind {
        case .image:
            return "photo"
        case .audio:
            return "waveform"
        case .video:
            return "film"
        case .document:
            return "doc.text"
        case .file:
            return "doc"
        }
    }
}

struct ComposerEditor: NSViewRepresentable {
    @Binding var text: String
    @Binding var measuredHeight: CGFloat
    var disabled: Bool
    var textInset: NSSize
    var onSubmit: () -> Void

    static let minimumLineCount = 1
    static let maximumLineCount = 8
    static let fontSize: CGFloat = 14
    static let verticalTextInset: CGFloat = 8

    static var editorFont: NSFont {
        NSFont.systemFont(ofSize: fontSize, weight: .regular)
    }

    static var lineHeight: CGFloat {
        ceil(editorFont.ascender - editorFont.descender + editorFont.leading)
    }

    static var minimumHeight: CGFloat {
        lineHeight * CGFloat(minimumLineCount) + verticalTextInset * 2
    }

    static var maximumHeight: CGFloat {
        lineHeight * CGFloat(maximumLineCount) + verticalTextInset * 2
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, measuredHeight: $measuredHeight, onSubmit: onSubmit)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = false
        scrollView.autohidesScrollers = true

        let textView = SubmitTextView()
        textView.delegate = context.coordinator
        textView.onSubmit = { context.coordinator.submit() }
        textView.drawsBackground = false
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.font = Self.editorFont
        textView.textColor = NSColor(red: 0.835, green: 0.817, blue: 0.760, alpha: 1)
        textView.insertionPointColor = NSColor(red: 0.525, green: 0.695, blue: 0.900, alpha: 1)
        textView.textContainerInset = textInset
        textView.setAccessibilityLabel("Message composer")
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.autoresizingMask = [.width]

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else { return }
        context.coordinator.onSubmit = onSubmit
        context.coordinator.measuredHeight = $measuredHeight
        if let submitTextView = textView as? SubmitTextView {
            submitTextView.onSubmit = { context.coordinator.submit() }
        }
        if textView.string != text {
            textView.string = text
        }
        textView.textContainerInset = textInset
        textView.isEditable = !disabled
        textView.isSelectable = !disabled
        textView.alphaValue = disabled ? 0.55 : 1
        DispatchQueue.main.async {
            context.coordinator.updateMeasuredHeight(for: textView)
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var text: Binding<String>
        var measuredHeight: Binding<CGFloat>
        var onSubmit: () -> Void

        init(
            text: Binding<String>,
            measuredHeight: Binding<CGFloat>,
            onSubmit: @escaping () -> Void
        ) {
            self.text = text
            self.measuredHeight = measuredHeight
            self.onSubmit = onSubmit
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text.wrappedValue = textView.string
            updateMeasuredHeight(for: textView)
        }

        func updateMeasuredHeight(for textView: NSTextView) {
            guard
                let scrollView = textView.enclosingScrollView,
                let textContainer = textView.textContainer,
                let layoutManager = textView.layoutManager
            else { return }

            layoutManager.ensureLayout(for: textContainer)
            let laidOutTextHeight = ceil(layoutManager.usedRect(for: textContainer).height)
            let contentHeight = laidOutTextHeight + textView.textContainerInset.height * 2
            let minimumHeight = ComposerEditor.minimumHeight
            let maximumHeight = ComposerEditor.maximumHeight
            let clampedHeight = min(max(contentHeight, minimumHeight), maximumHeight)

            scrollView.hasVerticalScroller = contentHeight > maximumHeight
            if abs(measuredHeight.wrappedValue - clampedHeight) > 0.5 {
                measuredHeight.wrappedValue = clampedHeight
            }
        }

        func submit() {
            onSubmit()
        }
    }

    final class SubmitTextView: NSTextView {
        var onSubmit: (() -> Void)?

        override func keyDown(with event: NSEvent) {
            let isReturn = event.keyCode == 36 || event.keyCode == 76
            let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            if isReturn && !modifiers.contains(.shift) {
                onSubmit?()
                return
            }
            super.keyDown(with: event)
        }
    }
}

struct AttachmentMetadataRow: Identifiable, Equatable {
    var id: String
    var fileName: String
    var mimeType: String
    var byteSize: Int
    var sha256: String
    var kind: String
    var status: String
    var progress: Int
    var provenanceStorage: String
}

struct DocumentReferenceMetadataRow: Identifiable, Equatable {
    var id: String
    var title: String
    var kind: String
    var displayPath: String?
    var tokenCount: Int?
    var isSensitive: Bool
    var isRedacted: Bool
}

func attachmentMetadataRows(_ metadata: JSONRecord) -> [AttachmentMetadataRow] {
    guard case .array(let items)? = metadata["attachments"] else { return [] }
    return items.compactMap { item in
        guard case .object(let object) = item else { return nil }
        let fileName = stringValue(object["fileName"]) ?? "attachment"
        let provenance: JSONRecord
        if case .object(let value)? = object["provenance"] {
            provenance = value
        } else {
            provenance = [:]
        }
        return AttachmentMetadataRow(
            id: stringValue(object["id"]) ?? fileName,
            fileName: fileName,
            mimeType: stringValue(object["mimeType"]) ?? "application/octet-stream",
            byteSize: intValue(object["byteSize"]) ?? 0,
            sha256: stringValue(object["sha256"]) ?? "",
            kind: stringValue(object["kind"]) ?? "file",
            status: stringValue(object["status"]) ?? "unavailable",
            progress: intValue(object["progress"]) ?? 0,
            provenanceStorage: stringValue(provenance["storage"]) ?? "local-authorized"
        )
    }
}

func documentReferenceMetadataRows(_ metadata: JSONRecord) -> [DocumentReferenceMetadataRow] {
    let source: JSONValue? = metadata["documentReferences"] ?? metadata["references"]
    guard case .array(let items)? = source else { return [] }
    return items.compactMap { item in
        guard case .object(let object) = item else { return nil }
        let isSensitive = boolValue(object["isSensitive"]) ?? false
        let isRedacted = boolValue(object["isRedacted"]) ?? false
        return DocumentReferenceMetadataRow(
            id: stringValue(object["id"]) ?? stringValue(object["title"]) ?? "reference",
            title: isRedacted ? "[REDACTED]" : stringValue(object["title"]) ?? "Reference",
            kind: stringValue(object["referenceKind"]) ?? stringValue(object["kind"]) ?? "unknown",
            displayPath: isRedacted ? "[REDACTED]" : stringValue(object["displayPath"]),
            tokenCount: intValue(object["tokenCount"]),
            isSensitive: isSensitive,
            isRedacted: isRedacted || isSensitive
        )
    }
}

func formatByteCount(_ value: Int) -> String {
    ByteCountFormatter.string(fromByteCount: Int64(max(value, 0)), countStyle: .file)
}

private func intValue(_ value: JSONValue?) -> Int? {
    switch value {
    case .number(let number):
        return Int(number)
    case .string(let string):
        return Int(string)
    default:
        return nil
    }
}

struct MessageIconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        RCIconButtonInteractionBody(
            label: configuration.label,
            isPressed: configuration.isPressed,
            variant: .message
        )
    }
}

struct StatusBadge: View {
    var title: String
    var tone: ComponentTone
    var accessibilityLabelText: String?

    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(tone.color)
            .padding(.horizontal, 8)
            .frame(height: 20)
            .background(tone.background)
            .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(tone.color.opacity(0.42)))
            .accessibilityLabel(accessibilityLabelText ?? title)
    }
}

struct RoleBadge: View {
    var title: String
    var color: Color
    var border: Color

    var body: some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .frame(height: 20)
            .background(Color.white.opacity(0.03))
            .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(border))
            .accessibilityLabel("\(title) message role")
    }
}

func isActiveDispatch(_ status: DispatchStatus) -> Bool {
    switch status {
    case .queued, .started, .streaming:
        return true
    case .completed, .failed, .cancelled:
        return false
    }
}

func isAuthDispatch(_ dispatch: RuntimeDispatch) -> Bool {
    dispatch.errorCode == "auth_required"
}

func isOfflineDispatch(_ dispatch: RuntimeDispatch) -> Bool {
    guard dispatch.runtimeType == .openclaw else { return false }
    return ["harness_unhealthy", "harness_missing", "transport_error", "runtime_unavailable"].contains(dispatch.errorCode ?? "")
}

func friendlyDispatchError(_ dispatch: RuntimeDispatch) -> String {
    if let message = dispatch.errorMessage, !message.isEmpty {
        let runtimeName: String
        switch dispatch.runtimeType {
        case .hermes:
            runtimeName = "Hermes Agent"
        case .openclaw:
            runtimeName = "OpenClaw"
        case .claudeCode:
            runtimeName = "Claude Code"
        case .codexCli:
            runtimeName = "Codex CLI"
        case .relayEcho:
            runtimeName = "Relay Echo"
        case .none:
            runtimeName = "The runtime"
        }
        return userFacingRuntimeFailureMessage(message, runtimeName: runtimeName)
    }
    if dispatch.status == .cancelled {
        return "The runtime dispatch was cancelled before a reply was posted."
    }
    return "The runtime dispatch failed before a reply was posted."
}

func statusLabel(_ lifecycle: HarnessLifecycleState) -> String {
    switch lifecycle {
    case .notInstalled:
        return "Not Installed"
    case .installing:
        return "Installing"
    case .installed:
        return "Installed"
    case .starting:
        return "Starting"
    case .connected:
        return "Connected"
    case .authRequired:
        return "Auth Required"
    case .chatNotWired:
        return "Setup Needed"
    case .error:
        return "Error"
    }
}

func statusMessage(_ record: HarnessInstallRecord) -> String {
    if let message = record.lastError?.nilIfEmpty {
        return message
    }
    if let health = record.health {
        return health.message
    }
    if record.dependencyStatus != "installed" {
        return "Connect an existing runtime that you installed and manage."
    }
    if record.modelAuthStatus != .connected {
        return "Authentication is required in \(record.displayName). Complete it there, then re-check."
    }
    return record.lifecycleState == .connected ? "Runtime is ready for direct chat." : "Runtime is unavailable. Start it outside Relay Console, then re-check."
}

func runtimeConnectionLabel(_ record: HarnessInstallRecord) -> String {
    if record.source == .managed { return "Migration Needed" }
    if record.source == .missing { return "Not Connected" }
    if record.lifecycleState == .authRequired { return "Authentication Required" }
    if record.lifecycleState == .error { return "Offline" }
    return statusLabel(record.lifecycleState)
}

func runtimeConnectionTone(_ record: HarnessInstallRecord) -> ComponentTone {
    if record.source == .managed || record.source == .missing || record.lifecycleState == .authRequired { return .amber }
    if record.lifecycleState == .error { return .red }
    return statusTone(record.lifecycleState)
}

func runtimeCompatibilityLabel(_ record: HarnessInstallRecord) -> String {
    if let error = record.lastError?.lowercased(), error.contains("incompatible") || error.contains("unsupported version") {
        return "Incompatible"
    }
    let detectedVersion = record.installedVersion?.trimmingCharacters(in: CharacterSet(charactersIn: "v"))
    let testedVersion = record.targetVersion?.trimmingCharacters(in: CharacterSet(charactersIn: "v"))
    if (record.installedCommit != nil && record.installedCommit == record.targetCommit)
        || (detectedVersion != nil && detectedVersion == testedVersion) {
        return "Supported"
    }
    return "Version Not Verified"
}

func runtimeCompatibilityTone(_ record: HarnessInstallRecord) -> ComponentTone {
    switch runtimeCompatibilityLabel(record) {
    case "Supported": return .green
    case "Incompatible": return .red
    default: return .amber
    }
}

func runtimeCompatibilityMessage(_ record: HarnessInstallRecord) -> String {
    switch runtimeCompatibilityLabel(record) {
    case "Supported":
        return "This matches Relay Console's tested runtime release."
    case "Incompatible":
        return "This runtime version cannot use the current Relay integration."
    default:
        return "This installation was detected but does not match the exact Relay-tested release."
    }
}

func runtimeVersionSummary(_ record: HarnessInstallRecord) -> String {
    let installed = record.installedVersion?.nilIfEmpty ?? "Unknown"
    let verified = record.targetVersion?.nilIfEmpty ?? "Unknown"
    return "Installed \(installed) · Verified \(verified)"
}

func setupButtonLabel(_ record: HarnessInstallRecord, busy: Bool) -> String {
    if busy {
        return "Working..."
    }
    return record.source == .missing ? "Connect \(record.displayName)" : "Re-check"
}

func pillColor(_ lifecycle: HarnessLifecycleState) -> Color {
    statusTone(lifecycle).color
}

func statusTone(_ lifecycle: HarnessLifecycleState) -> ComponentTone {
    switch lifecycle {
    case .connected:
        return .green
    case .installing, .starting, .installed, .chatNotWired:
        return .blue
    case .authRequired, .notInstalled:
        return .amber
    case .error:
        return .red
    }
}

func formatTime(_ iso: String) -> String {
    let date = parseIsoDate(iso) ?? Date()
    return date.formatted(date: .omitted, time: .shortened)
}

func relativeTime(_ iso: String) -> String {
    guard let date = parseIsoDate(iso) else { return "" }
    let seconds = Int(Date().timeIntervalSince(date))
    if seconds < 60 { return "now" }
    if seconds < 3600 { return "\(seconds / 60)m" }
    if seconds < 86_400 { return "\(seconds / 3600)h" }
    return date.formatted(date: .abbreviated, time: .omitted)
}

func appIconImage() -> NSImage? {
    bundleImageURL(named: "source", extension: "png", subdirectories: ["Assets/AppIcon", nil])
        .flatMap(NSImage.init(contentsOf:))
        ?? bundleImageURL(named: "icon", extension: "png", subdirectories: ["Assets/AppIcon", nil])
            .flatMap(NSImage.init(contentsOf:))
}

func relayConsoleWordmarkImage() -> NSImage? {
    bundleImageURL(named: "logo_relay_console", extension: "png", subdirectories: ["Assets", nil])
        .flatMap(NSImage.init(contentsOf:))
}

private func parseIsoDate(_ iso: String) -> Date? {
    ISO8601DateFormatter.relayConsole.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
}

private func initials(_ name: String) -> String {
    let parts = name
        .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        .prefix(2)
        .compactMap(\.first)
    let value = String(parts).uppercased()
    return value.isEmpty ? "RC" : value
}

private func jsonString(_ value: JSONValue?) -> String? {
    guard let value else { return nil }
    if case .string(let string) = value { return string }
    return nil
}

private enum AvatarUploadValidationError: LocalizedError {
    case unsupportedType
    case fileTooLarge

    var errorDescription: String? {
        switch self {
        case .unsupportedType:
            return "Avatars must be PNG or JPEG images."
        case .fileTooLarge:
            return "Avatars must be 3 MB or smaller."
        }
    }
}

let maximumAvatarUploadBytes = 3 * 1024 * 1024
let allowedAvatarUploadContentTypes: [UTType] = [.png, .jpeg]

private final class RelayNSImageCache: @unchecked Sendable {
    private let storage = NSCache<NSString, NSImage>()

    func image(for key: String, load: () -> NSImage?) -> NSImage? {
        if let cached = storage.object(forKey: key as NSString) {
            return cached
        }
        guard let image = load() else { return nil }
        storage.setObject(image, forKey: key as NSString)
        return image
    }
}

private let avatarImageCache = RelayNSImageCache()
private let runtimeBrandImageCache = RelayNSImageCache()

private func remoteAvatarURL(_ value: String?) -> URL? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
        return nil
    }
    if let absoluteURL = URL(string: value),
       absoluteURL.scheme == "https",
       absoluteURL.host != nil {
        return absoluteURL
    }
    let normalized = value.hasPrefix("/") ? String(value.dropFirst()) : value
    guard normalized.hasPrefix("avatars/"), let baseURL = configuredAvatarAssetBaseURL else {
        return nil
    }
    return baseURL.appendingPathComponent(String(normalized.dropFirst("avatars/".count)))
}

private func loadAvatarImage(_ value: String?) -> NSImage? {
    guard let value, !value.isEmpty else { return nil }
    return avatarImageCache.image(for: value) {
        if value.hasPrefix("data:"), let comma = value.firstIndex(of: ",") {
            let payload = value[value.index(after: comma)...]
            return Data(base64Encoded: String(payload)).flatMap(NSImage.init(data:))
        }
        let normalized = value.hasPrefix("/") ? String(value.dropFirst()) : value
        if let avatarResource = bundledAvatarResource(from: normalized),
           let url = bundledAvatarImageURL(for: avatarResource) {
            return NSImage(contentsOf: url)
        } else {
            let fileName = URL(fileURLWithPath: normalized).lastPathComponent
            guard !fileName.isEmpty else { return nil }
            let ext = URL(fileURLWithPath: fileName).pathExtension
            let base = ext.isEmpty ? fileName : String(fileName.dropLast(ext.count + 1))
            if let url = bundleImageURL(named: base, extension: ext.isEmpty ? nil : ext, subdirectories: ["Assets/avatars/illustrated", nil]) {
                return NSImage(contentsOf: url)
            }
        }
        if let url = URL(string: value), url.isFileURL {
            return NSImage(contentsOf: url)
        }
        return nil
    }
}

private func bundledAvatarImageURL(for resource: BundledAvatarResource) -> URL? {
    let preferred = avatarResourceSubdirectories(categoryId: resource.categoryId)
    let legacyFallbacks = avatarCategoryDefinitions
        .filter { $0.id != resource.categoryId }
        .flatMap { avatarResourceSubdirectories(categoryId: $0.id) }
    return bundleImageURL(
        named: resource.baseName,
        extension: resource.extensionName,
        subdirectories: preferred + legacyFallbacks
    )
}

private func runtimeBrandImage(_ runtimeType: RuntimeType) -> NSImage? {
    let resourceName: String
    switch runtimeType {
    case .openclaw:
        resourceName = "hermes"
    case .hermes:
        resourceName = "openclaw"
    default:
        return nil
    }
    return runtimeBrandImageCache.image(for: runtimeType.rawValue) {
        guard let url = bundleImageURL(
            named: resourceName,
            extension: "png",
            subdirectories: ["Assets/runtime-icons", "Resources/Assets/runtime-icons", nil]
        ) else {
            return nil
        }
        return NSImage(contentsOf: url)
    }
}

private func chooseAvatarFile(onChange: @escaping (String?) -> Void) {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = allowedAvatarUploadContentTypes
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = false
    panel.begin { response in
        guard response == .OK, let url = panel.url else { return }
        do {
            let dataURL = try avatarUploadDataURL(from: url)
            DispatchQueue.main.async {
                onChange(dataURL)
            }
        } catch {
            NSSound.beep()
        }
    }
}

func avatarUploadDataURL(from url: URL) throws -> String {
    let accessed = url.startAccessingSecurityScopedResource()
    defer {
        if accessed { url.stopAccessingSecurityScopedResource() }
    }
    let ext = url.pathExtension.lowercased()
    guard let contentType = UTType(filenameExtension: ext),
          allowedAvatarUploadContentTypes.contains(where: { contentType.conforms(to: $0) }) else {
        throw AvatarUploadValidationError.unsupportedType
    }
    let values = try url.resourceValues(forKeys: [.fileSizeKey])
    if let fileSize = values.fileSize, fileSize > maximumAvatarUploadBytes {
        throw AvatarUploadValidationError.fileTooLarge
    }
    let data = try Data(contentsOf: url)
    guard data.count <= maximumAvatarUploadBytes else {
        throw AvatarUploadValidationError.fileTooLarge
    }
    let mime = contentType.conforms(to: .jpeg) ? "image/jpeg" : "image/png"
    return "data:\(mime);base64,\(data.base64EncodedString())"
}

func croppedAvatarDataURL(
    from image: NSImage,
    offset: CGSize,
    zoom: CGFloat,
    previewSize: CGFloat,
    outputPixels: Int
) throws -> String {
    let outputSize = CGFloat(outputPixels)
    let sourceSize = avatarSourceSize(image)
    let baseScale = max(outputSize / sourceSize.width, outputSize / sourceSize.height)
    let drawScale = baseScale * max(1, zoom)
    let drawSize = CGSize(width: sourceSize.width * drawScale, height: sourceSize.height * drawScale)
    let outputOffset = CGSize(
        width: offset.width / previewSize * outputSize,
        height: offset.height / previewSize * outputSize
    )
    let drawRect = NSRect(
        x: (outputSize - drawSize.width) / 2 + outputOffset.width,
        y: (outputSize - drawSize.height) / 2 - outputOffset.height,
        width: drawSize.width,
        height: drawSize.height
    )
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: outputPixels,
        pixelsHigh: outputPixels,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        throw AvatarUploadValidationError.unsupportedType
    }
    bitmap.size = NSSize(width: outputSize, height: outputSize)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: outputSize, height: outputSize).fill()
    image.draw(
        in: drawRect,
        from: NSRect(origin: .zero, size: image.size),
        operation: .sourceOver,
        fraction: 1,
        respectFlipped: false,
        hints: [.interpolation: NSImageInterpolation.high]
    )
    NSGraphicsContext.restoreGraphicsState()
    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        throw AvatarUploadValidationError.unsupportedType
    }
    return "data:image/png;base64,\(data.base64EncodedString())"
}

private func displaySize(for image: NSImage, previewSize: CGFloat, zoom: CGFloat) -> CGSize {
    let sourceSize = avatarSourceSize(image)
    let coverScale = max(previewSize / sourceSize.width, previewSize / sourceSize.height)
    let scale = coverScale * max(1, zoom)
    return CGSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
}

private func maxOffset(for image: NSImage, previewSize: CGFloat, zoom: CGFloat) -> CGSize {
    let size = displaySize(for: image, previewSize: previewSize, zoom: zoom)
    return CGSize(
        width: max(0, (size.width - previewSize) / 2),
        height: max(0, (size.height - previewSize) / 2)
    )
}

private func clampedOffset(_ offset: CGSize, image: NSImage, zoom: CGFloat, previewSize: CGFloat) -> CGSize {
    let bounds = maxOffset(for: image, previewSize: previewSize, zoom: zoom)
    return CGSize(
        width: min(max(offset.width, -bounds.width), bounds.width),
        height: min(max(offset.height, -bounds.height), bounds.height)
    )
}

private func avatarSourceSize(_ image: NSImage) -> CGSize {
    if let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        return CGSize(width: max(1, cgImage.width), height: max(1, cgImage.height))
    }
    return CGSize(width: max(1, image.size.width), height: max(1, image.size.height))
}

private func bundleImageURL(named name: String, extension ext: String?, subdirectories: [String?]) -> URL? {
    for subdirectory in subdirectories {
        if let url = Bundle.module.url(forResource: name, withExtension: ext, subdirectory: subdirectory) {
            return url
        }
    }
    return nil
}

let noAvatarPreferenceValue = "__relay_console_no_avatar__"

struct AvatarCategory: Identifiable, Hashable {
    var id: String
    var title: String
    var resourceNames: [String]

    func reference(for resourceName: String) -> String {
        if let baseURL = configuredAvatarAssetBaseURL {
            return baseURL
                .appendingPathComponent(id)
                .appendingPathComponent(resourceName)
                .absoluteString
        }
        return "avatars/\(id)/\(resourceName)"
    }
}

private struct BundledAvatarResource {
    var categoryId: String
    var fileName: String

    var extensionName: String? {
        let ext = URL(fileURLWithPath: fileName).pathExtension
        return ext.isEmpty ? nil : ext
    }

    var baseName: String {
        guard let extensionName else { return fileName }
        return String(fileName.dropLast(extensionName.count + 1))
    }
}

var avatarCategories: [AvatarCategory] {
    if configuredAvatarAssetBaseURL != nil {
        return avatarCategoryDefinitions.compactMap { definition in
            let names = remoteAvatarResourceNames(categoryId: definition.id)
            guard !names.isEmpty else { return nil }
            return AvatarCategory(id: definition.id, title: definition.title, resourceNames: names)
        }
    }
    return avatarCategoryDefinitions.compactMap { definition in
        let names = bundledAvatarResourceNames(categoryId: definition.id)
        guard !names.isEmpty else { return nil }
        return AvatarCategory(id: definition.id, title: definition.title, resourceNames: names)
    }
}

private var configuredAvatarAssetBaseURL: URL? {
    let configured = ProcessInfo.processInfo.environment["RELAY_CONSOLE_AVATAR_ASSET_BASE_URL"]
        ?? (Bundle.main.object(forInfoDictionaryKey: "RelayConsoleAvatarAssetBaseURL") as? String)
    guard let value = configured?.trimmingCharacters(in: .whitespacesAndNewlines),
          !value.isEmpty,
          let url = URL(string: value),
          url.scheme == "https",
          url.host != nil else {
        return nil
    }
    return url
}

private func remoteAvatarResourceNames(categoryId: String) -> [String] {
    switch categoryId {
    case "illustrated": return fallbackIllustratedAvatarResourceNames
    case "corporate": return sheetAvatarNames(sheet: 5, range: 1...100) + sheetAvatarNames(sheet: 6, range: 1...24)
    case "creator": return sheetAvatarNames(sheet: 7, range: 1...24)
    case "urban": return sheetAvatarNames(sheet: 1, range: 1...24)
    case "portrait": return sheetAvatarNames(sheet: 3, range: 1...24) + sheetAvatarNames(sheet: 10, range: 1...24)
    case "comic": return sheetAvatarNames(sheet: 8, range: 1...24) + sheetAvatarNames(sheet: 9, range: 1...9)
    case "retro": return sheetAvatarNames(sheet: 9, range: 10...24)
    case "hero": return sheetAvatarNames(sheet: 4, range: 1...24)
    case "vector": return sheetAvatarNames(sheet: 2, range: 1...24)
    default: return []
    }
}

private func sheetAvatarNames(sheet: Int, range: ClosedRange<Int>) -> [String] {
    range.map { String(format: "sheet-%02d_avatar-%03d.png", sheet, $0) }
}

private let avatarCategoryDefinitions: [(id: String, title: String)] = [
    ("illustrated", "Illustrated"),
    ("corporate", "Corporate"),
    ("creator", "Creator"),
    ("urban", "Urban"),
    ("portrait", "Portrait"),
    ("comic", "Comic"),
    ("retro", "Retro"),
    ("hero", "Hero"),
    ("vector", "Vector")
]

private func bundledAvatarResourceNames(categoryId: String) -> [String] {
    let urls = avatarResourceSubdirectories(categoryId: categoryId).flatMap { subdirectory in
        (Bundle.module.urls(forResourcesWithExtension: "png", subdirectory: subdirectory) ?? [])
            + (Bundle.module.urls(forResourcesWithExtension: "jpg", subdirectory: subdirectory) ?? [])
            + (Bundle.module.urls(forResourcesWithExtension: "jpeg", subdirectory: subdirectory) ?? [])
    }
    let names = urls.map(\.lastPathComponent).sorted()
    if categoryId == "illustrated" {
        return names.filter { $0 != hiddenIllustratedAvatarResourceName }
    }
    return names
}

private func avatarResourceSubdirectories(categoryId: String) -> [String] {
    [
        "avatars/\(categoryId)",
        "Assets/avatars/\(categoryId)",
        "Resources/Assets/avatars/\(categoryId)"
    ]
}

private func bundledAvatarResource(from value: String) -> BundledAvatarResource? {
    let parts = value.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
    guard parts.count == 3, parts[0] == "avatars" else { return nil }
    let categoryId = parts[1]
    guard avatarCategoryDefinitions.contains(where: { $0.id == categoryId }) else { return nil }
    return BundledAvatarResource(categoryId: categoryId, fileName: parts[2])
}

private func avatarCategoryId(for value: String?) -> String? {
    guard let value else { return nil }
    let normalized = value.hasPrefix("/") ? String(value.dropFirst()) : value
    return bundledAvatarResource(from: normalized)?.categoryId
}

func defaultIllustratedAvatarURL(seed: String) -> String? {
    let names = illustratedAvatarResourceNames
    guard !names.isEmpty else { return nil }
    let index = stableAvatarIndex(seed: seed, count: names.count)
    return "avatars/illustrated/\(names[index])"
}

var illustratedAvatarResourceNames: [String] {
    let names = bundledAvatarResourceNames(categoryId: "illustrated")
    return names.isEmpty ? fallbackIllustratedAvatarResourceNames : names
}

private func stableAvatarIndex(seed: String, count: Int) -> Int {
    var hash: UInt64 = 5381
    for scalar in seed.unicodeScalars {
        hash = ((hash << 5) &+ hash) &+ UInt64(scalar.value)
    }
    return Int(hash % UInt64(count))
}

private let hiddenIllustratedAvatarResourceName = "illustrated-white-male-03.png"

private let fallbackIllustratedAvatarResourceNames = [
    "illustrated-black-female-01.png",
    "illustrated-black-female-02.png",
    "illustrated-black-female-03.png",
    "illustrated-black-male-01.png",
    "illustrated-black-male-02.png",
    "illustrated-black-male-03.png",
    "illustrated-east-asian-female-01.png",
    "illustrated-east-asian-female-02.png",
    "illustrated-east-asian-female-03.png",
    "illustrated-east-asian-male-01.png",
    "illustrated-east-asian-male-02.png",
    "illustrated-east-asian-male-03.png",
    "illustrated-latino-female-01.png",
    "illustrated-latino-female-02.png",
    "illustrated-latino-female-03.png",
    "illustrated-latino-male-01.png",
    "illustrated-latino-male-02.png",
    "illustrated-latino-male-03.png",
    "illustrated-middle-eastern-female-01.png",
    "illustrated-middle-eastern-female-02.png",
    "illustrated-middle-eastern-female-03.png",
    "illustrated-middle-eastern-male-01.png",
    "illustrated-middle-eastern-male-02.png",
    "illustrated-middle-eastern-male-03.png",
    "illustrated-south-asian-female-01.png",
    "illustrated-south-asian-female-02.png",
    "illustrated-south-asian-female-03.png",
    "illustrated-south-asian-male-01.png",
    "illustrated-south-asian-male-02.png",
    "illustrated-south-asian-male-03.png",
    "illustrated-southeast-asian-female-01.png",
    "illustrated-southeast-asian-female-02.png",
    "illustrated-southeast-asian-female-03.png",
    "illustrated-southeast-asian-male-01.png",
    "illustrated-southeast-asian-male-02.png",
    "illustrated-southeast-asian-male-03.png",
    "illustrated-white-female-01.png",
    "illustrated-white-female-02.png",
    "illustrated-white-female-03.png",
    "illustrated-white-male-01.png",
    "illustrated-white-male-02.png"
]
