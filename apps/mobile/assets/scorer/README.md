# Scorer artwork

`undo.svg` is the original Undo pill icon from Sandlot's [Figma Scorer Bar](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=72-3104), in its 20 × 20 frame.

`undo.png`, `undo@2x.png`, and `undo@3x.png` rasterize that SVG at 20, 40, and 60 pixels with transparent backgrounds. React Native selects the density and tints the icon with the text color token. The separate image keeps the arrow independent of the platform font's glyph metrics.

The Field tab artwork comes from Sandlot's [Figma Field tab (milestone 4)](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=165-11107), exported as SVG and kept at the size of each SVG's own box, so the overflow Figma positions around a layer stays in place:

| SVG | Figma | 1× size |
| --- | --- | --- |
| `field-surface.svg` | Field surface (21:265): stripes, dirt, lines and bases over the field/grass color | 600 × 600 |
| `bat.svg` | Icon/Bat (16:47), with its shadow | 30.45 × 8.54 |
| `baseball.svg` | Icon/Baseball (29:288), with its shadow | 25.44 × 25.44 |
| `logo-emblem.svg` | Logo / Emblem (124:7447) | 64 × 64 |
| `glove.svg` | Icon/Glove (41:950), with its shadow, from the [Plays tab](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=69-1895) scoreboard | 16.07 × 17.21 |

Each PNG and its `@2x` and `@3x` copies rasterize that SVG with transparent backgrounds, rendered by headless Chrome. The artwork is fixed in Figma (its colors aren't tokens), so it ships as images rather than redrawn shapes.
