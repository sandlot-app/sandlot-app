# Design tokens come from a committed Figma export

The colors, spacing and radii in both apps come from one package, `@sandlot/tokens`, generated from `packages/tokens/figma-variables.json`, an export of the Figma file's variables that is committed whenever they change. We export by hand because Figma's variables API needs an Enterprise plan, and the export is done from a session that has Figma access, which the coding agents don't. The alternative, hand-written tokens in each app, is how the web page and the designs drifted apart (the live page's red accent and green aren't in Figma).

## Consequences

- A script turns the JSON into CSS variables for `apps/web` and a TypeScript object for `apps/mobile`. CI fails if the generated files don't match the JSON, so nobody edits them by hand.
- The mobile app uses a typed style helper in place of `StyleSheet.create`. Its color, spacing and corner-radius properties accept the matching token types, with zero allowed for spacing and radii. A small lint keeps styles in the helper and blocks casts that would forge tokens. The web app consumes the generated CSS variables.
- Text uses each platform's own font (SF Pro, Roboto, `system-ui`) with Figma's sizes, weights and line heights. Inter in Figma is a stand-in.
- Light mode only for now. The export keeps Figma's modes, so Dark can be added without changing the package's shape.
