// Ambient module declarations for libs without bundled types (or to silence missing types in strict TS)

declare module "hls.js" {
  interface HlsConfig { enableWorker?: boolean }
  export default class Hls {
    static isSupported(): boolean;
    static Events: { ERROR: string };
    constructor(config?: HlsConfig);
    loadSource(src: string): void;
    attachMedia(media: HTMLVideoElement): void;
    destroy(): void;
    on(event: string, cb: (event: string, data: unknown) => void): void;
  }
}

declare module "swr" {
  export interface SWRResponse<Data = unknown, Error = unknown> {
    data: Data | undefined;
    error: Error | undefined;
    mutate: (data?: Data | Promise<Data>, shouldRevalidate?: boolean) => Promise<Data | undefined>;
    isLoading: boolean;
  }
  export default function useSWR<Data = unknown, Error = unknown>(
    key: string | null,
    fetcher?: (key: string) => Promise<Data>,
    opts?: Record<string, unknown>
  ): SWRResponse<Data, Error>;
}
