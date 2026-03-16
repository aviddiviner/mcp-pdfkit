# mcp-pdfkit

A lightweight MCP server for generating PDFs using [PDFKit](https://pdfkit.org/). One file, simple schemas, no bloat.

## Usage

### With Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "pdfkit": {
      "command": "npx",
      "args": ["-y", "mcp-pdfkit"]
    }
  }
}
```

### With Zed

Add to your Zed settings (`⌘ + ,`):

```json
{
  "context_servers": {
    "mcp-pdfkit": {
      "command": "npx",
      "args": ["-y", "mcp-pdfkit"]
    }
  }
}
```

## Tool: `pdf-document`

Creates a flowing PDF document with automatic pagination. Returns a `file://` URI to the generated PDF.

### Parameters

| Parameter  | Type     | Default    | Description                          |
| ---------- | -------- | ---------- | ------------------------------------ |
| `filename` | string   | document.pdf | Output filename                    |
| `title`    | string   | —          | Document title metadata              |
| `author`   | string   | —          | Document author metadata             |
| `pageSize` | string   | LETTER     | Page size: `LETTER`, `A4`, `LEGAL`   |
| `margins`  | object   | 72pt all   | `{ top, bottom, left, right }` in points |
| `content`  | array    | (required) | Array of content items               |

### Content types

**text** — Body text with optional formatting.

```json
{
  "type": "text",
  "text": "Hello, world!",
  "fontSize": 12,
  "font": "Helvetica",
  "color": "#333333",
  "align": "center",
  "lineGap": 2
}
```

**heading** — Section heading (bold, larger font by default).

```json
{
  "type": "heading",
  "text": "My Document",
  "fontSize": 24,
  "font": "Helvetica-Bold",
  "color": "#000000",
  "align": "center"
}
```

**spacer** — Vertical whitespace.

```json
{ "type": "spacer", "height": 40 }
```

**divider** — Horizontal rule.

```json
{ "type": "divider", "color": "#cccccc", "thickness": 1 }
```

**pageBreak** — Force a new page.

```json
{ "type": "pageBreak" }
```

**image** — Inline image from an absolute file path.

```json
{
  "type": "image",
  "path": "/absolute/path/to/image.png",
  "width": 200,
  "height": 150,
  "align": "center"
}
```

### Available fonts

PDFKit built-in fonts only (no emoji/unicode support):

- `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`
- `Times-Roman`, `Times-Bold`, `Times-Italic`
- `Courier`, `Courier-Bold`, `Courier-Oblique`

## Example

Ask your AI assistant:

> Generate me a PDF with a dad joke

And it will call the `pdf-document` tool with something like:

```json
{
  "filename": "dad-joke.pdf",
  "title": "Dad Joke of the Day",
  "content": [
    { "type": "heading", "text": "Dad Joke of the Day", "align": "center" },
    { "type": "divider", "color": "#3366cc", "thickness": 2 },
    { "type": "spacer", "height": 30 },
    { "type": "text", "text": "Why do programmers always confuse Halloween and Christmas?", "align": "center", "font": "Helvetica-Bold", "fontSize": 18 },
    { "type": "spacer", "height": 15 },
    { "type": "text", "text": "Because Oct 31 = Dec 25.", "align": "center", "fontSize": 18 },
    { "type": "spacer", "height": 40 },
    { "type": "divider" },
    { "type": "text", "text": "(Octal 31 equals Decimal 25)", "align": "center", "color": "#888888", "font": "Helvetica-Oblique", "fontSize": 11 }
  ]
}
```

## How it works

- **[fastmcp](https://github.com/punkpeye/fastmcp)** handles the MCP protocol (stdio transport)
- **[pdfkit](https://pdfkit.org/)** generates the PDF
- PDFs are written to a temp directory and a `file://` URI is returned
- Schemas are flat and simple — no recursive types, no `$ref` — compatible with all model providers including Amazon Bedrock

## License

MIT
