# StoryPath - Theme System Plan

## Overview
StoryPath is an AI-powered interactive fiction game that generates personalized stories with illustrations. The theme system creates unique visual experiences based on **genre** and **maturity level** (kids vs adult).

## Preview Themes (Kids vs Adult)

### Kids Versions - Saturday Morning Cartoons
**Design Philosophy**: Bright, bouncy, playful, safe, fun - think Cartoon Network/Disney Jr.

- **Horror**: Peppa Pig spooky style
  - Friendly ghosts, purple/orange palette, silly sounds
  - Bouncing animations, rounded fonts (Chewy)
  - Floating particle effects (stars, ghosts)
  - Status: ✅ COMPLETE

- **Sci-Fi**: Cartoon aliens
  - Bright neon, bouncy UFOs
  - Retro-futuristic "Jetsons" vibe
  - Bleeps and bloops
  - Status: ⏳ PENDING

- **Mystery**: Scooby-Doo notebook
  - Magnifying glass animations
  - Comic book style
  - "Zoinks!" energy
  - Status: ⏳ PENDING

- **Fantasy**: Disney-style sparkles
  - Rainbow scrolls, friendly dragons
  - Magical twinkling
  - Storybook aesthetic
  - Status: ⏳ PENDING

- **Adventure**: Treasure maps
  - "X marks the spot" animations
  - Playful compass spinning
  - Pirate/explorer vibes
  - Status: ⏳ PENDING

### Adult Versions - Gritty and Cinematic
**Design Philosophy**: Sophisticated, atmospheric, immersive - think prestige TV/cinema

- **Horror**: Silent Hill fog
  - Blood drips, glitch effects
  - VHS grain, CRT scanlines
  - Desaturated with red accents
  - Status: ✅ COMPLETE

- **Sci-Fi**: Blade Runner terminals
  - Matrix code rain
  - Cyberpunk neon
  - Terminal/hacker aesthetic
  - Status: ⏳ PENDING

- **Mystery**: True Detective noir
  - Coffee stains, cigarette burns
  - Film grain, vintage photos
  - Dark amber lighting
  - Status: ⏳ PENDING

- **Fantasy**: Game of Thrones parchment
  - Fire effects, medieval aesthetics
  - Wax seals, worn leather
  - Epic orchestral feel
  - Status: ⏳ PENDING

- **Adventure**: Indiana Jones
  - Worn leather, dust particles
  - Sepia tones, treasure maps
  - Cinematic adventure
  - Status: ⏳ PENDING

## Game Themes (Persistent from Preview)

Each genre+maturity combo gets:
- **Custom color schemes** - Match preview aesthetic
- **Unique animations** - Using anime.js for transitions
- **Different UI elements** - Themed buttons, borders, panels
- **Genre-specific sound effects** - Optional ambient audio (Howler.js)
- **Maturity-appropriate narrative panels** - Different fonts, decorations

Status: ⏳ PENDING (all 10 combinations)

## Animation Libraries

### Imported Libraries (~66KB total)

1. **tsParticles** (~35KB) - Particle effects
   - Fog, sparkles, Matrix rain, fireflies, dust
   - Kids: Bouncy stars, friendly ghosts
   - Adult: Static, blood drips, smoke

2. **TypeIt** (~5KB) - Typewriter effects
   - Narrative text typing
   - Terminal-style reveals

3. **Splitting.js** (~1.5KB) - Character-by-character animations
   - Works with anime.js
   - Text reveals, glitch effects

4. **Howler.js** (~7KB) - Audio playback
   - Ambient sounds
   - UI feedback sounds
   - Genre-specific music

5. **Granim.js** (<17KB) - Animated gradients
   - Background transitions
   - Color morphing effects

6. **anime.js** (already imported) - Core animations
   - UI transitions
   - Button effects
   - Scene transitions

## Custom Story Seed Detection

For custom prompts that don't fit standard genres:

### Detection Strategy
1. **Analyze user's custom text** with Claude AI
2. **Detect keywords/themes**:
   - "space pirates" → sci-fi
   - "haunted mansion" → horror
   - "medieval knight" → fantasy
   - "treasure hunt" → adventure
   - "detective case" → mystery
3. **Fall back to user selection** if unclear
4. **Infer maturity** from language/themes or default to kids

Status: ⏳ PENDING

## Technical Implementation

### File Structure
```
/var/www/html/storypath/
├── css/
│   ├── main.css (global variables, base styles)
│   ├── preview.css (all 10 preview themes)
│   └── game.css (all 10 game themes)
├── preview.html (preview page with theme detection)
├── game.html (game page with theme persistence)
└── wizard.html (story creation with seed detection)

/opt/vodbase/storypath/
├── ai/
│   ├── StoryEngine.js (narrative generation)
│   └── ImageGenerator.js (FLUX 1.1 Pro via Replicate)
└── server.js (API endpoints)
```

