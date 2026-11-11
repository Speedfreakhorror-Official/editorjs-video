import type { API } from '@editorjs/editorjs';
export interface ToolImage {
    url: string;
    width: number;
    height: number;
    alt: string;
    [extra: string]: unknown;
}
/** A picture before its description is written (Omit<> would lose the named keys behind the index signature). */
export interface BareImage {
    url: string;
    width: number;
    height: number;
    [extra: string]: unknown;
}
export interface ImageConfig {
    uploader?: (file: File) => Promise<BareImage | {
        error: string;
    }>;
    sources?: {
        label: string;
        icon?: string;
        pick: () => Promise<(BareImage & {
            alt?: string;
        }) | null>;
    }[];
    actions?: {
        label: string;
        show: (img: ToolImage) => boolean;
        run: (img: ToolImage) => Promise<ToolImage | {
            error: string;
        }>;
    }[];
}
/** An `{ error }` answer from a host callback (the index signature stops `in` from narrowing). */
export declare const isError: (r: object) => r is {
    error: string;
};
/** A saved image as a ToolImage (extras kept), or null when it is not one. */
export declare function normalizeImage(v: unknown): ToolImage | null;
export declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K];
export declare function imageField(opts: {
    value: ToolImage | null;
    config: ImageConfig;
    api: API;
    onChange(v: ToolImage | null): void;
}): HTMLElement;
