# pen.dev prompt — TT Tournaments

Design the complete UI/UX for **TT Tournaments**, a mobile-first table tennis tournament manager.

## Strict scope — follow exactly

Design only the routes, actions, data, and states specified below.

- Do **not** invent pages, fields, workflow steps, navigation items, charts, features, or data.
- Do **not** add marketing pages, onboarding, participant registration, player profiles, user settings, search, filters, notifications, payments, scheduling, court assignments, exports, chat, social features, maps, or a dedicated 404 page.
- Do **not** add a Custom event type. Event types are only **Singles, Doubles, Team, Executive**.
- Do **not** design a desktop sidebar or multi-column desktop dashboard.
- Do **not** add public score-entry controls: public pages are read-only.
- Do **not** use a conventional graphical bracket tree. Knockout brackets are vertical match cards.
- Unknown routes redirect to public home.

This is a focused tournament operations app. Make it intense and premium, but never add UI that is not requested.

---

## Product and visual direction

TT Tournaments lets viewers browse public tournaments and live results. Admins create a tournament, configure divisions, add entries, organize groups, score matches, handle forfeits/no-shows, manually resolve tied group rankings from paper head-to-head results, and generate knockout rounds.

Create a **sporty, striking, bold, fierce, modern, and professional** visual system:

- Competitive table-tennis energy; precise, trustworthy event-management UX
- Bold, high-contrast athletic headline treatment; clean readable body text
- Font: Inter or a similar modern sans-serif
- Primary background: deep dark navy `#071B33` with slightly lighter navy sections such as `#0C2847`
- Primary brand: vivid competition orange `#FF7A00`; use deeper orange `#D95D00` for pressed states and pale orange `#FFF0E1` only on light surfaces
- Use white and cool blue-white text for maximum contrast on navy; use muted steel-blue text for supporting labels
- Surfaces: dark navy cards with subtle blue borders; reserve white cards for focused forms, score entry, or high-priority contrast moments only
- Live status: red dot and red status accent
- Manual-rank and pending warnings: amber/gold
- Winner/success: bright orange or a restrained green confirmation state when it improves semantic clarity
- Strong blue-navy card borders, compact shadows, modern 12–16px radii
- Lightweight table-tennis details are permitted: court lines, speed streaks, ball-circle motifs, subtle diagonal energy shapes
- Decoration must never interfere with standings, scores, forms, or legibility
- Avoid generic SaaS visual language, excessive gradients, glassmorphism, neon, photographs, avatars, and illustration-heavy screens

## Responsive rules

- Design mobile-first around a 390px-wide viewport.
- Single column; centered maximum content width 512px on larger screens.
- No desktop-only navigation, sidebar, or multi-column reflow.
- Public and admin headers are sticky and around 52px high.
- Admin has a fixed bottom navigation with exactly two tabs: **Dashboard** and **New**.
- Primary actions are full-width and touch-friendly.
- Horizontal stage tabs must scroll horizontally.
- Tables must preserve readability and may scroll horizontally.
- Long names truncate safely; chips wrap.

---

# Exact route inventory

Create exactly these page designs:

1. `/` — Public Home
2. `/tournaments/:tournamentId` — Public Tournament Detail
3. `/tournaments/:tournamentId/events/:eventId` — Public Division Detail
4. `/live/:tournamentId/:eventId` — Public Live Standings and Bracket
5. `/admin/login` — Admin Login
6. `/admin` — Admin Dashboard
7. `/admin/tournaments/new` — New Tournament Wizard
8. `/admin/tournaments/:tournamentId` — Admin Tournament Hub
9. `/admin/tournaments/:tournamentId/events/new` — Add Division
10. `/admin/tournaments/:tournamentId/events/:eventId` — Admin Division Management
11. `/admin/admins/new` — Create Admin

Use state variants of these pages only where specified; they are not extra routes.

---

# Shared layouts

## Public layout

Sticky white header:

- Left: **TT Tournaments** (home link)
- Right: **Admin**

