/**
 * fal.ai Image Generation Provider — C2
 *
 * Wraps the fal.ai FLUX Schnell API for fast image generation.
 * Used by the /api/image-generate route.
 */

export interface ImageGenerationRequest {
  prompt: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationResult {
  url: string;
  width: number;
  height: number;
}

/**
 * Generate an image via fal.ai FLUX Schnell.
 *
 * @throws {Error} On non-OK HTTP response or missing image data.
 */
export async function generateImage(
  request: ImageGenerationRequest,
  apiKey: string,
): Promise<ImageGenerationResult> {
  const width = request.width || 1024;
  const height = request.height || 768;

  const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: request.prompt,
      image_size: { width, height },
      num_images: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`fal.ai error ${response.status}: ${body || response.statusText}`);
  }

  const data = (await response.json()) as {
    images?: { url: string; width: number; height: number }[];
  };

  if (!data.images?.length) {
    throw new Error('fal.ai returned no images');
  }

  return {
    url: data.images[0].url,
    width: data.images[0].width,
    height: data.images[0].height,
  };
}
