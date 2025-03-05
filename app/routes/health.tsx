import { json } from '@remix-run/cloudflare';

export function loader() {
  const hasSecret = Boolean(Deno.env.get("SESSION_SECRET") || process.env.SESSION_SECRET);
  
  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      sessionSecret: hasSecret ? 'set' : 'missing',
      // Add other environment checks as needed, but don't expose actual secrets
    }
  });
}

export default function Health() {
  return (
    <div>
      <h1>Health Check</h1>
      <p>Service is running</p>
    </div>
  );
}
