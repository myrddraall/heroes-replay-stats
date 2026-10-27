import {
  DataTexture,
  FloatType,
  Matrix3,
  Matrix4,
  NearestFilter,
  type Node,
  type NodeBuilder,
  type NodeFrame,
  type Object3D,
  RGBAFormat,
  type Texture,
  TextureNode,
  Vector2,
  Vector3,
  Vector4,
} from 'three/webgpu';
import { int, ivec2, textureLoad, uniform } from 'three/tsl';
import type { UniformSet } from './uniforms';
import { rimTurn } from '../../space/directions';
import { MAX_FIELDS, MAX_LIGHTS, MAX_SHADES, MAX_SURFACES, V_SAMPLES } from './limits';

/**
 * The uniforms a shader reads, by the names `UniformSet` sets them by (uLightDir, uLayers[0].color
 * and the like), made as the shader is built, only those it reads; and each draw's values for
 * them (`DrawValues`), from its `UniformSet` (`apply`), so the CPU side works the numbers out as
 * it always has. A material many draws share reads each draw's values as it draws it (`perDraw`):
 * its shader is built once, however many draws it has.
 *
 * The arrays (each light's, each shade's, a grid's fields, the v tables, the surfaces) are packed
 * as vec4 rows, one run of rows per kind (`PACKS`), into one float texture a draw has of its own
 * (its texels read as they are). Not uniform arrays: three.js names each in the shader by its
 * node's id, so two materials of the same shader would be two programs, each compiled; a texture
 * is named by where the shader first reads it, the same in every material of that shader.
 */

/** How many lights, shades and grid fields a body's list of reaches holds at most. */
const MAX_REACHES = MAX_LIGHTS + MAX_SHADES + 2 * MAX_FIELDS;
/**
 * Each reach's rows: 0 its direction as reachOf takes it (a shade's and a field's turned about)
 * and softness (a field's falloff); 1 its colour and kind; 2 its specular colour and fade; 3 its
 * place and wrap (a field's spread); 4 its aim and role (0 light, 1 shade, 2 reveal, 3 activation);
 * 5 its ground colour; 6 its cone; 7 its amounts (x strength, y energy, z glow); 8 to 10 a rim's
 * turn of the view (`turnReaches`), the rows of its matrix.
 */
const REACH_ROWS = 11;
/** The rim's kind of light (its view turned by its aim: `turnReaches`). */
const RIM = 5;

/** A packed array: how many entries, how many vec4 rows each, and where each uniform array lands in them. */
interface Pack {
  readonly count: number;
  readonly rows: number;
  /** By uniform name: its row, its first component in the row, and its width (1 to 4). */
  readonly fields: Readonly<Record<string, readonly [row: number, offset: number, width: number]>>;
}

export const PACKS = {
  /**
   * Every light, shade, reveal and activation on a body, in that order, in one list (the shader
   * reads them in one loop, `uReachCount` long): packed from their own arrays (`packReaches`).
   */
  reaches: { count: MAX_REACHES, rows: REACH_ROWS, fields: {} },
  /** A uv sphere's v tables: x the first mapping's, y the second's. */
  vTable: {
    count: V_SAMPLES,
    rows: 1,
    fields: { 'uMap.v[0]': [0, 0, 1], 'uMap2.v[0]': [0, 1, 1] },
  },
  surfaces: { count: MAX_SURFACES, rows: 1, fields: { uSurfaces: [0, 0, 4] } },
} as const satisfies Record<string, Pack>;

export type PackName = keyof typeof PACKS;

/** Where each pack's rows start in a draw's table, every pack in it whether its shader reads it or not. */
const PACK_START = (() => {
  let at = 0;
  const start = {} as Record<PackName, number>;
  for (const [name, { count, rows }] of Object.entries(PACKS) as [PackName, Pack][]) {
    start[name] = at;
    at += count * rows;
  }
  return { start, rows: at };
})();

