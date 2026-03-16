#!/usr/bin/env node
import { FastMCP } from "fastmcp";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { writeFile, mkdtemp, realpath } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import emojiRegex from "emoji-regex";
import pkg from "./package.json" with { type: "json" };

function stripUnsupportedChars(text) {
  return text.replace(emojiRegex(), "").trim();
}

const server = new FastMCP({
  name: "mcp-pdfkit",
  version: pkg.version,
});

// Schema for a single content block in the PDF
const contentItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().describe("The text to render"),
    fontSize: z
      .number()
      .optional()
      .describe("Font size in points (default: 12)"),
    font: z
      .enum([
        "Helvetica",
        "Helvetica-Bold",
        "Helvetica-Oblique",
        "Times-Roman",
        "Times-Bold",
        "Times-Italic",
        "Courier",
        "Courier-Bold",
        "Courier-Oblique",
      ])
      .optional()
      .describe("Built-in PDF font (default: Helvetica)"),
    color: z
      .string()
      .optional()
      .describe('Text color as hex, e.g. "#333333" (default: "#000000")'),
    align: z
      .enum(["left", "center", "right", "justify"])
      .optional()
      .describe("Text alignment (default: left)"),
    lineGap: z
      .number()
      .optional()
      .describe("Extra spacing between lines in points (default: 0)"),
  }),
  z.object({
    type: z.literal("heading"),
    text: z.string().describe("The heading text"),
    fontSize: z
      .number()
      .optional()
      .describe("Font size in points (default: 24)"),
    font: z
      .enum([
        "Helvetica",
        "Helvetica-Bold",
        "Helvetica-Oblique",
        "Times-Roman",
        "Times-Bold",
        "Times-Italic",
        "Courier",
        "Courier-Bold",
        "Courier-Oblique",
      ])
      .optional()
      .describe("Built-in PDF font (default: Helvetica-Bold)"),
    color: z
      .string()
      .optional()
      .describe('Text color as hex, e.g. "#333333" (default: "#000000")'),
    align: z
      .enum(["left", "center", "right", "justify"])
      .optional()
      .describe("Text alignment (default: left)"),
  }),
  z.object({
    type: z.literal("spacer"),
    height: z.number().describe("Vertical space in points"),
  }),
  z.object({
    type: z.literal("divider"),
    color: z.string().optional().describe('Line color (default: "#cccccc")'),
    thickness: z
      .number()
      .optional()
      .describe("Line thickness in points (default: 1)"),
  }),
  z.object({
    type: z.literal("pageBreak"),
  }),
  z.object({
    type: z.literal("image"),
    path: z.string().describe("Absolute path to the image file"),
    width: z.number().optional().describe("Image width in points"),
    height: z.number().optional().describe("Image height in points"),
    align: z
      .enum(["left", "center", "right"])
      .optional()
      .describe("Image alignment (default: left)"),
  }),
]);

