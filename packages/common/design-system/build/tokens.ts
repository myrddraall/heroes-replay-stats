/**
 * The design tokens, as tokens.json holds them: the base themes' colour roles from the role table
 * (themes.ts), the theme-independent colours (given in hex, written in OKLCH), shadows, type,
 * spacing, radius, opacity and effects.
 */
import { formatOklch, hexToOklch } from './oklab.ts';
import { BASE_THEMES, type Role, roleValue, themeShadows } from './themes.ts';

interface Token {
  readonly name: string;
  readonly value: string | Readonly<Record<string, string>>;
  readonly usage: string;
}

const perTheme = (value: (theme: (typeof BASE_THEMES)[number]) => string) =>
  Object.fromEntries(BASE_THEMES.map((t) => [t, value(t)]));
const role = (r: Role) => perTheme((t) => roleValue(t, r));
const glow = (name: string) => perTheme((t) => themeShadows(t)[name]!);
/** A colour given in hex, written as OKLCH. */
const hex = (h: string) => formatOklch(hexToOklch(h));

const color: Token[] = [
  { name: 'hrs-ground', value: role('hrs-ground'), usage: 'Page ground under the Play scene, and what shows if the scene is off. Never a panel fill.' },
  { name: 'hrs-tint', value: role('hrs-tint'), usage: 'Base colour of every panel film: composed with hrs-surface-alpha over the scene (oklch(from) syntax). Panels, side nav, table rows.' },
  { name: 'hrs-tint-raised', value: role('hrs-tint-raised'), usage: 'Film base for raised surfaces: popovers, menus, select panels, drawers, tooltips, the top bar. Composed with hrs-surface-alpha-raised.' },
  { name: 'hrs-selection', value: role('hrs-selection'), usage: 'Selected row / active list item fill, hovered row at hrs-hover-alpha. Always under hrs-text.' },
  { name: 'hrs-border', value: role('hrs-border'), usage: 'The 1px line on every panel, button, field, card and divider. 3:1 against hrs-tint in every theme.' },
  { name: 'hrs-border-strong', value: role('hrs-border-strong'), usage: 'Border of hovered, focused and selected things; the sub-bar active underline; sort arrow.' },
  { name: 'hrs-accent', value: role('hrs-accent'), usage: 'Accent text and icons: active nav label glow, links, chevron on section headings, primary button text. 4.5:1 on hrs-tint and hrs-tint-raised.' },
  { name: 'hrs-glow', value: role('hrs-glow'), usage: 'Colour of every outer glow (box-shadow, drop-shadow) on hover/selected/primary and StyledText. 66% lightness in every theme with the chroma sRGB holds at that hue (cyan lifted to 72%), so no theme glows louder. Never a fill or text.' },
  { name: 'hrs-text', value: hex('#f3f0ff'), usage: 'Titles, names, values, button labels. On hrs-tint, hrs-tint-raised, hrs-selection and hrs-ground in every theme.' },
  { name: 'hrs-text-muted', value: role('hrs-text-muted'), usage: 'Body copy, labels, column headers, placeholders, secondary values. On hrs-tint and hrs-tint-raised; 4.5:1 in every theme.' },
  { name: 'hrs-text-dim', value: role('hrs-text-dim'), usage: 'Disabled text and empty-slot labels only (decorative, 3:1 on hrs-tint). Never for content that must be read.' },
  { name: 'hrs-on-accent', value: role('hrs-on-accent'), usage: 'Text on a solid hrs-accent fill (filled checkbox, slider thumb, count badge). Dark, never white.' },
  { name: 'hrs-focus', value: hex('#ffd166'), usage: "Keyboard focus ring (2px solid, 2px offset) on every surface in every theme; the game has none, this is the web's." },
  // semantic, theme independent
  { name: 'hrs-team-blue', value: hex('#4a95ff'), usage: 'Ally / team-1 player names and markers (lifted from game LabelYourTeam #3184ff for 4.5:1 on hrs-selection). Text on hrs-tint. Pair with data-theme="blue" for whole panels.' },
  { name: 'hrs-team-red', value: hex('#ff6471'), usage: 'Enemy / team-2 player names and markers (lifted from game LabelEnemyTeam #f70b21 for 4.5:1 on hrs-tint). Panels: data-theme="red".' },
  { name: 'hrs-self', value: hex('#4ee36b'), usage: 'The user\'s own player wherever they appear in a list (the Watch roster green). Panels about the user: data-theme="green".' },
  { name: 'hrs-gold', value: hex('#f2b632'), usage: 'Ownership and heroic marks: OWNED lines, heroic key outlines, the active section heading, the portrait frame fallback.' },
  { name: 'hrs-error', value: hex('#ff6b6b'), usage: "Error lines and failed imports (the chat's red). Text on hrs-tint; always with a word, never colour alone." },
  { name: 'hrs-info', value: hex('#6ca7ff'), usage: "System and informational lines (the chat's blue): 'has come online', import finished." },
  { name: 'hrs-warning', value: hex('#f0a830'), usage: 'Warnings and partial states. Text on hrs-tint.' },
];

