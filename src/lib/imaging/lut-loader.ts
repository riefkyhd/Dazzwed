import { LUTCubeLoader } from "three-stdlib";
import * as THREE from "three";

// In-memory cache of parsed 3D LUT textures to eliminate redundant network/parsing latency
const lutCache = new Map<string, Promise<THREE.Data3DTexture>>();

/**
 * Creates an identity fallback 3D LUT texture (size 16x16x16).
 * Used when a network request fails or before a custom .cube is loaded.
 */
export function createIdentityLUT(size = 16): THREE.Data3DTexture {
  const data = new Float32Array(size * size * size * 4);
  let idx = 0;

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        data[idx++] = x / (size - 1);
        data[idx++] = y / (size - 1);
        data[idx++] = z / (size - 1);
        data[idx++] = 1.0;
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.FloatType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Loads and parses an Adobe .cube 3D LUT file via LUTCubeLoader.
 * Leverages tetrahedral interpolation in WebGL 3D texture samplers.
 */
export async function loadCubeLUT(url: string): Promise<THREE.Data3DTexture> {
  const existing = lutCache.get(url);
  if (existing) return existing;

  const loadPromise = (async () => {
    try {
      const loader = new LUTCubeLoader();
      const lut = await loader.loadAsync(url);
      if (lut.texture3D) {
        return lut.texture3D as THREE.Data3DTexture;
      }
      return createIdentityLUT();
    } catch (err) {
      console.warn(`Failed to load .cube LUT from ${url}, falling back to identity:`, err);
      return createIdentityLUT();
    }
  })();

  lutCache.set(url, loadPromise);
  return loadPromise;
}