server.addTool({
  name: "pdf-document",
  description: `Create a PDF document and save it to disk.

Supports flowing content that automatically paginates: text, headings, images, spacers, dividers, and page breaks.

Returns the absolute file path to the generated PDF. Use built-in PDF fonts only (Helvetica, Times-Roman, Courier and their bold/italic variants).

IMPORTANT: Built-in PDF fonts do NOT support emoji or special Unicode symbols. Do not include emoji characters in text — they will be stripped automatically. Use plain text descriptions instead.

After generating a PDF, offer to open it for the user using the file:// URI returned in the result.`,
  parameters: z.object({
    filename: z
      .string()
      .optional()
      .describe(
        'Output filename (default: "document.pdf"). Saved to a temp directory.',
      ),
    title: z.string().optional().describe("Document title metadata"),
    author: z.string().optional().describe("Document author metadata"),
    pageSize: z
      .enum(["LETTER", "A4", "LEGAL"])
      .optional()
      .describe('Page size preset (default: "LETTER")'),
    margins: z
      .object({
        top: z
          .number()
          .optional()
          .describe("Top margin in points (default: 72)"),
        bottom: z
          .number()
          .optional()
          .describe("Bottom margin in points (default: 72)"),
        left: z
          .number()
          .optional()
          .describe("Left margin in points (default: 72)"),
        right: z
          .number()
          .optional()
          .describe("Right margin in points (default: 72)"),
      })
      .optional()
      .describe("Page margins in points (default: 72pt / 1 inch on all sides)"),
    content: z
      .array(contentItemSchema)
      .describe("Array of content items to render in the PDF"),
  }),
  execute: async (args) => {
    const {
      filename = "document.pdf",
      title,
      author,
      pageSize = "LETTER",
      margins,
      content,
    } = args;

    const m = {
      top: margins?.top ?? 72,
      bottom: margins?.bottom ?? 72,
      left: margins?.left ?? 72,
      right: margins?.right ?? 72,
    };

    const doc = new PDFDocument({
      size: pageSize,
      margins: m,
      info: {
        ...(title && { Title: title }),
        ...(author && { Author: author }),
      },
    });

    // Collect PDF into a buffer
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    const pdfReady = new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const contentWidth = doc.page.width - m.left - m.right;

    for (const item of content) {
      switch (item.type) {
        case "text": {
          const textContent = stripUnsupportedChars(item.text);
          if (!textContent) break;
          doc.font(item.font ?? "Helvetica");
          doc.fontSize(item.fontSize ?? 12);
          doc.fillColor(item.color ?? "#000000");
          doc.text(textContent, {
            align: item.align ?? "left",
            width: contentWidth,
            lineGap: item.lineGap ?? 0,
          });
          doc.moveDown(0.5);
          break;
        }

        case "heading": {
          const headingContent = stripUnsupportedChars(item.text);
          if (!headingContent) break;
          doc.font(item.font ?? "Helvetica-Bold");
          doc.fontSize(item.fontSize ?? 24);
          doc.fillColor(item.color ?? "#000000");
          doc.text(headingContent, {
            align: item.align ?? "left",
            width: contentWidth,
          });
          doc.moveDown(0.75);
          break;
        }

        case "spacer": {
          doc.y += item.height;
          break;
        }

        case "divider": {
          const dividerColor = item.color ?? "#cccccc";
          const thickness = item.thickness ?? 1;
          doc.y += 10;
          doc
            .lineWidth(thickness)
            .moveTo(m.left, doc.y)
            .lineTo(doc.page.width - m.right, doc.y)
            .stroke(dividerColor);
          doc.y += thickness + 10;
          break;
        }

        case "pageBreak": {
          doc.addPage();
          break;
        }

        case "image": {
          const imgOpts = {};
          if (item.width) imgOpts.width = item.width;
          if (item.height) imgOpts.height = item.height;
          if (!item.width && !item.height) imgOpts.width = contentWidth;

          if (item.align === "center") {
            const w = item.width ?? contentWidth;
            const xOffset = m.left + (contentWidth - w) / 2;
            doc.image(item.path, xOffset, doc.y, imgOpts);
          } else if (item.align === "right") {
            const w = item.width ?? contentWidth;
            const xOffset = m.left + contentWidth - w;
            doc.image(item.path, xOffset, doc.y, imgOpts);
          } else {
            doc.image(item.path, imgOpts);
          }
          doc.moveDown(0.5);
          break;
        }
      }
    }

    doc.end();
    const pdfBuffer = await pdfReady;

    // Write to a temp directory
    const tmpBase = await realpath(tmpdir());
    const tmpDir = await mkdtemp(join(tmpBase, "mcp-pdfkit-"));
    const outPath = join(tmpDir, filename);
    await writeFile(outPath, pdfBuffer);

    const fileUri = `file://${outPath}`;
    return `PDF created successfully: ${fileUri} (${pdfBuffer.length} bytes, ${doc.bufferedPageRange().count} page(s))\n\nOffer to open the file for the user.`;
  },
});

server.start({ transportType: "stdio" });
