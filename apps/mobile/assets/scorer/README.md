# Scorer artwork

`undo.svg` is the original Undo pill icon from Sandlot's [Figma Scorer Bar](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=72-3104), in its 20 × 20 frame.

`undo.png`, `undo@2x.png`, and `undo@3x.png` rasterize that SVG at 20, 40, and 60 pixels with transparent backgrounds. React Native selects the density and tints the icon with the text color token. The separate image keeps the arrow independent of the platform font's glyph metrics.