Single-column centered main content with generous spacing.

## Admin layout

Sticky emerald header:

- **Admin**
- **Public site** link

Fixed bottom tab bar:

- Dashboard
- New

No other admin navigation destinations.

---

# Public pages

## 1. Public Home — `/`

Purpose: browse publicly visible tournaments.

Content:

- Optional inline red error message
- **Ongoing** section title with small red pulsing dot
- List of ongoing tournament cards
- **Upcoming** section title
- List of upcoming tournament cards

Tournament card:

- Tournament name
- Live or Upcoming status pill
- Up to four division chips
- Date and venue metadata when available
- Entire card is clickable

States:

- Loaded ongoing and upcoming lists
- Empty: “No ongoing tournaments.” and “No upcoming tournaments.”
- Firebase configuration warning: amber inline panel

Do not show Draft or Ended tournaments.

## 2. Public Tournament Detail — `/tournaments/:tournamentId`

Content:

- Back link to home
- Tournament name
- Date and venue metadata
- Section: **Choose a division**
- Clickable division rows

Division row:

- Division name
- Status text and Live/Upcoming pill

Empty state:

- “No public divisions available yet.”

Only Upcoming and Ongoing divisions are visible.

## 3. Public Division Detail — `/tournaments/:tournamentId/events/:eventId`

Content:

- Back link with tournament name
- Division name
- Tag row: event type, category when applicable, status
- Configuration summary card:
  - Entries / max slots
  - Team format for Team divisions only
  - Group layout
  - Group and Final best-of rules
- **Participants (n/max)** list
- Full-width **View live bracket** button only when division status is Ongoing

Participants:

- Singles / Executive: name, organization, optional seeded label
- Doubles: pair name when provided, player A / player B, organization, optional seeded label
- Team: team name, organization, player roster, optional seeded label

Do not add public registration or score entry.

## 4. Public Live — `/live/:tournamentId/:eventId`

Purpose: public, read-only live score viewing.

Top:

- Red live dot
- Tournament name
- Division name
- Append round name when viewing Quarters, Semis, or Final
- Back link to division detail

Stage navigation:

- Horizontally scrollable rounded pill tabs
- Group A, Group B, etc.
- Quarters, Semis, Final when present
- Group tabs can show an amber pending-match count

Group tab:

- Standings table: rank, name, wins, losses, set difference
- Use a stable five-column table grid on every standings view: **# | Player / Team | W | L | +/−**
- Keep rank, W, L, and +/− columns fixed-width with centered, tabular numerals; keep Player / Team as the only flexible left-aligned column
- Right-align or center all numeric values consistently; never mix alignments between rows, headers, or public/admin variants
- Use one-line headers, matching row heights, clear column dividers, and generous horizontal cell padding
- Use `white-space: nowrap` for numeric cells; truncate only long Player / Team names with an ellipsis
- Preserve the exact column order and widths across public and admin standings so viewers and admins read them identically
- On very narrow screens, retain the full table structure inside horizontal scroll; do not stack standings into cards or hide W/L/+− data
- Winner highlight on rank 1
- **Manual ranks** badge when admin overrides rank order
- Optional amber footer:
  - Label: **Why manual ranks?**
  - Admin’s explanation

Knockout tab:

- Vertical list of compact match cards, never a bracket tree graphic
- Two competitors, scores, winner in emerald
- BYE and play-in states
- TBD/waiting states for unfilled slots

Empty:

- “No group or knockout data yet.”

---

# Admin pages

## 5. Admin Login — `/admin/login`

Standalone page; no admin header or bottom nav.

Content:

- Back link: **Public site**
- Centered login card
- **Admin Login** title
- Email input
- Password input
- Full-width **Sign in**
- Loading state: **Signing in…**
- Inline error
- Optional Firebase configuration warning

Do not add sign-up, forgot password, social/OAuth login, or remember-me.

## 6. Admin Dashboard — `/admin`

Content:

