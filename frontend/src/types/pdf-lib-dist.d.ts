// Use the standalone UMD build of pdf-lib. Its `es`/`cjs` builds import `tslib`
// which breaks under Metro's package-exports ESM interop
// ("Cannot destructure property '__extends' of 'tslib.default'").
// The dist build inlines tslib, so it works on web, iOS and Android.
declare module "pdf-lib/dist/pdf-lib.js" {
  export * from "pdf-lib";
}
