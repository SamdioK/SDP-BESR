SDP-BESR v0.3.2 — consolidated map display correction

INSTALLATION
1. Extract this ZIP.
2. Replace the entire index.html in the SamdioK/SDP-BESR GitHub repository with the supplied index.html.
3. Keep the existing assets/ directory and its image files unchanged.
4. Commit the replacement and wait for GitHub Pages to publish.

MAP DISPLAY RULES
- Statewide: settlement labels and ward labels are suppressed to avoid a crowded map.
- Intermediate zoom: only a limited number of primary settlement labels are shown within the visible map area.
- Close zoom: more settlement labels are gradually revealed, with geographic spacing and a hard label limit.
- Ward labels require an explicit electoral monitoring selection (LGA or ward) and close zoom; labels are restricted to that selected LGA/ward.
- Settlement markers are limited by visible map bounds, zoom level and spatial spacing. The reference records remain loaded and are revealed progressively as users zoom in.
- Panning and zooming refresh visible map detail only; they do not change the selected geographic monitoring scope.
- Existing map base layers, LGA boundaries, authentication, dashboard sections, and existing assets are retained.

DATA AND OPERATIONAL LIMITS
- GRID3 settlement points and ward polygons are reference data and must be checked against current INEC records before operational use.
- The polling-unit selection level is a prepared interface control. It does not create or imply a verified polling-unit dataset; verified polling-unit names, codes and coordinates must be connected separately.
- Do not add Supabase service-role keys or other secrets to index.html.
