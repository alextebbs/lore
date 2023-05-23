import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import parse from "html-react-parser";

export const md2jsx = (md: string) => {
  return parse(
    DOMPurify.sanitize(marked(md, { mangle: false, headerIds: false }))
  );
};
