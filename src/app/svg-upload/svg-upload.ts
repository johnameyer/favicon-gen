import { Component, output, signal } from '@angular/core';

/** Maximum accepted upload size, in bytes. Favicons don't need huge SVGs. */
export const MAX_SVG_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Result of validating candidate SVG file contents.
 *
 * This validation exists purely for UX (rejecting garbage/non-SVG files with
 * a helpful message), NOT as a security boundary. The accepted markup is
 * only ever used as an `Image` `src` via a data URL for canvas drawing
 * (see `src/app/canvas/svg-data-url.ts` / `render-layers.ts`), never injected
 * into the live DOM — so embedded `<script>` tags etc. can't execute via this
 * path. No sanitization/script-stripping is performed; that's out of scope.
 */
export type SvgValidationResult = { ok: true; svgMarkup: string } | { ok: false; error: string };

/** Validates raw SVG file text: well-formed XML with an `<svg>` root element. */
export function validateSvgMarkup(text: string): SvgValidationResult {
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  const parserError = parsed.querySelector('parsererror');
  if (parserError || parsed.documentElement.localName !== 'svg') {
    return { ok: false, error: "That doesn't look like a valid SVG file." };
  }
  return { ok: true, svgMarkup: text };
}

/** Validates a candidate upload's type/size before reading and parsing its contents. */
export async function readAndValidateSvgFile(file: File): Promise<SvgValidationResult> {
  if (file.size > MAX_SVG_FILE_SIZE_BYTES) {
    return { ok: false, error: 'File is too large (max 2 MB).' };
  }

  const looksLikeSvg =
    file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg') || file.type === '';
  if (!looksLikeSvg) {
    return { ok: false, error: "That doesn't look like a valid SVG file." };
  }

  const text = await file.text();
  return validateSvgMarkup(text);
}

@Component({
  selector: 'app-svg-upload',
  template: `
    <div
      class="svg-upload-dropzone"
      [class.svg-upload-dropzone--dragover]="dragOver()"
      role="button"
      tabindex="0"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
      (keydown.enter)="fileInput.click()"
      (keydown.space)="fileInput.click()"
      data-testid="svg-upload-dropzone"
    >
      <p>Drag &amp; drop an SVG file here, or click to browse</p>
      <input
        #fileInput
        type="file"
        accept=".svg,image/svg+xml"
        class="svg-upload-input"
        (change)="onFileInputChange($event)"
        data-testid="svg-upload-input"
      />
    </div>
    @if (error()) {
      <p class="svg-upload-error" data-testid="svg-upload-error">{{ error() }}</p>
    }
  `,
  styleUrl: './svg-upload.scss',
})
export class SvgUpload {
  /** Emits raw SVG markup once a dropped/selected file passes validation. */
  readonly svgSelected = output<string>();

  readonly error = signal<string | null>(null);
  readonly dragOver = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await this.handleFile(file);
    }
  }

  async onFileInputChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      await this.handleFile(file);
    }
    input.value = '';
  }

  async handleFile(file: File): Promise<void> {
    const result = await readAndValidateSvgFile(file);
    if (result.ok) {
      this.error.set(null);
      this.svgSelected.emit(result.svgMarkup);
    } else {
      this.error.set(result.error);
    }
  }
}