### CSS Architecture
- **Option 2 Chosen**: Theme classes in existing CSS files
- Genre + maturity classes: `.preview-horror.kids`, `.preview-horror.adult`
- JavaScript applies classes based on `storyData.genre` and `storyData.maturity_level`
- Keeps everything centralized but CSS files are large

### Theme Application Flow
1. **Story Creation** (wizard.html):
   - User selects genre + maturity OR provides custom seed
   - Custom seeds analyzed by Claude for genre/maturity detection
   - Story created with metadata

2. **Preview Page** (preview.html):
   - Loads story data from API
   - Applies genre+maturity CSS classes
   - Initializes theme-specific animations (particles, typewriter)
   - Shows themed "Start Story" button

3. **Title Reveal**:
   - Animated transition between preview and game
   - Genre+maturity specific animation (e.g., bouncing ghost vs blood drip)

4. **Game Page** (game.html):
   - Persists theme from preview
   - Applies game-specific theme styles
   - Maintains visual consistency

## Progress Tracker

### Completed ✅
- [x] Import all animation libraries
- [x] Kids Horror preview theme (Peppa Pig Halloween)
- [x] Adult Horror preview theme (Silent Hill glitch)
- [x] Kids Horror title reveal (bouncing ghost)
- [x] Adult Horror title reveal (blood drip)
- [x] Custom scrollbar styling (purple for kids, red for adult)
- [x] Typewriter effects with auto-scroll
- [x] Particle systems (friendly ghosts for kids, fog for adult)

### In Progress 🔄
- [ ] Testing horror preview themes (scrollbar, animations)

### Pending ⏳
- [ ] Build 8 remaining preview themes (Sci-Fi, Mystery, Fantasy, Adventure × kids/adult)
- [ ] Create 10 game page themes with animations
- [ ] Update game.html to apply genre+maturity theme styling
- [ ] Add custom story seed theme detection to wizard
- [ ] Optional: Add Howler.js sound effects per theme

## Design Principles

### Kids Themes
- **Colors**: Bright, saturated, rainbow palettes
- **Fonts**: Rounded, playful (Chewy, Comic Sans vibes)
- **Animations**: Bouncy, elastic, overshoots
- **Particles**: Stars, hearts, friendly creatures
- **Sounds**: Silly, upbeat, cartoonish
- **Tone**: Safe, fun, "wow cool!"

### Adult Themes
- **Colors**: Desaturated, atmospheric, accent pops
- **Fonts**: Cinematic, gritty (Special Elite, serif)
- **Animations**: Smooth, subtle, cinematic
- **Particles**: Fog, dust, atmospheric effects
- **Sounds**: Ambient, immersive, realistic
- **Tone**: Sophisticated, moody, immersive

## Known Issues & Fixes

### Fixed Issues
1. ✅ Image cropping - Changed `object-fit: cover` to `contain`
2. ✅ Preview button unclickable - Added `pointer-events: none` to overlays
3. ✅ Furigana on katakana - Strip markers from kana characters
4. ✅ Typewriter too slow - Reduced speed from 30ms to 10ms
5. ✅ Scrollbar bouncing - Scroll every 5 chars with `behavior: 'auto'`
6. ✅ Kids horror showing adult title reveal - Added maturity detection

### Active Considerations
- FLUX 1.1 Pro image generation confirmed active via Replicate
- Cache busting critical for CSS/JS updates (currently v=25)
- Furigana parsing happens server-side for Japanese stories
- Title generation async (polls every 1s for 30s)

## API Integration

### Image Generation
- **Service**: Replicate
- **Model**: FLUX 1.1 Pro (black-forest-labs/flux-1.1-pro)
- **Format**: 16:9 PNG
- **Speed**: 3-5 seconds
- **Fallback**: Placeholder until generated

### Story Generation
- **Service**: Anthropic Claude
- **Model**: Claude 3.5 Sonnet
- **Features**:
  - Story arc planning
  - Scene generation with choices
  - Furigana for Japanese (漢字《かんじ》 format)
  - State management (HP, inventory, relationships)

## Future Enhancements

### Potential Additions
- [ ] More genres (Romance, Historical, Superhero)
- [ ] Teenager maturity level (between kids and adult)
- [ ] User-uploaded background images
- [ ] Custom color scheme picker
- [ ] Achievement system with themed badges
- [ ] Story sharing with preserved themes
- [ ] Mobile-optimized themes
- [ ] Accessibility mode (reduced animations)

---

**Last Updated**: 2025-11-15
**Status**: Horror themes complete, 8 themes pending, game page theming pending
