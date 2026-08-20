# File yazin

**File yazin** is a local-first file workspace for selected PDF, CBZ, JPG, TXT, and HTML operations. It is designed to make a single merge, split, or conversion task clear, then preserve the sources and outputs as an editable project in the user's browser.

> Core file processing and the result library run locally in the browser. Source files are not uploaded for merge, split, or conversion operations.

## Supported formats and operations

| Source format | Merge | Split | Conversion targets |
| --- | --- | --- | --- |
| PDF | Yes | Yes | PDF, CBZ, JPG |
| CBZ | Yes | Yes | CBZ, PDF, JPG |
| JPG | Yes, into CBZ | No | JPG, PDF, CBZ |
| TXT | Yes | Yes | TXT, HTML, PDF, JPG, CBZ |
| HTML | Yes | Yes | HTML, TXT, PDF, JPG, CBZ |

Text-to-PDF, JPG, and CBZ routes render readable visual pages in the browser. PDF and CBZ do not offer TXT or HTML export because the application does not use OCR.

## Local result projects

Every completed operation creates a result project in IndexedDB on the current browser. A project keeps its own source files, output files, operation configuration, editable TXT/HTML sources, copy action, rename action, rerun action, and downloads. Clearing browser storage removes these local projects.

## Running locally

Use a recent Node.js version and pnpm.

```bash
pnpm install
pnpm dev
```

To validate a change before publishing:

```bash
pnpm test
pnpm check
pnpm build
pnpm audit --prod
```

## Credits

Instagram: [@pro_hg_i](https://www.instagram.com/pro_hg_i/)

Developer: **Yazin**

All rights reserved to @pro_hg_i.
