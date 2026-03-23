# Gitea PR Review Exporter - Agent Guide

## Project Purpose
Chrome Extension (Manifest V3) that runs on Gitea pull request pages and helps export review conversations as JSON.

Primary goals:
- Scrape PR conversation blocks from `.ui.segments.conversation-holder`
- Apply user-selected filters (resolved, outdated, last commenter)
- Export selected conversations (copy/download)
- Provide visual validation via `Test Selection`
- Support per-thread quick action via `Copy CR JSON`

## Runtime Architecture
- `manifest.json`
  - MV3 extension config, popup entrypoint, content script registration, icons
- `popup.html`, `popup.js`, `styles.css`
  - Extension UI, filter controls, theme controls, export/test actions
- `content.js`
  - Page-side logic: scraping, filter evaluation, expansion, highlighting, single-thread copy

Message flow:
- Popup -> Content Script
  - `SCRAPE_UNRESOLVED_CONVERSATIONS`
  - `TEST_SELECTION`
  - `GET_DEFAULT_GIT_USERNAME`
- Content Script -> Popup
  - result payloads + status stats

## Data Model (Conversation)
Each exported entry includes:
- `conversationId`
- `filePath`
- `line`
- `outdated`
- `rootComment`
- `comments[]`

Comment fields:
- `id`
- `author`
- `datetime` (ISO when parsed)
- `text`

## Filter Pipeline
Filters are applied in this sequence:
1. resolved filter
2. outdated filter
3. last-comment-by-user filter

Important implication:
- If a thread is excluded by an earlier filter, it will not be counted in later filter skips.

`Test Selection` returns diagnostic stats to clarify this behavior.

## Design System Structure
This project uses a small token-driven UI system in `styles.css`.

### 1) Theme Tokens
Dark-first defaults in `:root`, light overrides in `body.theme-light`.

Token groups:
- Surfaces: `--bg`, `--bg-elev`, `--bg-soft`
- Text: `--fg`, `--muted`
- Brand/Action: `--primary`, `--primary-hover`
- Feedback: `--danger`
- Structure: `--border`, `--ring`

### 2) Theming Modes
Popup supports 3 modes:
- `dark` (default)
- `light`
- `auto` (follows `prefers-color-scheme`)

Persisted with localStorage key:
- `gitea-pr-review-exporter-theme`

### 3) Component Layers
- Header: logo + title + subtitle + theme switch
- Panel: filter section (input + checkboxes)
- Actions: copy/download/test buttons
- Feedback: status/error output block

### 4) Interaction Patterns
- Primary CTA uses green gradient style (`button.primary`)
- Secondary actions use elevated surfaces and border emphasis
- Focus states use `--ring`
- Disabled controls reduce opacity and block interaction

### 5) In-Page Injected UI
Content script injects extension-owned elements with dedicated class names:
- `gpre-highlighted-conversation`
- `gpre-highlight-badge`
- `gpre-copy-single-btn`

Injected styles must:
- avoid broad selectors
- avoid breaking Gitea layout
- prefer `gpre-*` namespace

## URL Scope Rules
Current logic expects PR root URL shape:
- `http(s)://git.../OWNER/REPO/pulls/NUMBER`

Both popup checks and content checks enforce this.

## Contributor Notes
- Use native DOM APIs only (no page jQuery dependency).
- Prefer robust selector fallbacks for Gitea variants.
- Keep filter behavior explicit and observable in `Test Selection` stats.
- When adding UI controls, wire popup -> message options -> content behavior end-to-end.

## Design Context

### Users
Primary users are developers working on Gitea pull requests, especially individual contributors and reviewers. Tech leads and release managers may also use the extension, but design decisions should optimize for frequent IC/reviewer workflows: fast filtering, clear thread state visibility, and low-friction export/copy actions during active code review sessions.

### Brand Personality
Code-friendly, practical, calm. The interface should feel trustworthy and controlled under time pressure, helping users act quickly without visual noise. Tone should remain concise, technical, and neutral.

### Aesthetic Direction
Use a compact, developer-tool visual style with clear hierarchy and minimal ornamentation. Preserve the existing dark-first and light-mode support, with high legibility and strong state signaling. Avoid cartoonish visuals and avoid heavy rounding; use subtle corner radius only where it improves scanability and affordance.

References: none specified.
Anti-references: overly playful/cartoon-like UI, excessively rounded components.

### Design Principles
1. Prioritize confidence and control: every action should be explicit, reversible when possible, and reflected by clear status feedback.
2. Optimize for speed in review flow: minimize clicks, keep controls predictable, and surface essential information first.
3. Preserve calm clarity: reduce visual clutter, keep copy brief, and maintain consistent component behavior across states.
4. Keep a code-tool aesthetic: practical, structured, and technical rather than decorative.
5. Treat accessibility as a core quality bar for popup and injected page controls: keyboard reachability, visible focus, adequate contrast, and non-color-only state cues.