/** Each packed uniform array's pack, by its name. */
const PACKED = new Map<string, { pack: PackName; row: number; offset: number; width: number }>(
  (Object.entries(PACKS) as [PackName, Pack][]).flatMap(([pack, { fields }]) =>
    Object.entries(fields).map(
      ([name, [row, offset, width]]) => [name, { pack, row, offset, width }] as const,
    ),
  ),
);

type Kind = 'int' | 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat3' | 'mat4';
type Value = number | Vector2 | Vector3 | Vector4 | Matrix3 | Matrix4;
/** A uniform node given its value as each object is drawn (what the callback returns, if anything). */
interface Updated<V> {
  onObjectUpdate(callback: (frame: NodeFrame) => V | undefined): unknown;
}
/** A value as a draw gives it: a number, or a vector's or matrix's numbers (a matrix's by column). */
type Given = number | ArrayLike<number>;

const initial = (kind: Exclude<Kind, 'int' | 'float'>): Exclude<Value, number> => {
  switch (kind) {
    case 'vec2':
      return new Vector2();
    case 'vec3':
      return new Vector3();
    case 'vec4':
      return new Vector4();
    case 'mat3':
      return new Matrix3();
    case 'mat4':
      return new Matrix4();
  }
};

/**
 * A texture a draw gives by name (`ShaderUniforms.texture`), taken from it as each object is drawn,
 * its uniform named by that name (three.js names a texture's uniform by the texture, so two names
 * given one texture would share one binding, and the shader would change with which share one).
 * Its samples (clones of it) take it into it, and name theirs by it. Read as three.js reads a
 * texture where it `flips` (WebGL's render targets upside down), else as it is.
 */
class DrawTexture extends TextureNode {
  key = '';
  flips = false;
  pick: ((frame: NodeFrame) => Texture) | null = null;

  constructor(
    value?: Texture,
    uvNode?: Node | null,
    levelNode?: Node | null,
    biasNode?: Node | null,
  ) {
    super(value, uvNode, levelNode, biasNode);
    // Read where it is asked, never through a texture's uv matrix (three.js gives a node made
    // without coordinates one, and `textureLoad` clones it so: a uniform and a multiply each read).
    this.updateMatrix = false;
    // Updated for every object drawn (three.js sets a texture node's update type as it is built: this one's stays).
    Object.defineProperty(this, 'updateType', { get: () => 'object', set: () => undefined });
  }

  private get base(): DrawTexture {
    return this.getBase() as DrawTexture;
  }

  override getUniformHash(builder: NodeBuilder): string {
    return this.base.key || super.getUniformHash(builder);
  }

  /** (three.js's own, which on WebGL turns every read over or not by a uniform, kept only where it `flips`.) */
  setupUV(builder: NodeBuilder, uvNode: Node): Node {
    if (!this.base.flips) return uvNode;
    return (
      TextureNode.prototype as unknown as { setupUV(b: NodeBuilder, uv: Node): Node }
    ).setupUV.call(this, builder, uvNode);
  }

  override update(frame: NodeFrame): boolean | undefined {
    const { base } = this;
    if (base.pick) this.value = base.pick(frame);
    return base.flips ? super.update(frame) : undefined;
  }
}

export class ShaderUniforms {
  private readonly entries = new Map<string, { readonly kind: Kind; readonly node: unknown }>();
  private readonly textures = new Map<string, DrawTexture>();
  /** Its one draw's values, unless it reads each draw's (`perDraw`). */
  private readonly own: DrawValues | null;
  private readonly read: (frame: NodeFrame) => DrawValues;

  /**
   * `perDraw`: its values read from each object as it is drawn (`withValues`), for a material many
   * draws share; else its own, given by `set` and `apply`.
   */
  constructor(perDraw = false) {
    if (perDraw) {
      this.own = null;
      this.read = ({ object }) => valuesOf(object);
    } else {
      const own = new DrawValues();
      this.own = own;
      this.read = () => own;
    }
  }

