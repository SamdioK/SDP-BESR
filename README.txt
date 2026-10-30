SDP-BESR INTERFACE FOUNDATION v0.2.2

PROJECT FILES
- index.html
- assets/sdp-logo.jpg (official SDP logo supplied by the user)

ELECTION DASHBOARDS
The overview has four distinct dashboard workspaces:
1. Governorship — statewide / LGA operations.
2. State House of Assembly — constituency, LGA, ward and polling-unit operations.
3. Senate — senatorial district, LGA, ward and polling-unit operations.
4. Federal House of Representatives — federal constituency, LGA, ward and polling-unit operations.

Constituency and district names/mappings are not invented. They must be loaded from verified INEC records before operational use.

MAP
- Leaflet map with OpenStreetMap background tiles.
- Benue LGA polygons are requested from an ArcGIS Feature Service. Query filters ADM1_EN='Benue' and requests ADM2_EN, ADM2_PCODE and geometry in WGS84.
- Service layer metadata: https://services3.arcgis.com/7J7WB6yJX0pYke9q/ArcGIS/rest/services/NCO_Security_Database_WFL1/FeatureServer/1
- The service describes the layer as Nigeria LGA boundaries and exposes ADM1_EN and ADM2_EN fields. Verify the service's data provenance, boundary currency, and legal terms with the data provider and current official INEC/Benue State records before operational decisions.
- LGA matching normalises names and handles known spelling variants. The displayed list falls back to the 23-LGA reference list if the map service is unavailable; fallback names do not imply their polygons loaded.
- Internet access is required for map tiles and boundary data.

ATTRIBUTION
- Map tiles: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright
- Boundary layer: ArcGIS Feature Service linked above. Check source/provider licensing and attribution terms before production deployment.

STATUS
This is a frontend preview only. Supabase authentication, database persistence, live reports, incident evidence storage, result capture, secure roles, and offline sync are not connected.

SECURITY
Never commit Supabase service-role keys, passwords, private operational records, agent personal data, or sensitive evidence to the public GitHub repository.
