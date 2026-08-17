# Tag X

Tag X is a focused football match-tagging and video-analysis workspace designed for fast manual event collection.

## MVP scope

- Football Manager 26-inspired workspace using the Tag X blue palette
- Match setup and MP4/WebM import flow with keyboard transport controls
- Movable and resizable tagging windows with grid snapping, lock, and reset
- Professional default event types and outcomes
- Click-to-tag pitch coordinates and recent event log
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

Create a Supabase project, run `supabase/schema.sql` in the SQL editor, and add the project URL and anon key to `.env.local` using `.env.example` as the template. The current interface is a functional front-end prototype; wiring these credentials is the final step for durable teams, rosters, matches, events, and video metadata.
