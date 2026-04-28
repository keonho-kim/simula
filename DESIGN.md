# Design System: Simula
**Project ID:** local-simula

## 1. Visual Theme & Atmosphere

Simula uses a clean white simulation-console aesthetic. The interface should feel precise, calm, and operational: a bright workspace for reading actor state, timeline activity, graph structure, and run controls without visual noise.

The dominant impression is crisp white surfaces, cool neutral borders, compact controls, and restrained status color. Avoid cream, parchment, beige, sand, yellow-tinted canvas, or any background that makes the UI look aged or warm. The product should read as clean software infrastructure, not an editorial landing page.

## 2. Color Palette & Roles

- **Clean White Canvas** (#FFFFFF): The default page background and primary workspace surface.
- **Panel White** (#FFFFFF): Cards, dialogs, popovers, and simulation panels.
- **Cool Wash** (#F8FAFC): Subtle sidebar or secondary region background when a white-on-white break is needed.
- **Soft Cool Gray** (#F3F6FA): Muted control backgrounds, tab rails, and empty states.
- **Hairline Gray** (#E5EAF0): Borders, separators, panel rings, and structural dividers.
- **Input Gray** (#D7DEE8): Form borders and range-control rails.
- **Simulation Ink** (#172033): Primary text on light surfaces.
- **Muted Ink** (#667085): Secondary copy, timestamps, captions, helper text, and inactive labels.
- **Primary Navy** (#1F2A44): Primary actions, selected controls, and high-emphasis UI.
- **Focus Blue** (#4C8DF6): Keyboard focus rings and active graph emphasis.
- **Pale Blue** (#EEF6FF): Actor or information accents.
- **Pale Mint** (#EEFBF6): Event or success-adjacent accents.
- **Pale Violet** (#F5F3FF): Artifact or example accents.
- **Pale Rose** (#FFF1F4): Soft warning or history accents when destructive red is too strong.
- **Destructive Red** (#D92D20): Explicit destructive or failed states.

Use semantic Tailwind tokens such as `bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, and `bg-primary` before adding raw color values. Raw colors are acceptable only for graph nodes, icon accent swatches, or similarly domain-specific visuals.

## 3. Typography Rules

Use `Geist Variable` as the primary UI font, falling back to system sans-serif fonts. Keep headings compact and work-focused: 14-20px for panel headings, 32-48px only on the start screen. Use `font-semibold` for headings and `font-medium` for control labels.

Body copy should stay readable and dense, typically 12-14px inside the application shell and 14-16px on start or dialog screens. Letter spacing should remain normal. Avoid marketing-style display typography, oversized hero copy inside the app shell, and decorative serif fonts.

## 4. Component Stylings

* **Buttons:** Use compact rounded rectangles with 8px radius. Primary buttons use Primary Navy (#1F2A44) with white text. Outline and ghost buttons stay white or transparent with cool gray borders.
* **Cards and Panels:** Use white backgrounds with 1px Hairline Gray (#E5EAF0) rings or borders. Keep shadows minimal and diffuse; panels should feel placed on the canvas, not floating above it.
* **Dialogs and Popovers:** Use Panel White (#FFFFFF), cool gray rings, compact spacing, and clear titles. Avoid tinted modal surfaces unless the component is an empty or muted state.
* **Inputs and Forms:** Use white or transparent fills with Input Gray (#D7DEE8) borders. Focus states use Focus Blue (#4C8DF6), never yellow or warm amber.
* **Graph View:** Use a white canvas. Node colors may use pale blue, mint, violet, or white to distinguish domain roles. Do not use yellow, cream, or parchment graph backgrounds.
* **Badges and Status:** Prefer neutral outline badges. Use status color only when it improves scan speed for run state, graph activity, or error reporting.

## 5. Layout Principles

The application shell is a dense but breathable workstation. Use a centered max-width container for the dashboard, tight panel gutters, and predictable top command, stage, activity, and replay regions.

Keep simulation logic visually separate from controls: graph and activity regions should be easy to scan at a glance. Use whitespace inside panels to group information, but do not add decorative cards inside cards. Start-screen tiles may be larger and more welcoming, but they should still use white panels, cool borders, and restrained accent swatches.

When adding new UI, first ask whether the existing shadcn component and semantic color token already express the needed state. Add new visual vocabulary only when the simulation domain needs a distinct, observable meaning.
