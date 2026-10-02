# Pinterest Cleaner - AI Filter & Ad Blocker

Local-first browser extension that hides AI content, promoted pins, and user-defined rules on Pinterest.

中文名：**Pinterest 净化助手 - AI 过滤与广告屏蔽**

## Features

- AI filter: Strict / Standard / Aggressive
- Promoted / Sponsored / Shopping ads filtering (multi-language labels)
- Keyword rules (AND / OR, contains / exact / regex)
- Creator and source-domain filters
- Content-type filters and page-module cleaner
- Whitelist, pause / resume, show filtered content
- Local stats, diagnostics, safe mode
- Import / export
- Edge / Chrome / Firefox
- English default UI + Simplified Chinese

## Privacy

All filtering runs locally in your browser. Settings and rules stay on device. No account. No server upload.

## Develop

Load unpacked:

1. Chromium / Edge: `chrome://extensions` → Developer mode → Load unpacked → select this folder
2. Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → choose `manifest.firefox.json` (or packed xpi)

```bash
npm test
npm run pack
```

Outputs:

- `pinterest-cleaner-chromium.zip` (Edge + Chrome)
- `pinterest-cleaner-firefox.xpi`

## Architecture

```text
DOM Observer → Pin Extractor → Filter Engine → Renderer
                     ↑
              Selector Registry + Safe Mode + Diagnostics
```

Detectors never mutate DOM. Renderer only hides/restores with reversible attributes (`data-pc-filtered`), never `element.remove()`.

## Permissions

- `storage`
- `https://*.pinterest.com/*`

## Notes

- Icons/screenshots can be replaced later under `icons/` and `store/`.
- Pinterest DOM changes frequently; selectors are centralized in `src/content/lib/selectors.js`.
