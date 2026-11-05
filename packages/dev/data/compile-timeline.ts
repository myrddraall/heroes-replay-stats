/** `KHR_parallel_shader_compile`'s query: whether a program has finished compiling and linking. */
const COMPLETION_STATUS_KHR = 0x91b1;
/** How often programs still compiling are asked whether they're done (ms). */
const POLL_MS = 4;
/** What in a program's info log tells of Direct3D's compiler trying again or giving up on loops. */
const LOG_FLAGS = ['X3531', 'X4014', 'X3504', 'X3511', 'X3550', 'X3570', 'Retrying'];

/** One WebGL program as the timeline saw it compile (times from the timeline's start, ms). */
export interface ProgramRecord {
  /** Its number, in the order the page linked them. */
  readonly id: number;
  readonly fragmentLines: number;
  readonly vertexBytes: number;
  readonly fragmentBytes: number;
  readonly requestedAt: number;
  /** How long the link call itself took (it shouldn't wait on the compile). */
  readonly linkCallMs: number;
  completedAt: number | null;
  /** How long the page was held up asking whether it linked before it had (a synchronous wait). */
  syncWaitMs: number;
  /** The first draw with it, and when the GPU had done everything up to and after it. */
  firstDrawAt: number | null;
  firstDrawDoneAt: number | null;
  /** The shaders' sizes as translated for the GPU (HLSL on Direct3D), where the browser tells. */
  translatedVertexBytes: number | null;
  translatedFragmentBytes: number | null;
  /** What of LOG_FLAGS its info log has. */
  flags: string[];
  log: string;
}

/** One WebGPU pipeline: made ahead (async) or at once (sync, built when first drawn with). */
export interface PipelineRecord {
  readonly kind: 'async' | 'sync';
  /** Its label, as three.js gives it. */
  readonly label: string;
  readonly requestedAt: number;
  resolvedAt: number | null;
  readonly codeBytes: number;
}

/** What else the page spent its time on while the timeline ran (ms). */
export interface PageCosts {
  getContextMs: number;
  /** WebGPU's start: asking for its adapter and its device, until each was given. */
  gpuStartMs: number;
  /** Texture uploads, WebGL's and WebGPU's (the time the calls took). */
  textureUploadMs: number;
  longTasks: number;
  longestTaskMs: number;
}

const noCosts = (): PageCosts => ({
  getContextMs: 0,
  gpuStartMs: 0,
  textureUploadMs: 0,
  longTasks: 0,
  longestTaskMs: 0,
});

/**
 * Every shader program the page compiles while it is installed, timed: WebGL programs from their
 * link to when they're done (asked every few ms through `KHR_parallel_shader_compile`, which asks
 * the GPU process without waiting on it), any synchronous wait on one, its first draw, its info
 * log and translated size; WebGPU pipelines made ahead and made at once; and the page's other
 * costs (contexts, texture uploads, long tasks). Taken per test: `take` hands over what was seen
 * since the last take.
 */
export class CompileTimeline {
  private readonly start = performance.now();
  private programs: ProgramRecord[] = [];
  private pipelines: PipelineRecord[] = [];
  private costs: PageCosts = noCosts();
  private readonly pending = new Map<
    WebGLProgram,
    { gl: WebGL2RenderingContext; record: ProgramRecord }
  >();
  private readonly records = new WeakMap<WebGLProgram, ProgramRecord>();
  private readonly attached = new WeakMap<WebGLProgram, WebGLShader[]>();
  private readonly sources = new WeakMap<WebGLShader, string>();
  private readonly current = new WeakMap<WebGL2RenderingContext, WebGLProgram | null>();
  private nextId = 1;
  private timer: ReturnType<typeof setInterval> | 0 = 0;

  /** Now, on the timeline (ms). */
  now(): number {
    return performance.now() - this.start;
  }

  /** A `performance.now()` time, on the timeline (ms). */
  fromPerformance(t: number): number {
    return t - this.start;
  }

