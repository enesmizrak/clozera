# Clozera wordmark — v1 review set

Chosen direction: a lowercase `clozera` with a horizontal slot inside the orange `o`, and a C
monogram for the favicon. The chosen light-background wordmark and the light and dark favicon
versions are wired into the app. This folder holds the working files; the optimized copies the
app uses live in `frontend/public/brand`.

## Files

- `logo-on-light.png`: transparent PNG wordmark with dark lettering, for light backgrounds.
- `logo-on-dark-preview.png`: preview of the wordmark on a dark background; **not transparent**.
- `symbol-on-light.png`: dark C + orange dash for light backgrounds; transparent PNG.
- `symbol-on-dark.png`: light C + orange dash for dark backgrounds; transparent PNG.
- `favicon-on-light.ico` and `favicon-on-dark.ico`: contain 16, 32 and 48 px frames.
- `icon-on-{light,dark}-{16,32,48,180,192,512}.png`: PNG icons in separate sizes.

`on-light` marks the dark artwork meant for light backgrounds; `on-dark` marks the light artwork
meant for dark backgrounds. The interface theme and the browser tab theme are not always the
same, so choose them separately when wiring assets into the app.

## Known limitation

ImageGen's transparent white wordmark outputs had edge artifacts, so they were left out of this
set. The dark-background version is therefore only a preview on a solid background; do not use
it as a transparent, production-ready dark wordmark. The next step is to export both wordmarks
from a clean vector master with the same geometry.

The icon PNG sizes and the three resolutions inside the ICO files were verified at the file
level. No SVG master is included in this set. The navbar uses the version that matches the
app's current light theme; the favicon is chosen by the browser's color-scheme preference. The
dark wordmark preview is not wired into the app.

Production method: the built-in ImageGen tool. The final generation prompts are in `PROMPTS.md`.
Pillow was used only for resizing and PNG/ICO export; the artwork was not redrawn or recolored.
