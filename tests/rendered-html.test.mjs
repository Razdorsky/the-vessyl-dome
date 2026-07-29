import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders The Vessyl experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*The Vessyl[^<]*<\/title>/i);
  assert.match(html, /Not a Vacation\./);
  assert.match(html, /A Recalibration\./);
  assert.match(html, /Feel sound/);
  assert.match(html, /The Dome/);
  assert.match(html, /Arenal/);
  assert.match(
    html,
    /<nav class="desktop-nav"[^>]*>[\s\S]*href="#arenal"[\s\S]*<\/nav>/,
  );
  assert.match(html, /Book The Vessyl/);
  assert.match(html, /scene-fallback/);
  assert.doesNotMatch(html, /\b(?:SIGNA|SYGNA)\b/i);
  assert.doesNotMatch(html, /codex-preview|Building your site/i);
});

test("starter preview is fully removed", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /VessylExperience/);
  assert.match(layout, /The Vessyl/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("updated typography keeps a one-switch legacy rollback", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    layout,
    /const TYPOGRAPHY_PROFILE: "legacy" \| "updated" = "updated"/,
  );
  assert.match(layout, /data-typography=\{TYPOGRAPHY_PROFILE\}/);
  assert.match(styles, /font-size: 0\.68rem/);
  assert.match(styles, /:root\[data-typography="updated"\]/);
  assert.match(styles, /--type-brand-width: clamp\(209px, 18\.15vw, 277px\)/);
  assert.match(styles, /--type-brand-width: 213px/);
  assert.match(styles, /--type-mobile-nav: clamp\(33px, 10\.8vw, 60px\)/);
  assert.match(styles, /--type-h1: clamp\(55px, 7\.14vw, 128px\)/);
  assert.match(styles, /--type-h2: clamp\(48px, 5\.47vw, 103px\)/);
  assert.match(styles, /--type-h2-experience: clamp\(47px, 4\.96vw, 91px\)/);
  assert.match(styles, /--type-h2-book: clamp\(55px, 6\.16vw, 116px\)/);
  assert.match(styles, /--type-h2: clamp\(46px, 5\.73vw, 87px\)/);
  assert.match(styles, /--type-h1: clamp\(52px, 13\.68vw, 85px\)/);
  assert.match(styles, /--type-h2: clamp\(44px, 11\.12vw, 75px\)/);
  assert.match(styles, /--type-h2-book: clamp\(48px, 12\.4vw, 82px\)/);
  assert.match(styles, /--type-h1: clamp\(46px, 13vw, 65px\)/);
  assert.match(styles, /--type-h2: clamp\(40px, 10\.94vw, 57px\)/);
  assert.match(styles, /--type-h2-book: clamp\(44px, 11\.54vw, 62px\)/);
  assert.match(styles, /--type-nav: 12px/);
  assert.match(styles, /--type-mobile-cta: 14px/);
  assert.match(styles, /--type-lead: 18px/);
  assert.match(styles, /text-shadow: 0 3px 18px rgba\(0, 0, 0, 0\.33\)/);
  assert.match(styles, /0 1px 4px rgba\(0, 0, 0, 0\.55\)/);
  assert.match(styles, /0 3px 16px rgba\(0, 0, 0, 0\.45\)/);
  assert.ok(
    styles.indexOf(':root[data-typography="updated"]') >
      styles.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
});

test("volcano environment is rendered by the Three.js world", async () => {
  const [scene, experience, styles] = await Promise.all([
    readFile(new URL("../app/components/DomeScene.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/VessylExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(scene, /new THREE\.CylinderGeometry\(/);
  assert.match(scene, /new THREE\.TextureLoader\(\)\.load\(/);
  assert.match(scene, /floorMarker\.position\.y = DOME_BASE_Y/);
  assert.match(scene, /webgl-cylindrical-skybox/);
  assert.match(scene, /const FRAME_INTERVAL_MS = 1000 \/ 60/);
  assert.doesNotMatch(scene, /1000 \/ (?:24|30)/);
  assert.match(scene, /fxaa: false,\s*msaa: true,\s*msaaSamples: 4/);
  assert.match(scene, /antialias: ANTIALIASING\.msaa/);
  assert.match(
    scene,
    /samples: ANTIALIASING\.msaa \? ANTIALIASING\.msaaSamples : 0/,
  );
  assert.doesNotMatch(scene, /alphaHash/);
  assert.match(
    scene,
    /opacity: 1,\s*transparent: true,\s*side: THREE\.FrontSide,\s*depthWrite: false/,
  );
  assert.match(
    scene,
    /new EffectComposer\(renderer, antialiasRenderTarget\)/,
  );
  assert.match(scene, /fxaaPass\.enabled = ANTIALIASING\.fxaa/);
  assert.match(
    scene,
    /composer\.addPass\(renderPass\);[\s\S]*composer\.addPass\(outputPass\);[\s\S]*composer\.addPass\(fxaaPass\);/,
  );
  assert.doesNotMatch(scene, /idleDelay|lastInteractionAt/);
  assert.match(scene, /const RESONANCE_RING_THICKNESS = 0\.18/);
  assert.match(scene, /const RESONANCE_RING_SPEED = 0\.18/);
  assert.match(scene, /elapsed \* RESONANCE_RING_SPEED/);
  assert.match(scene, /new THREE\.DataTexture\(/);
  assert.match(scene, /map: particleTexture/);
  assert.match(scene, /const PARTICLE_COUNT = 840/);
  assert.match(scene, /const LOW_POWER_PARTICLE_COUNT = 320/);
  assert.match(scene, /sceneRings = isVisible \? "animating" : "paused"/);
  assert.match(scene, /sceneState = "idle"/);
  assert.match(experience, /src="\/footer-mark\.svg"/);
  assert.match(
    styles,
    /\.site-footer > img \{[\s\S]*width: 74px;[\s\S]*height: 74px;/,
  );
  assert.doesNotMatch(experience, /scene-skybox/);
  assert.doesNotMatch(styles, /\.scene-skybox/);
  assert.doesNotMatch(styles, /backdrop-filter:\s*blur\(3px\)[^}]*mask-image/s);
});
