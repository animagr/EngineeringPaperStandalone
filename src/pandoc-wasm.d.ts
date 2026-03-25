declare module "pandoc-wasm" {
  interface ConvertOptions {
    from?: string;
    to?: string;
    standalone?: boolean;
    "output-file"?: string;
    "table-of-contents"?: boolean;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface ConvertResult {
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, Blob>;
    mediaFiles: Record<string, Blob>;
  }

  export function convert(
    options: ConvertOptions,
    stdin: string | null,
    files: Record<string, string | Blob>
  ): Promise<ConvertResult>;
}
