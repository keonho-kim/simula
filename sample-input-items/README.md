# Small synthetic document inputs

These files contain invented launch-review facts only. They are intentionally small
and contain no credentials or private data. Use them for converter and local VLM
checks; they are not evidence of performance or quality on real documents.

| File | What it exercises |
| --- | --- |
| `memory-retention.json` | Tiny Korean promise/fulfillment and private-disclosure inputs for `bun scripts/qualify-memory.ts` against local Ornith |
| `source-access-choices.json` | Two small facts with distinct initial audiences for the indexed-choice Ornith runner |
| `event-audience.json` | Three explicit audience cases and one unresolved recipient case for real Ornith Planner qualification |
| `world-access.json` | One public meeting fact and one participant-restricted synthetic code for world source-access qualification |
| `notes.txt`, `brief.md`, `risks.csv` | Native text, Markdown, and tabular rows |
| `overview.docx`, `overview.doc`, `overview.pdf` | The same meeting facts across Office and selectable-text PDF formats |
| `presentation.pptx` | One slide with a decision and two figures |
| `budget.xlsx` | Two sheets; `Budget 2027!B4` stores formula `=B2-B3` and cached result `40`; `B5` stores `=B2+B3` without a cached result |
| `scanned-note.pdf` | One image-only page with a May 12 launch decision and a 120 million KRW budget |

`overview.doc` and `overview.pdf` were converted from `overview.docx` with
LibreOffice. The scanned PDF was rendered from a synthetic raster image. The
comparison findings are in [document-converter-comparison.md](../docs/document-converter-comparison.md).