  private get<K extends Kind>(name: string, kind: K, fallback = 0): Node<K> {
    let entry = this.entries.get(name);
    if (!entry) {
      const read = this.read;
      if (kind === 'int' || kind === 'float') {
        const node = (kind === 'int'
          ? uniform(fallback, 'int')
          : uniform(fallback)) as unknown as Updated<number>;
        node.onObjectUpdate((frame) => {
          const v = read(frame).get(name);
          return v === undefined ? fallback : typeof v === 'number' ? v : (v[0] ?? fallback);
        });
        entry = { kind, node };
      } else {
        // One value, each draw's numbers copied into it as it is drawn (its own, or none given: its first).
        const value = initial(kind as Exclude<Kind, 'int' | 'float'>) as Vector4;
        const blank = value.clone();
        const node = uniform(value) as unknown as Updated<Value>;
        node.onObjectUpdate((frame) => {
          const v = read(frame).get(name);
          if (v === undefined || typeof v === 'number') value.copy(blank);
          else value.fromArray(v);
          return undefined;
        });
        entry = { kind, node };
      }
      this.entries.set(name, entry);
    }
    if (entry.kind !== kind)
      throw new Error(`uniform ${name} read as ${kind}, made as ${entry.kind}`);
    return entry.node as Node<K>;
  }

  int(name: string, value?: number): Node<'int'> {
    return this.get(name, 'int', value);
  }
  float(name: string, value?: number): Node<'float'> {
    return this.get(name, 'float', value);
  }
  vec2(name: string): Node<'vec2'> {
    return this.get(name, 'vec2');
  }
  vec3(name: string): Node<'vec3'> {
    return this.get(name, 'vec3');
  }
  vec4(name: string): Node<'vec4'> {
    return this.get(name, 'vec4');
  }
  mat3(name: string): Node<'mat3'> {
    return this.get(name, 'mat3');
  }
  mat4(name: string): Node<'mat4'> {
    return this.get(name, 'mat4');
  }

  /**
   * A texture the draw gives by `name` (its `textures`), `placeholder` until it is drawn; `flips`:
   * read as three.js reads a texture (where it is a render target's), else as it is (an image's).
   */
  texture(name: string, placeholder: Texture, flips = false): TextureNode {
    let node = this.textures.get(name);
    if (!node) {
      const read = this.read;
      node = new DrawTexture(placeholder);
      node.key = `draw:${name}`;
      node.flips = flips;
      node.pick = (frame) => read(frame).textures[name] ?? placeholder;
      this.textures.set(name, node);
    }
    return node;
  }

  /** The draw's table (`DrawValues.tableTexture`). */
  private table(): TextureNode {
    let node = this.textures.get(TABLE);
    if (!node) {
      const read = this.read;
      node = new DrawTexture(newTable().texture);
      node.key = `draw:${TABLE}`;
      node.pick = (frame) => read(frame).tableTexture;
      this.textures.set(TABLE, node);
    }
    return node;
  }

  /** A packed array's row for entry i (a light, a shade, a field, a v-table sample, a surface). */
  row(pack: PackName, i: Node<'int'> | number, row: number): Node<'vec4'> {
    const { rows } = PACKS[pack];
    const first = PACK_START.start[pack] + row;
    const at =
      typeof i === 'number' ? int(first + i * rows) : (rows === 1 ? i : i.mul(rows)).add(first);
    return textureLoad(this.table(), ivec2(at, int(0))) as unknown as Node<'vec4'>;
  }

  /** Its one draw's values (a shared material's are each draw's: `withValues`). */
  get values(): DrawValues {
    if (!this.own)
      throw new Error('a shared material takes its values from each draw (`withValues`)');
    return this.own;
  }

  /** A value set directly (not from a `UniformSet`). */
  set(name: string, value: Given): void {
    this.values.set(name, value);
  }

  /** The values a `UniformSet` gives. */
  apply(set: UniformSet): void {
    this.values.apply(set);
  }
}

/** The name a draw's table goes by among its textures. */
const TABLE = 'table';

function newTable(): { texture: DataTexture; data: Float32Array<ArrayBuffer> } {
  const data = new Float32Array(PACK_START.rows * 4);
  const texture = new DataTexture(data, PACK_START.rows, 1, RGBAFormat, FloatType);
  texture.minFilter = texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, data };
}