  /** What was seen since the last take (or the install). */
  take(): { programs: ProgramRecord[]; pipelines: PipelineRecord[]; costs: PageCosts } {
    const taken = { programs: this.programs, pipelines: this.pipelines, costs: this.costs };
    this.programs = [];
    this.pipelines = [];
    this.costs = noCosts();
    return taken;
  }

  /** The hooks put in; the originals back when the returned function is called. */
  install(): () => void {
    const restores = [
      this.hookWebGl(),
      this.hookWebGpu(),
      this.hookCanvas(),
      this.observeLongTasks(),
    ];
    return () => {
      clearInterval(this.timer);
      this.timer = 0;
      for (const restore of restores) restore();
    };
  }

  private hookWebGl(): () => void {
    const proto = WebGL2RenderingContext.prototype;
    const saved = {
      shaderSource: proto.shaderSource,
      attachShader: proto.attachShader,
      linkProgram: proto.linkProgram,
      getProgramParameter: proto.getProgramParameter,
      useProgram: proto.useProgram,
      drawArrays: proto.drawArrays,
      drawArraysInstanced: proto.drawArraysInstanced,
      drawElements: proto.drawElements,
      drawElementsInstanced: proto.drawElementsInstanced,
      texImage2D: proto.texImage2D,
      texSubImage2D: proto.texSubImage2D,
    };
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const timeline = this;
    proto.shaderSource = function (
      this: WebGL2RenderingContext,
      shader: WebGLShader,
      source: string,
    ) {
      timeline.sources.set(shader, source);
      saved.shaderSource.call(this, shader, source);
    };
    proto.attachShader = function (
      this: WebGL2RenderingContext,
      program: WebGLProgram,
      shader: WebGLShader,
    ) {
      const list = timeline.attached.get(program) ?? [];
      list.push(shader);
      timeline.attached.set(program, list);
      saved.attachShader.call(this, program, shader);
    };
    proto.linkProgram = function (this: WebGL2RenderingContext, program: WebGLProgram) {
      const at = timeline.now();
      saved.linkProgram.call(this, program);
      timeline.linked(this, program, at, timeline.now() - at);
    };
    proto.getProgramParameter = function (
      this: WebGL2RenderingContext,
      program: WebGLProgram,
      pname: GLenum,
    ) {
      const waiting = pname === this.LINK_STATUS ? timeline.pending.get(program) : undefined;
      const at = timeline.now();
      const value: unknown = saved.getProgramParameter.call(this, program, pname);
      if (waiting) {
        // Asked whether it linked before it was done: the page waited for it, here.
        waiting.record.syncWaitMs += timeline.now() - at;
        timeline.done(waiting.gl, program, waiting.record);
      }
      return value;
    } as typeof proto.getProgramParameter;
    proto.useProgram = function (this: WebGL2RenderingContext, program: WebGLProgram | null) {
      timeline.current.set(this, program);
      saved.useProgram.call(this, program);
    };
    const drawn = (gl: WebGL2RenderingContext) => {
      const program = timeline.current.get(gl);
      const record = program ? timeline.records.get(program) : undefined;
      if (!record || record.firstDrawAt !== null) return;
      record.firstDrawAt = timeline.now();
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (gl.isContextLost()) return; // no time: the context went
        if (!sync || gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED) {
          record.firstDrawDoneAt = timeline.now();
          if (sync) gl.deleteSync(sync);
        } else setTimeout(poll, POLL_MS);
      };
      poll();
    };
    proto.drawArrays = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof proto.drawArrays>
    ) {
      saved.drawArrays.apply(this, args);
      drawn(this);
    };
    proto.drawArraysInstanced = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof proto.drawArraysInstanced>
    ) {
      saved.drawArraysInstanced.apply(this, args);
      drawn(this);
    };
    proto.drawElements = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof proto.drawElements>
    ) {
      saved.drawElements.apply(this, args);
      drawn(this);
    };
    proto.drawElementsInstanced = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof proto.drawElementsInstanced>
    ) {
      saved.drawElementsInstanced.apply(this, args);
      drawn(this);
    };
    const upload = <F extends (...a: never[]) => void>(original: F) =>
      function (this: WebGL2RenderingContext, ...args: Parameters<F>) {
        const at = performance.now();
        (original as unknown as (...a: unknown[]) => void).apply(this, args);
        timeline.costs.textureUploadMs += performance.now() - at;
      } as unknown as F;
    proto.texImage2D = upload(saved.texImage2D);
    proto.texSubImage2D = upload(saved.texSubImage2D);
    return () => Object.assign(proto, saved);
  }

  private linked(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    at: number,
    linkCallMs: number,
  ): void {
    const shaders = this.attached.get(program) ?? [];
    const vertexShader = shaders.find((s) => /gl_Position/.test(this.sources.get(s) ?? ''));
    const vertex = vertexShader ? (this.sources.get(vertexShader) ?? '') : '';
    const fragment = this.sources.get(shaders.find((s) => s !== vertexShader)!) ?? '';
    gl.getExtension('KHR_parallel_shader_compile'); // the query asked below
    const record: ProgramRecord = {
      id: this.nextId++,
      fragmentLines: fragment.split('\n').length,
      vertexBytes: vertex.length,
      fragmentBytes: fragment.length,
      requestedAt: at,
      linkCallMs,
      completedAt: null,
      syncWaitMs: 0,
      firstDrawAt: null,
      firstDrawDoneAt: null,
      translatedVertexBytes: null,
      translatedFragmentBytes: null,
      flags: [],
      log: '',
    };
    this.programs.push(record);
    this.records.set(program, record);
    this.pending.set(program, { gl, record });
    if (!this.timer) this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  private poll(): void {
    for (const [program, { gl, record }] of this.pending) {
      if (gl.isContextLost()) {
        this.pending.delete(program);
        continue;
      }
      const ready = gl.getExtension('KHR_parallel_shader_compile')
        ? (browserGetProgramParameter.call(gl, program, COMPLETION_STATUS_KHR) as boolean)
        : true;
      if (ready) this.done(gl, program, record);
    }
    if (!this.pending.size) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private done(gl: WebGL2RenderingContext, program: WebGLProgram, record: ProgramRecord): void {
    if (!this.pending.delete(program)) return;
    record.completedAt = this.now();
    // Read now it's done (before, they would wait for it).
    record.log = gl.getProgramInfoLog(program) ?? '';
    const debug = gl.getExtension('WEBGL_debug_shaders');
    for (const shader of this.attached.get(program) ?? []) {
      if (!gl.isShader(shader)) continue;
      const log = gl.getShaderInfoLog(shader) ?? '';
      if (log) record.log += `\n${log}`;
      if (!debug) continue;
      const bytes = debug.getTranslatedShaderSource(shader).length;
      if (/gl_Position/.test(this.sources.get(shader) ?? '')) record.translatedVertexBytes = bytes;
      else record.translatedFragmentBytes = bytes;
    }
    record.flags = LOG_FLAGS.filter((f) => record.log.includes(f));
  }

  private hookWebGpu(): () => void {
    if (typeof GPUDevice === 'undefined') return () => undefined;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const timeline = this;
    const device = GPUDevice.prototype;
    const queue = GPUQueue.prototype;
    const gpu = GPU.prototype;
    const adapter = GPUAdapter.prototype;
    const saved = {
      createShaderModule: device.createShaderModule,
      createRenderPipeline: device.createRenderPipeline,
      createRenderPipelineAsync: device.createRenderPipelineAsync,
      writeTexture: queue.writeTexture,
      copyExternalImageToTexture: queue.copyExternalImageToTexture,
      requestAdapter: gpu.requestAdapter,
      requestDevice: adapter.requestDevice,
    };
    const sizes = new WeakMap<GPUShaderModule, number>();
    const codeBytes = (d: GPURenderPipelineDescriptor) =>
      (sizes.get(d.vertex.module) ?? 0) + (d.fragment ? (sizes.get(d.fragment.module) ?? 0) : 0);
    device.createShaderModule = function (this: GPUDevice, d: GPUShaderModuleDescriptor) {
      const module = saved.createShaderModule.call(this, d);
      sizes.set(module, d.code.length);
      return module;
    };
    device.createRenderPipeline = function (this: GPUDevice, d: GPURenderPipelineDescriptor) {
      const record: PipelineRecord = {
        kind: 'sync',
        label: d.label ?? '',
        requestedAt: timeline.now(),
        resolvedAt: null,
        codeBytes: codeBytes(d),
      };
      timeline.pipelines.push(record);
      // Made at once, it is built in the GPU process before anything after it: an error scope
      // around it settles once it is built (an upper bound on how long that took). Only
      // out-of-memory errors are caught here; any other goes on to three.js's own scope as before.
      this.pushErrorScope('out-of-memory');
      const pipeline = saved.createRenderPipeline.call(this, d);
      void this.popErrorScope().then((error) => {
        record.resolvedAt = timeline.now();
        if (error) console.warn('a pipeline ran out of memory:', error.message);
      });
      return pipeline;
    };
    device.createRenderPipelineAsync = function (this: GPUDevice, d: GPURenderPipelineDescriptor) {
      const record: PipelineRecord = {
        kind: 'async',
        label: d.label ?? '',
        requestedAt: timeline.now(),
        resolvedAt: null,
        codeBytes: codeBytes(d),
      };
      timeline.pipelines.push(record);
      return saved.createRenderPipelineAsync.call(this, d).then((p) => {
        record.resolvedAt = timeline.now();
        return p;
      });
    };
    const uploads = <F extends (...a: never[]) => void>(original: F) =>
      function (this: GPUQueue, ...args: Parameters<F>) {
        const at = performance.now();
        (original as unknown as (...a: unknown[]) => void).apply(this, args);
        timeline.costs.textureUploadMs += performance.now() - at;
      } as unknown as F;
    queue.writeTexture = uploads(saved.writeTexture);
    queue.copyExternalImageToTexture = uploads(saved.copyExternalImageToTexture);
    const started = <F extends (...a: never[]) => Promise<unknown>>(original: F) =>
      function (this: unknown, ...args: Parameters<F>) {
        const at = performance.now();
        const done = () => (timeline.costs.gpuStartMs += performance.now() - at);
        return (original as unknown as (...a: unknown[]) => Promise<unknown>)
          .apply(this, args)
          .finally(done);
      } as unknown as F;
    gpu.requestAdapter = started(saved.requestAdapter);
    adapter.requestDevice = started(saved.requestDevice);
    return () => {
      Object.assign(device, {
        createShaderModule: saved.createShaderModule,
        createRenderPipeline: saved.createRenderPipeline,
        createRenderPipelineAsync: saved.createRenderPipelineAsync,
      });
      Object.assign(queue, {
        writeTexture: saved.writeTexture,
        copyExternalImageToTexture: saved.copyExternalImageToTexture,
      });
      gpu.requestAdapter = saved.requestAdapter;
      adapter.requestDevice = saved.requestDevice;
    };
  }

  private hookCanvas(): () => void {
    const proto = HTMLCanvasElement.prototype;
    const getContext = proto.getContext;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const timeline = this;
    proto.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
      const at = performance.now();
      const context = (getContext as (...a: unknown[]) => unknown).apply(this, args);
      if (args[0] === 'webgl2' || args[0] === 'webgpu')
        timeline.costs.getContextMs += performance.now() - at;
      return context;
    } as typeof proto.getContext;
    return () => {
      proto.getContext = getContext;
    };
  }

  private observeLongTasks(): () => void {
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return () => undefined;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.costs.longTasks++;
        this.costs.longestTaskMs = Math.max(this.costs.longestTaskMs, entry.duration);
      }
    });
    observer.observe({ type: 'longtask' });
    return () => observer.disconnect();
  }
}

/** The browser's own getProgramParameter (kept as the module loads, before any hook replaces it). */
const browserGetProgramParameter = WebGL2RenderingContext.prototype.getProgramParameter;
