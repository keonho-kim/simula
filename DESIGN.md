# Design System: Simula

## 1. Product Purpose and Design Direction

Simula helps people explore what could happen using materials they already have. Users bring documents and context, review the resulting scenario, observe simulated interactions, and read an explanation of possible developments and the conditions behind them.

The "Minority Report" reference expresses the ambition to make possible futures inspectable. Translate that ambition into clear evidence, connected events, and readable interpretation. The visual language is a complete analytical service: a recognizable application workspace, actionable dashboards, an operational simulation view, and editorial reports. Keep speculative outcomes visibly connected to their inputs and assumptions; the interface must not imply certainty or real-world predictive accuracy that the system has not established.

Use a Databricks-inspired analytical workspace: stable navigation groups, compact toolbars, clear list/detail boundaries, white work surfaces, and data-first content. This is an enterprise web application, not a sparse landing page. Treat the [Databricks workspace navigation](https://docs.databricks.com/aws/en/workspace/navigate-workspace) as a structural reference; retain Simula's identity and workflows. Do not copy unrelated product menus or add nonfunctional search, catalog, or account controls.

Separate navigation, commands, state, and content through position and surface contrast. Use a warm primary action color, blue source/focus accents, and independently meaningful status colors. Reserve large display type for editorial reports. Prefer compact working layouts with visible boundaries over oversized promotional cards, repeated instructions, or blank space.

This document is the design authority for new and revised UI. It describes the target design; it does not claim every existing screen already follows it. Implement changes through existing components and semantic tokens, within the responsibility being changed.

## 2. Core Principles

### Lead with the user's question

| Stage | First question the screen answers | Highest-priority content |
| --- | --- | --- |
| Start | What can I explore with my materials? | Add materials and context; resume existing work |
| Prepare | What will this simulation assume? | Source coverage, scenario, participants, constraints |
| Run | What is happening, and what changed? | Current stage, meaningful events, interactions, controls |
| Read | What happened, why, and what remains uncertain? | Conclusion, turning points, conditions, evidence |
| Compare | How did developments differ across worlds? | Observed paths, counts, shared conditions, exceptions |

Model latency, token throughput, and provider diagnostics are secondary to these questions. Keep them available in execution details or usage views without letting them dominate preparation or report reading.

### Make importance visible

- Establish a clear page title, section headings, body, and supporting detail. Do not give every element the same visual weight.
- Use size, position, spacing, and contrast together. Important information must remain recognizable without color.
- Put the principal next action near the content it affects. Give each decision area one clearly emphasized action.
- Use concise summaries for orientation and preserve access to the full underlying content.

### Group by meaning

- Place related labels, values, and explanations close together; leave visibly larger gaps between responsibilities.
- Use background planes for major regions, rules for section boundaries, and cards for independently selectable or comparable objects.
- Use a consistent alignment grid. Avoid arbitrary widths, isolated controls, and decorative cards nested inside cards.
- Progressive disclosure should reduce competing detail while keeping the relevant controls discoverable.

### Preserve the relationship between evidence and interpretation

Use the existing provenance categories: source claim, scenario assumption, user constraint, simulation observation, and analytical interpretation.

- A statement in an uploaded document is a source claim, not automatically a verified fact.
- Show assumptions and user constraints before execution and keep them accessible from results.
- Distinguish simulated events from source material and analytical interpretation using labels and placement as well as color.
- Link findings to the available source location or simulation record. Preserve reading position when opening and closing evidence.
- Present missing evidence, partial analysis, outdated sources, and unavailable inputs near the conclusions they affect.
- Show observed world counts with their denominator and analysis scope. Do not turn simulated frequencies into real-world probabilities or invent confidence scores.

## 3. One Product, Three Presentation Modes

Share the same colors, typography family, controls, navigation language, and state vocabulary across the application. Adapt density to the task.

| Mode | Applies to | Layout character |
| --- | --- | --- |
| Working | Source review, scenario preparation, simulation, settings | Clear sections, bounded controls, visible selection, compact supporting detail |
| Tactical | Live simulation graph within the bright workspace | Navy canvas, static grid, clear relationships and selection, no continuous decorative animation |
| Editorial | Report conclusions, explanations, evidence-led summaries | Strong title hierarchy, generous section spacing, constrained prose width, chapter navigation |

Reports need their own reading scale. Do not inherit compact console typography for long analytical prose. Working screens should also give source documents and explanations enough space to read comfortably.

## 4. Color and Surface System

### Foundations

These light-theme values are the reference palette. `src/ui/index.css` owns implemented theme tokens; components consume semantic roles. Update tokens centrally when implementing this palette. Existing dark-mode support must retain the same roles with separately verified contrast.

| Role | Reference value | Use |
| --- | --- | --- |
| Workspace | `#F4F5F7` | Page canvas around content and tools |
| Reading surface | `#FFFFFF` | Documents, reports, forms, primary panels |
| Secondary surface | `#E9EDF2` | Navigation, grouped controls, supporting regions |
| Structural divider | `#CBD5E1` | Section and panel boundaries |
| Control boundary | `#74859B` | Input and interactive boundaries where needed for recognition |
| Primary ink | `#202D3A` | Titles, body, important values |
| Secondary ink | `#536170` | Descriptions, metadata, captions |
| Primary action | `#B93820` | Main actions with white text |
| Active and focus | `#2272B5` | Selection indicators, keyboard focus, active navigation |

### Semantic accents

Use a visible dark accent with a light supporting surface. A faint pastel background alone is not enough to distinguish a region.

| Meaning | Accent | Supporting surface | Application |
| --- | --- | --- | --- |
| Source material | `#1E40AF` | `#EFF6FF` | Source labels, document icons, reference headings |
| Scenario assumptions and constraints | `#6D28D9` | `#F5F3FF` | Preparation sections and provenance labels; distinguish the two categories with text |
| Simulation observations | `#0F766E` | `#F0FDFA` | Observed events, recorded developments, timeline markers |
| Analytical interpretation | `#254E70` | `#EDF4F7` | Conclusions, interpretation labels, reading summaries |
| Attention or uncertainty | `#92400E` | `#FFFBEB` | Missing evidence, limitations, decisions needing attention |
| Failure or destructive action | `#B42318` | `#FEF3F2` | Failed operations, errors, destructive confirmations |
| Successful operation | `#166534` | `#F0FDF4` | Completed upload, save, or processing state |

Color communicates a specific meaning. Successful execution does not imply a favorable simulated outcome. An adverse scenario outcome does not imply a software error.

- Use accents on section markers, icons, selected states, short labels, and bounded summary surfaces. Keep long prose on quiet backgrounds.
- Use only the semantic accents relevant to the visible task. A screen does not need to display the entire palette.
- Give normal text adequate ink contrast; do not make entire paragraphs pale to create hierarchy.
- Pair state and provenance colors with text, icons, line styles, or shapes. Include legends where meanings are not already explicit.
- Keep actor and series colors stable across a graph, timeline, and legend. Identity colors must not silently acquire status meaning.
- Prefer 6px panel corners, 1px structural borders, and neutral header bands. Use light, static elevation only where it separates a dialog or bounded entry form from the canvas. Give primary, secondary, and destructive actions distinct fills; avoid a uniform collection of outlined rectangles.
- Warm amber is appropriate for a bounded attention state. Keep the overall canvas white or cool neutral.
- Use existing semantic Tailwind tokens first. Add a named semantic token only when implementing its actual consumer; avoid page-specific raw color palettes.

## 5. Typography and Reading

Use `Geist Variable` for the shared interface with system fallbacks that render Korean and English clearly. Establish editorial character through scale, rhythm, and layout. A serif face may be considered for report display headings only after testing both locales; it is not required for the editorial style.

| Role | Working screens | Editorial reports |
| --- | --- | --- |
| Page title | 24–28px | 36–48px desktop; 28–34px compact |
| Section title | 20–24px | 24–28px |
| Subsection title | 16–18px | 18–20px |
| Lead or summary | 16–18px | 18–22px |
| Body and source prose | 15–16px | 16–18px |
| Controls and supporting text | 13–14px | 13–14px |

These ranges are starting points, not a requirement to use every size. Use a small, consistent scale per mode. Compact live-control headers may be smaller than page titles; report titles and conclusions must retain reading hierarchy.

- Use medium or semibold headings and normal body weight. Keep letter spacing natural, particularly in Korean.
- Use body line-height around 1.6–1.75 in working views and 1.7–1.85 in reports. Tune paragraph spacing alongside line-height.
- Start report prose at a maximum width of 640–720px. Validate line lengths in both locales instead of relying solely on a Latin `ch` measure.
- Allow document and report titles to wrap. Truncation is for bounded lists with a way to inspect the full title.
- Format numbers and dates for the active locale; use tabular numerals for aligned numeric comparisons.
- Keep prose, titles, and evidence selectable for reading, copying, and quotation.
- Give report Markdown an explicit reading variant. Check the nested renderer's computed font size and line-height; a parent text class must not be silently defeated by compact Markdown defaults.

## 6. Layout and Navigation

### Shared layout rhythm

- Working pages use a centered shell at 80% of the available width, with 10% outer space on each side, including compact screens. Credential entry is a bounded task: center a form no wider than 440px inside this frame. Short settings credential forms may use a 480px maximum. Do not apply another page-wide maximum that increases those margins. Allocate the inner width to actual working columns.
- Within that shell, separate navigation, primary content, and supporting detail. Reports may use a narrow contents rail beside the constrained prose column.
- Use a 4px spacing base: 4–8px within a control, 12–16px between related items, 24–28px between working sections, and 48–64px between major report sections.
- Keep titles, sections, and actions aligned to the shared 80% frame. Use padding within panels rather than adding a second layer of page padding. Collapse internal columns below 1024px.
- Provide a stable context header with the current scenario or report and a clear return path. Place global settings and locale controls consistently.
- Use the shared workspace header for input, settings, document analysis, simulation management, and report pages. Give its toolbar a neutral surface and its title area a white surface. Editorial mastheads keep an open reading layout below the same toolbar. Place navigation and page actions in one toolbar above the title. Home and return controls use the same 40px outlined button, 14px visible label, and leading icon; do not place an icon-only home control beside an editorial title.
- Standard workspace titles use a 24–28px scale. Editorial titles retain their larger reading scale, with report status below the title. Neither title styling nor Markdown rendering may change the size of navigation controls or shrink an inline heading to body size.
- Use tabs for alternative views of the same scope. Use a contents navigation for chapters within a document. Avoid wrapping long lists of unrelated destinations into several tab rows.

### Start and source entry

- Keep the home navigation in a distinct, compact left region on desktop, above content on smaller screens. Show real run counts and a recent-records list in the main region; use existing manifest data only.
- Make adding materials and describing the question the primary entry. Group prepared-scenario import and examples as alternative ways to begin; present history and resume actions separately.
- Explain the product in one short sentence. Use action labels for import, examples, history, and settings; do not repeat a description beneath every navigation action.
- Show upload and interpretation state per document, including partial or failed extraction and the next recovery action.
- Prefer meaningful document titles in lists. Keep filenames and technical details secondary and available when needed.

### Scenario review and launch

- Clearly separate source review, scenario assumptions, participants, and execution settings.
- In generated scenario review, group situation/assumption cards, named participants, and scenario rules under separate section headings. Keep evidence selection in a compact list/detail layout; an unselected evidence panel must not reserve a tall blank column.
- Use a source list and reading pane when inspecting documents. Keep context visible when switching evidence.
- Make basic execution settings immediately available; group advanced behavior under a labeled disclosure.
- Explain automatic continuation and autonomous stopping as distinct decisions. Long switch descriptions should not become a grid of equally weighted cards.
- Keep the final review summary and launch action easy to locate. Sticky controls must not cover content or keyboard focus.
- Use a full page for extended review and multi-step preparation. Reserve dialogs for bounded edits and confirmations; avoid stacking settings over a long preview dialog.

### Copy and credential entry

- Put instructions beside the input or decision they explain. Remove page subtitles that repeat the title, field labels, or an obvious button action. Preserve errors, source limitations, and distinctions between automatic continuation and autonomous stopping.
- Keep credential entry a single-column grid: brand, title, one short explanation, visible password label, input, inline error, primary action, then a separated reset link.
- Associate errors with the input, announce failures, show processing state, and disable competing actions during synchronization. Keep the reset confirmation and encrypted storage boundary intact.
- Input width must follow the task's expected content, not the viewport. Never stretch a password form across a desktop workspace. Test 320px, 390px, 1440px, and 1920px at a minimum.
- Keep provider configuration, scenario input, generation targets, and selected details in identifiable regions. A border around every small text fragment is not information hierarchy.

### Generation hierarchy

- Always separate the stage, its semantic generation targets, and each target's steps. A participant's personality, decision scope, and goal belong inside that person, rather than appearing as three unrelated participant cards.
- Present stage navigation first, target cards second, and a selected target's step list beside its content third. Keep a breadcrumb and a return control for both inner levels; restore focus to the originating control on return.
- Name targets using the actual person, document, or subject. Name steps by what they produce. Numbers are useful for repeated evidence blocks or roster positions, but must not replace a meaningful target name.

| Stage | Generation target | Steps |
| --- | --- | --- |
| Read materials | Each source document; combined materials | Check facts, summarize, identify gaps, synthesize evidence |
| Design situation | Decision context; goals, constraints, tensions | Title, purpose, decision, starting situation; relevant facet |
| Build participants | Participant selection; each named person | Choose count and names; personality, decision scope, immediate goal |
| Check scenario | Rules; source access; consistency | Information, actions, stopping conditions, variations; fact access |
| Prepare simulation | Initial situation; each named person | Opening, assumptions; starting position, immediate concern |

- Keep the stage/target overview stable while reading a step. New progress must update the existing target, not reset navigation or duplicate it during retries.
- Count received steps explicitly. Generation can introduce further work, so completion of the currently received steps is not a fabricated overall percentage.
- Fetch accepted content and subscribe to drafts only for the selected step. Inactive content must not remain mounted. On compact screens, stack the step list and reading pane without flattening the hierarchy.

### Simulation and world comparison

- Keep source analysis and scenario review at `/document-analysis`. After confirmation, move preparation and active-run management to `/simulations` with its own title and actions. The document-analysis header must not frame running simulations.
- Use "simulation" for user-facing execution controls. "View simulations" returns to management; "View simulation" opens one run; "Stop simulation" affects the selected run. Domain and storage identifiers may retain "world".
- Keep new-scenario entry on the home page. Simulation management and observation focus on the current scenario and its executions; do not add a competing new-scenario action to their headers.
- Organize management into actual batch totals, a visible simulation list, the selected run's controls, and a separate area for batch-wide actions and the aggregate report. Mount detailed preparation for the selected simulation only.

- Prioritize the current stage, actor interactions, meaningful changes, and pause/continue controls.
- Keep command and conversation surfaces bright. Use the tactical navy palette only inside the simulation graph, including labels and overlays. A static grid and meaningful selection provide the operational character. The graph palette module owns its canvas and overlay colors.
- Show the existing compact performance charts directly above the live simulation, without a separate summary or disclosure. Report preparation uses the same card dimensions, spacing, and responsive columns directly below its context header and above the generation board. Stack metric cards on compact screens. Accepted-report metrics remain in execution details.
- Show validated actor messages as soon as each finishes. Pending previews must be labeled and replaced in place by accepted interactions; only accepted interactions affect saved history, graph state, or reports.
- Use a viewport-bound layout only when the primary content remains usable. On compact screens, provide focused views or a readable vertical flow instead of shrinking everything into one viewport.
- Compare worlds with aligned labels and consistent scales. Show incomplete and unclassified worlds alongside the denominator for any distribution.

### Editorial report

The report is the main explanation of the user's experiment. Its reading order is:

1. **Identity and scope:** full report title, scenario, available date or revision, and analysis coverage.
2. **Conclusion:** the main interpretation, with material limitations or partial status close by.
3. **Key observations:** the outcomes, turning points, and influential conditions supported by the accepted report.
4. **Detailed explanation:** clearly headed chapters with full prose and findings.
5. **Evidence and next checks:** source references, relevant recorded interactions, and unanswered questions.
6. **Execution details:** model usage, resource accounting, and technical exports.

- The first viewport should expose the main conclusion and enough scope to interpret it. Do not put a large model-metrics dashboard ahead of the report.
- Use a strong title block, readable lead, chapter rhythm, rules, and captions. Keep analytical paragraphs outside decorative cards.
- Keep analysis reading, recorded interactions, and execution details visibly distinct. Within analysis, use chapter navigation and mount only the selected full chapter.
- Allow figures and comparison tables to extend beyond the prose column when useful. Provide captions and explain what their values represent.
- Open evidence inline or in an adjacent panel with a clear return to the claim. On compact screens, preserve a straightforward reading and focus order.
- Display accepted report content without silently shortening or regenerating it to fit a layout. A summary must not replace the full report.
- Respect existing scope: aggregate reports describe their batch, while single-world records retain their own inspection context. Do not invent missing data or analysis to populate visual slots.

### Settings

- Keep provider connection, role behavior, and advanced configuration in distinct groups.
- Use a stable navigation area and one content region; make the selected group unmistakable.
- Show ordinary fields first and disclose advanced headers or JSON configuration when requested.
- Keep save state and validation near the relevant controls. Preserve drafts and warn before discarding changed settings through the existing workflow.

## 7. Actions and Button Placement

| Role | Existing variant | Appearance and placement |
| --- | --- | --- |
| Principal next step | `default` | Filled brand blue, white text, light elevation; near the task result or in its action footer |
| Related alternative | `secondary` | Tinted blue surface with dark ink; grouped next to the principal action |
| Navigation or inspection | `outline` | White control surface, visible boundary, dark ink; in the context header or adjacent to inspected content |
| Low-priority action | `ghost` or `link` | Text emphasis with local hover/focus feedback; outside the principal decision group |
| Stop or destructive action | `destructive` | Red-tinted surface, red ink, visible red boundary; separated from forward actions |

- Use 40px common controls and 44px large actions, semibold labels, approximately 8px corners, and consistent icon spacing. Preserve compact controls for bounded table or list actions.
- Give each decision area one principal action. Navigation belongs in the page toolbar; selected-run actions belong in the selected-run panel; batch-wide actions belong in the top-level execution overview header, before the simulation list. Keep the target scope visible next to its controls.
- Place progression switches close to the run they affect. Place stop controls apart from continue/view controls, with explicit target wording.
- Keep controls visually distinct from surrounding panels through fill, boundary, elevation, and ink. Hover, pressed, disabled, and focus states must remain recognizable.
- Align actions in stable groups with 12–16px spacing. On compact screens, wrap labels and groups, and use full-width actions where needed; do not hide or clip essential actions.
- Keep default element rules inside the base CSS layer. Global unlayered border or font resets must not override component variants.
- Use icons to reinforce action meaning, alongside visible labels. Avoid undifferentiated rows of equally styled buttons.

## 8. Components, States, and Accessibility

- Reuse existing shadcn primitives and their keyboard behavior. Express reusable component emphasis through variants; keep page layout with its owner.
- Use approximately 8px control radii and 8–12px panel radii consistently. Larger containers do not need progressively larger rounding.
- Prefer a visible label for important actions; icon-only controls need accessible names and discoverable explanations.
- Selected navigation needs a clear indicator plus an appropriate background or text treatment. A subtle gray shift alone is insufficient.
- Distinguish loading, empty, partial, failed, and completed states with specific messages and relevant next actions. Unknown values use an explicit unavailable state, not a fabricated zero.
- Show actual progress when the workload is known; otherwise identify the current stage without inventing a percentage or time estimate.
- Keep accepted content readable during recovery. State which result or source is unavailable and what the user can do next.
- Maintain text contrast of at least 4.5:1 for normal text and 3:1 for qualifying large text. Essential control boundaries and visual state indicators need 3:1 contrast against adjacent colors; decorative rules do not.
- Meet WCAG 2.2 target-size requirements, including applicable spacing exceptions. Prefer 40–44px controls for common touch actions rather than designing to the 24 by 24 CSS pixel minimum.
- Maintain visible keyboard focus, semantic heading order, labeled form groups, and meaningful reading order. Restore focus after closing an overlay.
- Verify compact layouts, 200% text resizing, and reflow at 320 CSS pixels. Put genuinely two-dimensional tables or graphs in their own usable regions.
- Respect reduced motion. Keep feedback local, preserve scroll position, and stop background animation when hidden or idle. Shared timing and presence behavior belong to `src/ui/animation`.

## 9. Review and Implementation Checks

For each changed screen, verify:

1. The user's main question, current context, and next action are clear before reading every label.
2. Headings, grouping, and alignment establish hierarchy even without color.
3. Accent colors have the same meaning across source review, simulation, and reports.
4. Conclusions remain connected to evidence, assumptions, scope, and material uncertainty.
5. Korean and English titles, long prose, empty values, and large counts fit without hiding important content.
6. Compact layouts preserve access to content and controls; sticky regions and nested scroll surfaces do not trap the reader.
7. Loading, failure, partial results, and recovery have actionable presentation.
8. Keyboard access, focus, contrast, and text resizing are checked beyond screenshots.
9. Existing components, semantic tokens, and report contracts remain the implementation owners.

Use fixed fixtures to inspect layouts without LLM calls. Review representative long reports and populated working screens, as well as empty states. Separate visual checks from live-stream or model-quality verification.

### Related implementation and references

- Theme tokens: [`src/ui/index.css`](src/ui/index.css)
- Report presentation: [`src/ui/styles/report.css`](src/ui/styles/report.css)
- Markdown presentation: [`src/ui/styles/markdown.css`](src/ui/styles/markdown.css)
- Analysis scope and behavior: [`docs/analysis.md`](docs/analysis.md)
- [Visual hierarchy — Nielsen Norman Group](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
- [Proximity and grouping — Nielsen Norman Group](https://www.nngroup.com/articles/gestalt-proximity/)
- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/)