- **Dashboard** title
- Sign out text action
- Primary full-width **+ New tournament**
- Secondary text action: **Create admin account**
- **All tournaments** section
- Tournament cards with name, division list, and statuses
- Empty: “No tournaments yet.”

Do not add analytics, filters, search, charts, or activity feeds.

## 7. New Tournament Wizard — `/admin/tournaments/new`

Two steps only.

### Step 1: Tournament details

- Tournament name, required
- Venue
- Start date
- **Next: Add divisions** button, disabled before a name is entered

### Step 2: Add divisions

- **Quick add** preset chips:
  - Singles – U12
  - Singles – U16
  - Singles – U18
  - Singles – Open
  - Doubles – Open
  - Team
  - Executive
- Dashed full-width **+ Add division**
- Empty helper when no divisions exist
- One or more reusable Division Configuration cards
- Back button
- **Create {tournament name}** button
- Inline validation errors

### Division Configuration card

- Division number/title and Remove action
- Event type selector — exactly:
  - Singles
  - Doubles
  - Team
  - Executive
- Category selector for Singles, Doubles, Executive:
  - Under 12
  - Under 16
  - Under 18
  - Open
  - Custom label
- Custom category text field only after Custom label selection
- Optional custom display name
- Maximum entry slots
- Group-layout options showing entries per group and resulting group count
- Advance per group
- Knockout bracket:
  - Cross
  - Block
- Disable Block when group count is odd
- Team-only:
  - roster size: 3 or 4
  - format: SSS, SDS, SSDSS

## 8. Admin Tournament Hub — `/admin/tournaments/:tournamentId`

Content:

- Back link to Dashboard
- Tournament name, venue, date
- Edit action
- Delete action with confirmation state
- Edit panel when Edit is active:
  - Tournament name
  - Venue
  - Start date
  - **Save changes**
- Inline success/error messages
- **Divisions / events** section
- **+ Add division**
- Division rows:
  - Division name
  - Status
  - Link to division management
  - Remove only when Draft

## 9. Add Division — `/admin/tournaments/:tournamentId/events/new`

Content:

- Back link containing tournament name
- **Add division** title
- One Division Configuration card identical to the wizard
- Full-width **Add division**
- Inline validation error

## 10. Admin Division Management — `/admin/tournaments/:tournamentId/events/:eventId`

This is a single route with operational state variants.

### Shared top area

- Back link with tournament name
- Division name
- Status pill; label Ongoing as **Live**
- Caption: Knockout type — Cross or Block
- Inline success and error messages
- Amber warnings for duplicates, organization conflicts, seed conflicts, and group-assignment warnings

### Draft state

- **Delete division** destructive action
- Full-width **Publish**
- Entry management

### Upcoming state

- **Delete division**
- Full-width **Start division**
- Disabled Start state when insufficient entries, duplicates, or invalid layout
- **Ready to start** card:
  - Entries vs slots
  - Layout preview
  - Selectable valid group-layout options
- Entry management

### Entry management

Header: **Add entries (current/max)**

Forms:

**Singles / Executive**

- Player name
- Organization, required
- Seeded selector
- Add entry

**Doubles**

- Pair name, optional
- Player A
- Player B
- Organization
- Seeded selector
- Add entry

**Team**

- Team name
- Organization
- Comma-separated roster
- Seeded selector
- Add entry

Below each form:

- Entry list with name, organization, optional seeded label
- Remove action

Organization is critical. It supports group placement that avoids same-organization matchups where possible and displays conflict warnings when they cannot be avoided.

### Ongoing state — Group stage

- **End division** destructive action
- Horizontal Group/Knockout stage navigator
- Active group standings table
- **To score (n)** pending-match section
- Collapsible **Completed (n)** section with read-only results

#### Match score card

- Competitor A vs Competitor B
- Outcome selector:
  - Normal
  - Forfeit
  - No-show
  - DQ
- For Forfeit / No-show / DQ:
  - **Award win to** selector
  - Plain-language statement naming who is recorded as forfeiting/no-show/DQ
