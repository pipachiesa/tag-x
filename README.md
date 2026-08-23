# Tag X

Tag X is a focused football match-tagging and video-analysis workspace designed for fast manual event collection.

## MVP scope

- Minimal Codex-inspired workspace using the Tag X palette
- Match setup and MP4/WebM import flow with compact playback controls
- Playback speeds from 0.25× to 2×, Space for play/pause, and Left/Right arrows to seek 5 seconds
- Movable and resizable tagging windows with grid snapping, lock, and reset
- Professional default event types and outcomes
- Responsive pitch with click-to-place and press-drag event paths
- Optional in-workspace controls for phase analysis, goal frame, notes, and clips
- Reusable team and roster library concept
- Illustrator workspace for tactical annotations
- Responsive desktop and mobile layouts

## Run locally

```bash
npm install
npm run dev
```

## Supabase

Tag X persists each signed-in user's sessions, events, team library, playlists, clips, and illustration metadata through the server-only `/api/workspace` endpoint.

1. Create a Supabase project.
2. Link the local project with `supabase link --project-ref <project-ref>`.
3. Apply the migration with `supabase db push`.
4. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server environment variables, following `.env.example`.

Never expose the service-role key in browser code or prefix it with `NEXT_PUBLIC_`. If Supabase is not configured, Tag X continues working with its local-device fallback and clearly labels the workspace as local.
