import * as THREE from 'three';

const DARK_EQUIPMENT = '#111827';
const BALL_HOCKEY_SHOE = '#0f172a';
const GOALIE_PAD = '#f8fafc';
const DEFAULT_UNIFORM = {
  jersey: '#f8fafc',
  stripe: '#1d4ed8',
  shorts: '#0f172a',
  helmet: '#f8fafc',
};
const textureCache = new Map();

function runnerSleeveColor(player) {
  return player?.team === 'us' ? '#dbeafe' : '#b91c1c';
}

function runnerCompressionSleeveColor(player, uniform) {
  return player?.team === 'us' ? uniform.stripe : runnerSleeveColor(player);
}

const MATERIAL_PARTS = [
  ['helmetShell', ['helmet_cage_visor_shell', 'helmet_shell']],
  ['neckGuard', ['neck_guard', 'chin_strap']],
  ['visor', ['visor', 'cage', 'grille']],
  ['mask', ['mask']],
  ['blocker', ['blocker']],
  ['catcher', ['catcher']],
  ['equipmentStrap', ['equipment_strap', 'cap_strap', 'upper_strap', 'lower_strap']],
  ['runnerArmPad', ['shoulder_elbow_pad']],
  ['gloveGripTape', ['palm_grip_pad', 'wrist_tape', 'glove_grip_tape']],
  ['pad', ['legpad', 'leg_pad', 'goaliepad', 'goalie_pad', 'pad']],
  ['stickBlade', ['blade', 'tape']],
  ['stick', ['stick', 'shaft']],
  ['glove', ['glove', 'mitt']],
  ['underarmGusset', ['underarm_gusset']],
  ['jerseyYoke', ['shoulder_yoke']],
  ['jerseyAccent', ['uniform_accent', 'collar', 'sleeve_cuff', 'waist_band']],
  ['shoe', ['shoe', 'sneaker', 'footwear']],
  ['helmet', ['helmet']],
  ['shorts', ['short', 'shorts']],
  ['sock', ['sock']],
  ['stripe', ['stripe', 'trim', 'number', 'logo', 'crest']],
  ['compressionSleeve', ['forearm_sleeve', 'compression_sleeve']],
  ['jerseySleeve', ['uniform_top_left_sleeve', 'uniform_top_right_sleeve', 'jersey_sleeve', 'forearm_sleeve', 'compression_sleeve']],
  ['jersey', ['jersey', 'shirt', 'uniform_top', 'uniformtop']],
];

function normalizedText(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .toLowerCase();
}

export function classifyProductionRigPart(...nameParts) {
  const haystack = normalizedText(nameParts.filter(Boolean).join(' '));
  const match = MATERIAL_PARTS.find(([, fragments]) => fragments.some((fragment) => haystack.includes(fragment)));
  return match?.[0] ?? 'default';
}

export function getProductionUniformMaterial(part, player) {
  const uniform = { ...DEFAULT_UNIFORM, ...(player?.uniform ?? {}) };
  const isHome = player?.team === 'us';

  if (part === 'jersey') return { color: uniform.jersey, roughness: 0.68, metalness: 0.01, texture: 'jersey-knit', bumpScale: 0.018 };
  if (part === 'jerseySleeve') return { color: runnerSleeveColor(player), roughness: 0.62, metalness: 0.01, texture: 'jersey-knit', bumpScale: 0.014 };
  if (part === 'compressionSleeve') return { color: runnerCompressionSleeveColor(player, uniform), roughness: 0.66, metalness: 0.01, texture: 'jersey-knit', bumpScale: 0.012 };
  if (part === 'stripe') return { color: uniform.stripe, roughness: 0.48, metalness: 0.02, texture: 'stripe-weave', bumpScale: 0.01 };
  if (part === 'shorts') return { color: uniform.shorts, roughness: 0.7, metalness: 0.01, texture: 'shorts-weave', bumpScale: 0.015 };
  if (part === 'helmetShell' || part === 'helmet' || part === 'mask') return { color: uniform.helmet, roughness: 0.24, metalness: 0.08 };
  if (part === 'neckGuard') return { color: '#020617', roughness: 0.64, metalness: 0.02, texture: 'equipment-grain', bumpScale: 0.014 };
  if (part === 'visor') return { color: DARK_EQUIPMENT, roughness: 0.18, metalness: 0.16 };
  if (part === 'shoe') return { color: BALL_HOCKEY_SHOE, roughness: 0.42, metalness: 0.04, texture: 'shoe-grain', bumpScale: 0.02 };
  if (part === 'glove') return { color: '#0f172a', roughness: 0.54, metalness: 0.03, texture: 'glove-grain', bumpScale: 0.024 };
  if (part === 'gloveGripTape') return { color: '#020617', roughness: 0.66, metalness: 0.02, texture: 'grip-tape', bumpScale: 0.02 };
  if (part === 'equipmentStrap') return { color: '#020617', roughness: 0.62, metalness: 0.02, texture: 'equipment-grain', bumpScale: 0.018 };
  if (part === 'runnerArmPad') return { color: DARK_EQUIPMENT, roughness: 0.58, metalness: 0.025, texture: 'equipment-grain', bumpScale: 0.018 };
  if (part === 'underarmGusset') return { color: DARK_EQUIPMENT, roughness: 0.7, metalness: 0.01, texture: 'jersey-knit', bumpScale: 0.012 };
  if (part === 'jerseyYoke') return { color: uniform.stripe, roughness: 0.5, metalness: 0.02, texture: 'stripe-weave', bumpScale: 0.01 };
  if (part === 'jerseyAccent') return { color: uniform.stripe, roughness: 0.5, metalness: 0.02, texture: 'stripe-weave', bumpScale: 0.01 };
  if (part === 'pad') return { color: GOALIE_PAD, roughness: 0.54, metalness: 0.02 };
  if (part === 'blocker' || part === 'catcher') return { color: GOALIE_PAD, roughness: 0.5, metalness: 0.02 };
  if (part === 'stickBlade') return { color: isHome ? '#1d4ed8' : '#ef4444', roughness: 0.36, metalness: 0.03 };
  if (part === 'stick') return { color: DARK_EQUIPMENT, roughness: 0.44, metalness: 0.04 };
  if (part === 'sock') return { color: isHome ? '#f8fafc' : '#fee2e2', roughness: 0.66, metalness: 0.01, texture: 'sock-rib', bumpScale: 0.016 };

  return null;
}

