"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { createDomeCladdingGeometry } from "./domeCladding";

type SceneKeyframe = {
  at: number;
  camera: THREE.Vector3;
  target: THREE.Vector3;
  dome: THREE.Vector3;
  scale: number;
  rotation: number;
  tiles: number;
  shell: number;
  wire: number;
  resonance: number;
  sky: number;
};

type SceneSample = Pick<
  SceneKeyframe,
  "scale" | "rotation" | "tiles" | "shell" | "wire" | "resonance" | "sky"
>;

const COPPER = new THREE.Color("#d57e3d");
const COPPER_LIGHT = new THREE.Color("#f5c6a3");
const COPPER_DARK = new THREE.Color("#2a1309");

const DOME_RADIUS = 2.48;
const DOME_DRUM_HEIGHT = DOME_RADIUS * 0.62;
const DOME_SPRING_Y = 0;
const DOME_BASE_Y = DOME_SPRING_Y - DOME_DRUM_HEIGHT;
const DOME_TOP_Y = DOME_SPRING_Y + DOME_RADIUS;
const ENVIRONMENT_RADIUS = 22;
const ENVIRONMENT_HEIGHT = 15.5;
const ENVIRONMENT_PHOTO_FOV = 68;
const FRAME_INTERVAL_MS = 1000 / 60;
const ANTIALIASING = {
  fxaa: true,
  msaa: false,
  msaaSamples: 4,
} as const;
const VIEWPORT_RENDER_SCALE = {
  desktop: 1.4,
  tablet: 1.4,
  mobileWide: 1.3,
  mobile: 1.2,
  small: 1.2,
} as const;
const RESONANCE_RING_INNER_OFFSET = 0.065;
const RESONANCE_RING_THICKNESS = 0.18;
const RESONANCE_RING_SPEED = 0.18;
const WIRE_VISIBILITY_EPSILON = 0.001;
const PARTICLE_COUNT = 840;
const LOW_POWER_PARTICLE_COUNT = 320;

function seededNoise(value: number) {
  return Math.sin(value * 12.9898) * 43758.5453 % 1;
}

function getViewportRenderScale(width: number) {
  if (width > 1100) return VIEWPORT_RENDER_SCALE.desktop;
  if (width > 820) return VIEWPORT_RENDER_SCALE.tablet;
  if (width > 760) return VIEWPORT_RENDER_SCALE.mobileWide;
  if (width > 520) return VIEWPORT_RENDER_SCALE.mobile;
  return VIEWPORT_RENDER_SCALE.small;
}

function createDomeGeometry(radius: number, compact: boolean) {
  const radialSegments = compact ? 42 : 60;
  const drumSegments = compact ? 4 : 6;
  const capSegments = compact ? 16 : 24;
  const profile: THREE.Vector2[] = [];

  for (let index = 0; index <= drumSegments; index += 1) {
    profile.push(
      new THREE.Vector2(
        radius,
        DOME_BASE_Y + (DOME_DRUM_HEIGHT * index) / drumSegments,
      ),
    );
  }

  for (let index = 1; index <= capSegments; index += 1) {
    const angle = (index / capSegments) * (Math.PI / 2);
    profile.push(
      new THREE.Vector2(
        Math.cos(angle) * radius,
        DOME_SPRING_Y + Math.sin(angle) * radius,
      ),
    );
  }

  const sourceGeometry = new THREE.LatheGeometry(
    profile,
    radialSegments,
    0,
    Math.PI * 2,
  );
  const geometry = sourceGeometry.toNonIndexed();
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];

  for (let index = 0; index < positions.count; index += 3) {
    const centerX =
      (positions.getX(index) +
        positions.getX(index + 1) +
        positions.getX(index + 2)) /
      3;
    const centerY =
      (positions.getY(index) +
        positions.getY(index + 1) +
        positions.getY(index + 2)) /
      3;
    const centerZ =
      (positions.getZ(index) +
        positions.getZ(index + 1) +
        positions.getZ(index + 2)) /
      3;
    const noise = Math.abs(
      seededNoise(centerX * 3.1 + centerY * 5.7 + centerZ * 7.3),
    );
    const height = THREE.MathUtils.clamp(
      (centerY - DOME_BASE_Y) / (DOME_TOP_Y - DOME_BASE_Y),
      0,
      1,
    );
    const color = COPPER_DARK.clone()
      .lerp(COPPER, 0.3 + noise * 0.34)
      .lerp(COPPER_LIGHT, Math.pow(height, 2.8) * 0.14);

    for (let vertex = 0; vertex < 3; vertex += 1) {
      colors.push(color.r, color.g, color.b);
    }
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  sourceGeometry.dispose();
  return geometry;
}