/** The values an object drawn with a shared material gives its shader (see `withValues`). */
function valuesOf(object: Object3D | null): DrawValues {
  const values = object?.userData['values'] as DrawValues | undefined;
  if (!values)
    throw new Error(
      `${object?.name || 'an object'} is drawn with a shared material but has no values`,
    );
  return values;
}

/** An object given its draw's values, which a shared material reads as it is drawn. */
export function withValues<T extends Object3D>(object: T, values: DrawValues): T {
  object.userData['values'] = values;
  return object;
}

/**
 * A turn of the view (about `up` by x, then about `right` by y), as the rows of its matrix: worked
 * out once on the CPU in place of turning the view in the shader.
 */
function viewTurn(right: ArrayLike<number>, up: ArrayLike<number>, x: number, y: number): number[] {
  const a = turning(right, y);
  const b = turning(up, x);
  return Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  });
}

/** A turn about an axis by an angle (`v c + (axis × v) s + axis (axis · v)(1 - c)`), as the rows of its matrix. */
function turning(axis: ArrayLike<number>, angle: number): number[] {
  const x = axis[0] ?? 0;
  const y = axis[1] ?? 0;
  const z = axis[2] ?? 0;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = 1 - c;
  return [
    c + x * x * k,
    x * y * k - z * s,
    x * z * k + y * s,
    y * x * k + z * s,
    c + y * y * k,
    y * z * k - x * s,
    z * x * k - y * s,
    z * y * k + x * s,
    c + z * z * k,
  ];
}

/** A matrix's rows by its columns (as a mat3 uniform takes it). */
const byColumn = (m: readonly number[]) => [
  m[0]!,
  m[3]!,
  m[6]!,
  m[1]!,
  m[4]!,
  m[7]!,
  m[2]!,
  m[5]!,
  m[8]!,
];

const LAYERS = [0, 1, 2, 3, 4];
/**
 * Values worked out from others as they are read, not set: each layer's turn as cos and sin
 * (`spin`), and its fresnel's view turned by its lean and the body's rim turn (`view`).
 */
const DERIVED = new Map<string, (v: DrawValues) => Given>(
  LAYERS.flatMap((i) => [
    [
      `uLayers[${i}].spin`,
      (v: DrawValues) => {
        const angle = v.scalar(`uLayers[${i}].angle`);
        return [Math.cos(angle), Math.sin(angle)];
      },
    ],
    [
      `uLayers[${i}].view`,
      (v: DrawValues) => {
        const lean = v.vector(`uLayers[${i}].fTurn`);
        const rim = v.vector('uRimTurn');
        return byColumn(
          viewTurn(
            v.vector('uRight'),
            v.vector('uUp'),
            (lean[0] ?? 0) + (rim[0] ?? 0),
            (lean[1] ?? 0) + (rim[1] ?? 0),
          ),
        );
      },
    ],
  ]),
);

/** The values that turn the reaches' views (`turnReaches`). */
const TURNS_FROM = new Set(['uRight', 'uUp', 'uRimTurn', 'uRevealed']);
/**
 * The values that turn the reaches into the frame the draw is shaded in (`frameReaches`): the
 * turn of its lights' directions and places, and of its leans (into the view), from the body's
 * placement frame they are set in. Not the shader's: worked out here, into the rows it reads.
 */
const FRAMES_FROM = new Set(['uLightTurn', 'uLeanTurn']);

/** Whether a turn (a mat3's numbers by column) is none at all, number for number; none given: none. */
const noTurn = (m: ArrayLike<number>) =>
  m.length === 0 ||
  (m[0] === 1 &&
    m[1] === 0 &&
    m[2] === 0 &&
    m[3] === 0 &&
    m[4] === 1 &&
    m[5] === 0 &&
    m[6] === 0 &&
    m[7] === 0 &&
    m[8] === 1);

/** A vector turned by a mat3 (its numbers by column). */
const turned = (
  m: ArrayLike<number>,
  x: number,
  y: number,
  z: number,
): [number, number, number] => [
  m[0]! * x + m[3]! * y + m[6]! * z,
  m[1]! * x + m[4]! * y + m[7]! * z,
  m[2]! * x + m[5]! * y + m[8]! * z,
];

