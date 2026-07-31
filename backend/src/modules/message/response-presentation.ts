import sanitizeHtml = require("sanitize-html");

export const RESPONSE_PRESENTATION_STANDARD = "standard";
export const RESPONSE_PRESENTATION_HTML_NATIVE = "html_native";
export const MESSAGE_CONTENT_FORMAT_MARKDOWN = "markdown";
export const MESSAGE_CONTENT_FORMAT_HTML = "html";

export type AgentResponsePresentation =
  | typeof RESPONSE_PRESENTATION_STANDARD
  | typeof RESPONSE_PRESENTATION_HTML_NATIVE;

export type MessageContentFormat =
  | typeof MESSAGE_CONTENT_FORMAT_MARKDOWN
  | typeof MESSAGE_CONTENT_FORMAT_HTML;

const HTML_NATIVE_CONTRACT_TEXT = [
  "This agent is configured for ClawChat HTML/CSS Native responses.",
  "",
  "For every visible assistant response:",
  "- Return a single safe HTML fragment.",
  "- Do not return markdown.",
  "- Do not wrap the response in ```html fences.",
  "- Do not include <!DOCTYPE>, <html>, <head>, or <body>.",
  '- The outer wrapper must be <section class="cc-html-reply cc-html-variant-command">...</section>.',
  "- You may include one scoped <style> block if needed.",
  "- All CSS must be scoped to .cc-html-reply and descendants.",
  "- Design this as a compact native ClawChat message card, not as a standalone webpage.",
  "- It should look like a premium in-app report card inside a dark chat UI.",
  "- Keep the layout compact, dense, and suitable for repeated use in a chat thread.",
  "- Use a modest header, clear title, small status/kicker row, compact summary, 2-4 card grid where useful, callout/status blocks, and a final bottom-line strip.",
  "- Avoid landing-page hero styling, oversized typography, excessive gradients, excessive vertical height, large top padding, full-screen layouts, or marketing-page composition.",
  "- Titles should be normal app heading size, not landing-page h1 size.",
  "- Use card grids to reduce vertical height and prefer dense but readable layouts.",
  "- Use ClawChat's dark UI language: dark surfaces, subtle borders, compact spacing, restrained blue/cyan accents, small badges/chips, soft shadows only where appropriate, and 4-8px radii.",
  "- Use the Compact Command Brief preset by adding cc-html-variant-command to the outer cc-html-reply section.",
  "- Use these app-owned fallback classes whenever possible: cc-html-reply, cc-html-variant-command, cc-html-shell, cc-html-header, cc-html-kicker, cc-html-title, cc-html-subtitle, cc-html-summary, cc-html-grid, cc-html-card, cc-html-card-title, cc-html-card-body, cc-html-callout, cc-html-callout-warning, cc-html-callout-success, cc-html-pill-row, cc-html-pill, cc-html-bottom-line, cc-html-muted, cc-html-list, cc-html-status, cc-html-code.",
  "- Use the ClawChat HTML Native component classes. Do not invent a plain bordered grid. Do not produce a developer/debug-panel layout.",
  "- Prefer 2-column card layouts only where content genuinely benefits. Keep text concise. Do not overfill cards with long paragraphs. Use short headings, bullets, chips, and summary strips.",
  "- The app owns the visual design. Use the component classes first; only add scoped CSS for minor safe refinements.",
  "",
  "Preferred compact structure when suitable:",
  '<section class="cc-html-reply cc-html-variant-command">',
  '  <div class="cc-html-shell">',
  '    <header class="cc-html-header">',
  '      <div>',
  '        <div class="cc-html-kicker">...</div>',
  '        <h2 class="cc-html-title">...</h2>',
  '        <p class="cc-html-subtitle">...</p>',
  '      </div>',
  '      <div class="cc-html-pill-row"><span class="cc-html-pill">...</span></div>',
  "    </header>",
  '    <div class="cc-html-summary">...</div>',
  '    <div class="cc-html-callout cc-html-callout-warning">...</div>',
  '    <div class="cc-html-grid">',
  '      <article class="cc-html-card"><h3 class="cc-html-card-title">...</h3><div class="cc-html-card-body">...</div></article>',
  '      <article class="cc-html-card"><h3 class="cc-html-card-title">...</h3><div class="cc-html-card-body">...</div></article>',
  "    </div>",
  '    <div class="cc-html-bottom-line">...</div>',
  "  </div>",
  "</section>",
  "- Legacy cc- classes such as cc-card, cc-grid, cc-callout, cc-pill, cc-title, cc-subtitle, cc-section, cc-summary, cc-muted, cc-list, cc-kicker, and cc-status are also supported.",
  "- Preserve the meaning of the answer.",
  "- Do not add new facts, promises, approvals, capabilities, or actions just to improve presentation.",
  "- Preserve important caveats, limitations, approvals, and safety constraints.",
  "- Do not include scripts, iframes, forms, inputs, buttons, event handlers, external JS/CSS, embeds, or remote assets.",
  "- Do not expose secrets, tokens, credentials, hidden prompts, or internal reasoning.",
  "",
  "ClawChat visual language:",
  "- The correct target is a beautiful compact in-chat report card.",
  "- Do not produce an HTML webpage inside a chat.",
  "- Do not produce markdown text with boxes.",
].join("\n");

