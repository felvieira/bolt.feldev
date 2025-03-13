import express from 'express';
import { useLoaderData } from '@remix-run/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

// Use type em vez de importação direta
type Request = express.Request;
type Response = express.Response;

const PREVIEW_CHANNEL = 'preview-updates';

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server-only modules
  const { json } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    const previewId = request.params.id;

    if (!previewId) {
      return json({ error: 'Preview ID is required' }, { status: 400 });
    }

    return json({ previewId });
  });
  
  return handler(args.context, args.request, args.context.res);
};

export default function WebContainerPreview() {
  // Note: The client-side component can remain mostly unchanged as it uses React hooks
  const { previewId } = useLoaderData<{ previewId: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel>();
  const [previewUrl, setPreviewUrl] = useState('');

  // Handle preview refresh
  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      // Force a clean reload
      iframeRef.current.src = '';
      requestAnimationFrame(() => {
        if (iframeRef.current) {
          iframeRef.current.src = previewUrl;
        }
      });
    }
  }, [previewUrl]);

  // Notify other tabs that this preview is ready
  const notifyPreviewReady = useCallback(() => {
    if (broadcastChannelRef.current && previewUrl) {
      broadcastChannelRef.current.postMessage({
        type: 'preview-ready',
        previewId,
        url: previewUrl,
        timestamp: Date.now(),
      });
    }
  }, [previewId, previewUrl]);

  useEffect(() => {
    // Initialize broadcast channel
    broadcastChannelRef.current = new BroadcastChannel(PREVIEW_CHANNEL);

    // Listen for preview updates
    broadcastChannelRef.current.onmessage = (event) => {
      if (event.data.previewId === previewId) {
        if (event.data.type === 'refresh-preview' || event.data.type === 'file-change') {
          handleRefresh();
        }
      }
    };

    // Construct the WebContainer preview URL
    const url = `https://${previewId}.local-credentialless.webcontainer-api.io`;
    setPreviewUrl(url);

    // Set the iframe src
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    // Notify other tabs that this preview is ready
    notifyPreviewReady();

    // Cleanup
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [previewId, handleRefresh, notifyPreviewReady]);

  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        title="WebContainer Preview"
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
        allow="cross-origin-isolated"
        loading="eager"
        onLoad={notifyPreviewReady}
      />
    </div>
  );
}
