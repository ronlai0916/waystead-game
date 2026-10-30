# Spellbright looks (S-W2, 30 Oct 2026)

Spellbright now uses the same three styles as Wordbright, so the games look like one set:

| Style | When | Buttons | Keys | Flower | Celebration |
|---|---|---|---|---|---|
| Sunny garden | Day (default) | Leaf green pills | Honey | Pink petals, sunny middle | Petals and leaves |
| Paint box | Day (chosen) | Cobalt, Ink outline | Cream, Ink outline | Tomato, sunshine, cobalt and grass petals, Ink outline | Paint splats |
| Night sky | Night (always) | Gold | Moon glow | Glowing pink and lilac petals | Stars |

Spellbright keeps its own identity: the flower that loses petals, and Plum (`--sb`) on the spelling-part rails, the product label and the progress bars. Teal stays on the Waystead Learning panel only (now the darker `#0C7167`, white text 5.9:1).

`screenshots/`: every style at Mac width (1440 px) and phone width (390 px): home, study, quick game mid-game, test, progress; plus `<style>-picker.png`.

Checks: `node --test tests/*.test.js` (contrast in all three styles; theme model for every mode × day style × device).
