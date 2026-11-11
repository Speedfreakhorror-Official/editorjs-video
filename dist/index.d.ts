import type { BlockTool, BlockToolConstructorOptions } from '@editorjs/editorjs';
import { type ImageConfig, type ToolImage } from './image';
export type { ImageConfig, ToolImage } from './image';
export interface VideoData {
    provider: string;
    id: string;
    title: string;
    poster?: ToolImage;
}
export interface Provider {
    name: string;
    label: string;
    parse(text: string): string | null;
    embed(id: string): string;
}
export interface VideoConfig {
    providers?: Provider[];
    upload?: (file: File, onProgress: (fraction: number) => void) => Promise<{
        provider: string;
        id: string;
    } | {
        error: string;
    }>;
    uploader?: ImageConfig['uploader'];
    /** More ways to pick the poster, and actions on it (as the picture tool's). */
    sources?: ImageConfig['sources'];
    actions?: ImageConfig['actions'];
}
export declare const BUILT_IN: Provider[];
/** The first provider that reads the text as a video link or id. */
export declare function parseLink(text: string, providers: Pick<Provider, 'name' | 'parse'>[]): {
    provider: string;
    id: string;
} | null;
/** Whether the block shows an upload button. */
export declare const uploadVisible: (config: VideoConfig) => boolean;
/** Fills defaults and drops unknown top-level keys. */
export declare function normalize(data: unknown): VideoData;
/** True when a video is picked and has a title. */
export declare const isValid: (d: VideoData) => boolean;
/** True when nothing is set: no video, title or poster (the only block `validate` refuses). */
export declare const isEmpty: (d: VideoData) => boolean;
export default class VideoTool implements BlockTool {
    private opts;
    private data;
    private root;
    constructor(opts: BlockToolConstructorOptions<VideoData, VideoConfig>);
    static get toolbox(): {
        title: string;
        icon: string;
    };
    static get isReadOnlySupported(): boolean;
    render(): HTMLElement;
    save(): VideoData;
    validate(data: VideoData): boolean;
    private get config();
    private get providers();
    private draw;
    private uploadBar;
}
