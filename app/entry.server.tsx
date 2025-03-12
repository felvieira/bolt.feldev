export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
  loadContext
) {
  // Environment setup code remains the same...

  const head = renderHeadToString({ request, remixContext, Head });
  
  return new Promise((resolve, reject) => {
    const { pipe, abort } = ReactDOMServer.renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady() {
          responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
          responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
          
          // Create a new writable stream
          const { readable, writable } = new TransformStream();

          // Write the doctype and head
          const writer = writable.getWriter();
          writer.write(new TextEncoder().encode('<!DOCTYPE html>\n'));
          writer.write(new TextEncoder().encode(`<html lang="en" data-theme="${themeStore.value}">\n`));
          writer.write(new TextEncoder().encode(`<head>${head}</head>`));
          writer.write(new TextEncoder().encode('<body><div id="root" class="w-full h-full">'));
          
          // Release the writer so the pipe can take over
          writer.releaseLock();
          
          // Pipe the React app content
          pipe(writable);
          
          // Create the response with the readable part of the transform stream
          const response = new Response(readable, {
            headers: responseHeaders,
            status: responseStatusCode,
          });
          
          resolve(response);
        },
        onShellError(error) {
          console.error('Shell error:', error);
          reject(new Response('Server Error', { status: 500 }));
        },
        onError(error) {
          console.error('Rendering error:', error);
          // We don't reject here because the shell might already be sent
        },
      }
    );
  });
}
