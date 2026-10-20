# Art Direction Brief

> For the artist(s) and UI designer. Theme and cultural rules come from [architecture.md](architecture.md) §9. Art work starts in M0 and is integrated in M6; developers use placeholders until then.

## 0. Status (v1)

No artist was available for v1, so the art below exists as **original in-house vector art** (inline SVG/CSS in `apps/web/src/components/art/`): six symbols (colour + brass-inlay variants), wooden dice, Dhaka khal board with brass corners, six venue skylines, marigold garland, kites. It follows the palette and cultural rules here and can be replaced piece by piece by commissioned art without touching game code. Sound effects are synthesised in the browser (no files); the Malshree dhun needs a licensed recording.

## 1. The feeling

Playing Jhandi Burja on a _khal_ spread on the brick floor of a Newari courtyard during Dashain: warm evening light, temples behind, kites in the sky, family laughing around the board.

Keywords: **warm, festive, handcrafted, heritage, clear to read on a small phone.**

## 2. Palette (starting point)

| Role                         | Colour      | Hex       |
| ---------------------------- | ----------- | --------- |
| Brick / terracotta (main)    | Patan brick | `#A63D2A` |
| Tika red (accent, wins)      | Abir red    | `#D7262E` |
| Brass / gold (coins, frames) | Brass       | `#C9A23A` |
| Deep wood (dark surfaces)    | Sal wood    | `#3B2418` |
| Jamara green (positive)      | Jamara      | `#7BAA3B` |
| Cream (text on dark, cards)  | Dhaka cream | `#F3E6C8` |
| Marigold (highlights)        | Sayapatri   | `#F2A51A` |

Text must meet WCAG AA contrast on its background.

## 3. Typography

- Headings: a Devanagari display face with Ranjana-inspired feel (licensed for web).
- Body / numbers: a clean Devanagari + Latin UI font (e.g. Mukta or Noto Sans Devanagari).
- Coin amounts always use tabular numerals.

## 4. Asset list (v1)

| Asset                                                            | Count                                                                               | Format                            | Notes                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| Symbol icons (Crown/Shirpech, Flag, Heart, Spade, Diamond, Club) | 6                                                                                   | SVG + PNG @1x/2x/3x (256 px base) | Must be instantly recognisable at 32 px; same silhouette as the traditional suit |
| Die faces (wooden block with brass inlay)                        | 6                                                                                   | PNG atlas                         | Used in roll animation                                                           |
| Khal board (Dhaka pattern, 6 tiles)                              | 1                                                                                   | Layered PSD → PNG atlas           | Portrait (phone) and landscape (desktop) layouts                                 |
| Bowl / dhakani lid                                               | 1                                                                                   | PNG / Spine                       | Shake + lift animation                                                           |
| Coin chips                                                       | 5 values (10, 50, 100, 500, 1,000)                                                  | PNG                               | Brass coins with values in Devanagari                                            |
| Venue backgrounds                                                | 6 (Nyatapola, Krishna Mandir, Basantapur, Changu Narayan, Swayambhu, Gorkha Durbar) | WebP/AVIF, 1920×1080 + 1080×1920  | Soft focus so the board stays readable                                           |
| Dashain decor                                                    | jamara, tika plate, kites, ping, marigold garland                                   | PNG                               | Small animated loops welcome (Lottie)                                            |
| Avatars (default set)                                            | 12                                                                                  | PNG 256 px                        | Diverse Nepali characters in Dashain clothing                                    |
| UI kit                                                           | buttons, cards, modals, toasts, timer ring                                          | Figma                             | Built on the palette above                                                       |
| Sound                                                            | dice shake, roll, coin place, win, lose, Malshree dhun loop                         | OGG + MP3                         | Music loop ≤ 1 MB, mute toggle                                                   |

## 5. Cultural rules (must follow)

- **No deity images** on dice, bet tiles, coins, or anywhere coins are placed or players "lose". Temples appear only as background scenery.
- No real photographs of temples; all illustrations original (commissioned or in-house).
- Flag must use the correct Nepal flag geometry and colours.
- Avoid anything that mocks religious or ethnic groups; Dashain is celebrated differently across communities.

## 6. Performance budget

- Initial download (code + first-screen art) **≤ 3 MB**; other venues load lazily.
- All sprites in atlases; backgrounds WebP/AVIF.
- Animations must hold ~60 fps on a mid-range Android phone in Chrome.

## 7. Delivery

- Source files in Figma / PSD, exports in `apps/web/public/assets/` following `snake_case` names, e.g. `symbol_crown@2x.png`, `venue_nyatapola_portrait.webp`.
- Asset manifest maintained in `packages/ui-theme`.