- Normal Singles, Doubles, Executive:
  - Sets-won inputs for both competitors
  - Best-of caption
- Normal Team:
  - Rubber W/L controls based on format
  - SSS: 3 singles
  - SDS: single, doubles, single
  - SSDSS: 5 rubbers
- Full-width **Save result**
- Inline validation errors

Completed results remain read-only. Do not create edit-result controls.

### Manual group ranking state

Visible only after all group matches for that group are completed.

- Card title: **Set group ranks — Group {label}**
- Explain manual paper head-to-head calculations
- Every entry shows:
  - Name
  - W–L
  - Set difference
  - Unique rank dropdown
- **Note for viewers (optional)** text field
- Example note: “Head-to-head on paper — Martin over Bordz”
- **Save ranks**
- **Reset to auto** if a manual rank is saved
- Confirmation copy: knockout uses saved positions

### Knockout generation state

Visible after all group matches are completed:

- Card title: **Knockout stage**
- Explain clearly: knockout is not generated automatically
- Workflow: save manual ranks where needed, then generate
- **Generate knockout bracket**
- When bracket exists but no knockout score exists:
  - **Regenerate knockout from ranks**
- When knockout scoring has started:
  - Inform admin that ranks can no longer update the bracket

### Ongoing state — Knockout scoring

- Active round: Quarters, Semis, Final
- Vertical knockout match cards
- Pending scoring cards using the same scoring interface
- Waiting copy while earlier winners are unknown
- Completion copy after Final: tell admin to end the division

No court schedules, time slots, point-by-point scoring, or result editing.

## 11. Create Admin — `/admin/admins/new`

Content:

- **Create admin** title
- Brief message that Cloud Function/Firebase setup is required
- Email field
- Password field, minimum 8 characters
- Full-width **Create admin**
- Inline success state
- Inline error state

Do not add role selection, invitations, admin lists, profile settings, or permission management.

---

# Component language

Use these recurring components consistently:

- Sticky headers
- Bold page and section titles
- Rounded white cards
- Emerald primary buttons
- Outlined secondary buttons
- Dashed add buttons
- Red destructive actions
- Status pills: Draft, Upcoming, Live, Ended
- Event type/category chips
- Green inline success, red error, amber warnings
- Compact empty states
- Back links with left arrow
- Clearly labeled inputs
- Disabled, loading, focus, selected, hover states
- A shared standings-table component used unchanged across public live and admin division views; it must follow the fixed column alignment rules above

Accessibility requirements:

- WCAG AA contrast
- Visible focus states
- Minimum 44px tap targets on primary controls
- Do not rely only on color for status
- Inputs have persistent labels or accessible names
- Data tables use meaningful headers
- Table headers remain visible and aligned with their data columns during horizontal scrolling

---

# Sample content

Keep sample content consistent across every frame:

- Tournament: **MECTTEL Table Tennis Championship 2026**
- Venue: **MECTTEL Sports Hall**
- Date: **August 15, 2026**
- Divisions:
  - Singles – Open
  - Singles – U18
  - Doubles – Open
  - Team
  - Executive
- Players: Martin Cruz, Bordz Reyes, Noel Santos, Carla Mendoza
- Organizations: MECTTEL, Northspin Club, Metro Paddlers
- Teams: MECTTEL Smashers, Northspin A

Manual-rank example:

- Martin Cruz, Bordz Reyes, Noel Santos each finish 1–1
- Saved order: Martin #1, Bordz #2, Noel #3
- Public note: **“Three-way tie resolved using the official paper head-to-head calculation.”**

---

# Final instruction

Generate a coherent, reusable design system and every listed page.

Include visual variants for:

- Public home: loaded + empty
- Public live: group standings + knockout
- Admin division: Draft, Upcoming, Ongoing group scoring, manual ranking, knockout generation, knockout scoring

Prioritize fast live-event scanning, clear score hierarchy, large touch targets, obvious status, fierce athletic character, and professional tournament credibility.

Create nothing outside this prompt.
