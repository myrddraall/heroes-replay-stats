# Heroes Replay Stats

Statistics from your Heroes of the Storm replays — an Angular app that runs in the
browser and, through a thin Electron shell, on the desktop. Everything happens on your
device: replays are parsed locally and stored in IndexedDB; there is no account, no
login and no server.

| Package                                                             | What it is                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`@myrddraall/heroes-replay-stats`](./packages/app)                 | the Angular 22 + Material app, themed after the game                  |
| [`@myrddraall/heroes-replay-stats-desktop`](./packages/desktop)     | the Electron shell: a window, and a preload bridge for the filesystem |
| [`@myrddraall/heroes-replay-stats-analysers`](./packages/analysers) | the app's own replay analysers: timeline and points of interest       |
| [`@myrddraall/heroes-replay-stats-map`](./packages/map)             | the map viewer: a map pack drawn by a viewer and its layer directives |

The replay parsing, the model and the generic analysers come from
[myrddraall/heroprotocol](https://github.com/myrddraall/heroprotocol). The app's ingest
worker runs those next to its own analysers from `packages/analysers`.

The tool that renders the battleground maps (transparent map images, sky layers, a parallax
viewer), which began here as `tools/map-capture`, is now
[myrddraall/heroes-capture](https://github.com/myrddraall/heroes-capture).

## Working on it

```bash
pnpm install
pnpm start          # Angular dev server on http://localhost:4200
pnpm desktop        # Electron against the dev server (needs `pnpm start` running)
pnpm build          # every package
pnpm test           # every package with tests
pnpm lint
pnpm typecheck
pnpm check          # pinned dependency versions agree
pnpm run generate.analysis-goldens  # after changing an app analyser's output
```

The app talks to its host through one seam, `Platform` (`packages/app/src/app/platform`):
the browser build picks files with an `<input type=file>`, the desktop build through
Electron's dialog and knows the game's replay folder. Nothing else in the app knows
where it runs.

## Maps rendered on this machine

The app reads its maps from [heroes-maps](https://github.com/myrddraall/heroes-maps). In the
devcontainer (`DEV_LOCAL` is true there) `pnpm start` and `pnpm build` add the app's `local`
configuration instead, which reads them from this machine:

```bash
pnpm run serve.maps                 # heroes-capture's output next to this repository (../heroes-capture/tmp/results/maps)
pnpm run serve.maps <folder> [port] # another folder of renders
pnpm start                          # the app on http://localhost:4200, its /maps-local/ proxied to the maps server
```

The maps server (port 4208) serves whatever renders are in the folder (a catalog, each pack, byte
ranges), read afresh on every request, so a new render shows on the next reload. The dev server
proxies `/maps-local/` to it, so from outside the container only port 4200 is needed.
`pnpm start -- --configuration production` serves the production bundle the same way. CI builds,
where `DEV_LOCAL` isn't set, read heroes-maps as before; nothing changes at check-in.

## The Play screen background

`/edit-background` is the game's Play screen background on a page of its own, filling the
window: its sky, the energy drifting in towards the horizon, the twinkling stars and the planets, drawn with
WebGL from the game's own camera, meshes, materials and particles (`hrs-play-background`,
`packages/app/src/app/scenes/play-background`, fills whatever element holds it).
The site's background is one instance in the shell, behind every page. `BackgroundStore`
(`packages/app/src/app/scenes/play-background/background.store.ts`) holds how it is tinted, as the
game turns it blue for vs A.I.: a colour and a blend (`multiply`, `color`, `hue`, `overlay`,
`soft-light`, `color-burn` or `saturation`, as CSS blends them) for the whole of it, and for each
planet on its own; a change fades over half a second. The site's tints are the Graphics settings'
colour; a page can hold its own over them while it is open (`setPageTints`, the Background page and
the theme preview do). It also holds how the background is drawn (`setDrawing`): whether it moves
(when not, it is drawn once for each page, cross-fading from the last, and again on a resize), its
frame rates (idle, while a tint fades, and while something interactive holds
`requestInteracting()`, which returns the release: the map explorer holds it while the map is
dragged or zoomed) and the share of the display's resolution it is drawn at. As a side
effect the tints are on the root element for the interface to use: `--hrs-background-tint`,
`--hrs-background-tint-blend`, and `--hrs-planet-large-tint`, `-medium-` and `-small-` (each with its
`-blend`). The Background page (in the nav) shows it alone, with a back button in the top left; it is
the background's editor (below).

The planets are put up in sets: the game's own as the site loads, then one drawn at random with
each page (`nextPlanetSet` on BackgroundStore; the Background page's Another set button too), from the
pool heroes-capture exports beside the scene (`planets/`): the Play screen's three, the tutorial
flyby's three worlds (Azeroth, Korhal, Sanctuary) with their own layered materials and atmosphere
shells, lit as the flyby lights them, and its nine painted spheres. A planet is a body of parts
(`scene-planets.ts`): each a shape about the body's centre (a sphere seen from outside or, for an
atmosphere shell modelled inside out, from inside; a flat ring) with a rule mapping it to its
materials' textures (a uv sphere about a pole, linear in the point, or round the ring), all read
off the game's meshes by heroes-capture. No mesh is loaded: the renderer draws each part on one
camera-facing square, finding the shape under each pixel (the body shader in
`scene-renderer.ts`), turned to face the camera as the game's billboards do and lit by the
flyby's lights where it is a world's. A planet can wear a style (`style-<id>.json`, the same
form): its parts go about the body and its shade darkens it from a side; `nexus` is the Play
screen's look for a world (its hex-grid shield and ring, a crescent left lit). A planet may wear
a style of its own (the index's `style`, from its tuning) unless a scene says otherwise, and its
tuning's `variants` say how it wears a style, over the style's own (its shade, the style's
materials' settings): the Play screen planets are their paintings alone, wearing `nexus` as each
one's own shield is in the game data (unshaded, the game's grid texture, each its own mask (`masks`, in place of a material's own) and its
own ring and shield placement (`parts`, by role, in place of the style's shapes and mappings)). A
ring keeps to the body's limb seen from any distance: the exporter gives the distance it was
modelled to be seen from (`seen`, in the body's radii: the game's camera), and the renderer sizes
it to lie there from where it is seen (`ringFit`); each body's square is sized from all its parts
(`partsExtent`: its spheres widened for perspective, its rings projected from their plane). A
mask at its full midtone offset cuts nothing out of an opaque material: the Play screen
planets' paintings are cut by their birth masks while they are born (the model's Birth sequence
lifts the masks' midtone from 0 to 1) and rest whole at 1, as the game shows them. A ring's
texture v peaks on the circle the game's mesh has it on (`mid`, from the exporter; the large
planet's, a third of the way across, on its limb from the game's camera), and a ring is shaded at
several points across each pixel's width and averaged, so its brightest circle (a crease about a
pixel wide at the Play screen's sizes) is a smooth line, not a staircase. A
body's outline, and a ring's edges, are smoothed over a pixel (how much of the pixel the shape
covers, blended by it), as the game's meshes are; a pixel the shape misses is shaded and given
nothing rather than dropped (dropping it leaves its neighbours' texture derivatives undefined), and
one past a sphere's outline reads its textures at their coarsest (seen wholly edge-on there). A body's lights are objects (`scene-lights.ts`), each a row in its tree's Lights group: its
light rig from the game data as an ambient light and its directional lights (named Key, Fill and
Back by how bright they are), and its Antilight (`shadow`, the data's shade: a light that darkens, from a side, how
softly). Each is switched on and off by its row's checkbox and has a colour and strength (a
antilight, how dark), the side it comes from and (an antilight) its softness, set per light (`lights`,
by `ambient`, `directional-<n>`, `shadow`) over the data's only where set, so a body nothing is
set for is lit exactly as before. The rig's lights start as its tuning has them (`tunedRig`: its
data's tuned `lighting`, every light that much stronger, and `lightFrom`, the rig turned so its
key light comes from there; a body's own from before lights were objects over that), so each
light shows, and is overridden from, what it actually lights with: there is no all-lights-at-once
control. Lights can be added (Add light: ambient, directional or antilight) to a body (`added` on its
settings), to an overlay in the library (lighting every body wearing it) and to a scene
(`lights` on its choices, lighting every planet in it; the scene source gives them to the
background as it does the sky); an added light is taken out where it was added (Remove light),
and set over (switched off, recoloured) at any level above. A body is drawn with up to eight
directional lights and four shades. A shade set before lights were objects (`shade`,
`shadeTowards`) is read as its antilight's, and taken into it when that is edited. Materials are drawn in an order (`drawOrder`): the opaque first, then the rest by the game
data's priority (highest first), or as a level sets it (`order`, a list of names on a sky's
settings and on each body's); the tree lists them in that order and they are moved in it by
dragging (a line shows where) or with Alt and an arrow, opaque rows staying first. A body's own
and its style's materials keep one order between them (moved within its group, a material takes
one of its group's places); a sky material dragged into another depth's group takes that depth.
(Particles are drawn after a depth's meshes whatever their place: they only add light, which
comes out the same in any order.) A body's parts (its own: surface, layer, shell; its style's: shield, ring) take settings of
their own, relative to the body so a style's part fits any planet wearing it (`parts`, by
`own:<role>` or `style:<role>`; `withPart`): a sphere's size, and its textures turned about its
pole (Turn) and its top tilted towards the eye (Tilt); a ring's size, width (about its middle
circle), depth along the line of sight, the circle its texture is brightest on, and whether it
keeps to its body's limb. A body's tree is by owner, then part, then material: its own parts, each with the materials drawn on it (in draw order; a material is dragged only among its part's), then its Lights group, then the overlay it wears (its style) with that overlay's parts, their materials, and the lights added to the overlay. Parts and materials own no lights: the scene, a body and an overlay do. A body's or an overlay's light reaches what its linking says (`reach` on its settings: all of its body unless set; `only` or `except` the parts and materials named, a part standing for every material on it; the light panel's Linking section, its parts and their materials checked): for each part and material drawn, a light that doesn't reach it is off there (`linkedSettings`, rig lights, added lights and antilights alike). A light added to a body reaches its moons (and theirs) only where `moons` is set (Reaches its moons): the scene's placement adds it to each moon whole (`lightsForMoons`), its reach being among its own body's parts. A scene's lights reach every body. A body's, part's or material's properties end with Lit by: every light of a kind that acts on it (ambient and directional lights on a lit material; antilights on any of its materials), with where it comes from (the body, its overlay, the library, the scene, a planet it is a moon of) and a button that selects it in the tree, its rows unfolded to it (`showLight`). A body's checkbox switches the light on or off for that body; a part's or material's takes it into or out of the light's reach, set at the level edited (`litByOf`, `withLitBy`, `withReceiver`; a scene's or a parent planet's light by the body's own settings for it). A grid (the shield: a part with a hex pattern) has a Reveal and an Activation of its own, settings of its material (`revealOn`, `revealStrength`, `revealFrom`, `revealReach`, `revealFalloff`; `activationOn` and the like; `gridFields`), not lights: each shaped as a light reaches a face (`fieldAt`: the more it turns to their side, in front or behind; Reach 0 the half facing it, 1 on round to the point facing away; Falloff sharpening it; times Strength). The Reveal is where the grid shows at all (its emissive times how much it reaches, the grid's own fade, its Rim, staying; on by default from the front, Strength 2, all its face, as the game shows it; off, the grid doesn't show). The Activation (off until switched on) colours it from its Inactive colour, the data's, towards its Active colour (a magenta unless set), as the reveal at half strength, from the reveal's side while Same direction as the reveal (`activationTied`, on by default), energizing (`activationEnergizes`: revealing that much of what it activates, 0.25) and glowing (`activationGlow`: shining that much brighter and blooming that much more, 0.5). Reveal and Activation lights kept from before are left out wherever lights are read (`knownLights`). Each body (a scene's), overlay and part has a checkbox in the tree, as each material does: switched off, it and everything under it isn't drawn (the rows under it dimmed), each keeping its own switch (`enabled`, `overlayEnabled` on a body's settings; `enabled` on a part's). A body switched off keeps its place, so the scene's layout doesn't move, and its moons go with it; an overlay switched off draws the body as if it wore none (its light and shade too), its style kept. A style open in the library (an overlay itself) offers only what an overlay brings to the bodies wearing it (its name, lights, and its parts' and materials' settings): a body's own light, rims' lean and tint aren't read from a style, so its panel doesn't show them (`BodyProperties`' `overlay`). Bodies, overlays (a style's name, set in the library), parts, lights, materials and their layers each have a Name (`label` on a body's, a part's, a material's and a layer's settings; `name` on a light's), set level over level like any other setting: renamed in the library (a material on its own, a planet, a style) it shows so wherever it is used, renamed in a planet it shows so for that planet only, renamed in a scene for that scene only; left empty, back to the name under it. The data name stays the key settings are kept by. The name is in each panel's General section (a body's with its actions: Focus, Remove, and Reset planet, moon or overlay; where its rims lean is its Rim section, Direction). Panels keep one order: General, what the thing is (Overlay, Orbit, Place, Shape, Surface), Colour, Light, Rim, then Add light and Lit by. What a material is made of is rows under it in the tree rather than sections of its panel (`MaterialView`, a target's `view`; keys `material::layer:diffuse` and the like, `viewKey`/`splitViewKey`): every material's layers each a row (folded under it unless unfolded), and a grid's part shows its Shield shader (`partMaterialRows`): Shield shader (its panel: Cells, drawn or the game's texture, Scale, Line width and softness or Contrast; Colours, Inactive), under it Materials (the grid's material, its layers under that) and Effects (Reveal and Activation, each with its switch in the tree, `revealOn`/`activationOn`, and its panel its settings). They are views of the same material settings, set and reset level over level as any other; a non-grid material's emissive layer shows its Texture (Scale, Contrast) with the layer. Styles are called overlays everywhere in the editor (a planet's Overlay section, Wears); a material's Surface has Opacity and Draw mode (its blending); a reveal's or activation's spread is shown as Reach. The panels' top-level sections are pods (`_pod.scss`): square boxes the panel's full width (past its padding, `--hrs-panel-inline`), their heading a bar across the top, lines above and below and none at the sides; a section inside another (a `PropertySection` finds one above it by injection) keeps the plain folding heading. The tree is two pods: what is edited, and the editing aids (the preview stage, the reference). A body's material is lit by its body's light or drawn flat, as its textures have it (`lit`;
the editor's "Ignore lights", ticked where it is drawn flat): as the game data says unless set (the flyby planets' textures
are plain colour maps, lit; the Play screen planets' paintings have their light painted in, flat);
a lit one on a body with no light shows flat rather than black. A material's layers (its diffuse, emissive and first two alpha masks, by slot) each take settings
of their own (`layers`; `withLayers`): the texture read (any loaded with what it is drawn on: the
body's own, its style's, the sky's), its offset, rotation (degrees), tiling, scroll (texture
widths a second, going on rather than looping back as the data's do; set, the body is drawn every
frame) and whether it repeats across u and v; a level setting one of a layer's leaves the rest of
it to the level below. The editor shows each layer as a row of its own under its material, its panel the
layer's settings and the texture it reads (where the site and the game data have it). Each sky material is drawn at a depth among the scene's objects (`depth`, the editor's Depth:
Background, Midground or Foreground, and the groups a sky's materials are under in the tree):
behind them all, as if infinitely far (`background`), among them at its own depth (`scene`), or in
front of them all, as if at the camera (`foreground`). Unless set, the game data decides
(`skyDepths`): looking at the scene's own planets, a sky mesh met only in front of them all is in
front (the Play screen's horizon energy), one met only behind them is behind (its star cylinder
and twinkling stars), one met about them is among them. The renderer draws in that order: the
background (what doesn't move of it kept drawn, then what moves), the objects over it (what doesn't
move of them kept drawn on their own and laid over it, then what moves, depth-tested), then the
foreground; its far plane is infinitely far, so an object set however far is never cut off. A material's `falloff` is how sharply its edge-on fresnel rises toward the limb (the formula to that power: 2 unless set; the Play screen planets' grid 1.3, measured against a Quick Match screenshot). A material's `spreadFrom` is the side its
fresnel is brightest on (the editor's Spread from), in place of its layers' own turn. How a planet shows
is settable per placement (`SetPlanet`): its light's strength, where its key light comes from
(its rig turned together), a shade and where it falls, where its rims and glows lean
(`scene-directions.ts`), a tint over all its materials, and its materials'
settings by name (`MaterialSettings`, the same for any material, a planet's, a style's or the
sky's: drawn or not, strength, blend, a tint, glow, spread, its pattern's size, cut, line width
and softness; `material-settings.ts` says which do anything for a material). Tints blend by
CSS's blend modes and the image editors' others (`scene-tints.ts`); heroes-capture's
`tuning` in a planet's file is the default where the data alone isn't right (Korhal's haze
material at 0.42, its back light's crescent shaded; the nexus style's shield material). The
design has three layers, each setting only what it changes: the game data with its tuning, the
library (each asset's defaults, wherever it appears, the site's random sets too) and the scenes
(`background-design.ts`). In the library a material has base settings of its own, wherever it is
used; a planet, style or the sky using it can set it otherwise for itself, and a scene again.
A scene is its planets (each where it is and how big, with its style, looks and moons), its sky,
an id and a name (`scene-<n>`; `background-scene.ts`, `scene-bodies.ts`). Two are presets: the
random sets (`''`: a set drawn with each page; its sky set as any scene's) and the game's own Play
screen (`play-screen`: its three planets where the game puts them, its small one a moon of its
medium one on the orbit that puts it there (`playScreenBodies`, `orbitTo`), set as any scene's). Scenes
kept with one planet before scenes had several open as that planet in the middle of the view.
The colour over the whole picture is the scenes'. What the site shows is the
published design, a global store kept in `localStorage` (`PublishedDesignStore`, provided as the
design in effect by the `BACKGROUND_DESIGN` token's root default). The Background page is an
editor of a draft of it: the page provides `DraftDesignStore` (kept between visits) as the design
for everything under it, so its background shows the draft while the rest of the site shows what
is published; Save publishes the draft and Discard takes it back (on one line with the Library button and the
view's menu while something is open; the tree and the library's list mark each thing not saved
with a dot). A new scene starts saved: it is published as it is made. The left panel starts on the library (`AssetCatalogStore`): the kind of thing listed as
its title, a choice of the kind (scenes, planets, styles, materials, particle systems, skies),
a search by name or where a thing is used, the bar, then the things of that kind as one flat
list (a material with what uses it). For the scenes, a New scene button opens a flyout: a name,
then empty, or a copy of any scene (the presets first, filtered where the list is long): the
copy has the template's planets as its own (a copy of the random sets, the set up then). A click (or the up and down
arrows) selects one: it goes in
the URL (`/edit-background/planet/korhal`, `/edit-background/material/<name>`,
`/edit-background/scene/<id>`; nothing: the random sets' scene), the background shows it and the right panel tells what it is (what it is
made of or used by, what of it is set, its textures), with no controls. A double-click (or
Enter) opens it: the left panel shows its tree (the arrows move through it too), with a way back
to the lists, and the right panel
the properties of what is selected in it (`pages/play-background/editor/`, built of the
compact rows in `properties/`). A material's properties show the textures it reads: where the
site has each, and where the game data has it (the export says; a baked one, the texture it was
baked from). A scene opens in `SceneEditorStore`, an asset in `AssetEditorStore`, each provided as
the abstract `Editor` token the layout, tree and panels use and as the `BACKGROUND_SCENE` the
background shows. A scene's tree is its sky and its materials, then each planet with its
parts, lights and overlay (as above) and its moons, moons of moons; its own properties are its name, its deletion, the
colour, and an Add planet button (a flyout of the planets, filtered). A planet's properties have
its place (across, up, distance) and size; a body's, an Add moon button (the same flyout). A moon
is any planet on an orbit about its parent: radius, tilt, turn, a progress round it and its size;
one hidden behind a body is shown round its orbit while selected. What is drawn is kept in the
view with room for each body's shells and halo (`visualExtent`): a scene of one planet, and the
preview stage's asset, drawn smaller where they would not fit; a scene of several drawn smaller
about the middle of the view (`fitScene`), its layout kept. Another scene or asset opened (or
another random set) is flown to; the one open edited (a planet or moon added or taken out, a
style changed) fades to where it is (`BackgroundSceneSource.key`). A body clicked in the view (the
nearest under the pointer) is selected in the tree, its rows unfolded to it. An asset is shown on a
preview stage (a scene of its own, `@preview`, there only to see the asset in): a planet itself, a
style worn by the planet last opened, a material on the stand-in planet, the sky alone. A
planet's or overlay's material can be opened as the library has it (Edit shared material: one
material, shared by all that use it) under what it was opened from, in the URL
(`/edit-background/planet/korhal/material/skyLights`; overlays are `overlay` in URLs, `style` in
the code), one route for every editor URL so the page is kept as it moves: it is then shown on
that planet or overlay (or, switched in the tree's head, Shown on, on the stand-in), its heading
`korhal › Sky lights` and its back button to korhal. The stage has two editing aids (`EditingAidsStore`), kept in this browser
only and never in the design: the backdrop (a sky, chosen there, with the stage's own tint and
materials for it under it in the tree; a plain colour; or, by default, a transparency grid of
white and light grey; for a colour or the grid the renderer leaves the sky out and lays the
backdrop under what the planets cover, after tone mapping, so it shows as chosen and doesn't
bloom), and the stand-in planet, a plain sphere of a colour or the grid lit as a 3D tool's material
preview is, by lights of its own under it in the tree (`standInLights`, each with the same Light
properties as a body's): an Ambient light (white, 1 by default: a lit material as bright as its
textures) and a Directional light to switch on (off by default) to show relief, that the app makes
itself (`BUILT_IN_PLANETS`, ids starting `@`), with the material drawn over it on the parts of
its own planet's file that draw it. Either editor's tree ends with one more aid, the reference:
a picture chosen from this computer (a screenshot of the game's own screen, to compare with),
kept in this browser's IndexedDB (`reference-image.ts`), laid over the view (`ReferenceOverlay`)
split past a line or faded, as tall as the view (the camera keeps its height's angle, so a
screenshot fits by its height) and nudged to fit. A particle system's material
takes only whether it is drawn and its strength (the particles' own settings aren't editable
yet). Every property and section shows a reset where it is set. A number is a field to scrub
(`PropertyNumber`, `scrub.ts`): pressed and dragged up or down, it changes the faster the further
the pointer is from where it was pressed (Esc takes it back; while it is typed in too, what was
typed kept first, a drag across selecting its text as usual, its text never dragged away), so a number with wide limits or none
is set finely or fast alike; clicked, it is typed; the arrow keys, and the wheel over it, step it
(Shift: ten steps; Alt: a hundred). Its
limits show beside it ("0 – 1", "≥ 0", "Any"): only those it really has (a distance, a size, a
glow's boost have none above). The properties use one vocabulary: a
direction is always the side something comes from ("Light from", "Shade from", "Rim from",
"Spread from": the rim's is the bright side, mirrored from the lean the design keeps), on the same
disc with a Front/Behind switch; colour sections are "Colour", a material's compositing "Surface",
its pattern's size "Scale". Materials show by readable names (`material-names.ts`: their part's
role, a shield's grid or a ring; else their own name where it says something; else their main
texture's), the game data's name beside them; a body's are grouped by whose they are, its own and
its style's (which says it comes from that style, and for which body). A setting
with a value from a level under the one edited (the game data's tuning, the library's material,
planet or style, a style the body wears, its tuning for that style) shows a small hollow dot after
its label, which level in its title and to assistive technology (`originsOf`, `bodyOrigins`); one
set at the level edited shows highlighted, with its reset back to the level below. The screenshot mode shows the
background alone, full screen, until Esc. The stores keep what they keep in `localStorage`
through the `withLocalStorage` store feature (`data/store-features/`, beside `withFolding`;
`withPlanetFiles` loads planets' files as a store needs them). A part may carry a
`pattern` the renderer draws in place of its emissive texture (the nexus shield's hexes: analytic lines
of a size, width and softness, crisp at any size), as many round the part as the texture it stands
for has (its `across`, counted in the texture, times the texture's tiling), so a material's Size
means the same drawn or textured (2: twice as big) and its Draw as shows it either way, the game's
texture or the pattern, to compare them. Each planet loads the first time a set has
it (`PlanetLoader`); the layout is `planet-sets.ts` (a set from a number, the same number
the same set). What glows past the light's bloom threshold (in the scene's tone data) blooms: blurred
small and added back, as the game's HDR does, which spreads the flyby planets' atmospheres into
soft coronas (how far and how strongly isn't in the data: measured against the tutorial's own shots,
got from a recording of it, as were the lights' reading and each world's moment). A new set is flown to while the background animates: the camera turns, the planets
slide out and the new ones in, the stars streak (1.6 s); where it doesn't, the picture cross-fades.

The Graphics settings (Settings page; `GraphicsStore`, `packages/app/src/app/data/settings/graphics.store.ts`,
kept in `localStorage`: `hrs.graphics.quality` holds the preset's id, or all the quality settings as
JSON when they are Custom; `hrs.graphics.custom` the last custom settings, as JSON; `hrs.graphics`
the look's settings the user chose) set it, through `provideSiteBackground()`: a quality
preset (Low, Medium, High, Ultra, Extreme; until one is chosen it is High, or Low where the
browser draws without hardware acceleration, detected on each load; Custom shows when the values
match none, and is the last such values kept, so choosing it after trying a preset brings them
back; a change that matches no preset replaces them) over the animation, the three frame rates, the resolution and the glass's blur; and the
look, which presets don't touch: the theme (purple or Nexus), the background's colour (fixed, or
random or the next in turn each page; the site always opens untinted and fades to it) and the
glass panels' and the frame's opacity.
The scene comes
from [heroes-capture](https://github.com/myrddraall/heroes-capture) and is checked in under
`packages/app/public/backgrounds/play` (about 1 MB); after a game update, export it again:

```bash
pnpm run generate.play-background   # heroes-capture ui background into packages/app/public/backgrounds/play
```

It needs `heroes-capture` on the path (its release executable, or `pip install -e .` in
heroes-capture's package).

## Releasing

This repository follows the [cpdevtools git-flow](https://github.com/cpdevtools/git-flow-template)
conventions: manifests carry the `0.0.0-MAIN` placeholder and the real version lives in
`.publish/versions.yml`. Packaging the desktop app and publishing the web build are not
wired yet; both are built and tested on every push.
