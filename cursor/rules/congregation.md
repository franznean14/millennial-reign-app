Congregation Management Rules

1) Access
- Show the "Congregation" nav item only for users who are elders (profile.congregation_role == 'elder') or app admins (is_admin(uid) == true).
- Creating a congregation is restricted to admins; editing an existing congregation is allowed for admins or elders of that congregation.

2) UX Structure
- If a congregation exists for the current user, default to a read-only view with labeled fields and an "Edit" button (if the user can edit).
- If no congregation exists, show the creation form (admin only).

3) Form Layout
- Keep day pickers (Select) for both midweek and weekend.
- Place day and time on the same line (two-column layout on >= sm screens).
- Meeting duration is not editable; rely on backend default.
- Include optional GPS latitude/longitude fields to enable a "Get directions" action.

4) Directions
- Compute Google Maps link from GPS coordinates when available; otherwise fall back to the address string.

5) Offline-first
- Do not block rendering if offline; hydrate Supabase session client-side and fetch via RPCs when online.
- Respect RLS and server-side security; all mutations go through Supabase with existing policies.

