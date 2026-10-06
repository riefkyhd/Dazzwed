"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, LUT, Bloom, Noise } from "@react-three/postprocessing";
import * as THREE from "three";
import { loadCubeLUT, createIdentityLUT } from "@/lib/imaging/lut-loader";

export interface FilmSimulationProps {
  /** Source image URL, Blob, File, or ImageBitmap */
  imageSrc: string | Blob | File;
  /** Path to the .cube LUT file (e.g. "/luts/fuji-classic-neg.cube") */
  lutUrl?: string;
  /** Bloom halation intensity (0.0 to 1.0) */
  halationIntensity?: number;
  /** Bloom luminance threshold (typically > 0.82) */
  halationThreshold?: number;
  /** Procedural silver-halide film grain amount (0.0 to 1.0) */
  grainAmount?: number;
  /** Optional callback when texture is loaded and ready */
  onReady?: (dimensions: { width: number; height: number }) => void;
  className?: string;
}

export interface FilmSimulationHandle {
  /**
   * Extracts the processed WebGL canvas as a high-resolution JPEG Blob.
   * Can be passed directly into an existing 2D composite pass for date stamps and frames.
   */
  exportProcessedBlob: (quality?: number) => Promise<Blob>;
}

/**
 * Inner Plane component:
 * Fits the texture onto an orthographic plane matching its aspect ratio.
 */
function ImagePlane({
  texture,
  onReady,
}: {
  texture: THREE.Texture | null;
  onReady?: (dim: { width: number; height: number }) => void;
}) {
  const { viewport } = useThree();

  if (!texture || !texture.image) return null;

  const img = texture.image as { width?: number; height?: number };
  const width = img.width || 1;
  const height = img.height || 1;

  useEffect(() => {
    if (texture && texture.image) {
      onReady?.({
        width,
        height,
      });
    }
  }, [texture, onReady, width, height]);

  const imageAspect = width / height;
  const viewportAspect = viewport.width / viewport.height;

  let planeWidth = viewport.width;
  let planeHeight = viewport.height;

  if (imageAspect > viewportAspect) {
    planeHeight = viewport.width / imageAspect;
  } else {
    planeWidth = viewport.height * imageAspect;
  }

  return (
    <mesh>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * GPU-Accelerated Film Simulation Component (R3F + WebGL Post-Processing)
 *
 * Capabilities:
 * - Flat Orthographic Texture Plane (zero perspective distortion)
 * - 3D LUT (.cube) pass with tetrahedral interpolation
 * - Optical Halation Bloom for highlight roll-off and light bleed
 * - Hardware procedural Noise for organic film grain
 * - High-Res JPEG extraction with preserveDrawingBuffer
 */
export const FilmSimulationCanvas = forwardRef<FilmSimulationHandle, FilmSimulationProps>(
  function FilmSimulationCanvas(
    {
      imageSrc,
      lutUrl,
      halationIntensity = 0.5,
      halationThreshold = 0.82,
      grainAmount = 0.12,
      onReady,
      className,
    },
    ref
  )
{
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [lutTexture, setLutTexture] = useState<THREE.Data3DTexture | null>(null);

  // 1. Load image as WebGL Texture
  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    const loadTexture = async () => {
      let url: string;
      if (typeof imageSrc === "string") {
        url = imageSrc;
      } else {
        url = URL.createObjectURL(imageSrc);
        objectUrlToRevoke = url;
      }

      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (loadedTex) => {
          if (!active) return;
          loadedTex.generateMipmaps = false;
          loadedTex.minFilter = THREE.LinearFilter;
          loadedTex.magFilter = THREE.LinearFilter;
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.needsUpdate = true;
          setTexture(loadedTex);
        },
        undefined,
        (err) => {
          console.error("FilmSimulationCanvas: Texture load failed", err);
        }
      );
    };

    void loadTexture();

    return () => {
      active = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [imageSrc]);

  // 2. Load 3D .cube LUT file
  useEffect(() => {
    let active = true;
    if (!lutUrl) {
      setLutTexture(createIdentityLUT());
      return;
    }

    void loadCubeLUT(lutUrl).then((lut) => {
      if (active) setLutTexture(lut);
    });

    return () => {
      active = false;
    };
  }, [lutUrl]);

  // 3. Expose imperative high-res extraction handle
  useImperativeHandle(ref, () => ({
    exportProcessedBlob: (quality = 0.95): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          reject(new Error("FilmSimulationCanvas: Canvas not ready for export"));
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("FilmSimulationCanvas: Failed to encode JPEG"));
          },
          "image/jpeg",
          quality
        );
      });
    },
  }));

  // Fallback identity if LUT is loading
  const activeLut = useMemo(() => lutTexture || createIdentityLUT(), [lutTexture]);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className || ""}`}>
      <Canvas
        ref={canvasRef}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: false,
          powerPreference: "high-performance",
          alpha: false,
        }}
        className="w-full h-full"
      >
        {/* Flat 2D Texture Plane */}
        <ImagePlane texture={texture} onReady={onReady} />

        {/* Post-Processing Pipeline */}
        <EffectComposer enableNormalPass={false} multisampling={0}>
          {/* 3D LUT Tetrahedral Interpolation */}
          {activeLut && <LUT lut={activeLut} />}

          {/* Optical Halation Bloom */}
          {halationIntensity > 0 && (
            <Bloom
              luminanceThreshold={halationThreshold}
              luminanceSmoothing={0.25}
              intensity={halationIntensity}
              radius={0.7}
              mipmapBlur
            />
          )}

          {/* Hardware Procedural Silver-Halide Grain */}
          {grainAmount > 0 && <Noise opacity={grainAmount} premultiply />}
        </EffectComposer>
      </Canvas>
    </div>
  );
});
