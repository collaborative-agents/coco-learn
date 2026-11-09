/** Extract a complete HTML document from any Coco reply for the shared preview window. */
export function extractPreviewHtml(reply: string): string | null {
  const html = reply.match(/<!doctype html[\s\S]*?<\/html>/i)?.[0]
    ?? reply.match(/<html\b[\s\S]*?<\/html>/i)?.[0];
  if (!html || html.length > 2_000_000 || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.body.textContent?.trim()) return null;
  doc.querySelectorAll('script, iframe, object, embed, form, base, link, meta[http-equiv], svg, math, template')
    .forEach((element) => element.remove());
  doc.querySelectorAll('style').forEach((element) => {
    element.textContent = (element.textContent ?? '')
      .replace(/@import[^;]*;?/gi, '')
      .replace(/url\([^)]*\)/gi, 'none');
  });
  doc.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)
        || /^(src|href|srcset|action|formaction|poster|background|xlink:href|srcdoc|data)$/i.test(attribute.name)
        || (attribute.name === 'style' && /url\s*\(/i.test(attribute.value))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/** A page may reserve space for the bundled Coco mascot using data-coco-mascot. */
export function embedCocoMascot(html: string, mascotDataUrl: string | null): string {
  if (!mascotDataUrl?.startsWith('data:image/png;base64,') || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img[data-coco-mascot]').forEach((image) => image.setAttribute('src', mascotDataUrl));
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
