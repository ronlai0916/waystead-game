# Wordbright style options (W2a)

Three colourful directions for Wordbright, as static mock-ups. The live game (`wordbright/site`), Spellbright (`site/`) and the home page (`hub/`) are unchanged.

- Open `index.html`, or any `<option>/start.html`, `play.html` or `end.html`. The pages need no server; the character pictures come from `../../../wordbright/site/assets/characters/`.
- The sun/moon button switches light and dark (`?theme=light|dark`). Tap the +5, or the cheering player on the end screen, to replay the celebration.
- `screenshots/`: every screen at Mac width (1440 px) and phone width (390 px), plus the other theme. `compare.png`: the three start and play screens side by side.
- `shared/mock.js` draws the same fixed game for all three (Maya against Ottie on the Standard board; Maya has just played HEART, a Star word, making OR as well). `shared/base.css` is the shared layout. Each option's own CSS sets the colours, fonts and shapes.

All three keep: the Waystead wordmark (Sora, Ink; Paper-white on dark) and the Amber waypoint dot; Pip, Ottie, Bramble and Fizz; the square names and icons (Spark, Glow, Shine, Star), with letter squares in one colour family and word squares in another, pale for ×2 and strong for ×3. None uses a sky-blue top bar, a rainbow logo, an owl, or another site's layout or wording; the copy is Wordbright's own.

## A · Sunny garden

Warm and gentle: butter-cream page, a hedge of round leaves under the top bar, pill-shaped buttons, honey tiles. The players sit in flower frames (a white face and a petal-coloured ring) on a little hill under the sun. **Celebration:** petals and leaves float out of the +5.

| Role | Light | Dark ("dusk") |
|---|---|---|
| Page | `#FFF8E6` | `#14201A` |
| Card | `#FFFFFF` | `#1C2B22` |
| Text | Ink `#1B1A20` (16.3:1) | `#F6F1E3` (14.9:1) |
| Muted text | `#5C5444` (7.1:1) | `#BDC7B4` (9.6:1) |
| Button | Leaf `#2E7D32`, white text (5.1:1) | `#8FD175`, dark text (9.5:1) |
| Links, Wordbright label | `#256B29` (6.2:1) | `#A6DD8F` (10.7:1) |
| Headings label | Rose `#B02D63` (5.8:1) | `#F49CBF` (7.3:1) |
| Tiles | Honey `#FFD95E`, Ink (12.6:1) | same |
| Tiles placed this turn | Rose `#C2346E`, white (5.2:1) | Petal `#F48FB6`, Ink (7.8:1) |
| Spark / Glow | `#E2F2CB` (14.7:1) / `#93CF6E` (9.4:1) | same, Ink names |
| Shine / Star | `#FDD3E1` (12.8:1) / `#FBB437` (9.6:1) | same, Ink names |
| +5 badge | Sun `#FFC93C`, Ink (11.3:1) | same |

**Fonts:** Fredoka (headings, tiles, buttons; round and friendly) and Andika (body; made by SIL for children learning to read, with a single-storey a and g).

## B · Paint box

Bold and tidy: cream page, an Ink rule under the top bar with four paint dots, chunky outlined buttons and cards with a solid shadow. The board is a paint tray: Ink gaps between bright pans. Tiles are cream with an Ink outline. The players are stickers in coloured frames (yellow, cobalt, tomato, grass), tilted round a palette of tiles. **Celebration:** paint splats burst out of the +5.

| Role | Light | Dark |
|---|---|---|
| Page | `#FFFAF0` | `#191613` |
| Card | `#FFFFFF`, Ink outline | `#24201B` |
| Text | Ink `#1B1A20` (16.6:1) | `#F7F2E8` (16.2:1) |
| Muted text | `#5A5249` (7.4:1) | `#C2B8AA` (9.2:1) |
| Button | Cobalt `#2250D0`, white (6.7:1) | `#8DAAFF`, Ink (7.7:1) |
| Labels | Tomato `#C4321F` (5.3:1) | `#FF8E7A` (7.3:1) |
| Tiles | `#FFFDF6`, Ink (17.0:1), Ink outline | same |
| Tiles placed this turn | Cobalt `#2250D0`, white (6.7:1) | `#8DAAFF`, Ink (7.7:1) |
| Plain square | `#F3E8CF` | `#2E2923` |
| Spark / Glow | `#FFE9A3` (14.4:1) / Sunshine `#FFC21A` (10.7:1) | same, Ink names |
| Shine / Star | `#FFCABD` (11.9:1) / `#FF7A5E` (6.8:1) | same, Ink names |
| +5 badge | `#D63A24`, white (4.7:1) | `#FF8E7A`, Ink (7.7:1) |

Decoration only: tomato `#E5432D`, grass `#3DBA5C`.

**Fonts:** Baloo 2 (headings, tiles; chunky and round) and Nunito (body; rounded and clear).

## C · Night sky

