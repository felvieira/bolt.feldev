import React, { useState, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';

interface ImageGenerateButtonProps {
  /** Whether FAL_KEY is available (controls visibility) */
  isAvailable: boolean;
  /** Callback when an image is generated — receives markdown to insert into chat */
  onImageGenerated?: (markdownSnippet: string) => void;
  disabled?: boolean;
}

type ImageSize = 'landscape' | 'square' | 'portrait';

const SIZE_PRESETS: Record<ImageSize, { width: number; height: number; label: string }> = {
  landscape: { width: 1024, height: 768, label: 'Landscape (1024x768)' },
  square: { width: 1024, height: 1024, label: 'Square (1024x1024)' },
  portrait: { width: 768, height: 1024, label: 'Portrait (768x1024)' },
};

export const ImageGenerateButton: React.FC<ImageGenerateButtonProps> = ({
  isAvailable,
  onImageGenerated,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>('landscape');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('Please enter an image description');
      return;
    }

    setIsGenerating(true);
    setPreviewUrl(null);

    try {
      const { width, height } = SIZE_PRESETS[size];
      const response = await fetch('/api/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), width, height }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Image generation failed');
      }

      setPreviewUrl(data.url);
      toast.success('Image generated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, size]);

  const handleUseInProject = useCallback(() => {
    if (previewUrl && onImageGenerated) {
      onImageGenerated(
        `Use this generated image in the project:\n![Generated image](${previewUrl})\n\nImage prompt: "${prompt}"`,
      );
    }

    setIsOpen(false);
    setPrompt('');
    setPreviewUrl(null);
  }, [previewUrl, prompt, onImageGenerated]);

  if (!isAvailable) {
    return (
      <IconButton title="Image generation requires FAL_KEY — set it in Settings or .env" disabled className="opacity-40">
        <div className="i-ph:image text-xl" />
      </IconButton>
    );
  }

  return (
    <div className="relative">
      <IconButton
        title="Generate image with AI"
        disabled={disabled}
        className="transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="i-ph:image text-xl" />
      </IconButton>

      {isOpen && (
        <div
          className={classNames(
            'absolute bottom-full left-0 mb-2 w-80',
            'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
            'rounded-lg shadow-lg p-4 z-50',
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary">AI Image Generation</h4>
            <button
              onClick={() => {
                setIsOpen(false);
                setPreviewUrl(null);
              }}
              className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
            >
              <div className="i-ph:x text-lg" />
            </button>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to generate..."
            className={classNames(
              'w-full h-20 px-3 py-2 rounded-md text-sm resize-none',
              'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
            )}
          />

          <div className="flex gap-2 mt-2">
            {(Object.keys(SIZE_PRESETS) as ImageSize[]).map((key) => (
              <button
                key={key}
                onClick={() => setSize(key)}
                className={classNames(
                  'flex-1 px-2 py-1 rounded text-xs transition-colors',
                  size === key
                    ? 'bg-purple-500 text-white'
                    : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={classNames(
              'w-full mt-3 px-4 py-2 rounded-md text-sm font-medium transition-all',
              'bg-purple-500 text-white hover:bg-purple-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="i-svg-spinners:90-ring-with-bg text-sm animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </button>

          {previewUrl && (
            <div className="mt-3">
              <img
                src={previewUrl}
                alt="Generated preview"
                className="w-full rounded-md border border-bolt-elements-borderColor"
              />
              <button
                onClick={handleUseInProject}
                className={classNames(
                  'w-full mt-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  'bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary',
                  'hover:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor',
                )}
              >
                Use in Project
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
