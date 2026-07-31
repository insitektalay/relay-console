import {
  MESSAGE_CONTENT_FORMAT_HTML,
  MESSAGE_CONTENT_FORMAT_MARKDOWN,
  RESPONSE_PRESENTATION_HTML_NATIVE,
  prepareAgentReplyForStorage,
} from "./response-presentation";

function htmlNativeMetadata(result: ReturnType<typeof prepareAgentReplyForStorage>) {
  return result.metadata.htmlNative as Record<string, unknown>;
}

describe("response presentation HTML-native sanitizer", () => {
  it("preserves safe scoped HTML and CSS for HTML-native replies", () => {
    const result = prepareAgentReplyForStorage({
      responsePresentation: RESPONSE_PRESENTATION_HTML_NATIVE,
      rawContent: `
        <section class="cc-html-reply cc-html-variant-command">
          <style>.cc-html-reply .cc-html-card { color: #f7faff; border: 1px solid #334155; }</style>
          <div class="cc-html-card">
            <h2 class="cc-html-title">Safe report</h2>
            <p class="cc-html-muted">Only scoped app-owned classes render.</p>
          </div>
        </section>
      `,
    });

    expect(result.contentFormat).toBe(MESSAGE_CONTENT_FORMAT_HTML);
    expect(result.content).toContain("<style>");
    expect(result.content).toContain(".cc-html-reply .cc-html-card");
    expect(result.content).toContain("Safe report");
    expect(htmlNativeMetadata(result).validity).toBe("valid");
  });

  it("strips script, event-handler, remote-media, inline-style, javascript URL, and unsafe CSS payloads", () => {
    const result = prepareAgentReplyForStorage({
      responsePresentation: RESPONSE_PRESENTATION_HTML_NATIVE,
      rawContent: `
        <section class="cc-html-reply cc-html-variant-command">
          <style>
            .cc-html-reply .cc-html-card {
              color: #f7faff;
              background-image: url("https://evil.example/track.png");
              position: fixed;
              transition: all 2s;
            }
          </style>
          <div class="cc-html-card" onclick="alert(1)" style="color:red">
            <script>alert(1)</script>
            <img src="https://evil.example/pixel.png" onerror="alert(2)">
            <a href="javascript:alert(3)" onclick="alert(4)">Open</a>
          </div>
        </section>
      `,
    });

    const metadata = htmlNativeMetadata(result);

    expect(result.contentFormat).toBe(MESSAGE_CONTENT_FORMAT_HTML);
    expect(result.content).not.toMatch(/<script|onclick|onerror|style=|<img|javascript:/i);
    expect(result.content).not.toMatch(/url\s*\(|position:\s*fixed|transition:/i);
    expect(result.content).toContain("Open");
    expect(metadata.validity).toBe("sanitized");
    expect(String(metadata.styleRemovedReason)).toContain("unsafe_declaration_removed");
  });

  it("falls back to markdown text when a reply attempts to render a document", () => {
    const result = prepareAgentReplyForStorage({
      responsePresentation: RESPONSE_PRESENTATION_HTML_NATIVE,
      rawContent: `
        <!doctype html>
        <html>
          <body>
            <section class="cc-html-reply">Visible text<script>alert(1)</script></section>
          </body>
        </html>
      `,
    });

    expect(result.contentFormat).toBe(MESSAGE_CONTENT_FORMAT_MARKDOWN);
    expect(result.content).toBe("Visible text");
    expect(htmlNativeMetadata(result).reason).toBe("document_html_not_allowed");
  });
});
