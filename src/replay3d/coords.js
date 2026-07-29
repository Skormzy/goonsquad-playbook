export const RINK_WORLD = {
  width: 30.48,
  length: 60.96,
  cornerRadius: 8.53,
  surfaceY: 0,
};

const round = (value) => Number(value.toFixed(2));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function rinkToWorld({ x, y, height = 0 }) {
  return {
    x: round(((clamp(x, 0, 100) / 100) - 0.5) * RINK_WORLD.width),
    y: height,
    z: round(((clamp(y, 0, 100) / 100) - 0.5) * RINK_WORLD.length),
  };
}

export function worldToRink({ x, z }) {
  return {
    x: round(((x / RINK_WORLD.width) + 0.5) * 100),
    y: round(((z / RINK_WORLD.length) + 0.5) * 100),
  };
}
