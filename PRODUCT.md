# Product

## Register

product

## Users

Pedro Pizzi — single user, personal dashboard. Monitors his WhatsApp AI bot, manages contacts/permissions, edits persona, views activity. Context: quick check-ins, occasional configuration tweaks. Needs speed and clarity. Not a tool he lives in all day.

## Product Purpose

Monitor and control "Cérebro Humano" — an AI bot that impersonates Pedro on WhatsApp. Core jobs:
- See what the bot is doing in real-time (live feed)
- Manage which contacts/groups the bot can talk to
- Edit the bot's personality and knowledge
- Override the bot manually when needed
- View profiles the AI has learned about contacts

Success: Pedro trusts the bot enough to leave it running. Dashboard makes state visible at a glance.

## Brand Personality

- **Clean** — Notion/Linear energy. Information architecture over decoration.
- **Focused** — One thing per screen. No dashboard sprawl.
- **Quietly confident** — The bot is smart. The UI doesn't need to scream about it.

## Anti-references

- **No cyberpunk/hacker aesthetic**: No neon glow, scanlines, Matrix green, glassmorphism panels, monospace-as-decor. Current design is exactly this — burn it.
- **No generic SaaS dashboard**: No white/cream background, blue-gradient buttons, identical metric cards, "hero metrics" template, eyebrow labels on every section. The Vercel/Stripe/shadcn default.
- **No AI slop**: No gradient text, no glass cards, no side-stripe borders, no tiny uppercase tracked kickers above every section.

## Design Principles

1. **State visible at a glance** — Pedro opens this to check status. Make "bot is running, 3 conversations active" obvious in 2 seconds.
2. **One thing per screen** — Live feed is one view. Permissions is another. Don't cram everything into a 3-column layout.
3. **Actions explicit** — Every toggle, button, and input explains what it does. No "God Mode" jargon. No hidden features.
4. **Real data only** — No placeholder charts with hardcoded numbers. If data isn't available, show that honestly.
5. **Fast to scan, fast to act** — This is a tool, not an experience. Minimize clicks for common actions.

## Accessibility & Inclusion

- WCAG 2.1 AA minimum
- All interactive elements keyboard accessible
- Focus indicators visible
- Reduced motion: respect `prefers-reduced-motion`
- Color not sole indicator of state
- Body text contrast ≥ 4.5:1 against background
