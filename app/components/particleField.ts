export type ParticleFieldOptions = {
  count: number;
  fieldRadius: number;
  fieldHeight: number;
  domeRadius: number;
  domeDrumHeight: number;
  domeClearance: number;
};

export type ParticleFieldAudit = {
  count: number;
  minHeight: number;
  maxHeight: number;
  maxRadius: number;
  outsideRadius: number;
  outsideHeight: number;
  insideDome: number;
};

function halton(index: number, base: number) {
  let result = 0;
  let fraction = 1 / base;
  let value = index;

  while (value > 0) {
    result += fraction * (value % base);
    value = Math.floor(value / base);
    fraction /= base;
  }

  return result;
}

export function isInsideDomeExclusion(
  radialDistance: number,
  heightAboveGround: number,
  options: Pick<
    ParticleFieldOptions,
    "domeRadius" | "domeDrumHeight" | "domeClearance"
  >,
) {
  const exclusionRadius = options.domeRadius + options.domeClearance;
  const capHeight = heightAboveGround - options.domeDrumHeight;

  if (heightAboveGround <= options.domeDrumHeight + options.domeClearance) {
    return radialDistance <= exclusionRadius;
  }

  return (
    capHeight <= exclusionRadius &&
    radialDistance * radialDistance + capHeight * capHeight <=
      exclusionRadius * exclusionRadius
  );
}

export function createParticleFieldPositions(options: ParticleFieldOptions) {
  const positions = new Float32Array(options.count * 3);
  let accepted = 0;
  let candidate = 1;

  while (accepted < options.count) {
    const radialDistance =
      options.fieldRadius * Math.sqrt(halton(candidate, 2));
    const angle = halton(candidate, 3) * Math.PI * 2;
    const heightAboveGround = halton(candidate, 5) * options.fieldHeight;
    candidate += 1;

    if (
      isInsideDomeExclusion(radialDistance, heightAboveGround, options)
    ) {
      continue;
    }

    const offset = accepted * 3;
    positions[offset] = Math.cos(angle) * radialDistance;
    positions[offset + 1] = heightAboveGround;
    positions[offset + 2] = Math.sin(angle) * radialDistance;
    accepted += 1;
  }

  return positions;
}

export function auditParticleFieldPositions(
  positions: Float32Array,
  options: Omit<ParticleFieldOptions, "count">,
): ParticleFieldAudit {
  const epsilon = 1e-5;
  const audit: ParticleFieldAudit = {
    count: positions.length / 3,
    minHeight: Number.POSITIVE_INFINITY,
    maxHeight: Number.NEGATIVE_INFINITY,
    maxRadius: 0,
    outsideRadius: 0,
    outsideHeight: 0,
    insideDome: 0,
  };

  for (let offset = 0; offset < positions.length; offset += 3) {
    const radialDistance = Math.hypot(
      positions[offset],
      positions[offset + 2],
    );
    const heightAboveGround = positions[offset + 1];

    audit.minHeight = Math.min(audit.minHeight, heightAboveGround);
    audit.maxHeight = Math.max(audit.maxHeight, heightAboveGround);
    audit.maxRadius = Math.max(audit.maxRadius, radialDistance);

    if (radialDistance > options.fieldRadius + epsilon) {
      audit.outsideRadius += 1;
    }
    if (
      heightAboveGround < -epsilon ||
      heightAboveGround > options.fieldHeight + epsilon
    ) {
      audit.outsideHeight += 1;
    }
    if (
      isInsideDomeExclusion(
        radialDistance,
        heightAboveGround,
        options,
      )
    ) {
      audit.insideDome += 1;
    }
  }

  return audit;
}