function createParticles(count: number) {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const radius = 4 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = -1.8 + Math.random() * 8;
    positions[index * 3 + 2] = Math.sin(angle) * radius - 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  return geometry;
}

function createParticleTexture() {
  const size = 32;
  const radius = (size - 1) / 2;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - radius, y - radius) / radius;
      const edge = THREE.MathUtils.clamp((1 - distance) / 0.22, 0, 1);
      const alpha = edge * edge * (3 - 2 * edge);
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createDomeTiles(radius: number, compact: boolean) {
  const { geometry, topology } = createDomeCladdingGeometry({
    radius,
    drumHeight: DOME_DRUM_HEIGHT,
    springY: DOME_SPRING_Y,
    compact,
  });
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.52,
    roughness: 0.64,
    opacity: 1,
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.claddingTopology = topology;
  return { mesh, geometry, material };
}

function mixVector(
  target: THREE.Vector3,
  from: THREE.Vector3,
  to: THREE.Vector3,
  amount: number,
) {
  target.copy(from).lerp(to, amount);
}

function sampleKeyframes(
  keyframes: SceneKeyframe[],
  progress: number,
  camera: THREE.Vector3,
  target: THREE.Vector3,
  dome: THREE.Vector3,
  sample: SceneSample,
) {
  let start = keyframes[0];
  let end = keyframes[keyframes.length - 1];

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    if (
      progress >= keyframes[index].at &&
      progress <= keyframes[index + 1].at
    ) {
      start = keyframes[index];
      end = keyframes[index + 1];
      break;
    }
  }

  const range = Math.max(0.0001, end.at - start.at);
  const raw = THREE.MathUtils.clamp((progress - start.at) / range, 0, 1);
  const amount = raw * raw * (3 - 2 * raw);
  mixVector(camera, start.camera, end.camera, amount);
  mixVector(target, start.target, end.target, amount);
  mixVector(dome, start.dome, end.dome, amount);

  sample.scale = THREE.MathUtils.lerp(start.scale, end.scale, amount);
  sample.rotation = THREE.MathUtils.lerp(
    start.rotation,
    end.rotation,
    amount,
  );
  sample.tiles = THREE.MathUtils.lerp(start.tiles, end.tiles, amount);
  sample.shell = THREE.MathUtils.lerp(start.shell, end.shell, amount);
  sample.wire = THREE.MathUtils.lerp(start.wire, end.wire, amount);
  sample.resonance = THREE.MathUtils.lerp(
    start.resonance,
    end.resonance,
    amount,
  );
  sample.sky = THREE.MathUtils.lerp(start.sky, end.sky, amount);
  return sample;
}

