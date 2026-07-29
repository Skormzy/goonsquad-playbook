import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyProductionUniformMaterials,
  classifyProductionRigPart,
  getProductionUniformMaterial,
  hideProductionRigParts,
} from './playerRigMaterials';

function fakeRoot(children) {
  return {
    traverse(callback) {
      children.forEach(callback);
    },
  };
}

function fakeMesh(name, materialName = name) {
  return {
    isMesh: true,
    name,
    material: new THREE.MeshStandardMaterial({ name: materialName, color: '#ffffff' }),
  };
}

function fakeMultiMaterialMesh(name, materialNames) {
  return {
    isSkinnedMesh: true,
    name,
    material: materialNames.map((materialName) => (
      new THREE.MeshStandardMaterial({ name: materialName, color: '#ffffff' })
    )),
  };
}

describe('player rig materials', () => {
  it('classifies production rig mesh names into equipment parts', () => {
    expect(classifyProductionRigPart('home_jersey_mesh')).toBe('jersey');
    expect(classifyProductionRigPart('jersey_uniform_top_left_sleeve')).toBe('jerseySleeve');
    expect(classifyProductionRigPart('jersey_uniform_top_forearm_sleeve_left')).toBe('compressionSleeve');
    expect(classifyProductionRigPart('runner_compression_sleeve_right')).toBe('compressionSleeve');
    expect(classifyProductionRigPart('compression_sleeve_upperarm_left')).toBe('compressionSleeve');
    expect(classifyProductionRigPart('shoulder_elbow_pad_left_shoulder')).toBe('runnerArmPad');
    expect(classifyProductionRigPart('shoulder_elbow_pad_right_elbow_upper_strap')).toBe('equipmentStrap');
    expect(classifyProductionRigPart('shoulder_elbow_pad_right_elbow_upper_strap', 'equipment_strap')).toBe('equipmentStrap');
    expect(classifyProductionRigPart('glove_mitt_left_palm_grip_pad')).toBe('gloveGripTape');
    expect(classifyProductionRigPart('glove_mitt_right_wrist_tape', 'glove_grip_tape')).toBe('gloveGripTape');
    expect(classifyProductionRigPart('jersey_uniform_top_left_underarm_gusset')).toBe('underarmGusset');
    expect(classifyProductionRigPart('mesh', 'jersey_underarm_gusset')).toBe('underarmGusset');
    expect(classifyProductionRigPart('jersey_uniform_top_collar')).toBe('jerseyAccent');
    expect(classifyProductionRigPart('jersey_uniform_top_shoulder_yoke')).toBe('jerseyYoke');
    expect(classifyProductionRigPart('jersey_uniform_top_waist_band')).toBe('jerseyAccent');
    expect(classifyProductionRigPart('jersey_uniform_top_left_sleeve_cuff')).toBe('jerseyAccent');
    expect(classifyProductionRigPart('mesh', 'uniform_accent')).toBe('jerseyAccent');
    expect(classifyProductionRigPart('sock_shin_guard_left_stripe', 'uniform_accent')).toBe('jerseyAccent');
    expect(classifyProductionRigPart('shoe_footwear_left_sole', 'uniform_accent')).toBe('jerseyAccent');
    expect(classifyProductionRigPart('helmet_cage_visor_shell', 'helmet_cage_visor')).toBe('helmetShell');
    expect(classifyProductionRigPart('neck_guard_collar', 'neck_guard_collar')).toBe('neckGuard');
    expect(classifyProductionRigPart('helmet_cage_visor_chin_strap_left', 'neck_guard_collar')).toBe('neckGuard');
    expect(classifyProductionRigPart('helmet_cage_visor_bar_-0.04', 'helmet_cage_visor_wire')).toBe('visor');
    expect(classifyProductionRigPart('goalie_leg_pad_left')).toBe('pad');
    expect(classifyProductionRigPart('stick_blade_tape')).toBe('stickBlade');
    expect(classifyProductionRigPart('plain_body_mesh')).toBe('default');
  });

  it('builds Goon Squad uniform material settings from player uniforms', () => {
    const player = {
      team: 'us',
      uniform: {
        jersey: '#f8fafc',
        stripe: '#1d4ed8',
        shorts: '#0f172a',
        helmet: '#f8fafc',
      },
    };

    expect(getProductionUniformMaterial('jersey', player).color).toBe('#f8fafc');
    expect(getProductionUniformMaterial('stripe', player).color).toBe('#1d4ed8');
    expect(getProductionUniformMaterial('glove', player).color).toBe('#0f172a');
    expect(getProductionUniformMaterial('shoe', player).color).toBe('#0f172a');
    expect(getProductionUniformMaterial('jersey', player).texture).toBe('jersey-knit');
    expect(getProductionUniformMaterial('sock', player).texture).toBe('sock-rib');
  });

  it('uses broadcast-readable sleeve and glove contrast instead of pale arms washing into the court', () => {
    const home = {
      team: 'us',
      uniform: {
        jersey: '#f8fafc',
        stripe: '#1d4ed8',
        shorts: '#0f172a',
        helmet: '#f8fafc',
      },
    };
    const away = {
      team: 'opponent',
      uniform: {
        jersey: '#dc2626',
        stripe: '#fee2e2',
        shorts: '#111827',
        helmet: '#dc2626',
      },
    };

    expect(getProductionUniformMaterial('jerseySleeve', home).color).toBe('#dbeafe');
    expect(getProductionUniformMaterial('jerseySleeve', home).roughness).toBeLessThanOrEqual(0.64);
    expect(getProductionUniformMaterial('jerseySleeve', away).color).toBe('#b91c1c');
    expect(getProductionUniformMaterial('compressionSleeve', home).color).toBe('#1d4ed8');
    expect(getProductionUniformMaterial('compressionSleeve', away).color).toBe('#b91c1c');
    expect(getProductionUniformMaterial('compressionSleeve', home).texture).toBe('jersey-knit');
    expect(getProductionUniformMaterial('glove', home).color).toBe('#0f172a');
    expect(getProductionUniformMaterial('glove', away).color).toBe('#0f172a');
    expect(getProductionUniformMaterial('runnerArmPad', home).color).toBe('#111827');
    expect(getProductionUniformMaterial('runnerArmPad', away).color).toBe('#111827');
    expect(getProductionUniformMaterial('runnerArmPad', home).texture).toBe('equipment-grain');
    expect(getProductionUniformMaterial('equipmentStrap', home).color).toBe('#020617');
    expect(getProductionUniformMaterial('equipmentStrap', home).texture).toBe('equipment-grain');
    expect(getProductionUniformMaterial('gloveGripTape', home).color).toBe('#020617');
    expect(getProductionUniformMaterial('gloveGripTape', home).texture).toBe('grip-tape');
    expect(getProductionUniformMaterial('underarmGusset', home).color).toBe('#111827');
    expect(getProductionUniformMaterial('underarmGusset', home).texture).toBe('jersey-knit');
    expect(getProductionUniformMaterial('jerseyAccent', home).color).toBe('#1d4ed8');
    expect(getProductionUniformMaterial('jerseyAccent', away).color).toBe('#fee2e2');
    expect(getProductionUniformMaterial('jerseyAccent', home).texture).toBe('stripe-weave');
    expect(getProductionUniformMaterial('helmetShell', home).color).toBe('#f8fafc');
    expect(getProductionUniformMaterial('helmetShell', away).color).toBe('#dc2626');
    expect(getProductionUniformMaterial('helmetShell', home).roughness).toBeLessThanOrEqual(0.28);
    expect(getProductionUniformMaterial('neckGuard', home).color).toBe('#020617');
    expect(getProductionUniformMaterial('neckGuard', home).metalness).toBeLessThanOrEqual(0.03);
    expect(getProductionUniformMaterial('neckGuard', home).roughness).toBeGreaterThanOrEqual(0.6);
    expect(getProductionUniformMaterial('neckGuard', home).texture).toBe('equipment-grain');
    expect(getProductionUniformMaterial('jerseyYoke', home).color).toBe('#1d4ed8');
    expect(getProductionUniformMaterial('jerseyYoke', away).color).toBe('#fee2e2');
    expect(getProductionUniformMaterial('jerseyYoke', home).texture).toBe('stripe-weave');
    expect(getProductionUniformMaterial('pad', home).color).toBe('#f8fafc');
  });

  it('clones and applies materials without mutating the source material object', () => {
    const jersey = fakeMesh('runner_jersey');
    const originalMaterial = jersey.material;
    const stick = fakeMesh('stick_blade');
    const root = fakeRoot([jersey, stick]);

    const counts = applyProductionUniformMaterials(root, {
      team: 'opponent',
      uniform: {
        jersey: '#b91c1c',
        stripe: '#fee2e2',
        shorts: '#111827',
        helmet: '#dc2626',
      },
    });

    expect(counts).toEqual({ jersey: 1, stickBlade: 1 });
    expect(jersey.material).not.toBe(originalMaterial);
    expect(jersey.material.color.getHexString()).toBe('b91c1c');
    expect(stick.material.color.getHexString()).toBe('ef4444');
    expect(originalMaterial.color.getHexString()).toBe('ffffff');
  });

  it('keeps imported player meshes from casting floor shadows that read as floating gaps', () => {
    const jersey = fakeMesh('runner_jersey');
    const shoe = fakeMesh('runner_shoe_footwear_left');
    const root = fakeRoot([jersey, shoe]);

    applyProductionUniformMaterials(root, {
      team: 'us',
      uniform: {
        jersey: '#f8fafc',
        stripe: '#1d4ed8',
        shorts: '#0f172a',
        helmet: '#f8fafc',
      },
    });

    expect(jersey.castShadow).toBe(false);
    expect(jersey.receiveShadow).toBe(false);
    expect(shoe.castShadow).toBe(false);
    expect(shoe.receiveShadow).toBe(false);
  });

  it('classifies multi-material skinned body slots independently', () => {
    const body = fakeMultiMaterialMesh('CC_Base_Body', [
      'skin_body',
      'compression_sleeve_skinned_arm',
    ]);
    const root = fakeRoot([body]);

    const counts = applyProductionUniformMaterials(root, {
      team: 'us',
      uniform: {
        jersey: '#f8fafc',
        stripe: '#1d4ed8',
        shorts: '#0f172a',
        helmet: '#f8fafc',
      },
    });

    expect(counts).toEqual({ compressionSleeve: 1 });
    expect(body.material[0].color.getHexString()).toBe('ffffff');
    expect(body.material[1].color.getHexString()).toBe('1d4ed8');
  });

  it('keeps neck guards and chin straps in dark equipment material instead of glossy cage material', () => {
    const collar = fakeMesh('neck_guard_collar', 'neck_guard_collar');
    const chinStrap = fakeMesh('helmet_cage_visor_chin_strap_left', 'neck_guard_collar');
    const cageWire = fakeMesh('helmet_cage_visor_bar_0.04', 'helmet_cage_visor_wire');
    const root = fakeRoot([collar, chinStrap, cageWire]);

    const counts = applyProductionUniformMaterials(root, {
      team: 'us',
      uniform: {
        jersey: '#f8fafc',
        stripe: '#1d4ed8',
        shorts: '#0f172a',
        helmet: '#f8fafc',
      },
    });

    expect(counts).toEqual({ neckGuard: 2, visor: 1 });
    expect(collar.material.color.getHexString()).toBe('020617');
    expect(chinStrap.material.color.getHexString()).toBe('020617');
    expect(chinStrap.material.roughness).toBeGreaterThan(cageWire.material.roughness);
  });

  it('can hide imported stick meshes when replay supplies the controlled sport-specific stick', () => {
    const stick = fakeMesh('runner_stick_shaft');
    const blade = fakeMesh('runner_stick_blade_tape');
    const jersey = fakeMesh('runner_jersey');
    const root = fakeRoot([stick, blade, jersey]);

    const counts = hideProductionRigParts(root, ['stick', 'stickBlade']);

    expect(counts).toEqual({ stick: 1, stickBlade: 1 });
    expect(stick.visible).toBe(false);
    expect(blade.visible).toBe(false);
    expect(jersey.visible).toBeUndefined();
  });
});
