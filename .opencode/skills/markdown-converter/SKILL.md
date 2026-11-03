---
name: markdown-converter
description: 将 Office 文档、PDF、网页、图片等常见文件转换为 Markdown，便于后续阅读、检索和处理。
source: agent-teams-skillhub
skillId: c82d7401-6567-442c-b02d-87e02313e7f7
versionId: 8a5af7c4-6289-4d22-8092-712c73c2f786
versionNo: 1
displayName: markdown-converter
contentSha256: 2c899e28119d94eb1403316ad8ef0380a702b521f273ea9a2048115d28901ee3

metadata:
  displayName: 文件转 Markdown
  source: agent-teams-skillhub
  version: 1
  agentTeams:
    skillId: c82d7401-6567-442c-b02d-87e02313e7f7
    versionId: 8a5af7c4-6289-4d22-8092-712c73c2f786
    versionNo: 1
    contentSha256: 2c899e28119d94eb1403316ad8ef0380a702b521f273ea9a2048115d28901ee3
    displayNameZh: 文件转 Markdown
    displayNameEn: 文件转 Markdown
    businessDescZh: 将 Office 文档、PDF、网页、图片等常见文件转换为 Markdown，便于后续阅读、检索和处理。
    businessDescEn: 将 Office 文档、PDF、网页、图片等常见文件转换为 Markdown，便于后续阅读、检索和处理。
---

# Markdown Converter

Convert files to Markdown using `uvx markitdown` — no installation required.

## Basic Usage

```bash
# Convert to stdout
uvx markitdown input.pdf

# Save to file
uvx markitdown input.pdf -o output.md
uvx markitdown input.docx > output.md

# From stdin
cat input.pdf | uvx markitdown
```

## Supported Formats

- **Documents**: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx, .xls)
- **Web/Data**: HTML, CSV, JSON, XML
- **Media**: Images (EXIF + OCR), Audio (EXIF + transcription)
- **Other**: ZIP (iterates contents), YouTube URLs, EPub

## Options

```bash
-o OUTPUT      # Output file
-x EXTENSION   # Hint file extension (for stdin)
-m MIME_TYPE   # Hint MIME type
-c CHARSET     # Hint charset (e.g., UTF-8)
-d             # Use Azure Document Intelligence
-e ENDPOINT    # Document Intelligence endpoint
--use-plugins  # Enable 3rd-party plugins
--list-plugins # Show installed plugins
```

## Examples

```bash
# Convert Word document
uvx markitdown report.docx -o report.md

# Convert Excel spreadsheet
uvx markitdown data.xlsx > data.md

# Convert PowerPoint presentation
uvx markitdown slides.pptx -o slides.md

# Convert with file type hint (for stdin)
cat document | uvx markitdown -x .pdf > output.md

# Use Azure Document Intelligence for better PDF extraction
uvx markitdown scan.pdf -d -e "https://your-resource.cognitiveservices.azure.com/"
```

## Notes

- Output preserves document structure: headings, tables, lists, links
- First run caches dependencies; subsequent runs are faster
- For complex PDFs with poor extraction, use `-d` with Azure Document Intelligence
