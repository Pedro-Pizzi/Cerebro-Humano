---
name: Cérebro Dashboard
description: Neural console for monitoring and controlling a WhatsApp AI persona — clean, focused, quiet.
colors:
  cortex-blue: "#4A8FD4"
  cortex-blue-hover: "#5A9FDE"
  neural-black: "#1A1C20"
  neural-gray: "#202226"
  neural-gray-raised: "#26282C"
  border-subtle: "#3E4046"
  border-hover: "#505258"
  text-primary: "#EBEBEB"
  text-secondary: "#8E9098"
  text-tertiary: "#5C5E66"
  success-green: "#3DA87A"
  warning-amber: "#C48A30"
  error-red: "#C94A3A"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
  5xl: "48px"
  6xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.cortex-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.cortex-blue-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.neural-gray}"
    textColor: "{colors.text-primary}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.neural-gray}"
    textColor: "{colors.text-primary}"
  input:
    backgroundColor: "{colors.neural-black}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.neural-gray}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Cérebro Dashboard

## 1. Overview

**Creative North Star: "The Neural Console"**

A direct neural link to your WhatsApp AI. Information-dense but never cluttered. Surgical precision without clinical coldness. The dashboard feels like a tool a neuroscientist would build to monitor a synthetic mind — every signal has a place, every control has a clear purpose.

This is a **product dashboard**, not a brand surface. Design serves the task: monitoring conversations, managing permissions, editing persona. The interface should disappear into the work. Personality comes from restraint, not decoration.

The system explicitly rejects: cyberpunk neon aesthetics (no glow, no scanlines, no glassmorphism), generic SaaS dashboard templates (no cream backgrounds, no blue-gradient hero cards, no identical metric grids), and AI-generation clichés (no gradient text, no side-stripe borders, no eyebrow kickers above every section).

**Key Characteristics:**
- Single accent (Cortex Blue) used on ≤10% of any screen — its rarity is the point
- Tonal layering over shadow: surfaces distinguished by lightness steps (0.145 → 0.175 → 0.20), not drop shadows
- Fixed type scale (1.125 ratio, 7 steps from 0.75rem to 1.75rem) — no fluid clamp headings in product UI
- One font family (Inter) for everything — product UI doesn't need display/body pairing
- 4px spatial grid with semantic spacing variables
- 120–250ms transitions, instant on reduced motion preference

## 2. Colors

A restrained dark palette built in OKLCH. One accent (Cortex Blue) carries all primary actions, current selections, and active state indicators. Neutrals are tinted 0.006–0.008 chroma toward 260° (cool undertone) to avoid pure-gray flatness. Semantic colors (success, warning, error) are muted enough to sit alongside the accent without competing.

