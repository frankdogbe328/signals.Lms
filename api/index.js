// Re-export the catch-all handler so /api/... requests resolve either via
// Vercel's catch-all filesystem convention (api/[...path].js) or via the
// legacy rewrite path that landed on /api. Keeps a single source of truth
// in api/[...path].js while ensuring the endpoint is reachable regardless
// of how the platform interprets routing.
export { default } from './[...path].js';
