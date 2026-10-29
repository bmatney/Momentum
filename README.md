# Momentum

A two-player life tracker for UniVersus, built with React and Capacitor.

## Development

- `npm ci` installs the locked dependencies.
- `npm run dev` starts the web preview.
- `npm run lint` checks source code, excluding generated native web assets.
- `npm test` checks game state, Undo, reset, and saved-game recovery.
- `npm run build` produces the production web app in `dist/`.

## Native builds

After web changes, run `npm run build`, then `npx cap copy ios` and/or
`npx cap copy android` before building in Xcode or Android Studio.
Use `npx cap sync` when native plugin dependencies change.

The iOS app uses a scene manifest and `SceneDelegate`, with `Main.storyboard`
creating the Capacitor bridge. Scene URL events are forwarded to Capacitor.

## Saved games

The current match is saved locally after state changes under `momentum.game.v1`.
Starting life, current life, first player, pending dice results, and Undo history
are restored on launch. Temporary attack-panel edits are not saved.
Invalid or unsupported saved data falls back to a fresh match. Failed writes
show an in-app warning. Clearing app data removes the saved match.

## Companion features

- Roll winners choose first or second; the highlighted player is the first player.
- Attack buttons preview damage. Throw applies half damage, rounded up, on a full block.
- History shows health changes in reverse order and supports Undo.
- Optional player names and vibration/screen-awake settings are saved locally.
- Help includes rules, privacy, support contact, and the unofficial-app notice.
- Barlow Condensed is bundled for offline use under the license in `public/fonts/OFL.txt`.

Settings use `momentum.preferences.v1`; existing `momentum.game.v1` saves remain compatible.
Public privacy/support URLs and confirmed store versions are still required by `npm run release:check`.

## Publishing and contact accounts

See [release account references](docs/release-accounts.md) before publishing.
Public support and other Momentum communications use momentumuvs@gmail.com.

## Release 1.1.0 preparation

The next candidate is version 1.1.0 / build 2 on both platforms. Store availability
of these numbers must still be checked before setting `storeVersionConfirmed`.
Android uses Gradle 9.6.0 and AGP 9.4.1; targets remain Android API 36 and iOS 15+.
Vite 8 explicitly targets Safari 15 and Chrome 107 rather than raising the web
syntax target implicitly. This does not replace testing on the oldest devices.

The unused `@capacitor/assets` generator was removed to eliminate its vulnerable
transitive dependencies. Existing native icons and splash assets remain in the
repository. The `xcode` parser's `uuid` dependency is overridden to 11.1.1 or newer
within major 11; parser, UUID generation and project serialization were checked.
Review this override when Capacitor updates its parser dependency.

Public support and privacy pages are maintained in `docs/site/` and published
from the `gh-pages` branch at https://bmatney.github.io/Momentum/ and
https://bmatney.github.io/Momentum/privacy.html. Both live pages were verified,
and their URLs are configured in `release.config.json`.
Do not mark the release check complete until the store version numbers are verified.

## Web app

The installable web app is hosted at https://bmatney.github.io/Momentum/play/.
Use `npm run build:web` to build into `work/web-dist`; the normal `npm run build`
continues to produce the native app assets in `dist` without a service worker.
Run `python3 scripts/publish-web.py` to publish the web output to the `play/`
subtree of `gh-pages`. This preserves the support and privacy pages, replaces
old web assets, and refuses a non-fast-forward update.

The generated service worker precaches the complete build, including lazy plugin
chunks, fonts, and icons. It only handles requests inside `/Momentum/play/`.
Updates wait until existing clients close; there is no forced reload or
skip-waiting action during a match. Reopen online between matches for updates.
Saved games stay in local browser storage and do not sync with native installs.
Browser storage eviction or clearing site data can remove offline files and saves.

On iPhone, open in Safari and choose Share → Add to Home Screen. On Android,
choose Install app / Add to Home screen from the browser menu. Allow the initial
online load to complete before going offline. Browser support determines wake
lock and orientation locking; vibration is unavailable in iPhone web apps.

Validation: lint and 24 game tests passed; both native and web builds passed.
Chrome loaded the web build at its deployment path; after stopping the local
server, reload restored the match and elapsed timer, and health/undo still worked.
Physical iPhone Home Screen installation still requires a device check.