function createDetailTexture(kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#b8c1c7';
  context.fillRect(0, 0, 64, 64);
  context.globalAlpha = 0.22;
  for (let x = 0; x < 64; x += kind.includes('rib') ? 5 : 8) {
    context.fillStyle = x % 16 === 0 ? '#ffffff' : '#6b7280';
    context.fillRect(x, 0, 1, 64);
  }
  for (let y = 0; y < 64; y += kind.includes('grain') ? 11 : 6) {
    context.fillStyle = y % 12 === 0 ? '#ffffff' : '#475569';
    context.fillRect(0, y, 64, 1);
  }
  context.globalAlpha = 0.12;
  for (let i = 0; i < 180; i += 1) {
    const shade = 110 + ((i * 37) % 90);
    context.fillStyle = `rgb(${shade},${shade},${shade})`;
    context.fillRect((i * 17) % 64, (i * 29) % 64, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind.includes('rib') ? 3 : 5, kind.includes('grain') ? 4 : 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  textureCache.set(kind, texture);
  return texture;
}

function applySettingsToMaterial(material, settings) {
  const next = material?.clone?.() ?? new THREE.MeshStandardMaterial();
  next.roughness = settings.roughness;
  next.metalness = settings.metalness;
  next.color = new THREE.Color(settings.color);
  const detailTexture = settings.texture ? createDetailTexture(settings.texture) : null;
  if (detailTexture) {
    next.map = detailTexture;
    next.bumpMap = detailTexture;
    next.bumpScale = settings.bumpScale ?? 0.01;
  } else if (partShouldDropTexture(settings)) {
    next.map = null;
  }
  next.needsUpdate = true;
  return next;
}

function partShouldDropTexture(settings) {
  return Boolean(settings?.color);
}

export function applyProductionUniformMaterials(root, player) {
  const counts = {};

  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = false;
    object.receiveShadow = false;
    object.frustumCulled = false;

    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => {
        const part = classifyProductionRigPart(object.name, material?.name);
        const settings = getProductionUniformMaterial(part, player);
        if (!settings) return material;
        counts[part] = (counts[part] ?? 0) + 1;
        return applySettingsToMaterial(material, settings);
      });
      return;
    }

    const part = classifyProductionRigPart(object.name, object.material?.name);
    const settings = getProductionUniformMaterial(part, player);
    if (!settings) return;

    counts[part] = (counts[part] ?? 0) + 1;
    object.material = applySettingsToMaterial(object.material, settings);
  });

  return counts;
}

export function hideProductionRigParts(root, partsToHide = []) {
  const hiddenParts = new Set(partsToHide);
  const counts = {};

  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    const materialNames = Array.isArray(object.material)
      ? object.material.map((material) => material?.name).join(' ')
      : object.material?.name;
    const part = classifyProductionRigPart(object.name, materialNames);
    if (!hiddenParts.has(part)) return;

    object.visible = false;
    counts[part] = (counts[part] ?? 0) + 1;
  });

  return counts;
}
