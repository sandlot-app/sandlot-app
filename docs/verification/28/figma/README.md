# Figma comparisons are blocked

Needs Christian: Hit by pitch has no Figma design

These are diagnostic comparisons of the preserved candidate, not a Figma pass. The Field screen retains the existing Hit by pitch control. The new contract forbids inventing its design. Further app/UI corrections stopped at that point. The original native acceptance flow also failed drag reordering, and full local verify has an open browser storage failure.

The Figma connection opened all three ticket frames and the additional touched-screen references in file `J8F4zRkkV63ji3AYhcHHwA`, session `6d3bde37-e814-4f4f-94ab-0fb715fb54f4`. The full reference PNGs are direct live exports. Their temporary download URLs are not runtime sources or committed references.

Each `*-pair.png` places Figma on the left and the actual Mac app on the right. Each panel is 393 × 852. Maestro's captured images are 1178 × 2556; the simulator's full screenshot is 1179 × 2556. Normalization divides the height by three and rounds the width to 393 with Lanczos resampling. The one-pixel capture-width difference is retained in the metadata. No app element was moved, redrawn or replaced. Raw captures remain in `../diagnostic-capture/screenshots/`.

The Lineup and Plays reference frames are longer than the phone viewport. Their full 393 × 1027 and 393 × 1098 exports remain in `*-figma-full.png`; the paired reference uses the first 852 pixels without changing scale. Those pairs cover only the first viewport and do not prove full-height parity. The native Lineup continuation is `lineup-reference-bottom.png`. The actual game data comes from the diagnostic user path and does not reproduce the reference's Bottom 5 sample game. No exception to the new match gate is claimed for these differences or coverage gaps.

The known preliminary differences include artwork, navigation/card/row geometry, count marks and wording. The Bench Player Row specifies 16 px corners while the current token export offers 6/12/20/28/full. The preserved candidate uses 20. The independent review must list and rate the differences; none is waived here.

| Screen | Live frame | Pair |
| --- | --- | --- |
| Setup | [167:11241](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=167-11241) | [Comparison](setup-pair.png) |
| Lineup | [168:11244](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=168-11244) | [First viewport](lineup-pair.png) |
| Plays | [69:1895](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=69-1895) | [First viewport](plays-pair.png) |
| Games | [107:5105](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=107-5105) | [Comparison](games-pair.png) |
| Field | [165:11107](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=165-11107) | [Comparison](field-pair.png) |
| In play1 | [75:2900](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=75-2900) | [Comparison](in-play-1-outcome-pair.png) |
| In play2 | [75:3162](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=75-3162) | [Comparison](in-play-2-fielder-pair.png) |
| In play3 | [75:3487](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=75-3487) | [Comparison](in-play-3-runners-pair.png) |
| Runner sheet | [87:2869](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=87-2869) | [Comparison](steal-attempt-pair.png) |
| More | [165:11367](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=165-11367) | [Comparison](more-pair.png) |

`pairs.json` records each source capture, hash, dimensions and crop. Run `python3 docs/verification/28/figma/make-pairs.py` from the repository root to reproduce the normalized pairs from the committed inputs. Application source is `b0e74e12942efb66d4332186742cd67e237a45a8` and remains unchanged in the evidence commits.
