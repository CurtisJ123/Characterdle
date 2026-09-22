# Isolated frontend benchmark

This harness only serves a prebuilt `dist` on an ephemeral loopback port. It does
not build, change application code, read credentials, connect to live services,
or use an existing Chrome profile. Every API response is a deterministic local
fixture. Unknown API calls fail locally; all off-origin browser requests are
blocked. Browser background networking and external DNS resolution are disabled.

Run the same command against a copied baseline and the optimized production build:

```powershell
node scripts/performance-benchmark.mjs --label=baseline --dist=C:/path/to/baseline/dist --output=C:/path/to/reports/baseline
node scripts/performance-benchmark.mjs --label=after --dist=./dist --output=C:/path/to/reports/after --assert-split=true
node scripts/performance/compare.mjs C:/path/to/reports/baseline/report.json C:/path/to/reports/after/report.json C:/path/to/reports/comparison.md
```

Playwright is resolved from installed packages or the bundled Codex runtime. Use
`--playwright=C:/path/to/playwright` and `--chromium=C:/path/to/chrome.exe` to override.
The installed browser executable can be used safely: Playwright creates a fresh
temporary profile, not the user's profile or an existing browser window.

Defaults: three cold runs of each scenario, 375x812 at DPR 2, 4x CPU throttling,
1.6 Mbps download / 0.75 Mbps upload, 150ms network latency, 15-second fixed window.
HTML, CSS, JS, JSON and SVG are Brotli-compressed at quality 6. Reports contain
FCP, LCP, session-window CLS, UI-ready time, long tasks, individual resource sizes,
loaded-image state, browser errors, and mobile/desktop screenshots. No Lighthouse
score or field INP is claimed. Off-origin fonts are blocked for both builds, so
screenshots use identical fallback fonts; this is not a production typography test.
Screenshots explicitly wait for image decoding after metric collection, avoiding
blank offscreen portraits in full-page captures without affecting measured times.

The fresh scenarios measure landing, character and quote initial loads. The two
progress scenarios restore three incorrect guesses entirely inside the isolated
browser to exercise large portraits without playing or changing a real daily game.
The UI is exercised after measurements for mode switching, a help modal and
secondary-page navigation. Their requests are not included in initial-load totals.

Options: `--runs=3`, `--observation-ms=15000`, `--scenarios=landing,character,quote`,
`--validation=false`, `--validation-only=true`. Any unfinished static asset transfers fail the run; increase the window
for both builds and repeat. Keep browser version, machine load, settings and
fixtures identical. Do not compare localhost numbers to actual user Core Web Vitals.

`--assert-split=true` also requires independent lazy entries for admin/auth/profile/
settings/updates and checks no secondary screen chunks are requested during any
initial page load. AuthContext and lightweight announcement metadata requests are
expected. JavaScript totals always include all scripts, not just the App chunk.

Use `--diagnostic=true --assert-split=true --scenarios=character --runs=1
--validation=false` in a separate output directory to record layout-shift sources,
loading-state transitions and API completion times. This also asserts that an
already-preloaded initial route never mounts the generic lazy-loading fallback.
Diagnostic results are not substituted for the three-run performance comparison.
`--validation-only=true --assert-split=true` additionally tests intentionally failed
and delayed About-page chunks, checking the Reload/fallback UI preserves the header.

The screenshot comparison helper uses bundled `pngjs` and `pixelmatch`. Pass the
baseline measurement directory, expanded baseline validation directory, and after
directory, followed by an optional JSON report path:

```powershell
node scripts/performance/compare-screenshots.mjs C:/reports/baseline C:/reports/baseline-validation C:/reports/after C:/reports/visual-comparison.json
```

Expected image-encoding changes may alter pixels. The helper asserts identical
screenshot dimensions, but visual inspection is still required for layout and
image quality. It does not modify screenshots.
