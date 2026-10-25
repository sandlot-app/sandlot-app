## Sheet spacing (added 2026-10-25)

The scorer sheets felt cramped. Sentences, cards, lists and buttons were all 10–12px apart, so nothing was grouped and every sheet read as one block. Every scorer sheet now follows one spacing rule, and the Time limit reached result card was redesigned.

### The rule
Each step uses the Size tokens.
- **Between sections:** 16px (`space/4`).
- **Inside a section:** 8px (`space/2`).
  - A caps label and the content it names sit together as one section (Hit + its outcome grid, Bring in + the bench list, What changes + the changes).
  - Rows in a list stay together as one list: runner rows, bench players, delay reasons.
- **Actions:** the main button sits an extra 8px (`space/2`) away from the content, grouped with any link under it ("Not yet", "Skip") 12px apart (`space/3`).
- **Placement:** sheets sit on the bottom edge and grow upward. They're anchored to the bottom, so taller content never pushes the button off the screen.

Applied to all 16 scorer sheets:
- More, Steal attempt, Pitching change and Substitution
- In play steps 1–3
- Fix a play steps 1–5
- Delay reason and End for today
- Time limit reached
- Resume (Check who's here)

Prototype links on the moved buttons were kept.

### Time limit reached: result card
Chosen from four options on the Archive page ("Exploration — Time limit sheet"). The card is now a label and value list, the same pattern as the details card on the Suspended screen:

| | |
|---|---|
| Result | **Final: Hawks 2, Marlins 1** |
| Innings | 5 |
| Families see | "Final · time limit" |

- It's a white card with a 1px `border/subtle` outline and `radius/lg` corners, with hairlines between the rows and 12px row padding.
- It replaces the soft blue card, which had 12px padding, 2px between its lines and a 28px corner.

### Pitching change: Replacing row
"Replacing" now sits above the pitcher's line instead of beside it. Since the sample game moved to Mustang rules, "A. Kindle · 24 pitches · 1.1 IP · 5 outs left today" was too long for one row and was being cut off.
