import { convert } from "pandoc-wasm";

export async function generateDocx(
  markdown: string,
  title: string,
  _paperSize: "a4" | "letter"
): Promise<Blob> {
  const result = await convert(
    {
      from: "markdown",
      to: "docx",
      "output-file": "output.docx",
      standalone: true,
      metadata: { title },
    },
    markdown,
    {}
  );

  const docxBlob = (result.files as Record<string, Blob>)["output.docx"];
  if (!docxBlob) {
    throw new Error("pandoc-wasm did not produce output.docx");
  }
  return docxBlob;
}
