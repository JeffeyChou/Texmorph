---
'@texmorph/dom': minor
'@texmorph/remotion': patch
---

`shapes` now defaults to `'always'`, so `render(t)` depends on `t` alone in every host: live playback, scrubbing and offline frame-by-frame rendering draw the same frame for the same progress. `'auto'`, which measures the display frame rate and falls back to stretch-and-crossfade on slow devices, is now opt-in for live pages. `<TexMorph>` no longer overrides the default.