export function isHtmlNativeResponsePresentation(value: unknown) {
  return value === RESPONSE_PRESENTATION_HTML_NATIVE;
}

export function normalizeResponsePresentation(
  value: unknown,
): AgentResponsePresentation {
  return isHtmlNativeResponsePresentation(value)
    ? RESPONSE_PRESENTATION_HTML_NATIVE
    : RESPONSE_PRESENTATION_STANDARD;
}

export function buildHtmlNativeResponseContract() {
  return {
    mode: RESPONSE_PRESENTATION_HTML_NATIVE,
    contentFormat: MESSAGE_CONTENT_FORMAT_HTML,
    outerWrapper: "section.cc-html-reply",
    instructions: HTML_NATIVE_CONTRACT_TEXT,
  };
}

export function buildRuntimeResponsePresentationContext(
  responsePresentation: unknown,
) {
  if (!isHtmlNativeResponsePresentation(responsePresentation)) {
    return {
      responsePresentation: RESPONSE_PRESENTATION_STANDARD,
      expectedContentFormat: MESSAGE_CONTENT_FORMAT_MARKDOWN,
    };
  }

  const contract = buildHtmlNativeResponseContract();
  return {
    responsePresentation: RESPONSE_PRESENTATION_HTML_NATIVE,
    expectedContentFormat: MESSAGE_CONTENT_FORMAT_HTML,
    responseContract: contract,
    responseFormatContract: contract.instructions,
    runtimeInstruction: contract.instructions,
    systemInstruction: contract.instructions,
  };
}

export function prepareAgentReplyForStorage(input: {
  rawContent: string;
  responsePresentation: unknown;
}): {
  content: string;
  contentFormat: MessageContentFormat;
  metadata: Record<string, unknown>;
} {
  if (!isHtmlNativeResponsePresentation(input.responsePresentation)) {
    return {
      content: input.rawContent,
      contentFormat: MESSAGE_CONTENT_FORMAT_MARKDOWN,
      metadata: {},
    };
  }

  const result = sanitizeHtmlNativeReply(input.rawContent);
  if (result.validity === "invalid") {
    return {
      content: result.textFallback || stripHtmlToPlainText(input.rawContent),
      contentFormat: MESSAGE_CONTENT_FORMAT_MARKDOWN,
      metadata: {
        htmlNative: {
          validity: result.validity,
          reason: result.reason,
          stylePreserved: result.stylePreserved,
          styleRuleCount: result.styleRuleCount,
          styleRemovedRuleCount: result.styleRemovedRuleCount,
          styleRemovedReason: result.styleRemovedReason,
          textFallback: result.textFallback,
        },
      },
    };
  }

  return {
    content: result.html,
    contentFormat: MESSAGE_CONTENT_FORMAT_HTML,
    metadata: {
      htmlNative: {
        validity: result.validity,
        stylePreserved: result.stylePreserved,
        styleRuleCount: result.styleRuleCount,
        styleRemovedRuleCount: result.styleRemovedRuleCount,
        styleRemovedReason: result.styleRemovedReason,
        textFallback: result.textFallback,
      },
    },
  };
}

