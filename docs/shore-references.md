# Land/water boundary in the cut-away — references

The problem: in the front cut-away, the water section ends in a straight, slanted edge, and the land beside it is a flat dark-teal slab. The shore is visible on the surface, but the cut face does not follow it.

## References
| Reference | What to take from it |
|---|---|
| [Isometric Low-Poly Landscape (Sketchfab)](https://sketchfab.com/3d-models/isometric-low-poly-landscape-702c70d6e14444a7842857f6155905e9) | A low-poly diorama tagged cross-section / river / water: one block where land and water share a single cut face |
| [Isometric river diorama with a floating cutaway (Hyper3D)](https://hyper3d.ai/3d-models/434abe8a-d6c5-4c86-b051-5944fc40bebd) | Beige soil strata under the land, blue water layers in the channel, soft rounded shapes |
| [Soil layers, cross-sectional isometric diagram (CGTrader)](https://cgtrader.com/3d-models/science/other/soil-layers-cross-sectional-isometric-diagram-5013088f-5a87-4ac8-9f43-f0b92ea8758e) | Soil drawn as horizontal bands: grass rim, topsoil, lighter subsoil, darker rock lower down |
| [Pottery Beach cross-section, Brownsea Island (Sketchfab)](https://sketchfab.com/3d-models/pottery-beach-cross-section-brownsea-island-uk-c1b022f4c7204497ba2d2ca5c40ba5b0) | A real shore cut open: the beach slopes down under the water; the layers follow that slope |
| [How to create a 3D diorama with just colors (80.lv)](https://80.lv/articles/how-to-create-a-3d-diorama-with-just-colors) | Stylized dioramas reading well from flat color bands alone |
| [How to make a 3D diorama in ArcGIS Pro (Esri)](https://www.esri.com/arcgis-blog/products/arcgis-pro/mapping/how-to-make-a-3d-diorama-in-arcgis-pro) | Cut-away walls draped with geologic layers, with the water body cut on the same wall |

## What they share (and the fix)
1. **One continuous cut face.** Land and water are cut by the same plane; nothing sticks out or ends in a separate slab.
2. **The water section is bounded by the ground.** Under the water, the cut shows the lakebed profile: from the shore the ground slopes down into the lake, and the water fills only the space above it.
3. **Soil in bands.** Under the land: a thin grass/sand rim at the top, then topsoil, then lighter subsoil, then darker rock lower down. The bands follow the ground's top edge loosely.
4. **The waterline continues to the shore** and stops where the water meets the ground, not at a straight vertical edge.
