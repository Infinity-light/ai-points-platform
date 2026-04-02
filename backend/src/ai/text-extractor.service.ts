import { Injectable, Logger } from '@nestjs/common';

const MAX_CHARS = 8000; // ~3000 tokens

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return this.truncate(data.text ?? '', MAX_CHARS);
    } catch (err) {
      this.logger.error(`PDF extraction failed: ${(err as Error).message}`);
      return '';
    }
  }

  async extractDocxText(buffer: Buffer): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return this.truncate(result.value ?? '', MAX_CHARS);
    } catch (err) {
      this.logger.error(`DOCX extraction failed: ${(err as Error).message}`);
      return '';
    }
  }

  private truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n... (已截断)';
  }
}
