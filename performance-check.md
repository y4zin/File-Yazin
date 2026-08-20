# Conversion performance check

The local smoke check was run on 20 August 2026 after introducing lazy loading for PDF and archive engines. It used representative in-memory text, HTML, and JPG inputs and measures only the transform time after the application modules are available.

| Route | Measured time | Result |
|---|---:|---|
| TXT to HTML | < 1 ms | One HTML output |
| HTML to TXT | 1 ms | One TXT output |
| JPG to CBZ | 47 ms | One CBZ output |
| TXT merge | < 1 ms | One TXT output |
| TXT split | 1 ms | Three TXT outputs |

The expanded check also used a two-page PDF with selectable text and a two-page CBZ generated from those rendered pages. The following transform-time results were recorded in the local test environment.

| Route | Measured time | Result |
|---|---:|---|
| PDF to TXT | 733 ms | One text output from two pages |
| PDF to JPG | 57 ms | Two individual JPG outputs |
| PDF to CBZ | 48 ms | One CBZ output |
| CBZ to JPG | 4 ms | Two individual JPG outputs |
| CBZ to PDF | 7 ms | One PDF output |

PDF rendering, CBZ decompression, and OCR remain proportional to page count and image resolution. The application now loads those engines only when the relevant route is selected, processes OCR sequentially by page, and reports the current page, aggregate progress, remaining pages, and a rolling time estimate instead of resetting the progress display for each page.
