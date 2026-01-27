# Tuiles raster locales (offline)

But: place your generated tiles under `public/tiles/{z}/{x}/{y}.png` in this project.

Recommended tools to generate tiles:

- MapTiler Desktop (GUI) — export "tiles folder" (easy).
- MapTiler CLI or `gdal2tiles.py` for command-line:
  - Example (gdal2tiles):
    ```powershell
    gdal2tiles.py -z 10-14 input.tif ./tiles
    ```

Steps:
1. Generate tiles for the zoom levels and the region you need (limit zoom to save space).
2. Copy the resulting `tiles` folder to `mobile-app/public/tiles` so that tiles are available at `/tiles/{z}/{x}/{y}.png`.
3. Start the dev server:
   ```powershell
   cd mobile-app
   npm run dev -- --host 0.0.0.0
   ```
4. Open the app and go to `/carte` (or log in) — the Leaflet map will use the local tiles.

Notes:
- Keep the tile area and zoom range limited to control APK size.
- If tiles are missing the app shows a placeholder message.
- For larger datasets consider using MBTiles + tileserver or vector tiles (advanced).
