import * as THREE from "three";
import { EffectComposer } from "postprocessing";
import { RenderPass, EffectPass, LUT3DEffect, BloomEffect, NoiseEffect, BlendFunction } from "postprocessing";
import { loadCubeLUT } from "./lut-loader";

export interface RenderThreeOptions {
  width: number;
  height: number;
  lutUrl?: string;
  bloomThreshold?: number;
  bloomIntensity?: number;
  grainAmount?: number;
}

/**
 * Offscreen Three.js / Postprocessing Film Simulation Renderer
 * Renders an image source through 3D LUT tetrahedral interpolation, optical halation bloom, and noise.
 */
export async function renderWithPostProcessing(
  source: TexImageSource,
  options: RenderThreeOptions
): Promise<HTMLCanvasElement> {
  const {
    width,
    height,
    lutUrl,
    bloomThreshold = 0.82,
    bloomIntensity = 0.45,
    grainAmount = 0.12,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 100);
  camera.position.z = 10;

  // Source Texture
  const texture = new THREE.Texture(source as CanvasImageSource);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const composer = new EffectComposer(renderer, {
    multisampling: 0,
    frameBufferType: THREE.HalfFloatType,
  });

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const effects = [];

  // 1. 3D LUT Pass
  if (lutUrl) {
    try {
      const lutTexture = await loadCubeLUT(lutUrl);
      const lutEffect = new LUT3DEffect(lutTexture);
      effects.push(lutEffect);
    } catch (e) {
      console.warn("Failed to load LUT in renderThree:", e);
    }
  }

  // 2. Halation Bloom Pass
  if (bloomIntensity > 0) {
    const bloomEffect = new BloomEffect({
      luminanceThreshold: bloomThreshold,
      luminanceSmoothing: 0.25,
      intensity: bloomIntensity,
      radius: 0.7,
      mipmapBlur: true,
    });
    effects.push(bloomEffect);
  }

  // 3. Procedural Film Grain Noise Pass
  if (grainAmount > 0) {
    const noiseEffect = new NoiseEffect({
      premultiply: true,
    });
    noiseEffect.blendMode.opacity.value = grainAmount;
    effects.push(noiseEffect);
  }

  if (effects.length > 0) {
    const effectPass = new EffectPass(camera, ...effects);
    composer.addPass(effectPass);
  }

  composer.render();

  // Copy to 2D canvas before disposing WebGL renderer context
  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d");
  if (outCtx) {
    outCtx.drawImage(canvas, 0, 0);
  }

  // Dispose GPU memory
  composer.dispose();
  geometry.dispose();
  material.dispose();
  texture.dispose();
  renderer.dispose();
  canvas.width = canvas.height = 0;

  return outCanvas;
}