const shadow: Token[] = [
  { name: 'hrs-glow-hover', value: glow('hrs-glow-hover'), usage: 'Hovered button, card, row and nav item.' },
  { name: 'hrs-glow-selected', value: glow('hrs-glow-selected'), usage: 'Selected list item, active toggle, focused field, primary button at rest.' },
  { name: 'hrs-glow-panel', value: glow('hrs-glow-panel'), usage: "Popovers, menus and the modal panel: the panel 'lifts' with a wide faint glow." },
  { name: 'hrs-glow-modal', value: glow('hrs-glow-modal'), usage: "The modal dialog's halo over the blurred page." },
  { name: 'hrs-shade', value: '0 2px 8px oklch(0% 0 0 / 0.5)', usage: 'Raised surfaces also drop a plain shadow under the glow so they read over bright art.' },
];

/** tokens.json. */
export const DESIGN_TOKENS = {
  name: 'HRS Nexus UI',
  version: 1,
  color: {
    themes: [
      { id: 'purple', name: 'Purple (neutral)' },
      { id: 'magenta', name: 'Magenta' },
      { id: 'cyan', name: 'Cyan (nexus)' },
      { id: 'blue', name: 'Blue team' },
      { id: 'red', name: 'Red team' },
      { id: 'green', name: 'Self (green)' },
    ],
    tokens: color,
  },
  type: {
    fonts: [],
    families: {
      brand: "'Exo 2', 'Segoe UI', system-ui, sans-serif",
      plain: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
      mono: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
    },
    groups: [
      {
        name: 'Chrome',
        family: 'brand',
        styles: [
          { name: 'nav-1', fontSize: '26px', lineHeight: '30px', fontWeight: 700, letterSpacing: '0', sample: 'MATCHES  PLAYERS  GAME', usage: "Level-1 nav labels: the game's TaskBarNavigation style (Metronic Bold, height 30, Uppercase, gradient text 9d90ff→8f99fb with a dark glow; selected cbe8ff→ffffff with glow 0063c8). Here: gradient from the theme accent, selected from hrs-text with the theme glow." },
          { name: 'nav-2', fontSize: '19px', lineHeight: '24px', fontWeight: 700, letterSpacing: '0', sample: 'Quick Match  Ranked  Brawl', usage: "Level-2 sub-bar tabs: the game's TaskBarSubNavigation style (height 18, no uppercase, gradient 9d90ff→aab2ff; selected cbe8ff→ffffff, glow 0063c8), title case as the game writes them." },
          { name: 'tab', fontSize: '12px', lineHeight: '16px', fontWeight: 600, letterSpacing: '0.04em', sample: 'About  Skins  Abilities  Talents', usage: 'In-page tabs inside a panel.' },
          { name: 'nav-3', fontSize: '13px', lineHeight: '18px', fontWeight: 600, sample: 'Featured heroes', usage: 'Level-3 side list buttons.' },
          { name: 'label', fontSize: '11px', lineHeight: '14px', fontWeight: 700, letterSpacing: '0.08em', sample: 'LOBBY MODE', usage: 'Form labels, column headers, card status lines, uppercase.' },
        ],
      },
      {
        name: 'Headings',
        family: 'brand',
        styles: [
          { name: 'display', fontSize: '32px', lineHeight: '36px', fontWeight: 700, letterSpacing: '0.06em', sample: 'VOLSKAYA FOUNDRY', usage: 'Page and modal titles, uppercase.' },
          { name: 'title', fontSize: '22px', lineHeight: '28px', fontWeight: 700, sample: 'Ragnaros', usage: 'Panel titles, hero and player names in headers.' },
          { name: 'section', fontSize: '15px', lineHeight: '20px', fontWeight: 700, sample: '〉 The Firelord', usage: 'Section headings inside content, with the chevron.' },
          { name: 'panel-title', fontSize: '14px', lineHeight: '18px', fontWeight: 700, letterSpacing: '0.06em', sample: 'MATCH DETAILS', usage: 'Panel header rows, uppercase.' },
        ],
      },
      {
        name: 'Text',
        family: 'plain',
        styles: [
          { name: 'body', fontSize: '15px', lineHeight: '22px', fontWeight: 400, usage: 'Paragraphs and descriptions in hrs-text-muted.' },
          { name: 'body-strong', fontSize: '15px', lineHeight: '22px', fontWeight: 600, usage: 'Names and values beside a label, in hrs-text.' },
          { name: 'small', fontSize: '13px', lineHeight: '18px', fontWeight: 400, usage: 'Table cells, list rows, chat lines, helper text.' },
          { name: 'caption', fontSize: '12px', lineHeight: '16px', fontWeight: 400, usage: 'Timestamps, file counts, footnotes.' },
          { name: 'numeric', fontSize: '14px', lineHeight: '18px', fontWeight: 600, sample: '234,930  16:08  2098', usage: 'Stats, counts, durations: tabular figures (font-variant-numeric).' },
        ],
      },
      {
        name: 'Code',
        family: 'mono',
        styles: [{ name: 'mono', fontSize: '13px', lineHeight: '18px', fontWeight: 400, usage: 'Replay file names, paths, ids.' }],
      },
    ],
  },
  spacing: {
    tokens: [
      { name: 'hrs-space-1', value: '4px', usage: 'Hairline gaps: badge inset, divider margins.' },
      { name: 'hrs-space-2', value: '8px', usage: 'Inside buttons and fields vertically; gap between icon and label.' },
      { name: 'hrs-space-3', value: '12px', usage: 'Button horizontal padding; table cell padding; list row padding.' },
      { name: 'hrs-space-4', value: '16px', usage: 'Panel padding; gap between controls.' },
      { name: 'hrs-space-5', value: '20px', usage: 'Section gaps inside a panel.' },
      { name: 'hrs-space-6', value: '24px', usage: 'Page padding on desktop; gap between panels.' },
      { name: 'hrs-space-8', value: '32px', usage: 'Modal padding; gap between page sections.' },
      { name: 'hrs-space-12', value: '48px', usage: 'Hero header spacing.' },
      { name: 'hrs-bar-1', value: '64px', usage: "Top bar height (level 1): the game's TopNavContainer is 108 units, the sub bar 52; 64/36 keeps that ratio at web size." },
      { name: 'hrs-bar-2', value: '40px', usage: 'Sub-bar height (level 2); see hrs-bar-1.' },
      { name: 'hrs-side-nav', value: '240px', usage: 'Level-3 side list width on desktop.' },
      { name: 'hrs-side-panel', value: '320px', usage: 'Right tool drawer width.' },
      { name: 'hrs-control', value: '36px', usage: 'Height of buttons, fields and selects; icon buttons are square at this size.' },
      { name: 'hrs-control-sm', value: '28px', usage: 'Small buttons, chips, toggle-group items, sub-bar tabs.' },
    ],
  },
  radius: {
    tokens: [
      { name: 'hrs-radius-0', value: '0px', usage: 'Everything: panels, buttons, fields, cards, modals. The system is square.' },
      { name: 'hrs-radius-1', value: '2px', usage: "Only badges, chips and the slider thumb, so they don't look like tiny panels." },
    ],
  },
  shadow: { tokens: shadow },
  opacity: {
    note: 'The film over the Play scene. These are the floors: the Opacity setting (Settings → Theme) raises all of them together towards solid, never below.',
    tokens: [
      { name: 'hrs-surface-alpha', value: '0.72', usage: 'Panels, side nav, cards, table rows over the scene: oklch(from var(--hrs-tint) l c h / var(--hrs-surface-alpha)).' },
      { name: 'hrs-surface-alpha-raised', value: '0.92', usage: 'Popovers, menus, selects, drawers, tooltips, the top bar: nearly solid so text stays legible over anything.' },
      { name: 'hrs-surface-alpha-modal', value: '0.9', usage: 'The modal dialog panel.' },
      { name: 'hrs-scrim-alpha', value: '0.6', usage: 'The page scrim under a modal, drawn in hrs-ground.' },
      { name: 'hrs-hover-alpha', value: '0.5', usage: 'Hovered rows and list items: hrs-selection at this alpha.' },
    ],
  },
  effect: {
    note: 'Backdrop blur is a setting, off by default (CPU cost over the animated scene). When on, these are the values.',
    tokens: [
      { name: 'hrs-backdrop', value: 'none', usage: 'backdrop-filter of panels and the side nav. Setting on: blur(6px).' },
      { name: 'hrs-backdrop-raised', value: 'none', usage: 'backdrop-filter of popovers, menus, drawers and the top bar. Setting on: blur(10px).' },
      { name: 'hrs-backdrop-modal', value: 'none', usage: 'backdrop-filter of the modal scrim. Setting on: blur(12px) saturate(0.8).' },
      { name: 'hrs-pattern-alpha', value: '0.07', usage: "Strength of the low-poly mesh (an SVG wireframe mask in the theme's accent): the modal scrim at this value; the TopBar mesh at 1.2× with the rolling band at 4×. A stand-in until the game's own mesh and flash textures are extracted (README › Game assets)." },
      { name: 'hrs-nav-shimmer', value: '8s', usage: "One pass of the TopBar shimmer through the triangle mask (the game's BackgroundTriangleShimmer animation: an 8 s loop, UV scroll with a 0→255→0 fade envelope). Off under prefers-reduced-motion." },
      { name: 'hrs-nav-pulse', value: '4s', usage: "The selected nav button's glow pulse (the game's GlowImage Toggled animation: fade 0→255 over 2 s, back over 2 s, looping)." },
      { name: 'hrs-nav-sparkle', value: '1.8s', usage: "One rise of a selected-button sparkle triangle (the game's ShapesContainer SparkleAnim: rise over 1.8 s, fade in at 0.5 s and out at 1.6 s, a 3 s spin)." },
    ],
  },
};
