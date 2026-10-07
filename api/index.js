// api/index.js — Vercel Serverless entry point.
//
// Vercel hands a Node (req, res) pair to the default export of the file
// matching the inbound route. We delegate straight to the existing
// pure-Node dispatcher in server/src/index.js — no framework, no deps.
//
// On Vercel, every request runs in a fresh lambda invocation. There is
// no long-lived TCP socket, no in-memory sticky state between calls.
// State lives in Supabase. The Market SSE stream (`/market/stream/...`)
// is intentionally dropped by Vercel after ~25s on the Hobby tier;
// the client already falls back to REST polling when the stream closes,
// so this is a graceful degradation, not a regression.

import { createApp } from '../server/src/index.js';

// Build the app once per cold start. Supabase config comes from env vars
// (Vercel project settings). PORT is ignored on Vercel — Vercel
// provides the listener — but kept here so the local server still runs.
const { app } = createApp();

export default async function handler(req, res) {
  // Vercel handles OPTIONS preflight at the edge, but if a request
  // sneaks through without that, the dispatcher still sets CORS
  // headers via setCors().
  return app.dispatch(req, res);
}

// Avoid leaking Vercel's auto-added x-powered-by: Vercel header.
export const config = {
  api: {
    bodyParser: false,
  },
};