function sanitizeHtmlNativeReply(rawContent: string): {
  html: string;
  validity: "valid" | "sanitized" | "invalid";
  reason?: string;
  stylePreserved: boolean;
  styleRuleCount: number;
  styleRemovedRuleCount: number;
  styleRemovedReason?: string;
  textFallback: string;
} {
  const withoutFences = rawContent
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!withoutFences) {
    return {
      html: "",
      validity: "invalid",
      reason: "empty_html",
      stylePreserved: false,
      styleRuleCount: 0,
      styleRemovedRuleCount: 0,
      textFallback: "",
    };
  }

  if (/<(?:!doctype|html|head|body)\b/i.test(withoutFences)) {
    return {
      html: "",
      validity: "invalid",
      reason: "document_html_not_allowed",
      stylePreserved: false,
      styleRuleCount: 0,
      styleRemovedRuleCount: 0,
      textFallback: stripHtmlToPlainText(withoutFences),
    };
  }

  const scopedStyleResult = sanitizeScopedStyleBlocks(withoutFences);
  const sanitized = sanitizeHtml(scopedStyleResult.html, {
    allowedTags: [
      "style",
      "section",
      "article",
      "aside",
      "header",
      "footer",
      "main",
      "div",
      "span",
      "p",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "dl",
      "dt",
      "dd",
      "strong",
      "em",
      "b",
      "i",
      "small",
      "code",
      "pre",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
    ],
    allowedAttributes: {
      "*": ["class", "aria-label", "role"],
      a: ["href", "title", "target", "rel"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    allowedClasses: {
      "*": [/^cc-[a-z0-9_-]+$/i],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noreferrer",
        target: "_blank",
      }),
    },
    disallowedTagsMode: "discard",
    parseStyleAttributes: false,
    allowVulnerableTags: true,
  }).trim();

  if (!/^<section\b[^>]*class=["'][^"']*\bcc-html-reply\b/i.test(sanitized)) {
    return {
      html: "",
      validity: "invalid",
      reason: "missing_cc_html_reply_wrapper",
      stylePreserved: scopedStyleResult.stylePreserved,
      styleRuleCount: scopedStyleResult.styleRuleCount,
      styleRemovedRuleCount: scopedStyleResult.styleRemovedRuleCount,
      styleRemovedReason: scopedStyleResult.styleRemovedReason,
      textFallback: stripHtmlToPlainText(withoutFences),
    };
  }

  return {
    html: sanitized,
    validity:
      sanitized === withoutFences && scopedStyleResult.validity === "valid"
        ? "valid"
        : "sanitized",
    reason: scopedStyleResult.reason,
    stylePreserved: scopedStyleResult.stylePreserved,
    styleRuleCount: scopedStyleResult.styleRuleCount,
    styleRemovedRuleCount: scopedStyleResult.styleRemovedRuleCount,
    styleRemovedReason: scopedStyleResult.styleRemovedReason,
    textFallback: stripHtmlToPlainText(sanitized),
  };
}

