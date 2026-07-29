# The Vessyl — The Dome

An immersive editorial landing page for The Vessyl in Arenal, Costa Rica.
The centerpiece is a procedural WebGL geodesic dome that changes composition,
light, and intensity as the visitor moves through the story.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verify

```bash
npm run build
npm test
npm run lint
```

## Structure

- `app/components/DomeScene.tsx` — procedural Three.js dome and scroll choreography
- `app/components/VessylExperience.tsx` — editorial chapters and interactions
- `app/globals.css` — responsive art direction, motion, and accessibility states
- `public/media/` — optimized resort photography

All public-facing naming follows the current The Vessyl brand. Historical
SIGNA/SYGNA naming from source materials is intentionally not used.
