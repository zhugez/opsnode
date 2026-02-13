# External Assets & License Notes

All non-code visual assets used for character portraits and office props are from **Kenney CC0** packs (public domain).

## 1) Character Assets (Roster + In-Scene Sprites)

### Source pack
- Pack: **Kenney — Mini Characters 1**
- Source page: https://kenney.nl/assets/mini-characters-1
- Download URL listed on source page: https://kenney.nl/media/pages/assets/mini-characters-1/a745467fe1-1721210573/kenney_mini-characters.zip
- Preview image URL used for repo extraction: https://kenney.nl/media/pages/assets/mini-characters-1/7d4c88415c-1721210569/preview.png
- License: **CC0 1.0 (Public Domain)**
- License link: https://creativecommons.org/publicdomain/zero/1.0/
- Attribution: not required

### Files used in this repo
- `public/assets/characters/kenney-mini-characters-preview.png` (source preview from Kenney)
- Derived portrait crops (from the preview image):
  - `public/assets/characters/sentinel-card.png`
  - `public/assets/characters/sniper-card.png`
  - `public/assets/characters/analyst-card.png`
  - `public/assets/characters/medic-card.png`

### Stable archetype mapping (single source of truth in app code)
- Sentinel → `/assets/characters/sentinel-card.png`
- Sniper → `/assets/characters/sniper-card.png`
- Analyst → `/assets/characters/analyst-card.png`
- Medic → `/assets/characters/medic-card.png`

These same files are used both in roster/menu portraits and in-world 3D sprite rendering.

---

## 2) Office Environment 3D Models

### Source pack
- Pack: **Kenney — Furniture Kit**
- Primary source page: https://kenney.nl/assets/furniture-kit
- Mirror used to fetch individual `.glb` files: https://poly.pizza/bundle/Furniture-Kit-NoG1sEUD1z
- License: **CC0 1.0 (Public Domain)**
- License link: https://creativecommons.org/publicdomain/zero/1.0/
- Attribution: not required

### Files used in this repo
- `public/assets/office/desk.glb` (model page: https://poly.pizza/m/6PbVkqPzEU)
- `public/assets/office/desk_corner.glb` (model page: https://poly.pizza/m/LCfBX1FVJr)
- `public/assets/office/desk_chair.glb` (model page: https://poly.pizza/m/CKSz6PB1vO)
- `public/assets/office/computer_screen.glb` (model page: https://poly.pizza/m/V5Qo141OcB)
- `public/assets/office/paneling.glb` (model page: https://poly.pizza/m/PcMUlGoC2C)
- `public/assets/office/wall_window.glb` (model page: https://poly.pizza/m/qivZBDjfUM)
- `public/assets/office/lamp_ceiling.glb` (model page: https://poly.pizza/m/AAJ1hFnGaH)

---

## Summary
- Character and office assets above are CC0/public-domain source assets (or direct derivative crops from CC0 source imagery).
- No additional third-party license obligations are required for redistribution or commercial use.
