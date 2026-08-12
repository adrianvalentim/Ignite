# Local fonts

These WOFF2 files replace the app's former runtime Google Fonts request. They
are kept beside their SIL Open Font License files.

Vite also copies the distributable license files from `public/licenses/` into
the production artifact so every packaged font ships with its license.

- `Fraunces[SOFT,WONK,opsz,wght].woff2`: official Fraunces variable webfont,
  pinned to upstream commit `7ccdec31c6028118dce3e47fe864e3744460371d`.
- `InterVariable.woff2`: official Inter 4.1 variable webfont.
- `JetBrainsMono[wght].woff2`: official JetBrains Mono variable webfont,
  pinned to upstream commit `19371302b95d218af43299bce79ddbddd0bc364d`.

The `@font-face` declarations in `fonts.css` expose only the ranges used by the
interface. Fraunces retains its `opsz`, `wght`, `SOFT`, and `WONK` axes.
