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
  const fontPreloads = [
    ...html.matchAll(/<link[^>]+href="([^"]+)"[^>]+as="font"[^>]*>/gi),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(fontPreloads)].sort(),
    ["/fonts/manrope-latin.woff2", "/fonts/prata-latin.woff2"],
  );
  assert.match(html, /\/fonts\/manrope-latin\.woff2/);
  assert.match(html, /\/fonts\/prata-latin\.woff2/);
  assert.doesNotMatch(html, /_vinext_fonts\/(?:manrope|prata)/);
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
  assert.match(layout, /process\.env\.NEXT_PUBLIC_SITE_URL/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await Promise.all([
    access(new URL("../public/fonts/manrope-latin.woff2", import.meta.url)),
    access(new URL("../public/fonts/prata-latin.woff2", import.meta.url)),
  ]);
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
  assert.match(styles, /font-family: "Vessyl Sans"/);
  assert.match(styles, /font-family: "Vessyl Display"/);
  assert.match(styles, /:root\[data-typography="updated"\]/);
  assert.match(styles, /--type-brand-width: clamp\(209px, 18\.15vw, 277px\)/);
  assert.match(styles, /--type-brand-width: 213px/);
  assert.match(
    styles,
    /\.site-header::before \{[\s\S]*height: clamp\(9rem, 18vh, 13rem\)[\s\S]*rgba\(7, 9, 8, 0\.66\) 38%/,
  );
  assert.match(styles, /--type-mobile-nav: clamp\(33px, 10\.8vw, 60px\)/);
  assert.match(styles, /--type-h1: clamp\(55px, 7\.14vw, 128px\)/);
  assert.match(styles, /--type-h2: clamp\(48px, 5\.47vw, 103px\)/);
  assert.match(
    styles,
    /--type-h2-experience: clamp\(46px, calc\(4\.96vw - 1px\), 90px\)/,
  );
  assert.match(
    styles,
    /--type-h2-book: clamp\(54px, calc\(6\.16vw - 1px\), 115px\)/,
  );
  assert.match(styles, /--type-h2: clamp\(46px, 5\.73vw, 87px\)/);
  assert.match(styles, /--type-h1: clamp\(68px, calc\(43\.6054px \+ 4\.6823vw\), 82px\)/);
  assert.match(styles, /--type-h2: clamp\(58px, calc\(33\.6054px \+ 4\.6823vw\), 72px\)/);
  assert.match(styles, /--type-h1: clamp\(44px, calc\(18\.4px \+ 8vw\), 60px\)/);
  assert.match(styles, /--type-h2: clamp\(38px, calc\(12\.4px \+ 8vw\), 54px\)/);
  assert.match(styles, /--type-h2-book: calc\(var\(--type-h2\) - 1px\)/);
  assert.match(styles, /--type-nav: 12px/);
  assert.match(styles, /--type-mobile-cta: 14px/);
  assert.match(styles, /--type-lead: 20px/);
  assert.match(styles, /--type-lead: 18px/);
  assert.match(styles, /--type-body-small: 14px/);
  assert.match(styles, /--type-card-label: 12px/);
  assert.match(styles, /--type-card-title: 24px/);
  assert.match(styles, /--type-stage-number: 12px/);
  assert.match(styles, /--type-stage-title: 24px/);
  assert.match(styles, /--type-card-title: 22px/);
  assert.match(styles, /--type-stage-title: 22px/);
  assert.match(
    styles,
    /--copy-shadow:\s*0 2px 6px rgba\(0, 0, 0, 0\.48\),\s*0 4px 18px rgba\(0, 0, 0, 0\.48\)/,
  );
  assert.match(
    styles,
    /--card-copy-shadow:\s*0 1px 3px rgba\(0, 0, 0, 0\.24\),\s*0 2px 9px rgba\(0, 0, 0, 0\.24\)/,
  );
  assert.match(
    styles,
    /\.hero h1,\s*:root\[data-typography="updated"\] \.chapter h2 \{\s*text-shadow: var\(--copy-shadow\)/,
  );
  assert.match(styles, /text-shadow: var\(--copy-shadow\)/);
  assert.match(styles, /color: rgba\(245, 235, 231, 0\.88\)/);
  assert.match(styles, /0 2px 6px rgba\(0, 0, 0, 0\.48\)/);
  assert.match(styles, /0 4px 18px rgba\(0, 0, 0, 0\.48\)/);
  assert.match(
    styles,
    /\.signal-grid h3,[\s\S]*\.signal-grid p,[\s\S]*\.journey-path h3,[\s\S]*\.journey-path p \{\s*text-shadow: var\(--card-copy-shadow\)/,
  );
  assert.match(
    styles,
    /\.signal-grid article \{[\s\S]*?background: rgba\(7, 9, 8, 0\.36\);[\s\S]*?backdrop-filter: blur\(10px\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 820px\) \{[\s\S]*?\.signal-grid \{[\s\S]*?width: calc\(100% \+ 2\.5rem\);[\s\S]*?margin: 2rem -1\.25rem 0;[\s\S]*?\.signal-grid article \{[\s\S]*?backdrop-filter: blur\(10px\);/,
  );
  assert.match(
    styles,
    /\.header-book \{[\s\S]*?background: rgba\(213, 126, 61, 0\.08\);[\s\S]*?backdrop-filter: blur\(10px\);/,
  );
  assert.match(
    styles,
    /\.menu-toggle \{[\s\S]*?background: rgba\(7, 9, 8, 0\.38\);[\s\S]*?backdrop-filter: blur\(10px\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 820px\) \{[\s\S]*?\.journey-path \{[\s\S]*?width: calc\(100% \+ 2\.5rem\);[\s\S]*?margin: 2\.5rem -1\.25rem 0;[\s\S]*?\.journey-path article \{[\s\S]*?backdrop-filter: blur\(10px\);/,
  );
  assert.match(
    styles,
    /\.journey-path article \{[\s\S]*?z-index: 1;[\s\S]*?padding: 1\.2rem 1\.5rem;/,
  );
  assert.match(
    styles,
    /\.journey-path::before \{[\s\S]*?top: 3\.95rem;/,
  );
  assert.match(
    styles,
    /\.journey-path \{[\s\S]*?left: clamp\(1\.35rem, 7vw, 8rem\);[\s\S]*?right: clamp\(1\.35rem, 7vw, 8rem\);[\s\S]*?isolation: isolate;/,
  );
  assert.match(
    styles,
    /\.journey-path::after \{[\s\S]*?left: 50%;[\s\S]*?width: 100vw;[\s\S]*?transform: translateX\(-50%\);[\s\S]*?backdrop-filter: blur\(10px\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 820px\) \{[\s\S]*?\.hero h1 \{[\s\S]*?width: calc\(100vw - 1\.25rem\);[\s\S]*?max-width: none;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1101px\) \{[\s\S]*?\.chapter-stay \.media-layout-reverse \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) clamp\(28\.5rem, 42vw, 42rem\);/,
  );
  assert.match(
    styles,
    /@media \(min-width: 821px\) \{[\s\S]*?\.chapter-place \.media-layout \{[\s\S]*?grid-template-columns: clamp\(18rem, 35vw, 42rem\) minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /\.hero h1,\s*\.chapter h2 \{\s*white-space: nowrap;/,
  );
  assert.match(styles, /\.book-copy \{\s*width: min\(calc\(100vw - 1rem\), 75rem\);/);
  assert.match(
    styles,
    /--type-h2-book: min\(calc\(var\(--type-h2\) - 1px\), calc\(10vw - 3px\)\)/,
  );
  assert.match(
    styles,
    /--type-h2-experience: min\(calc\(var\(--type-h2\) - 1px\), calc\(11\.15vw - 3px\)\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 820px\) \{[\s\S]*?\.journey-heading h2 \{[\s\S]*?width: calc\(100vw - 1rem\);[\s\S]*?margin-left: calc\(50% - 50vw \+ 0\.5rem\);/,
  );
  assert.match(
    styles,
    /\.portal-stay figcaption \{\s*top: 1\.45rem;\s*bottom: auto;/,
  );
  assert.match(
    styles,
    /\.portal-stay::before \{[\s\S]*linear-gradient\(180deg, rgba\(7, 9, 8, 0\.74\), transparent 52%/,
  );
  assert.match(
    styles,
    /\.photo-portal img \{[\s\S]*transform: scale\(1\.3\);[\s\S]*transform 6s/,
  );
  assert.match(
    styles,
    /\.is-visible \.photo-portal img \{\s*transform: scale\(1\);/,
  );
  assert.ok(
    styles.indexOf(':root[data-typography="updated"]') >
      styles.indexOf("@media (prefers-reduced-motion: reduce)"),
  );
});

test("volcano environment is rendered by the Three.js world", async () => {
  const [scene, cladding, particles, experience, styles] = await Promise.all([
    readFile(new URL("../app/components/DomeScene.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/domeCladding.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/particleField.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/VessylExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(scene, /new THREE\.CylinderGeometry\(/);
  assert.match(scene, /new THREE\.TextureLoader\(\)\.load\(/);
  assert.match(scene, /createDomeCladdingGeometry\(/);
  assert.doesNotMatch(scene, /new THREE\.InstancedMesh\(/);
  assert.doesNotMatch(scene, /new THREE\.ExtrudeGeometry\(/);
  assert.doesNotMatch(scene, /lateralSeam|lipLift/);
  assert.match(cladding, /circumferentialPeriod = compact \? 32 : 44/);
  assert.match(cladding, /coursePeriod = compact \? 40 : 56/);
  assert.match(cladding, /const crownDepth = compact \? 0\.16 : 0\.115/);
  assert.match(cladding, /const edgeOwners = new Map/);
  assert.match(cladding, /maxEdgeOwners/);
  assert.match(cladding, /unexpectedBoundaryEdges/);
  assert.match(cladding, /zeroAreaTriangles/);
  assert.match(scene, /floorMarker\.position\.y = DOME_BASE_Y/);
  assert.match(scene, /webgl-cylindrical-skybox/);
  assert.match(scene, /const FRAME_INTERVAL_MS = 1000 \/ 60/);
  assert.doesNotMatch(scene, /1000 \/ (?:24|30)/);
  assert.match(
    scene,
    /desktop: 1\.4,\s*tablet: 1\.4,\s*mobileWide: 1\.3,\s*mobile: 1\.2,\s*small: 1\.2/,
  );
  assert.match(
    scene,
    /if \(width > 1100\)[\s\S]*if \(width > 820\)[\s\S]*if \(width > 760\)[\s\S]*if \(width > 520\)/,
  );
  assert.match(
    scene,
    /renderer\.setPixelRatio\(getViewportRenderScale\(window\.innerWidth\)\)/,
  );
  assert.match(scene, /const pixelRatio = getViewportRenderScale\(width\)/);
  assert.doesNotMatch(scene, /window\.devicePixelRatio/);
  assert.match(scene, /fxaa: true,\s*msaa: false,\s*msaaSamples: 4/);
  assert.match(scene, /antialias: ANTIALIASING\.msaa/);
  assert.match(
    scene,
    /samples: ANTIALIASING\.msaa \? ANTIALIASING\.msaaSamples : 0/,
  );
  assert.doesNotMatch(scene, /alphaHash/);
  assert.doesNotMatch(scene, /domeTiles\.mesh\.visible/);
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
  assert.match(scene, /const RESONANCE_RING_THICKNESS = 0\.2/);
  assert.match(scene, /const RESONANCE_RING_SPEED = 0\.2/);
  assert.match(scene, /elapsed \* RESONANCE_RING_SPEED/);
  assert.match(
    scene,
    /const resonanceGroup = new THREE\.Group\(\);[\s\S]*resonanceGroup\.renderOrder = 1;[\s\S]*scene\.add\(resonanceGroup\)/,
  );
  assert.match(scene, /ring\.position\.y = 0\.022/);
  assert.match(scene, /resonanceGroup\.add\(ring\)/);
  assert.doesNotMatch(scene, /domeGroup\.add\(ring\)/);
  assert.match(
    scene,
    /resonanceGroup\.position\.copy\(environmentFloor\);[\s\S]*resonanceGroup\.scale\.setScalar\(sampled\.scale\);[\s\S]*resonanceGroup\.rotation\.set\(0, domeGroup\.rotation\.y, 0\)/,
  );
  assert.match(scene, /const WIRE_VISIBILITY_EPSILON = 0\.001/);
  assert.match(
    scene,
    /const wireMaterial = new THREE\.LineBasicMaterial\(\{[\s\S]*?opacity: 0,[\s\S]*?depthWrite: false,[\s\S]*?\}\)/,
  );
  assert.match(scene, /wire\.visible = false/);
  assert.match(
    scene,
    /wire\.visible = wireOpacity > WIRE_VISIBILITY_EPSILON/,
  );
  assert.match(scene, /new THREE\.DataTexture\(/);
  assert.match(scene, /map: particleTexture/);
  assert.match(scene, /const PARTICLE_COUNT = 328/);
  assert.match(scene, /const LOW_POWER_PARTICLE_COUNT = 246/);
  assert.match(scene, /const PARTICLE_FIELD_RADIUS = 9/);
  assert.match(scene, /const PARTICLE_FIELD_HEIGHT = 6/);
  assert.match(scene, /createParticleFieldPositions\(/);
  assert.match(
    scene,
    /particles\.position\.set\(\s*domeGroup\.position\.x,\s*environmentFloor\.y,\s*domeGroup\.position\.z/,
  );
  assert.doesNotMatch(scene, /particles\.rotation\.x/);
  assert.match(particles, /fieldRadius \* Math\.sqrt\(halton\(candidate, 2\)\)/);
  assert.match(particles, /isInsideDomeExclusion\(/);
  assert.match(particles, /insideDome/);
  assert.doesNotMatch(
    scene,
    /ringsChapterVisible|ringsVisibilityObserver|showResonanceRings/,
  );
  assert.match(scene, /sceneState = "idle"/);
  assert.match(
    scene,
    /const resourceConstrained =[\s\S]*connection\?\.saveData[\s\S]*navigator\.hardwareConcurrency <= 4/,
  );
  assert.match(scene, /const LOW_POWER_MODE_ENABLED: boolean = false/);
  assert.match(
    scene,
    /let lowPower =\s*LOW_POWER_MODE_ENABLED && \(resourceConstrained \|\| compact\)/,
  );
  assert.doesNotMatch(
    scene,
    /lowPower = resourceConstrained \|\| compact/,
  );
  assert.match(
    scene,
    /root\.dataset\.scenePowerMode = lowPower \? "low-power" : "full"/,
  );
  assert.doesNotMatch(scene, /coarsePointerQuery|navigator\.maxTouchPoints/);
  assert.doesNotMatch(scene, /#if LOW_POWER|LOW_POWER:\s/);
  assert.match(
    scene,
    /vec3 imageColor =\s*texture2D\(uMap, photoUv\)\.rgb \* 0\.5 \+\s*texture2D\(uMap, photoUv - softOffset\)\.rgb \* 0\.25 \+\s*texture2D\(uMap, photoUv \+ softOffset\)\.rgb \* 0\.25;/,
  );
  assert.match(scene, /softOffset = vec2\(uTexel\.x \* 1\.8, 0\.0\)/);
  assert.match(scene, /const ENVIRONMENT_GROUND_COLOR = 0x07100f/);
  assert.match(
    scene,
    /float environmentBlend = smoothstep\(0\.0, 0\.14, height\)/,
  );
  assert.match(
    scene,
    /float alpha = mix\(1\.0, environmentAlpha, environmentBlend\)/,
  );
  assert.match(
    scene,
    /color: ENVIRONMENT_GROUND_COLOR,\s*side: THREE\.DoubleSide,\s*fog: false/,
  );
  assert.match(
    scene,
    /compact \? "\/media\/arenal-mobile\.webp" : "\/media\/arenal\.webp"/,
  );
  assert.match(scene, /createDomeGeometry\(DOME_RADIUS, lowPower\)/);
  assert.match(scene, /const resonanceCount = lowPower \? 3 : 5/);
  assert.match(
    scene,
    /lowPower \? LOW_POWER_PARTICLE_COUNT : PARTICLE_COUNT/,
  );
  assert.match(scene, /size: compact \? 0\.022 : 0\.028/);
  assert.match(scene, /const sampledScene: SceneSample/);
  assert.match(scene, /sampledDome,\s*sampledScene,/);
  assert.doesNotMatch(
    scene,
    /const updateScroll = \(\) => \{[\s\S]{0,320}scrollHeight/,
  );
  assert.match(scene, /const pixelRatioChanged = pixelRatio !== viewportPixelRatio/);
  assert.match(scene, /window\.setTimeout\(\(\) => \{[\s\S]*requestAnimationFrame\(commitResize\)/);
  assert.match(scene, /webglcontextrestored/);
  assert.match(scene, /const handleContextRestored = \(\) =>/);
  assert.doesNotMatch(scene, /domeGroup\.updateMatrixWorld\(true\)/);
  assert.match(experience, /src="\/footer-mark\.svg"/);
  assert.match(experience, /const MOBILE_SCROLL_LOCK_CLASS/);
  assert.match(
    experience,
    /external: "\\u2197\\uFE0E",\s*down: "\\u2193\\uFE0E"/,
  );
  assert.match(styles, /\.text-arrow \{[\s\S]*font-variant-emoji: text/);
  assert.match(experience, /event\.preventDefault\(\)/);
  assert.match(
    experience,
    /document\.body\.classList\.remove\(MOBILE_SCROLL_LOCK_CLASS\)/,
  );
  assert.match(
    experience,
    /target\.scrollIntoView\(\{ behavior, block: "start" \}\)/,
  );
  assert.match(
    experience,
    /const behavior = reducedMotion \? "auto" : "smooth"/,
  );
  assert.doesNotMatch(experience, /mobileViewport|coarsePointer/);
  assert.doesNotMatch(experience, /document\.body\.style\.overflow/);
  assert.match(experience, /window\.matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(experience, /mobileMenuQuery\.addEventListener\("change"/);
  assert.match(experience, /inert=\{!menuOpen\}/);
  assert.match(experience, /aria-current=\{activeChapter === index/);
  assert.match(experience, /className="skip-link"/);
  assert.match(experience, /event\.metaKey[\s\S]*event\.ctrlKey/);
  assert.match(experience, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styles, /body \{[\s\S]*overflow-x: clip/);
  assert.match(
    styles,
    /\.mobile-menu \{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain/,
  );
  assert.match(styles, /url\("\/media\/dome-day\.webp"\) 72% center/);
  assert.doesNotMatch(styles, /url\("\/media\/dome-night\.webp"\)/);
  assert.match(
    styles,
    /\.ambient-field::before \{[\s\S]*transform: translate3d\(/,
  );
  assert.doesNotMatch(
    styles,
    /\.signal-grid article \{[^}]*backdrop-filter:\s*none/,
  );
  assert.doesNotMatch(
    styles,
    /@media \(max-width: 820px\) \{\s*html \{\s*scroll-behavior: auto/,
  );
  assert.doesNotMatch(styles, /@media \(hover: none\) and \(pointer: coarse\)/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*scroll-behavior: auto/,
  );
  assert.match(
    styles,
    /\.site-footer > img \{[\s\S]*width: 74px;[\s\S]*height: 74px;/,
  );
  assert.doesNotMatch(experience, /scene-skybox/);
  assert.doesNotMatch(styles, /\.scene-skybox/);
  assert.doesNotMatch(styles, /backdrop-filter:\s*blur\(3px\)[^}]*mask-image/s);
});
