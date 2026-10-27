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