/** How many floats a body's list of reaches takes. */
const REACH_FLOATS = MAX_REACHES * REACH_ROWS * 4;

/**
 * A draw's values for its shader, by uniform name, and its textures by the names its shader reads
 * them by (`ShaderUniforms.texture`): its packed arrays in a table of its own (made as it is first
 * needed). Every value given is kept, whether its shader reads it or not.
 */
export class DrawValues {
  private readonly values = new Map<string, Given>();
  private tableOf: { texture: DataTexture; data: Float32Array<ArrayBuffer> } | null = null;
  /**
   * Its reaches as packed (`packReaches`), as set: in the body's placement frame. Turned into
   * the frame it is shaded in as they go into the table (`frameReaches`).
   */
  private sourceOf: Float32Array | null = null;
  /** Whether the reaches are to be turned into the table again (see `frameReaches`). */
  private framesStale = true;
  /** Whether the reaches' turns of the view are to be worked out again (see `turnReaches`). */
  private turnsStale = true;

  constructor(readonly textures: Readonly<Record<string, Texture>> = {}) {}

  get(name: string): Given | undefined {
    return this.values.get(name) ?? DERIVED.get(name)?.(this);
  }

  scalar(name: string): number {
    const v = this.get(name);
    return typeof v === 'number' ? v : (v?.[0] ?? 0);
  }

  vector(name: string): ArrayLike<number> {
    const v = this.get(name);
    return v === undefined ? [] : typeof v === 'number' ? [v] : v;
  }

  set(name: string, value: Given): void {
    this.values.set(name, value);
    if (TURNS_FROM.has(name)) this.turnsStale = true;
    if (FRAMES_FROM.has(name)) this.framesStale = true;
  }

  private get table(): { texture: DataTexture; data: Float32Array<ArrayBuffer> } {
    return (this.tableOf ??= newTable());
  }

  /** Its table as drawn: its reaches turned into its frame, and their turns of the view, brought up to date first. */
  get tableTexture(): DataTexture {
    if (this.framesStale) this.frameReaches();
    if (this.turnsStale) this.turnReaches();
    return this.table.texture;
  }

  /** Its table's texture, if it has one, to let go of with the draw. */
  get texture(): DataTexture | null {
    return this.tableOf?.texture ?? null;
  }

  /** The values a `UniformSet` gives (its arrays packed into the table). */
  apply(set: UniformSet): void {
    let changed = false;
    for (const [name, { value }] of set.values) {
      this.set(name, value);
      const packed = PACKED.get(name);
      if (!packed) continue;
      const { data } = this.table;
      const { count, rows } = PACKS[packed.pack];
      const start = PACK_START.start[packed.pack];
      for (let i = 0; i < count; i++)
        for (let c = 0; c < packed.width; c++) {
          const v = value[i * packed.width + c];
          if (v === undefined) continue;
          const at = (start + i * rows + packed.row) * 4 + packed.offset + c;
          if (data[at] !== v) {
            data[at] = v;
            changed = true;
          }
        }
    }
    // A body's set (with any of the counts: an unlit one has no lights, but may have shades and a grid).
    if (REACH_COUNTS.some((name) => set.values.has(name))) {
      packReaches(set, (this.sourceOf ??= new Float32Array(REACH_FLOATS)), 0);
      this.set('uReachCount', reachCount(set));
      this.framesStale = true;
      this.turnsStale = true;
    }
    if (changed) this.table.texture.needsUpdate = true;
  }

