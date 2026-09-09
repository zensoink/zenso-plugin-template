/**
 * Injects stylesheet and (optionally) script tags into an HTML template.
 *
 * @param html - The template markup to inject into.
 * @param opts - Asset references.
 * @param opts.stylesHref - Stylesheet `href` for the `<link>` tag (always emitted).
 * @param opts.mainSrc - Script `src` for the `<script type="module">` tag, or `null` to omit it.
 * @returns The markup with tags inserted before `</head>`, or appended when no `head` exists.
 * @example
 * injectHeadAssets('<head></head>', { stylesHref: 'assets/styles.css', mainSrc: null });
 * // '<head><link rel="stylesheet" href="assets/styles.css">\n</head>'
 */
export function injectHeadAssets(html: string, opts: { stylesHref: string; mainSrc: string | null }): string {
    const tags = [`<link rel="stylesheet" href="${opts.stylesHref}">`];
    if (opts.mainSrc) tags.push(`<script type="module" src="${opts.mainSrc}"></script>`);
    const injection = tags.join('\n');
    if (html.includes('</head>')) return html.replace('</head>', `${injection}\n</head>`);
    return `${html}\n${injection}`;
}