Calm and magical: deep indigo sky with small stars and two soft glows; tiles glow like the moon; gold buttons. The Star square is literally a gold star. The players are in round moon frames with a soft halo, joined by dotted lines like a constellation round the tiles. Dark first, with a light "daytime" version (lavender page, indigo tiles). **Celebration:** a shower of gold, pink and white stars.

| Role | Night (main) | Daytime (light) |
|---|---|---|
| Page | `#11133A` | `#F4F2FF` |
| Card | `#1B1E52` | `#FFFFFF` |
| Text | `#F3F1FF` (16.0:1) | Ink (15.6:1) |
| Muted text | `#BAB9E2` (9.4:1; 8.2:1 on a card) | `#55537A` (6.5:1) |
| Button | Gold `#FFD45C`, Ink (12.2:1) | Indigo `#3A3FB0`, white (8.3:1) |
| Links, Wordbright label | Gold (12.6:1) | `#3A3FB0` (7.5:1) |
| Headings label | Nebula `#FF9ACB` (7.9:1 on a card) | `#A83273` (5.6:1) |
| Tiles | Moon `#FFF4D2`, Ink (15.7:1), soft glow | Indigo `#2B2F86`, white (11.3:1) |
| Tiles placed this turn | Gold `#FFD45C`, Ink (12.2:1) | same |
| Spark / Glow | `#2D3A8E`, light names (8.9:1) / `#4A55C8`, white (6.1:1) | `#D9DEFF` / `#9DA8F5`, Ink (13.0, 7.7:1) |
| Shine / Star | `#8A3E78`, white (6.9:1) / `#FFC94A`, Ink (11.3:1) | `#F2C9E6` / `#FFC94A`, Ink (11.8, 11.3:1) |
| +5 badge | Gold, Ink (12.2:1) | same |

**Fonts:** Lexend (headings, tiles; designed for reading ease) and Atkinson Hyperlegible (body; designed by the Braille Institute so similar letters are easy to tell apart).

## Checks

- Contrast: every text pair above is WCAG AA (4.5:1 or more) in both themes. Square names and icons are 6.1:1 or more on every square. `tools/contrast.py` has the pairs.
- Phone (390 px): one column; legend last; rack, buttons and words panel fit with no sideways scroll.
- Motion: with reduced motion turned on, there is no burst and no twinkling; the +5 gets a still coloured ring instead (checked by emulating `prefers-reduced-motion: reduce`).
- The pages keep the game's rules: no inline scripts or `style=""`, no third-party requests. Sizes for the burst pieces are set from JS with `el.style.setProperty`.
- Pronunciations use Andika in all three, because it is the only one of the six fonts with every IPA symbol (ɪ ʊ ː θ ʃ ɒ ɔ ʌ ɜ and so on).

## Fonts and licences

All six are under the SIL Open Font License 1.1 (copies in `fonts/licences/`), self-hosted as woff2. Nothing is loaded from Google at run time; the files were fetched once from the google/fonts repository on GitHub. Sora (wordmark) is the same file as the live site.

| Font | Used in | Copyright | File |
|---|---|---|---|
| Fredoka | A headings | The Fredoka Project Authors, 2016 | Latin subset, 67 KB |
| Andika | A body; IPA in all | SIL International, 2004–2022 (Reserved Font Name "Andika") | whole font, 247 KB each |
| Baloo 2 | B headings | The Baloo 2 Project Authors, 2019 | Latin subset, 33 KB |
| Nunito | B body | The Nunito Project Authors, 2014 | Latin subset, 39 KB |
| Lexend | C headings | The Lexend Project Authors, 2018 (Reserved Font Name "RevReading Lexend") | Latin subset, 38 KB |
| Atkinson Hyperlegible | C body | Braille Institute of America, 2020 | Latin subset, 16 + 17 KB |

Andika is converted to woff2 but not subset, because its licence reserves the name "Andika" for unmodified versions; that is why it is large. If it is used in the game, either keep the whole file (cached by the service worker after the first visit) or subset it under a new name.

## Recommendation

**C, Night sky,** for Wordbright.

- It fits the name and the line "Light up the board": glowing tiles on a night sky.
- It is the calmest of the three. The busy part (the board) has the most contrast against the page, so it stays simple, as now.
- It has the best dark mode, because dark is its home, and its daytime version is a clean, bright light mode.
- It keeps the Wordbright colour (indigo) from the brand, so it needs no new brand colour, and it stays clearly apart from Spellbright's plum and flower.
- Lexend and Atkinson Hyperlegible are both made for easy reading.

**Runner-up: B, Paint box.** It is the boldest and most "game-like", and it is the best in light mode. If the night sky feels too dark for Year 1 children by day, B is the safer choice.

**A, Sunny garden** is the warmest, but its flowers and petals overlap with Spellbright (where a flower loses its petals). It would suit Spellbright better than Wordbright. A small point: Fredoka's open "4" looks a little like a "Ч" at small sizes (see the score chips).

Before choosing, it is worth looking at the play screens on a real phone and tablet, and asking a child which board they would rather play on.
