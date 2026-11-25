# Published images

The build script creates `dist/images/` from image files in `public/assets/aistudio/`, removes those image files from the published `dist/assets/aistudio/` directory, and writes `dist/images/manifest.json`. The page uses that manifest to resolve its image references. Source media remains in `public/assets/aistudio/` so it can be tracked and included in future builds.
