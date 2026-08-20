# OCR V2 implementation note

## Decision

The GitHub Pages-compatible OCR V2 path will use a browser worker around Tesseract.js for rendered PDF and CBZ pages. The worker approach is compatible with browser execution and can reuse one worker across pages. Image preprocessing (upscale, grayscale, contrast, and binarization) will be applied before recognition. Extracted text will be stored as an editable local project artifact.

## Integrity limits

OCR V2 can improve recognition of clear printed text and may produce tentative results from some handwriting, but it cannot guarantee accurate recognition of all handwritten text. Tesseract.js wraps the Tesseract recognition model without improving its core accuracy, and its own project scope excludes direct PDF support; File yazin will therefore render PDF pages to images before OCR. The interface must display a confidence score and a clear review-before-use notice.

## Smoke-test results

On 20 August 2026, the installed browser-compatible engine produced a confidence score of 92% on the project’s printed-English fixture. The same engine returned 27% on a public handwritten English-note sample, which deliberately fails the project’s 45% smoke-test threshold. OCR V2 must therefore preserve the low-confidence review warning for handwriting and must not promise complete handwritten-text recovery.

## Sources

- Tesseract.js README: https://github.com/naptha/tesseract.js/
- Tesseract.js worker API: https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- Tesseract OCR README: https://github.com/tesseract-ocr/tesseract
