/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MICRON_SSO_URL?: string;
  readonly VITE_TUTORIAL_VIDEO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
