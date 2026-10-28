# F4 — Pictures, videos and Grok prompts (28 Oct 2026)

## What Grok makes, and what we draw in code instead
| Item | Made by | Why |
|---|---|---|
| 4 computer characters × 4 pictures | Grok | Characters are what Grok is good at |
| Wordbright welcome picture | Grok | |
| Waystead Game home-page picture (Plum) | Grok | |
| 2–3 short videos | Grok (picture → video) | |
| Board, tiles, bonus-square icons, board-picker pictures | CSS / SVG in code | Must be sharp at every size, no garbled letters |
| App icon, favicon | SVG in code | Grok is poor at tiny icons |
| Background texture | CSS | Lighter and works in dark mode |

## Colours (for prompts and the build)
| Use | Colour |
|---|---|
| Waystead Game home page accent | Plum #6B3FA0 |
| Wordbright accent (proposal) | Indigo #3B5BDB |
| Spellbright accent (existing) | Teal #0F8B7E |
| Board squares | Spark mint #D7EFEA, Glow teal #6FC2B4, Shine gold #F7DFB4, Star gold #E9A23B |

## The four computer players (original characters, British wildlife)
| Strength | Name | Animal | Look |
|---|---|---|---|
| Easy | Pip | Dormouse | Tiny, sleepy smile, small green backpack |
| Normal | Ottie | Otter | Swimming goggles pushed up on head, striped scarf |
| Hard | Bramble | Badger | Round glasses, knitted indigo jumper |
| Crazy | Fizz | Magpie | Very quick, cheeky, carries a shiny blank tile in its beak |

Avoid: anything like well-known story animals (no Edwardian clothes, no waistcoats, no pocket watches), no owls (an app mascot), no hedgehogs, no foxes.

## Style lock — paste at the start of EVERY prompt
```
Children's picture-book illustration, flat shapes with soft gentle grain, thick clean rounded outlines, warm friendly faces, simple plain warm-cream background (#FAF8F3), soft palette of indigo, teal, warm gold, plum and soft coral. No text, no letters, no numbers, no logos, no watermark.
```

## Pictures
| # | File name | Size | Used for | Prompt (after the style lock) |
|---|---|---|---|---|
| 1 | wb-pip-portrait.png | 1:1 | Easy player | A tiny dormouse called Pip, round and fluffy, big dark eyes, a sleepy happy smile, wearing a small green backpack, head and shoulders, centred, facing the viewer. |
| 2 | wb-pip-thinking.png | 1:1 | Its turn | Same dormouse, same backpack, one paw on chin, eyes looking up, thinking. |
| 3 | wb-pip-happy.png | 1:1 | Good move | Same dormouse, eyes closed, big smile, paws raised in joy. |
| 4 | wb-pip-surprised.png | 1:1 | You played well | Same dormouse, wide eyes, small round open mouth, ears up. |
| 5 | wb-ottie-portrait.png | 1:1 | Normal player | A friendly young otter called Ottie, sleek brown fur, swimming goggles pushed up on its head, a teal-and-cream striped scarf, head and shoulders, centred, facing the viewer. |
| 6–8 | wb-ottie-thinking / happy / surprised.png | 1:1 | | Same otter, same goggles and scarf; then the same three moods as Pip. |
| 9 | wb-bramble-portrait.png | 1:1 | Hard player | A wise, kind badger called Bramble, black-and-white striped face, small round glasses, a knitted indigo jumper, head and shoulders, centred, facing the viewer. |
| 10–12 | wb-bramble-thinking / happy / surprised.png | 1:1 | | Same badger, same glasses and jumper; same three moods. |
| 13 | wb-fizz-portrait.png | 1:1 | Crazy player | A cheeky, energetic magpie called Fizz, glossy black and white feathers with a blue-green shine, a mischievous grin, holding a shiny blank cream game tile in its beak, head and shoulders, centred. |
| 14–16 | wb-fizz-thinking / happy / surprised.png | 1:1 | | Same magpie, same tile; same three moods. |
| 17 | wb-hero.png | 16:9 | Wordbright welcome page | Pip, Ottie, Bramble and Fizz sitting around a low wooden table with a square game board of blank cream tiles, cosy reading-corner feel, books and a plant in the background, everyone smiling. Leave empty space on the left third for a heading. |
| 18 | wg-hero.png | 16:9 | Waystead Game home page | A cosy games corner in soft plum and cream: a small table with a flower in a pot on one side and a stack of blank cream letter tiles on the other, warm lamp light, a window with a gentle evening sky. Leave empty space on the left third for a heading. |

Tip: make the portrait first. For moods, use Grok's edit (picture-to-picture) on the chosen portrait, so the face stays the same.

## Videos (picture → video, 480p is enough)
| # | File name | Length | Start from | Prompt |
|---|---|---|---|---|
| V1 | wb-welcome.mp4 | 5 s, loop | wb-hero.png | The four animals gently nod and smile, Fizz hops once, soft lamp-light flicker, calm, slow, no camera move. |
| V2 | wb-win.mp4 | 3 s | wb-hero.png | All four animals cheer and throw soft gold and plum confetti, happy, short. |
| V3 | wg-welcome.mp4 | 5 s, loop (optional) | wg-hero.png | The flower sways slightly, lamp light glows, tiles gleam once. Calm, no camera move. |

## Rules for every file
- PNG for pictures, MP4 for videos; save in wordbright-design/assets-raw/ with the exact file name.
- Reject and remake any picture with letters, numbers, text, a logo or a known character look.
- Log every kept file in ASSETS.md (file, prompt, date, tool).
- Before launch: check xAI's current terms for commercial use of Grok Imagine output and write the date checked in ASSETS.md.
