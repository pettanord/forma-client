// Renders the Tiptap JSON that Forma's editors produce (StarterKit + Link +
// Image) as React elements. One renderer for every site frontend, so a new
// node type is added HERE once — not re-implemented per church.
//
// Unknown node types render their children rather than nothing: a Forma
// upgrade that introduces a node must degrade to readable text on sites
// that haven't updated the package yet, never to a hole in the page.

import type { ReactNode } from "react";
import { Fragment, createElement } from "react";
import type { TiptapNode } from "./types.js";

export interface RichTextProps {
  content: TiptapNode | null | undefined;
  /** Class on the wrapping <div>, for the site's own typography rules. */
  className?: string;
}

function renderMarks(node: TiptapNode, children: ReactNode): ReactNode {
  let result = children;
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        result = <strong>{result}</strong>;
        break;
      case "italic":
        result = <em>{result}</em>;
        break;
      case "strike":
        result = <s>{result}</s>;
        break;
      case "code":
        result = <code>{result}</code>;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        const external = /^https?:\/\//.test(href);
        result = (
          <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {result}
          </a>
        );
        break;
      }
      default:
        break; // unknown mark: keep the text, drop the decoration
    }
  }
  return result;
}

function renderChildren(node: TiptapNode): ReactNode {
  return (node.content ?? []).map((child, index) => (
    <Fragment key={index}>{renderNode(child)}</Fragment>
  ));
}

function renderNode(node: TiptapNode): ReactNode {
  switch (node.type) {
    case "text":
      return renderMarks(node, node.text ?? "");
    case "paragraph":
      return <p>{renderChildren(node)}</p>;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6);
      return createElement(`h${level}`, null, renderChildren(node));
    }
    case "bulletList":
      return <ul>{renderChildren(node)}</ul>;
    case "orderedList":
      return <ol>{renderChildren(node)}</ol>;
    case "listItem":
      return <li>{renderChildren(node)}</li>;
    case "blockquote":
      return <blockquote>{renderChildren(node)}</blockquote>;
    case "codeBlock":
      return (
        <pre>
          <code>{renderChildren(node)}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr />;
    case "hardBreak":
      return <br />;
    case "image": {
      const src = String(node.attrs?.src ?? "");
      if (!src) return null;
      return <img src={src} alt={String(node.attrs?.alt ?? "")} />;
    }
    default:
      // Unknown node (a future Forma feature): render what's inside it.
      return renderChildren(node);
  }
}

export function RichText({ content, className }: RichTextProps) {
  if (!content) return null;
  return <div className={className}>{renderChildren(content)}</div>;
}

/**
 * The document as plain text — for meta descriptions, previews, and search.
 * Blocks become line breaks; a truncation-friendly single string.
 */
export function richTextToPlainText(content: TiptapNode | null | undefined): string {
  if (!content) return "";
  const parts: string[] = [];
  const walk = (node: TiptapNode) => {
    if (node.type === "text" && node.text) parts.push(node.text);
    for (const child of node.content ?? []) walk(child);
    if (["paragraph", "heading", "listItem"].includes(node.type ?? "")) parts.push("\n");
  };
  walk(content);
  return parts.join("").replace(/\n{2,}/g, "\n").trim();
}