  /**
   * The reaches into the table, from the body's placement frame (as set) into the frame the draw
   * is shaded in: each one's direction, place and aim (rows 0, 3, 4; their fourth numbers kept)
   * turned by `uLightTurn`; a rim's aim (its lean's turn of the view, row 4) worked out again from
   * its lean (the way it comes from: its row 0 the other way) turned into the view by `uLeanTurn`.
   * A turn that is none copies the rows as they are, number for number.
   */
  private frameReaches(): void {
    this.framesStale = false;
    this.turnsStale = true;
    const source = this.sourceOf;
    if (!source) return;
    const { data, texture } = this.table;
    const lightTurn = this.vector('uLightTurn');
    const leanTurn = this.vector('uLeanTurn');
    const lights = !noTurn(lightTurn);
    const leans = !noTurn(leanTurn);
    const start = PACK_START.start.reaches * 4;
    let changed = false;
    const put = (at: number, v: number) => {
      const f = Math.fround(v);
      if (data[at] !== f) {
        data[at] = f;
        changed = true;
      }
    };
    for (let i = 0; i < this.scalar('uReachCount'); i++) {
      const from = i * REACH_ROWS * 4;
      const to = start + from;
      for (let k = 0; k < 8 * 4; k++) put(to + k, source[from + k]!);
      const rim = source[from + 4 + 3] === RIM;
      if (lights)
        for (const row of rim ? [0, 3] : [0, 3, 4]) {
          const at = from + row * 4;
          const v = turned(lightTurn, source[at]!, source[at + 1]!, source[at + 2]!);
          for (let c = 0; c < 3; c++) put(to + row * 4 + c, v[c]!);
        }
      if (rim && leans) {
        const lean = turned(leanTurn, -source[from]!, -source[from + 1]!, -source[from + 2]!);
        const [yaw, pitch] = rimTurn(lean);
        put(to + 16, -yaw);
        put(to + 17, -pitch);
      }
    }
    if (changed) texture.needsUpdate = true;
  }

  /**
   * Each rim's turn of the view into its rows (8 to 10): its aim's (and, where its grid is
   * revealed, the body's rim turn added, as its pattern's fresnel turns it), about the view's up
   * and right, which change with the view.
   */
  private turnReaches(): void {
    this.turnsStale = false;
    const table = this.tableOf;
    if (!table) return;
    const { data } = table;
    const right = this.vector('uRight');
    const up = this.vector('uUp');
    const rim = this.scalar('uRevealed') === 1 ? this.vector('uRimTurn') : [0, 0];
    const start = PACK_START.start.reaches * 4;
    let changed = false;
    for (let i = 0; i < this.scalar('uReachCount'); i++) {
      const at = start + i * REACH_ROWS * 4;
      if (data[at + 4 + 3] !== RIM) continue;
      const m = viewTurn(right, up, data[at + 16]! + (rim[0] ?? 0), data[at + 17]! + (rim[1] ?? 0));
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          const to = at + (8 + r) * 4 + c;
          // (Compared as the table holds it, a 32-bit float: the same turn sends nothing again.)
          const v = Math.fround(m[r * 3 + c]!);
          if (data[to] !== v) {
            data[to] = v;
            changed = true;
          }
        }
    }
    if (changed) table.texture.needsUpdate = true;
  }
}

/** The counts of what goes into a body's list of reaches (any of them in a set: it is a body's). */
const REACH_COUNTS = ['uLightCount', 'uShadeCount', 'uRevealCount', 'uActivationCount'];

/** A value of a set: its first number, or a vector's numbers at entry i (each `width` wide). */
const valueOf = (set: UniformSet, name: string) => set.values.get(name)?.value;
const scalar = (set: UniformSet, name: string) => valueOf(set, name)?.[0] ?? 0;

/** How many reaches a body's set has: its lights, shades, reveals (where its grid is revealed) and activations. */
function reachCount(set: UniformSet): number {
  const count = (name: string, max: number) => Math.min(max, Math.max(0, scalar(set, name)));
  const reveals = scalar(set, 'uRevealed') === 1 ? count('uRevealCount', MAX_FIELDS) : 0;
  return (
    count('uLightCount', MAX_LIGHTS) +
    count('uShadeCount', MAX_SHADES) +
    reveals +
    count('uActivationCount', MAX_FIELDS)
  );
}

/**
 * A body's lights, shades, reveals and activations, from their own arrays into the one list of
 * reaches (rows as `REACH_ROWS` says), at `start` (a float index) of `data` (the draw's reaches as
 * set, in the body's placement frame: `frameReaches` turns them into the table); whether any
 * number changed.
 */
