// Build-time constants injected by Vite `define` (see vite.config.ts).
// They stamp each deploy so the "Latest Update" banner is live, not hardcoded.
declare const __BUILD_TIME__: string;   // ISO timestamp of the production build
declare const __GIT_COMMIT__: string;   // subject line of the deployed commit
declare const __GIT_SHA__: string;      // short SHA of the deployed commit
