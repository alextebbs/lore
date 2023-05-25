import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import parse from "html-react-parser";

/**
 * Helper function to convert markdown to JSX.
 *
 * @param md Markdown string to convert to JSX
 * @returns JSX
 */
export const md2jsx = (md: string) => {
  return parse(
    DOMPurify.sanitize(marked(md, { mangle: false, headerIds: false }))
  );
};