export function DomeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const root = document.documentElement;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactQuery = window.matchMedia("(max-width: 760px)");
    const pointerQuery = window.matchMedia("(pointer: fine)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection;
    let prefersReducedMotion = motionQuery.matches;
    let compact = compactQuery.matches;
    const resourceLowPower =
      compact ||
      coarsePointerQuery.matches ||
      navigator.maxTouchPoints > 0 ||
      Boolean(connection?.saveData) ||
      (navigator.hardwareConcurrency > 0 &&
        navigator.hardwareConcurrency <= 4);
    let lowPower = resourceLowPower || compact;

    let renderer: THREE.WebGLRenderer | undefined;
    let animationFrame = 0;
    let resizeFrame = 0;
    let resizeTimer = 0;
    let disposed = false;
    let contextLost = false;
    let environmentReady = false;
    let targetProgress = 0;
    let currentProgress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let currentPointerX = 0;
    let currentPointerY = 0;
    let previousFrame = performance.now();
    let previousAnimationTick = performance.now();
    let frameBudgetMs = 0;
    let motionElapsed = 0;
    let ringsChapterVisible = false;
    let pageScrollRange = 1;
    let viewportWidth = 0;
    let viewportHeight = 0;
    let viewportPixelRatio = 0;
    let viewportFov = 0;

    root.classList.remove("no-webgl", "webgl-ready");
    delete root.dataset.sceneState;
    delete root.dataset.sceneEnvironment;
    delete root.dataset.sceneAntialiasing;
    delete root.dataset.sceneRings;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: ANTIALIASING.msaa,
        powerPreference: lowPower ? "low-power" : "default",
      });
    } catch {
      root.classList.add("no-webgl");
      return () => {
        root.classList.remove("no-webgl", "webgl-ready");
      };
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(getViewportRenderScale(window.innerWidth));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070908, 0.056);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    const antialiasRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: ANTIALIASING.msaa ? ANTIALIASING.msaaSamples : 0,
    });
    const composer = new EffectComposer(renderer, antialiasRenderTarget);
    const renderPass = new RenderPass(scene, camera);
    const outputPass = new OutputPass();
    const fxaaPass = new FXAAPass();
    fxaaPass.enabled = ANTIALIASING.fxaa;
    composer.addPass(renderPass);
    composer.addPass(outputPass);
    composer.addPass(fxaaPass);
    root.dataset.sceneAntialiasing = ANTIALIASING.msaa
      ? ANTIALIASING.fxaa
        ? "msaa+fxaa"
        : "msaa"
      : ANTIALIASING.fxaa
        ? "fxaa"
        : "none";

    const environmentGroup = new THREE.Group();
    scene.add(environmentGroup);

    const environmentTexture = new THREE.TextureLoader().load(
      resourceLowPower ? "/media/arenal-mobile.webp" : "/media/arenal.webp",
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(2, renderer?.capabilities.getMaxAnisotropy() ?? 1);
        texture.needsUpdate = true;
        environmentReady = true;
        if (!contextLost) {
          root.classList.remove("no-webgl");
          root.classList.add("webgl-ready");
        }
        renderFrame();
      },
      undefined,
      () => {
        if (disposed) return;
        environmentReady = false;
        root.classList.remove("webgl-ready");
      },
    );
    environmentTexture.colorSpace = THREE.SRGBColorSpace;
    environmentTexture.wrapS = THREE.ClampToEdgeWrapping;
    environmentTexture.wrapT = THREE.ClampToEdgeWrapping;

    const environmentGeometry = new THREE.CylinderGeometry(
      ENVIRONMENT_RADIUS,
      ENVIRONMENT_RADIUS,
      ENVIRONMENT_HEIGHT,
      resourceLowPower ? 40 : 56,
      1,
      true,
    );
    environmentGeometry.translate(0, ENVIRONMENT_HEIGHT / 2, 0);
    const environmentMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
      defines: {
        LOW_POWER: resourceLowPower ? 1 : 0,
      },
      uniforms: {
        uMap: { value: environmentTexture },
        uOpacity: { value: 0.42 },
        uEnvironmentHeight: { value: ENVIRONMENT_HEIGHT },
        uTanHalfFov: {
          value: Math.tan(
            THREE.MathUtils.degToRad(ENVIRONMENT_PHOTO_FOV / 2),
          ),
        },
        uPhotoHalfFov: {
          value: THREE.MathUtils.degToRad(ENVIRONMENT_PHOTO_FOV / 2),
        },
        uCaptureOrigin: { value: new THREE.Vector3(0, 3, 7.6) },
        uTexel: {
          value: new THREE.Vector2(
            1 / (resourceLowPower ? 900 : 1800),
            1 / (resourceLowPower ? 483 : 966),
          ),
        },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vEnvironmentPosition;

        void main() {
          vUv = uv;
          vEnvironmentPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform float uEnvironmentHeight;
        uniform float uTanHalfFov;
        uniform float uPhotoHalfFov;
        uniform vec3 uCaptureOrigin;
        uniform vec2 uTexel;
        varying vec2 vUv;
        varying vec3 vEnvironmentPosition;

        void main() {
          vec3 fromCapture = vEnvironmentPosition - uCaptureOrigin;
          float yaw = atan(fromCapture.x, -fromCapture.z);
          float photoU = 0.5 + 0.5 * tan(yaw) / uTanHalfFov;
          float height = clamp(
            vEnvironmentPosition.y / uEnvironmentHeight,
            0.0,
            1.0
          );
          vec2 photoUv = vec2(
            clamp(photoU, 0.0, 1.0),
            height
          );
          vec2 softOffset = vec2(uTexel.x * 1.35, 0.0);
          #if LOW_POWER == 1
          vec3 imageColor = texture2D(uMap, photoUv).rgb;
          #else
          vec3 imageColor =
            texture2D(uMap, photoUv).rgb * 0.5 +
            texture2D(uMap, photoUv - softOffset).rgb * 0.25 +
            texture2D(uMap, photoUv + softOffset).rgb * 0.25;
          #endif
          float luminance = dot(imageColor, vec3(0.299, 0.587, 0.114));
          imageColor = mix(vec3(luminance), imageColor, 0.62);
          imageColor *= vec3(0.44, 0.5, 0.52);

          float imageMask =
            smoothstep(0.0, 0.08, photoU) *
            smoothstep(0.0, 0.08, 1.0 - photoU) *
            (1.0 - smoothstep(
              uPhotoHalfFov,
              uPhotoHalfFov + 0.12,
              abs(yaw)
            ));
          vec3 groundColor = vec3(0.007, 0.016, 0.015);
          vec3 nightColor = mix(
            vec3(0.006, 0.012, 0.011),
            vec3(0.012, 0.022, 0.028),
            smoothstep(0.0, 0.78, height)
          );
          vec3 color = mix(nightColor, imageColor, imageMask);
          color = mix(
            groundColor,
            color,
            smoothstep(0.0, 0.09, height)
          );
          color *= mix(0.68, 1.0, smoothstep(0.0, 0.2, 1.0 - height));

          float alpha = uOpacity * mix(0.32, 1.0, imageMask);
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const environmentCylinder = new THREE.Mesh(
      environmentGeometry,
      environmentMaterial,
    );
    environmentCylinder.renderOrder = -20;
    environmentCylinder.frustumCulled = false;
    environmentGroup.add(environmentCylinder);

    const groundGeometry = new THREE.CircleGeometry(
      ENVIRONMENT_RADIUS,
      resourceLowPower ? 40 : 64,
    );
    const groundMaterial = new THREE.MeshBasicMaterial({
      color: 0x07100f,
      side: THREE.DoubleSide,
      fog: true,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.006;
    ground.renderOrder = -19;
    environmentGroup.add(ground);

    const domeGroup = new THREE.Group();
    domeGroup.rotation.order = "YXZ";
    scene.add(domeGroup);
    const floorMarker = new THREE.Object3D();
    floorMarker.position.y = DOME_BASE_Y;
    domeGroup.add(floorMarker);
    root.dataset.sceneEnvironment = "webgl-cylindrical-skybox";

    const domeGeometry = createDomeGeometry(DOME_RADIUS, resourceLowPower);
    const shellMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      metalness: 0.86,
      roughness: 0.32,
      transparent: true,
      opacity: 0.94,
      side: THREE.FrontSide,
      emissive: new THREE.Color("#35170a"),
      emissiveIntensity: 0.24,
    });
    const shell = new THREE.Mesh(domeGeometry, shellMaterial);
    shell.castShadow = false;
    shell.receiveShadow = false;
    domeGroup.add(shell);

    const domeTiles = createDomeTiles(DOME_RADIUS, resourceLowPower);
    domeGroup.add(domeTiles.mesh);

    const fresnelMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color("#ffd1ad") },
        uOpacity: { value: 0.28 },
      },
      vertexShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDirection = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vViewNormal, vViewDirection)), 2.5);
          gl_FragColor = vec4(uColor, fresnel * uOpacity);
        }
      `,
    });
    const fresnel = new THREE.Mesh(domeGeometry, fresnelMaterial);
    fresnel.scale.setScalar(1.008);
    domeGroup.add(fresnel);

    const wireGeometry = new THREE.WireframeGeometry(domeGeometry);
    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0xf1c6a3,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wire = new THREE.LineSegments(wireGeometry, wireMaterial);
    wire.scale.setScalar(1.012);
    wire.visible = false;
    domeGroup.add(wire);

    const innerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xd57e3d,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerGlow = new THREE.Mesh(domeGeometry, innerGlowMaterial);
    innerGlow.scale.set(0.965, 0.99, 0.965);
    domeGroup.add(innerGlow);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xd57e3d,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(DOME_RADIUS + 0.035, 0.022, 8, 96),
      ringMaterial,
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = DOME_BASE_Y + 0.032;
    domeGroup.add(baseRing);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(DOME_RADIUS + 0.27, 0.008, 6, 96),
      ringMaterial.clone(),
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = DOME_BASE_Y + 0.014;
    (outerRing.material as THREE.MeshBasicMaterial).opacity = 0.18;
    domeGroup.add(outerRing);

    const platform = new THREE.Mesh(
      new THREE.CircleGeometry(DOME_RADIUS + 0.4, 72),
      new THREE.MeshBasicMaterial({
        color: 0x0e1515,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
      }),
    );
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = DOME_BASE_Y + 0.006;
    domeGroup.add(platform);

    const polarGrid = new THREE.PolarGridHelper(
      10,
      18,
      10,
      64,
      0x32535a,
      0x182427,
    );
    polarGrid.position.y = DOME_BASE_Y + 0.018;
    const polarMaterials = Array.isArray(polarGrid.material)
      ? polarGrid.material
      : [polarGrid.material];
    polarMaterials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.22;
    });
    domeGroup.add(polarGrid);

    const resonanceRings: THREE.Mesh[] = [];
    const resonanceCount = resourceLowPower ? 3 : 5;
    for (let index = 0; index < resonanceCount; index += 1) {
      const geometry = new THREE.RingGeometry(
        DOME_RADIUS + RESONANCE_RING_INNER_OFFSET,
        DOME_RADIUS +
          RESONANCE_RING_INNER_OFFSET +
          RESONANCE_RING_THICKNESS,
        72,
      );
      const material = new THREE.MeshBasicMaterial({
        color: index % 2 === 0 ? 0xd57e3d : 0x5ba9b7,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = DOME_BASE_Y + 0.022;
      ring.userData.phase = index / resonanceCount;
      domeGroup.add(ring);
      resonanceRings.push(ring);
    }

    const particleGeometry = createParticles(
      resourceLowPower ? LOW_POWER_PARTICLE_COUNT : PARTICLE_COUNT,
    );
    const particleTexture = createParticleTexture();
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xa9cad3,
      size: resourceLowPower ? 0.022 : 0.028,
      map: particleTexture,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    scene.add(new THREE.HemisphereLight(0xbcdde2, 0x080807, 0.72));

    const keyLight = new THREE.DirectionalLight(0xffc59c, 2.8);
    keyLight.position.set(-4, 6, 4);
    scene.add(keyLight);

    const copperLight = new THREE.PointLight(0xd57e3d, 42, 13, 1.7);
    copperLight.position.set(3.5, 1.2, 3.2);
    scene.add(copperLight);

    const tealLight = new THREE.PointLight(0x247a8e, 16, 15, 1.8);
    tealLight.position.set(-4.5, 0.3, 1.2);
    scene.add(tealLight);

    const keyframes: SceneKeyframe[] = [
      {
        at: 0,
        camera: new THREE.Vector3(0.15, 1.15, 7.6),
        target: new THREE.Vector3(1.15, 0.62, 0),
        dome: new THREE.Vector3(1.62, -0.38, 0),
        scale: 0.94,
        rotation: -0.12,
        tiles: 0.96,
        shell: 0.42,
        wire: 0,
        resonance: 0.46,
        sky: 0.42,
      },
      {
        at: 0.2,
        camera: new THREE.Vector3(0.6, 0.72, 6.3),
        target: new THREE.Vector3(-1.25, 0.7, 0),
        dome: new THREE.Vector3(-1.75, -0.2, 0.15),
        scale: 1.08,
        rotation: 0.24,
        tiles: 0.26,
        shell: 0.44,
        wire: 0.42,
        resonance: 0.92,
        sky: 0.2,
      },
      {
        at: 0.4,
        camera: new THREE.Vector3(-0.5, 4.9, 6.4),
        target: new THREE.Vector3(0, -0.2, 0),
        dome: new THREE.Vector3(1.55, -0.78, -0.4),
        scale: 0.88,
        rotation: 0.76,
        tiles: 0.05,
        shell: 0.36,
        wire: 0.62,
        resonance: 1,
        sky: 0.1,
      },
      {
        at: 0.6,
        camera: new THREE.Vector3(0.2, 1.2, 7.9),
        target: new THREE.Vector3(-1.7, 0.45, 0),
        dome: new THREE.Vector3(-2.05, -0.42, -0.6),
        scale: 0.76,
        rotation: 1.12,
        tiles: 0.08,
        shell: 0.22,
        wire: 0.46,
        resonance: 0.72,
        sky: 0.29,
      },
      {
        at: 0.8,
        camera: new THREE.Vector3(-0.6, 1.4, 8.4),
        target: new THREE.Vector3(1.8, 0.25, 0),
        dome: new THREE.Vector3(2.25, -0.5, -0.8),
        scale: 0.68,
        rotation: 1.48,
        tiles: 0.14,
        shell: 0.2,
        wire: 0.35,
        resonance: 0.54,
        sky: 0.09,
      },
      {
        at: 1,
        camera: new THREE.Vector3(0, 3.8, 7.5),
        target: new THREE.Vector3(0, 0.3, 0),
        dome: new THREE.Vector3(0, -0.54, 0),
        scale: 1.04,
        rotation: 2.05,
        tiles: 0.72,
        shell: 0.38,
        wire: 0.28,
        resonance: 1,
        sky: 0.12,
      },
    ];

    const sampledCamera = new THREE.Vector3();
    const sampledTarget = new THREE.Vector3();
    const sampledDome = new THREE.Vector3();
    const environmentFloor = new THREE.Vector3();
    const sampledScene: SceneSample = {
      scale: 1,
      rotation: 0,
      tiles: 1,
      shell: 1,
      wire: 1,
      resonance: 1,
      sky: 1,
    };

    const updateScroll = () => {
      if (prefersReducedMotion) return;
      targetProgress = THREE.MathUtils.clamp(
        window.scrollY / pageScrollRange,
        0,
        1,
      );
      wakeScene();
    };

    const updatePointer = (event: PointerEvent) => {
      if (prefersReducedMotion || !pointerQuery.matches) return;
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
      wakeScene();
    };

    const commitResize = () => {
      resizeFrame = 0;
      if (!renderer) return;
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const pixelRatio = getViewportRenderScale(width);
      const fov = compact ? 47 : 38;
      pageScrollRange = Math.max(
        1,
        document.documentElement.scrollHeight - height,
      );

      const sizeChanged =
        width !== viewportWidth || height !== viewportHeight;
      const pixelRatioChanged = pixelRatio !== viewportPixelRatio;
      const projectionChanged = sizeChanged || fov !== viewportFov;

      if (!sizeChanged && !pixelRatioChanged && !projectionChanged) return;

      if (pixelRatioChanged) {
        renderer.setPixelRatio(pixelRatio);
        composer.setPixelRatio(pixelRatio);
      }
      if (sizeChanged) {
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
      }

      viewportWidth = width;
      viewportHeight = height;
      viewportPixelRatio = pixelRatio;
      viewportFov = fov;
      camera.aspect = width / height;
      camera.fov = fov;
      camera.updateProjectionMatrix();

      if (prefersReducedMotion) {
        renderFrame();
      } else {
        wakeScene();
      }
    };

    const scheduleResize = () => {
      if (disposed) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        if (resizeFrame) return;
        resizeFrame = window.requestAnimationFrame(commitResize);
      }, 80);
    };

    function renderFrame() {
      if (!renderer || disposed || contextLost) return;
      const elapsed = motionElapsed;
      const sampled = sampleKeyframes(
        keyframes,
        currentProgress,
        sampledCamera,
        sampledTarget,
        sampledDome,
        sampledScene,
      );

      camera.position.copy(sampledCamera);
      camera.position.x += currentPointerX * 0.54;
      camera.position.y -= currentPointerY * 0.36;
      sampledTarget.x += currentPointerX * 0.18;
      sampledTarget.y -= currentPointerY * 0.08;
      camera.lookAt(sampledTarget);

      domeGroup.position.copy(sampledDome);
      if (compact) domeGroup.position.x += 0.55;
      domeGroup.scale.setScalar(sampled.scale);
      domeGroup.rotation.y =
        sampled.rotation + (prefersReducedMotion ? 0 : elapsed * 0.025);
      domeGroup.rotation.z = currentPointerX * -0.024;
      floorMarker.getWorldPosition(environmentFloor);
      environmentGroup.position.y = environmentFloor.y;

      shellMaterial.opacity = sampled.shell;
      domeTiles.material.opacity = sampled.tiles;
      domeTiles.mesh.visible = sampled.tiles > 0.075;
      environmentMaterial.uniforms.uOpacity.value = sampled.sky;
      shellMaterial.emissiveIntensity =
        0.18 + sampled.resonance * 0.16 +
        (prefersReducedMotion ? 0 : Math.sin(elapsed * 1.1) * 0.025);
      const wireOpacity = THREE.MathUtils.clamp(sampled.wire, 0, 1);
      wireMaterial.opacity = wireOpacity;
      wire.visible = wireOpacity > WIRE_VISIBILITY_EPSILON;
      fresnelMaterial.uniforms.uOpacity.value =
        0.16 + sampled.resonance * 0.24;
      innerGlowMaterial.opacity = 0.025 + sampled.resonance * 0.07;
      innerGlow.visible = !lowPower;
      particleMaterial.opacity = 0.08 + sampled.resonance * 0.14;
      copperLight.intensity =
        30 + sampled.resonance * 24 +
        (prefersReducedMotion ? 0 : Math.sin(elapsed * 0.8) * 3);
      copperLight.position.x =
        Math.cos(elapsed * 0.17) * 3.8 + sampledDome.x * 0.15;
      copperLight.position.z = Math.sin(elapsed * 0.17) * 3.8 + 2.8;

      particles.rotation.y =
        currentProgress * 0.45 + (prefersReducedMotion ? 0 : elapsed * 0.006);
      particles.rotation.x = currentPointerY * 0.018;

      const showResonanceRings =
        ringsChapterVisible && sampled.resonance > 0.01;
      for (let index = 0; index < resonanceRings.length; index += 1) {
        const ring = resonanceRings[index];
        ring.visible = showResonanceRings;
        if (!showResonanceRings) continue;

        const phase = prefersReducedMotion
          ? ring.userData.phase
          : (elapsed * RESONANCE_RING_SPEED + ring.userData.phase) % 1;
        const scale = 1 + phase * 1.88;
        ring.scale.setScalar(scale);
        (ring.material as THREE.MeshBasicMaterial).opacity =
          (1 - phase) * 0.12 * sampled.resonance;
      }

      composer.render();
    }

    const animate = (now: number) => {
      animationFrame = 0;
      if (disposed || contextLost || prefersReducedMotion) {
        root.dataset.sceneState = "idle";
        return;
      }

      const tickDelta = Math.min(
        100,
        Math.max(0, now - previousAnimationTick),
      );
      previousAnimationTick = now;
      frameBudgetMs += tickDelta;

      if (frameBudgetMs < FRAME_INTERVAL_MS - 0.35) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }
      frameBudgetMs %= FRAME_INTERVAL_MS;

      const delta = Math.min(0.08, Math.max(0.001, (now - previousFrame) / 1000));
      previousFrame = now;
      motionElapsed += delta;
      currentProgress = THREE.MathUtils.damp(
        currentProgress,
        targetProgress,
        5.5,
        delta,
      );
      currentPointerX = THREE.MathUtils.damp(
        currentPointerX,
        pointerX,
        5.8,
        delta,
      );
      currentPointerY = THREE.MathUtils.damp(
        currentPointerY,
        pointerY,
        5.8,
        delta,
      );
      renderFrame();

      animationFrame = window.requestAnimationFrame(animate);
    };

    function requestSceneRender() {
      if (
        disposed ||
        contextLost ||
        prefersReducedMotion ||
        document.hidden ||
        animationFrame
      ) {
        return;
      }

      const now = performance.now();
      previousFrame = now;
      previousAnimationTick = now;
      frameBudgetMs = 0;
      root.dataset.sceneState = "active";
      animationFrame = window.requestAnimationFrame(animate);
    }

    function wakeScene() {
      requestSceneRender();
    }

    const handleVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        root.dataset.sceneState = "idle";
      } else if (!prefersReducedMotion && !contextLost) {
        wakeScene();
      }
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      root.classList.remove("webgl-ready");
      root.classList.add("no-webgl");
      root.dataset.sceneState = "idle";
    };

    const handleContextRestored = () => {
      if (disposed) return;
      contextLost = false;
      root.classList.remove("no-webgl");
      if (environmentReady) root.classList.add("webgl-ready");

      viewportWidth = 0;
      viewportHeight = 0;
      viewportPixelRatio = 0;
      viewportFov = 0;
      previousFrame = performance.now();
      previousAnimationTick = previousFrame;
      commitResize();
      renderFrame();
      if (!prefersReducedMotion) wakeScene();
    };

    const handleMotionPreference = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;

      if (prefersReducedMotion) {
        pageScrollRange = Math.max(
          1,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        const scrollProgress = THREE.MathUtils.clamp(
          window.scrollY / pageScrollRange,
          0,
          1,
        );
        targetProgress = scrollProgress;
        currentProgress = scrollProgress;
        pointerX = 0;
        pointerY = 0;
        currentPointerX = 0;
        currentPointerY = 0;
        renderFrame();
        root.dataset.sceneState = "idle";
      } else if (!contextLost) {
        updateScroll();
        wakeScene();
      }
    };

    const handleCompactPreference = (event: MediaQueryListEvent) => {
      compact = event.matches;
      lowPower = resourceLowPower || compact;
      scheduleResize();
    };

    const experienceSection = document.getElementById("experience");
    const ringsVisibilityObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isVisible = Boolean(entry?.isIntersecting);
        if (ringsChapterVisible === isVisible) return;

        ringsChapterVisible = isVisible;
        root.dataset.sceneRings = isVisible ? "animating" : "paused";
        if (isVisible) wakeScene();
      },
      {
        rootMargin: "10% 0px 10% 0px",
        threshold: 0.01,
      },
    );
    if (experienceSection) {
      ringsVisibilityObserver.observe(experienceSection);
    }
    root.dataset.sceneRings = "paused";

    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", scheduleResize);
    window.visualViewport?.addEventListener("resize", scheduleResize);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    motionQuery.addEventListener("change", handleMotionPreference);
    compactQuery.addEventListener("change", handleCompactPreference);

    commitResize();
    updateScroll();
    renderFrame();
    if (!prefersReducedMotion) {
      wakeScene();
    } else {
      root.dataset.sceneState = "idle";
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
      window.removeEventListener("pointermove", updatePointer);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
      );
      motionQuery.removeEventListener("change", handleMotionPreference);
      compactQuery.removeEventListener("change", handleCompactPreference);
      ringsVisibilityObserver.disconnect();
      root.classList.remove("no-webgl", "webgl-ready");
      delete root.dataset.sceneState;
      delete root.dataset.sceneEnvironment;
      delete root.dataset.sceneAntialiasing;
      delete root.dataset.sceneRings;

      resonanceRings.forEach((ring) => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });
      domeGeometry.dispose();
      domeTiles.geometry.dispose();
      domeTiles.material.dispose();
      wireGeometry.dispose();
      particleGeometry.dispose();
      shellMaterial.dispose();
      wireMaterial.dispose();
      fresnelMaterial.dispose();
      innerGlowMaterial.dispose();
      baseRing.geometry.dispose();
      (baseRing.material as THREE.Material).dispose();
      outerRing.geometry.dispose();
      (outerRing.material as THREE.Material).dispose();
      platform.geometry.dispose();
      (platform.material as THREE.Material).dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
      polarGrid.geometry.dispose();
      polarMaterials.forEach((material) => material.dispose());
      environmentGeometry.dispose();
      environmentMaterial.dispose();
      environmentTexture.dispose();
      groundGeometry.dispose();
      groundMaterial.dispose();
      fxaaPass.dispose();
      outputPass.dispose();
      composer.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="dome-canvas" />
  );
}