function packReaches(set: UniformSet, data: Float32Array, start: number): boolean {
  let changed = false;
  let entry = 0;
  const put = (row: number, offset: number, values: readonly number[]) => {
    values.forEach((v, c) => {
      const at = start + (entry * REACH_ROWS + row) * 4 + offset + c;
      if (data[at] !== v) {
        data[at] = v;
        changed = true;
      }
    });
  };
  const of = (name: string, i: number, width: number, sign = 1) =>
    Array.from({ length: width }, (_, c) => sign * (valueOf(set, name)?.[i * width + c] ?? 0));
  const count = (name: string, max: number) => Math.min(max, Math.max(0, scalar(set, name)));
  const add = (
    role: number,
    i: number,
    p: {
      dir: string;
      dirSign: number;
      softness: string;
      color?: string;
      kind: string;
      specular?: string;
      fade: string;
      pos: string;
      wrap: string;
      aim: string;
      ground?: string;
      cone: string;
      strength?: string;
      energy?: string;
      glow?: string;
    },
  ) => {
    put(0, 0, [...of(p.dir, i, 3, p.dirSign), ...of(p.softness, i, 1)]);
    put(1, 0, [...(p.color ? of(p.color, i, 3) : [0, 0, 0]), ...of(p.kind, i, 1)]);
    put(2, 0, [...(p.specular ? of(p.specular, i, 3) : [0, 0, 0]), ...of(p.fade, i, 1)]);
    put(3, 0, [...of(p.pos, i, 3), ...of(p.wrap, i, 1)]);
    put(4, 0, [...of(p.aim, i, 3), role]);
    put(5, 0, [...(p.ground ? of(p.ground, i, 3) : [0, 0, 0]), 0]);
    put(6, 0, of(p.cone, i, 4));
    put(7, 0, [
      p.strength ? of(p.strength, i, 1)[0]! : 0,
      p.energy ? of(p.energy, i, 1)[0]! : 0,
      p.glow ? of(p.glow, i, 1)[0]! : 0,
      0,
    ]);
    entry++;
  };
  for (let i = 0; i < count('uLightCount', MAX_LIGHTS); i++)
    add(0, i, {
      dir: 'uLightDir',
      dirSign: 1,
      softness: 'uLightSoftness',
      color: 'uLightColor',
      kind: 'uLightKind',
      specular: 'uLightSpecular',
      fade: 'uLightFade',
      pos: 'uLightPos',
      wrap: 'uLightWrap',
      aim: 'uLightAim',
      ground: 'uLightGround',
      cone: 'uLightCone',
    });
  for (let i = 0; i < count('uShadeCount', MAX_SHADES); i++)
    add(1, i, {
      dir: 'uShadeDir',
      dirSign: -1,
      softness: 'uShadeSoftness',
      color: 'uShadeColor',
      kind: 'uShadeKind',
      fade: 'uShadeFade',
      pos: 'uShadePos',
      wrap: 'uShadeWrap',
      aim: 'uShadeAim',
      cone: 'uShadeCone',
      strength: 'uShadeStrength',
    });
  const field = (prefix: 'Reveal' | 'Activation') => ({
    dir: `u${prefix}From`,
    dirSign: -1,
    softness: `u${prefix}Falloff`,
    kind: `u${prefix}Kind`,
    fade: `u${prefix}Fade`,
    pos: `u${prefix}Pos`,
    wrap: `u${prefix}Spread`,
    aim: `u${prefix}Aim`,
    cone: `u${prefix}Cone`,
    strength: `u${prefix}Strength`,
  });
  if (scalar(set, 'uRevealed') === 1)
    for (let i = 0; i < count('uRevealCount', MAX_FIELDS); i++) add(2, i, field('Reveal'));
  for (let i = 0; i < count('uActivationCount', MAX_FIELDS); i++)
    add(3, i, { ...field('Activation'), energy: 'uActivationEnergy', glow: 'uActivationGlow' });
  return changed;
}
