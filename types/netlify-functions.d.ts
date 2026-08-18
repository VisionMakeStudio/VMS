declare module "@netlify/functions" {
  export type Config = {
    path?: string | string[];
    excludedPath?: string | string[];
    preferStatic?: boolean;
  };
  export type Context = Record<string, unknown>;
}
declare const Netlify: { env: { get(name: string): string | undefined } };