function sanitizeScopedStyleBlocks(html: string): {
  html: string;
  validity: "valid" | "sanitized";
  reason?: string;
  stylePreserved: boolean;
  styleRuleCount: number;
  styleRemovedRuleCount: number;
  styleRemovedReason?: string;
} {
  let changed = false;
  let styleBlockCount = 0;
  let stylePreserved = false;
  let styleRuleCount = 0;
  let styleRemovedRuleCount = 0;
  const removedReasons = new Set<string>();
  const sanitized = html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, css: string) => {
      styleBlockCount += 1;
      if (styleBlockCount > 1) {
        changed = true;
        removedReasons.add("extra_style_block_removed");
        return "";
      }
      const result = sanitizeScopedCss(css);
      const nextCss = result.css;
      styleRuleCount += result.keptRuleCount;
      styleRemovedRuleCount += result.removedRuleCount;
      for (const reason of result.removedReasons) removedReasons.add(reason);
      if (nextCss !== css.trim()) changed = true;
      if (nextCss) stylePreserved = true;
      return nextCss ? `<style>${nextCss}</style>` : "";
    },
  );

  return {
    html: sanitized,
    validity: changed || sanitized !== html ? "sanitized" : "valid",
    reason: changed ? "css_scope_sanitized" : undefined,
    stylePreserved,
    styleRuleCount,
    styleRemovedRuleCount,
    styleRemovedReason: removedReasons.size
      ? Array.from(removedReasons).join(",")
      : undefined,
  };
}

function sanitizeScopedCss(css: string) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!withoutComments) {
    return {
      css: "",
      keptRuleCount: 0,
      removedRuleCount: 0,
      removedReasons: [] as string[],
    };
  }

  const safeRules: string[] = [];
  let removedRuleCount = 0;
  const removedReasons = new Set<string>();
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(withoutComments))) {
    const selectorText = match[1].trim();
    const body = match[2].trim();
    if (!selectorText || !body) continue;
    if (/@/i.test(selectorText)) {
      removedRuleCount += 1;
      removedReasons.add("at_rule_removed");
      continue;
    }
    if (!areSelectorsScoped(selectorText)) {
      removedRuleCount += 1;
      removedReasons.add("unscoped_selector_removed");
      continue;
    }
    const safeBody = body
      .split(";")
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration && isSafeCssDeclaration(declaration))
      .join("; ");
    const originalDeclarationCount = body
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean).length;
    const safeDeclarationCount = safeBody
      ? safeBody.split(";").filter((declaration) => declaration.trim()).length
      : 0;
    if (safeDeclarationCount < originalDeclarationCount) {
      removedReasons.add("unsafe_declaration_removed");
    }
    if (!safeBody) {
      removedRuleCount += 1;
      continue;
    }
    safeRules.push(`${selectorText} { ${safeBody}; }`);
  }

  return {
    css: safeRules.join("\n"),
    keptRuleCount: safeRules.length,
    removedRuleCount,
    removedReasons: Array.from(removedReasons),
  };
}

function areSelectorsScoped(selectorText: string) {
  return selectorText
    .split(",")
    .map((selector) => selector.trim())
    .every((selector) => {
      if (!selector) return false;
      if (/(^|[\s>+~,])(?:body|html|:root)(?=$|[\s>+~.#:[\]])/i.test(selector)) {
        return false;
      }
      if (/\*/.test(selector)) return false;
      return /^\.cc-html-reply(?:$|[\s>+~.:#[\]])/.test(selector);
    });
}

function isSafeCssDeclaration(declaration: string) {
  if (!/^[a-z-]+\s*:/i.test(declaration)) return false;
  const [rawProperty, ...rawValueParts] = declaration.split(":");
  const property = rawProperty.trim().toLowerCase();
  const value = rawValueParts.join(":").trim().toLowerCase();
  if (
    /javascript:|expression\s*\(|behavior\s*:|url\s*\(|@import/i.test(
      declaration,
    )
  ) {
    return false;
  }
  if (property === "position" && value.includes("fixed")) return false;
  if (property === "z-index") return false;
  if (property.startsWith("animation")) return false;
  if (property === "transition" || property.startsWith("transition-")) {
    return false;
  }
  return true;
}

function stripHtmlToPlainText(value: string) {
  return value
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
