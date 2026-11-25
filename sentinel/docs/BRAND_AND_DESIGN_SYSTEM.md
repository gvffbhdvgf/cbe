# Softflix Sentinel — Brand & Design System

**Version:** 1.0  
**Date:** 25 November 2026  
**Status:** Initial product design system; validate with representative educators and administrators.

## Brand architecture

- **Company:** Softflix
- **Product:** Sentinel
- **Product descriptor:** Education operations & intelligence
- **Positioning:** A connected, evidence-led workspace for institutional operations, curriculum, assessment and learner support.
- **Brand promise:** See the whole picture. Support every possibility.
- **Voice:** Clear, composed, precise, respectful and human-centred. Avoid bureaucratic jargon, inflated AI claims and judgemental language about learners or schools.

## Visual principles

1. **Trust without intimidation:** deep navy anchors the interface; avoid alarm-heavy or surveillance-like visual language.
2. **Clarity over density:** whitespace, consistent grids, readable hierarchy and deliberate proximity make complex information navigable.
3. **Evidence is contextual:** charts and indicators must retain labels, denominators, periods, source and scope.
4. **Human outcomes first:** people and learning support are more prominent than scores and rankings.
5. **Quiet intelligence:** gradients and motion provide depth and orientation, never compete with operational content.
6. **Accessible by default:** keyboard focus, reduced motion, semantic HTML, readable contrast and non-colour status cues are required.

## Logo and iconography

The Sentinel emblem combines a protective shield, an open book and a north-star accent. It represents safe stewardship of learning evidence and the possibility of learner growth. The mark is drawn as a scalable vector in `src/components/brand-mark.tsx` and `src/app/icons/sentinel-mark.svg`.

Use the standalone mark for favicons, compact navigation and small surfaces. Use the wordmark lockup for page headers and product identity. On dark surfaces, use the light lockup variant. Maintain clear space of at least one quarter of the mark's width; never stretch, outline, rotate or add decorative effects that reduce legibility.

Icons should be consistent, simple line/solid hybrids with rounded joins, a 1.75–2 px stroke at 24 px, and a restrained palette. Use icons to reinforce labels, not replace them. Avoid emoji as interface controls or status indicators.

## Colour tokens

| Token | Hex | Role |
|---|---|---|
| Midnight | `#0B2035` | Hero, dark navigation, high-emphasis surfaces |
| Deep navy | `#102B45` | Primary text, logo frame, key actions |
| Teal | `#16B8B0` | Primary accent and selected states |
| Aqua | `#35D5C2` | Highlights, positive progress and decorative light |
| Amber | `#F7B955` | Attention and limited emphasis; never sole status cue |
| Canvas | `#F4F8FA` | App background |
| Surface | `#FFFFFF` | Cards and primary content surfaces |
| Line | `#E3EBF0` | Dividers, borders and table structure |
| Muted | `#667D91` | Secondary content |

Do not use teal or amber alone to communicate a state. Pair colour with a label, icon and/or text. Reserve red for destructive actions and genuine errors. Validate contrast for every text/background pairing before release.

## Typography

Use a modern sans-serif stack led by Inter where installed, with system UI fallbacks. Use:
- Display: 48–88 px desktop, tight tracking and compact leading; scale responsively.
- Page title: 32–44 px, semibold.
- Section title: 18–24 px, semibold.
- Body: 13–16 px, line-height 1.55–1.8 depending on density.
- Metadata: 10–12 px, with adequate contrast and never as the only carrier of meaning.
- Numeric data: tabular numerals; align values by decimal/units and retain units/denominators.

Avoid long all-caps headings. Uppercase eyebrow labels are limited to short section context with generous tracking.

## Layout, spacing and composition

Use a 4 px base spacing unit, with common steps 8, 12, 16, 24, 32, 48, 64 and 96 px. Use a centred content width up to 1440 px, responsive page gutters (24 px mobile, 40 px tablet, 56–64 px desktop), and a 12-column desktop grid where useful. Cards use 18–24 px corner radii; controls use 10–12 px. Keep borders subtle and shadows diffuse. Group related controls and data close together; separate unrelated tasks with whitespace and clear section labels.

## Gradients, imagery and motion

Use deep-navy-to-teal gradients only for hero/brand storytelling and selected emphasis. Avoid gradient text for data labels, tables or form controls. Original illustration motifs may reference open books, connected nodes, pathways and evidence trails; never use identifiable child imagery or generic stock photography as a substitute for real product context.

Motion is subtle and optional. Respect `prefers-reduced-motion`; never animate critical data, status changes or controls in ways that impair comprehension.

## Data visualisation rules

- Always show title, metric definition, period, population/scope, denominator and source where relevant.
- Do not imply causation from descriptive comparisons.
- Use direct labels and accessible patterns; do not rely on colour alone.
- Avoid decorative charts without a decision purpose.
- Suppress or aggregate small groups when privacy or re-identification risk exists.

## Responsive and accessibility requirements

Design for low-bandwidth conditions and constrained devices. Preserve task hierarchy on narrow screens; convert dense tables to accessible responsive views without dropping key context. Maintain visible keyboard focus, logical tab order, semantic landmarks, labelled form controls, useful error text and screen-reader announcements. Test WCAG 2.2 AA contrast and interaction requirements before production.

## Current implementation

The public landing page, sign-in experience, workspace shell and organisation directory use this system. The identity is an initial direction authored by Softflix for Sentinel, not a claim of validated preference from learners, teachers or institutional stakeholders. Run usability sessions with representative users before freezing the system.