### Primary
- **Cortex Blue** (#4A8FD4, canonical `oklch(0.62 0.15 250)`): Primary buttons, toggle switches (checked), focus rings, active nav items, links, processing indicators. The only saturated color on the screen. Used sparingly — a processing badge here, a nav highlight there, never as decoration.

### Neutral
- **Neural Black** (#1A1C20, canonical `oklch(0.145 0.008 260)`): Page background, input backgrounds, code areas. The deepest surface.
- **Neural Gray** (#202226, canonical `oklch(0.175 0.008 260)`): Card backgrounds, hover states for secondary elements, sidebar. The default "raised" surface.
- **Neural Gray Raised** (#26282C, canonical `oklch(0.20 0.008 260)`): Overlay surfaces, thought card backgrounds (processing state), badge neutral backgrounds.
- **Border Subtle** (#3E4046, canonical `oklch(0.30 0.006 260)`): Default borders on cards, inputs, tables, dividers. Visible but never prominent.
- **Border Hover** (#505258, canonical `oklch(0.36 0.006 260)`): Borders on hover. Slightly lighter to signal interactivity.
- **Text Primary** (#EBEBEB, canonical `oklch(0.92 0 0)`): Headings, body text, active nav labels, table content. High contrast against all surfaces.
- **Text Secondary** (#8E9098, canonical `oklch(0.62 0.006 260)`): Descriptions, help text, secondary nav labels, inactive states. Muted but legible.
- **Text Tertiary** (#5C5E66, canonical `oklch(0.42 0.006 260)`): Placeholders, timestamps, metadata, empty state descriptions. Lowest contrast tier.

### Semantic
- **Success Green** (#3DA87A, canonical `oklch(0.62 0.14 160)`): Online indicators, sent message confirmations, success badges. Used on status dots and badge text; never as a button color.
- **Warning Amber** (#C48A30, canonical `oklch(0.70 0.12 85)`): Attention-grabbing states. Currently reserved for future use.
- **Error Red** (#C94A3A, canonical `oklch(0.55 0.18 25)`): API failure indicators, error badges, destructive action hover. Paired with subtle red tint backgrounds (`oklch(0.22 0.04 25)`).

### Named Rules
**The One Accent Rule.** Cortex Blue appears on ≤10% of any given screen. If more than three elements on screen are blue, something is wrong. The accent's power comes from scarcity.

**The Tonal Depth Rule.** Surfaces are distinguished by lightness steps, not shadows. Neural Black → Neural Gray → Neural Gray Raised. A 1px border marks boundaries. Shadows exist only as hover feedback on interactive elements.

## 3. Typography

**Font:** Inter (system sans fallback)
**Mono Font:** SF Mono / Cascadia Code / JetBrains Mono / Fira Code

**Character:** A single sans-serif family at multiple weights carries the entire interface. Inter's clean, neutral geometry reads as engineered rather than styled — right for a tool that should feel precise. No display font. No serif pairing. One voice, many volumes.

### Hierarchy
- **Title** (600, 1.75rem, line-height 1.25): Page titles in main content area. Used once per view.
- **Headline** (600, 1.375rem, line-height 1.25): Card titles, section headers within views.
- **Subhead** (600, 1.1875rem, line-height 1.25): Component headers, table captions.
- **Body** (400, 0.9375rem, line-height 1.5): Primary content text. Cap line length at 65–75ch for prose; data-dense areas (tables, activity feeds) run unrestricted.
- **Small** (400, 0.8125rem, line-height 1.4): Secondary descriptions, help text, nav items, table content.
- **Caption** (400, 0.75rem, line-height 1.4): Timestamps, metadata, badge text, tertiary information.
- **Mono** (400, 0.8125rem, line-height 1.6): Code, system prompts, AI responses, manual override input. Pre-formatted text only; never used as decorative monospace.

### Named Rules
**The Single-Voice Rule.** Inter is the only typeface. No display font, no serif headings, no decorative weight changes. Hierarchy comes from size and weight within one family.

**The Fixed-Scale Rule.** Type sizes are fixed rem values, not fluid clamp(). Product UI is viewed at consistent DPI; clamp-sized headings that shrink in a sidebar look broken, not responsive.

## 4. Elevation

Flat by default. Depth is conveyed through tonal layering (three surface lightness steps: 0.145 → 0.175 → 0.20) and 1px borders, not shadows. This is a tool interface, not a physical metaphor — surfaces don't need to cast shadows to feel distinct.

### Shadow Vocabulary
Shadows are reserved for interactive feedback only — a card lifts slightly on hover, a button casts a micro-shadow on focus. Never used for static decoration.

- **Shadow Sm** (`0 1px 2px rgba(0, 0, 0, 0.30)`): Button hover lift, subtle interactive feedback.
- **Shadow Md** (`0 4px 12px rgba(0, 0, 0, 0.40)`): Card hover, dropdown menus, elevated interactive surfaces.
- **Shadow Lg** (`0 8px 24px rgba(0, 0, 0, 0.50)`): Modal dialogs, tooltips. Reserved for the highest elevation layer.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus). If a card casts a shadow while idle, the elevation model is broken.

**The No-Glow Rule.** Box-shadows never use spread for decorative glow effects. Shadows are directional offsets with blur, not colored halos. No `box-shadow: 0 0 20px var(--accent)` anywhere in the system.

## 5. Components

### Buttons
**Character:** Precise and restrained. Engineered, not decorated.

- **Shape:** Rounded corners at 6px (`--radius`). No pill shapes, no fully-rounded caps.
- **Primary:** Cortex Blue background, white text. Padding `8px 16px` (sm: `4px 12px`, lg: `12px 24px`). Used for primary actions only — save, send, add. Max one per screen section.
- **Secondary:** Transparent background, text-secondary color, 1px border-subtle border. Hover shifts to text-primary and neural-gray background with border-hover.
- **Ghost:** Transparent, no border, text-secondary. Hover: neural-gray background, text-primary. Used for navigation items and low-priority actions.
- **Danger:** Transparent, error-red border and text. Hover fills with error-red, white text. Used only for destructive actions.
- **States:** All variants have hover, focus-visible (2px cortex-blue ring, 2px offset), active, and disabled (50% opacity, cursor not-allowed). Loading state shows spinner + "Sending…" text.

### Inputs / Fields
**Character:** Invisible until needed. The field is a subtle container; the content is the focus.

- **Style:** Neural Black background, 1px border-subtle, 6px radius. Padding `8px 12px`. Text-primary for input, text-tertiary for placeholder.
- **Focus:** Border shifts to cortex-blue. A 3px cortex-blue ring at 20% opacity (`--accent-subtle`) wraps the field. Transition 120ms.
- **Textarea:** Same style, mono font, `12px` padding, `resize: vertical`. Used for the persona system prompt editor (minimum 25 rows).
- **Search:** Identical to default input. No magnifying glass icon inline — the placeholder text ("Search contacts…") carries the affordance.

### Toggle Switch
**Character:** A physical toggle rendered in pixels. Immediate, satisfying.

- **Track:** 36×20px, border color when off, cortex-blue when on. 10px radius (fully rounded ends).
- **Thumb:** 16×16px white circle, 2px from track edges. Translates 16px on check. 120ms transition.
- **Label:** Positioned to the left or as a sibling; 0.8125rem, font-weight 500, text-primary. Screen-reader-only label for standalone toggles.
- **Disabled:** 40% opacity, cursor not-allowed. Used for group contacts (proactive messaging unavailable).

### Navigation
**Character:** A fixed sidebar. Always there, never in the way.

- **Sidebar:** 220px wide, full viewport height. Neural Black background, 1px border-right. Fixed position, scrolls independently.
- **Nav Item:** Flex row with 18px icon + label. 6px radius, `8px 12px` padding. 0.8125rem, font-weight 500, text-secondary. 120ms transitions on color and background.
- **Active State:** Cortex Blue text (`--accent-text`), accent-subtle background (`--accent-subtle`). Icon opacity rises from 0.7 to 1.
- **Badge:** Cortex Blue pill on nav items with pending activity. 11px font, 600 weight, white text, min-width 18px. Auto-centered.
- **Mobile:** Sidebar translates off-screen. Toggle button reveals it with a 250ms slide transition.

### Cards
**Character:** Content containers, not design features.

- **Style:** Neural Gray background, 1px border-subtle, 8px radius. Padding `20px` (denser cards use `16px`).
- **Header:** Flex row, space-between. Title in 0.9375rem, weight 600. Optional badge or action button on the right.
- **Hover:** No elevation change at rest. Interactive cards (clickable rows) get neural-gray background on hover.
- **Nesting:** Never nest cards inside cards. If content needs subdivision, use background tint shifts or dividers.

### Status Indicators
- **Status Dot:** 6px circle. Green (success-green) = online/active. Red (error-red) = offline/error. Positioned inline with text labels.
- **Badge:** Inline-flex pill. 2px 8px padding, 0.75rem font, 500 weight, 100px border-radius. Color variants: success (green bg + text), warning (amber), error (red), neutral (neural-gray-raised bg + text-secondary). Used for contact types, processing states, counts.
- **Thought Card (signature):** Neural Black background with 1px border-subtle. When processing: border turns cortex-blue, background shifts to accent-subtle. Header row with target name + status badge. Response block in mono font, tinted by outcome (green = sent, muted italic = silent, red = errored).

### Empty States
**Character:** Teach the interface, don't blame the user.

- **Container:** Centered column, 48px vertical padding. Muted icon (2rem, 0.4 opacity). Title in 0.9375rem, weight 600, text-secondary. Description in 0.8125rem, text-tertiary, max-width 360px, line-height 1.6.
- **Variants:** "Waiting for activity" (Live Feed), "No contacts found" / "Sync from WhatsApp to load contacts" (Contacts), "No facts yet" with guidance on what to add (Knowledge), "No profiles extracted yet" with explanation of the feature (Profiles).

### Skeleton Loading
- **Style:** Border-subtle background, 4px radius. 1.5s ease-in-out pulse animation between 100% and 40% opacity.
- **Usage:** Table rows (avatar circle + text lines + toggle), textarea blocks, card content. Replaces spinners for initial loads.

## 6. Do's and Don'ts

### Do:
- **Do** use Cortex Blue for primary actions, active states, and processing indicators only — never as decoration
- **Do** distinguish surfaces with tonal layering (Neural Black → Neural Gray → Neural Gray Raised) and 1px borders
- **Do** use Inter at fixed rem sizes across all text — one family, one voice
- **Do** keep transitions between 120–250ms with ease curves — users are in flow, don't make them wait
- **Do** respect `prefers-reduced-motion` — all animations collapse to instant
- **Do** show skeleton loaders for initial data fetches, not blank cards with spinners
- **Do** pair every toggle with a visible label or screen-reader-only description
- **Do** explain what each view does in the page subtitle and the help panel at the bottom
- **Do** keep the Live Feed badge count accurate — it reflects real pending AI decisions

### Don't:
- **Don't** use glassmorphism panels (`backdrop-filter: blur()`) anywhere — this is a tool, not a showcase
- **Don't** use gradient text (`-webkit-background-clip: text`) — emphasis comes from weight and size, not effects
- **Don't** use side-stripe borders (`border-left` > 1px as colored accent) — use full borders, background tints, or badges instead
- **Don't** use neon glow effects, scanline overlays, or cyberpunk aesthetics — explicitly rejected by PRODUCT.md
- **Don't** use generic SaaS dashboard templates — no cream backgrounds, no blue-gradient hero cards, no identical metric grids
- **Don't** nest cards inside cards — use background tint shifts or dividers for sub-sections
- **Don't** use custom scrollbar styling as decoration — the system default is fine; if styled, keep it subtle and functional
- **Don't** hardcode fake data in chart components — if metrics aren't real, don't show fake ones
- **Don't** use "God Mode" or similar jargon for manual overrides — label controls by what they do, not how powerful they are
- **Don't** hardcode `localhost` in API calls — use relative URLs
- **Don't** use `box-shadow` with colored spread for glow effects — shadows are directional offsets with blur, never colored halos
- **Don't** use decorative motion — every animation conveys state change, feedback, or loading
