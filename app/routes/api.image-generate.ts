import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { generateImage } from '~/lib/modules/image/fal-provider';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.image-generate');

/**
 * POST /api/image-generate
 *
 * Body: { prompt: string; width?: number; height?: number }
 * Returns: { url: string; width: number; height: number } or { error: string }
 *
 * Reads FAL_KEY from:
 *  1. Client-side apiKeys cookie (key: "fal")
 *  2. Server env FAL_KEY
 *  3. process.env.FAL_KEY
 */
export async function action({ context, request }: ActionFunctionArgs) {
  try {
    const { prompt, width, height } = await request.json<{
      prompt: string;
      width?: number;
      height?: number;
    }>();

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Resolve FAL_KEY
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);

    const falKey =
      apiKeys?.['fal'] ||
      (context?.cloudflare?.env as Record<string, string>)?.FAL_KEY ||
      process.env.FAL_KEY ||
      '';

    if (!falKey) {
      return Response.json(
        { error: 'FAL_KEY is not configured. Set it in Settings → Cloud Providers or as an environment variable.' },
        { status: 401 },
      );
    }

    logger.info(`Generating image: "${prompt.slice(0, 80)}..." (${width || 1024}x${height || 768})`);

    const result = await generateImage({ prompt, width, height }, falKey);

    return Response.json(result);
  } catch (error: any) {
    logger.error('Image generation failed:', error);
    return Response.json({ error: error.message || 'Image generation failed' }, { status: 500 });
  }
}
