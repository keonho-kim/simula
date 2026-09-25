# Small-document converter comparison

Date: 2026-09-23. Input corpus: [sample-input-items](../sample-input-items/README.md),
all files at most 37 KiB. The table records a historical comparison of Docling
2.129.0 and LibreOffice flat ODF XML (`fodt`, `fodp`, `fods`, or `fodg`) on macOS.
Neither comparison path is the current PDF extraction pipeline. TXT and MD use
Simula's native text decoder in production.

| Input | Docling observation | LibreOffice-only observation |
| --- | --- | --- |
| Selectable PDF | Returned two text items, no table. The flattened table ended in `Costs 0`, while the source says `Costs 80`. | FODG body text retained `Costs 80`, but the table became positioned text frames rather than a semantic table. |
| Image-only PDF | OCR returned both short lines; the page renderer also provided a model image. | FODG contained an image and no selectable text. This text-only comparison could not recover the two facts; the current pipeline sends the page image to the VLM. |
| DOCX | Returned three text items and a six-cell table with both figures. | FODT retained both figures and prose. |
| Legacy DOC | Returned four text items; table cells were flattened into one text item. | FODT retained the values but also flattened the table structure. |
| PPTX | Returned four text items and a page locator. | FODP body retained the four slide lines. A parser must exclude master-slide template text. |
| XLSX | Returned two worksheet tables, including cached `Net 40`, but omitted both formulas and the source cache-miss distinction. | FODS retained both formula expressions. LibreOffice recalculated the originally uncached `B5` result to `200`, so its value cannot be presented as the stored source result. |
| CSV | Returned one table with headers and rows. | FODS retained the same header and row text. |
| TXT / MD | Production uses native UTF decoding and source offsets; no Docling call. | FODT conversion retained readable text but adds an Office transformation with no benefit for the original line offsets. |

One DOCX → plain TXT LibreOffice conversion was stopped after a small input caused a
temporary output file to grow beyond 450 MiB. A bounded retry to FODT completed and
produced 119 KiB. This observation does not establish that every TXT conversion
hangs, but shows why an unbounded LibreOffice-only fallback would be unsafe.

The local LM Studio endpoint listed `ornith-1.5-35b-a3b`. Simula sent only
`scanned-note.pdf` through its actual Docling page-image and text pairing path,
with that model configured for `storyBuilder` and one concurrent call. The run
completed in 31 seconds, produced one page-linked visual block, and preserved
the May 12 decision and 120 million KRW budget without adding unsupported
scenario facts. One tiny page is not a target-model quality or throughput result.

**Current implementation decision:** Docling is removed from extraction and is not
a runtime dependency or accepted evidence-method value. PDF.js `6.3.289`
extracts selectable text from each PDF page
and renders that *same page* using `@napi-rs/canvas` `1.0.9`. The extracted text
and page image enter one VLM request per page; results are merged in page order
even when Fast Mode runs page calls concurrently. The small
selectable PDF yields `Costs 80` directly through PDF.js. An image-only PDF has no
selectable text but still reaches the VLM with an empty-text marker and its page
image; lack of a text layer does not skip the page. If a
visual summary introduces a number absent from selectable text, it is not accepted
as evidence; extracted text remains authoritative. Office formats convert to PDF
with bounded LibreOffice work. XLSX original cell evidence is read before conversion
and wins over recalculated rendered-page values. The previous Docling/LibreOffice
observations above are historical comparison results, not current runtime behavior.
DOCX, DOC, and PPTX use extracted text and the corresponding image from each
converted PDF page. The VLM explains material page content rather than attempting
complete OCR. Original Office shapes and coordinates are outside the accepted
ingestion scope.
A larger corpus is still required before claiming reliable complex table or layout
extraction.

CSV now uses [Papa Parse 5.7.0](https://github.com/mholt/PapaParse) (MIT, about
13,500 stars) for quoted cells and row-level parsing. The server records column
names, missing counts, numeric ranges, and source row locations. When more than
80 data records are present, it keeps detailed evidence for the first and last
40 while retaining the original upload and reporting that sampling occurred.

The server-only direct dependencies are [fflate 0.8.3](https://github.com/101arrowz/fflate)
(MIT, about 3,000 stars, ZIP selection) and
[fast-xml-parser 5.11.1](https://github.com/NaturalIntelligence/fast-xml-parser)
(MIT, about 3,100 stars, OOXML parsing). The extractor reads selected workbook
parts only, caps compressed and expanded sizes, rejects XML DTD/entities and
worksheet paths outside the workbook, and does not evaluate formulas. They are
not imported by the browser. The production dependency audit reported existing
findings elsewhere in the dependency tree; neither added package appeared in
that output. The current PDF path also pins
[PDF.js 6.3.289](https://github.com/mozilla/pdf.js) (Apache-2.0, over 53,000 stars)
and [N-API Canvas 1.0.9](https://github.com/Brooooooklyn/canvas) (MIT, over 2,000
stars). Canvas publishes platform-specific optional binaries for supported macOS,
Linux, and Windows targets; the target VDI binary and rendering behavior still need
deployment verification.

The available TypeScript PDF extractors were reviewed against the page-pairing
requirement. [`pdf-parse`](https://github.com/mehmet-kozan/pdf-parse) exposes page
text and screenshots, but its repository had about 221 stars at the recorded
review. [`unpdf`](https://github.com/unjs/unpdf) exposes page text and rendering,
but wraps PDF.js, requires the official PDF.js build and canvas for Node page
images, and had about 1,236 stars at review. Neither met the requested 2,000-star
threshold, and either would add a layer over the already installed PDF.js.
Official [`MuPDF.js`](https://github.com/ArtifexSoftware/mupdf.js) can extract
structured text and render the same page in TypeScript, but its AGPL/commercial
license needs a separate adoption decision for network use. Direct
[`PDF.js`](https://github.com/mozilla/pdf.js) remains the smallest supported
choice: one page proxy owns both selectable-text extraction and rendering, and
the current fixtures exercise the pair. No additional PDF text package is added.
