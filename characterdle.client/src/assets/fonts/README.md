# Local typography assets

These are the unmodified WOFF2 subsets previously served by Google Fonts for
Cinzel (600/700), Cormorant Garamond (500/600/700), and Inter (400-800), normal style.
The variable files share weights; `fonts.css` preserves the old weight limits so
existing CSS requesting 900 still selects the same maximum weight as before.
No new italic faces or font styles have been introduced.

`sources.json` records each upstream URL, subset, byte size, and SHA-256.
The original Unicode coverage is retained for international usernames/comments.
Subsets load only when their characters are used; English pages normally need
only the three Latin files. Only Inter Latin and Cormorant Garamond Latin are
preloaded. Vite bundles the local CSS import and fingerprints the WOFF2 URLs,
including the HTML preloads, under `/assets/` for Cloudflare asset serving.

To intentionally refresh the assets, run `node scripts/vendor-fonts.mjs` from
the frontend directory and review the resulting file/hash/visual changes.
This maintenance command needs network access. Normal builds and visitors do not
contact Google Fonts. Font licenses are in `public/licenses/*-OFL.txt`.

The inline `HistoryEduIcon` uses Google's official
[History Edu Outlined SVG](https://github.com/google/material-design-icons/blob/master/symbols/web/history_edu/materialsymbolsoutlined/history_edu_24px.svg)
(24px optical size, weight 400, fill 0, grade 0). Its path is unchanged;
`fill="currentColor"` preserves the existing theme color. The license is in
`public/licenses/material-symbols-Apache-2.0.txt`.
