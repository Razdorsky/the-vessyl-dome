import {
  auditParticleFieldPositions,
  createParticleFieldPositions,
  type ParticleFieldOptions,
} from "../app/components/particleField";

const DOME_RADIUS = 2.48;
const DOME_DRUM_HEIGHT = DOME_RADIUS * 0.62;
const DOME_MAX_SCENE_SCALE = 1.08;

const sharedOptions: Omit<ParticleFieldOptions, "count"> = {
  fieldRadius: 9,
  fieldHeight: 6,
  domeRadius: DOME_RADIUS * DOME_MAX_SCENE_SCALE,
  domeDrumHeight: DOME_DRUM_HEIGHT * DOME_MAX_SCENE_SCALE,
  domeClearance: 0.08,
};

for (const [profile, count] of [
  ["desktop", 328],
  ["low-power", 246],
] as const) {
  const positions = createParticleFieldPositions({
    ...sharedOptions,
    count,
  });
  const audit = auditParticleFieldPositions(positions, sharedOptions);

  console.log(profile, audit);

  if (
    audit.count !== count ||
    audit.outsideRadius !== 0 ||
    audit.outsideHeight !== 0 ||
    audit.insideDome !== 0
  ) {
    throw new Error(`${profile} particle field failed its bounds audit`);
  }
}
