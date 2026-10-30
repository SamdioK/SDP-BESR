SDP-BESR INTERFACE FOUNDATION v0.2.0

1. Open index.html through a web server or static hosting. For the interactive map, an internet connection is required.
2. The map uses Leaflet, OpenStreetMap tiles, and geoBoundaries/GRID3 Nigeria administrative boundary GeoJSON (2022 representation, CC BY 4.0).
3. Attribution: geoBoundaries / GRID3 Nigeria administrative boundaries, CC BY 4.0; OpenStreetMap contributors.
4. The Benue state polygon and LGA polygons are fetched at runtime from the geoBoundaries public GeoJSON files. LGA selection is based on polygon centroids within the Benue State polygon. Verify all boundaries and names against current official INEC and government data before operational use.
5. This is a frontend preview only. No Supabase authentication, database, live reports, incident persistence, result capture, or secure evidence storage is connected.
6. Do not put Supabase service-role keys, passwords, private operational records, or sensitive evidence in this public repository.
7. No Google Maps imagery or copied Google map data is used.
