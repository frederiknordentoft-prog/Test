// WebGL2 D2Q9 backend: owns all textures/FBOs/programs and runs the per-frame pass chain.
// Pass order: obstacle (on pose change) → N × lbm → force → reduce → [smoke advect + particle
// update + splat] → composite. Force/probe readbacks are asynchronous (PBO + fence).

import type { Backend, ForceSample, GridSize, PoseState, ProbeResult, ShapeSpec, SimParams, StepInputs } from '../types';
import { ASPECT } from '../types';
import { compileProgram, createFbo, createQuadVao, destroyFbo, type Fbo, type GlCaps } from './gl';
import { AsyncReader } from './readback';
import { triangulate } from '../shape/triangulate';
import { seqLutData, divLutData } from '../../render/colormaps';

import quadVert from './shaders/quad.vert?raw';
import lbmFrag from './shaders/lbm.frag?raw';
import initFrag from './shaders/init.frag?raw';
import obstacleVert from './shaders/obstacle.vert?raw';
import obstacleFrag from './shaders/obstacle.frag?raw';
import boundaryFrag from './shaders/boundary.frag?raw';
import forceFrag from './shaders/force.frag?raw';
import reduceFrag from './shaders/reduce.frag?raw';
import smokeFrag from './shaders/smoke.frag?raw';
import particleUpdateFrag from './shaders/particleUpdate.frag?raw';
import particleVert from './shaders/particle.vert?raw';
import particleFrag from './shaders/particle.frag?raw';
import compositeFrag from './shaders/composite.frag?raw';

const OVERLAY_INT = { none: 0, speed: 1, vorticity: 2, pressure: 3, streamlines: 4 } as const;
const RAKE_ROWS = 15;

export class GpuBackend implements Backend {
  readonly kind = 'gpu' as const;
  grid: GridSize;

  private caps: GlCaps;
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;

  private quadVao!: WebGLVertexArrayObject;
  private emptyVao!: WebGLVertexArrayObject;

  private progLbm!: WebGLProgram;
  private progInit!: WebGLProgram;
  private progObstacle!: WebGLProgram;
  private progBoundary!: WebGLProgram;
  private progForce!: WebGLProgram;
  private progReduce!: WebGLProgram;
  private progSmoke!: WebGLProgram;
  private progPartUpd!: WebGLProgram;
  private progPartDraw!: WebGLProgram;
  private progComposite!: WebGLProgram;

  private simA!: Fbo; // 3 attachments
  private simB!: Fbo;
  private obstacleRaw!: Fbo;
  private obstacle!: Fbo;
  private force!: Fbo;
  private reduceChain: Fbo[] = [];
  private smokeA: Fbo | null = null;
  private smokeB: Fbo | null = null;
  private partA: Fbo | null = null;
  private partB: Fbo | null = null;
  private lutSeq!: WebGLTexture;
  private lutDiv!: WebGLTexture;

  private shapeVao: WebGLVertexArrayObject | null = null;
  private shapeVbo: WebGLBuffer | null = null;
  private shapeIbo: WebGLBuffer | null = null;
  private shapeIndexCount = 0;
  private shape: ShapeSpec | null = null;
  private pose: PoseState = { theta: 0, bend: [0, 0] };
  private obstacleDirty = true;

  private forceReader: AsyncReader;
  private probeReader: AsyncReader;
  private probeCell: [number, number] | null = null;
  private frame = 0;
  private lastUin = 0;
  private particlesEnabled: boolean;
  private particleCount: number;
  private partW = 128;
  private partH = 96;
  private seed: number;

  constructor(caps: GlCaps, canvas: HTMLCanvasElement, grid: GridSize, seed: number) {
    this.caps = caps;
    this.gl = caps.gl;
    this.canvas = canvas;
    this.grid = grid;
    this.seed = seed;
    // 16F position textures lack precision for cell coords → dye-only smoke on that path.
    this.particlesEnabled = caps.simType === caps.gl.FLOAT;
    this.particleCount = this.partW * this.partH;
    this.initGl();
    this.forceReader = new AsyncReader(this.gl, 1);
    this.probeReader = new AsyncReader(this.gl, 1);
    this.reset(0.05);
  }

  private initGl(): void {
    const gl = this.gl;
    this.quadVao = createQuadVao(gl);
    this.emptyVao = gl.createVertexArray()!;

    this.progLbm = compileProgram(gl, quadVert, lbmFrag);
    this.progInit = compileProgram(gl, quadVert, initFrag);
    this.progObstacle = compileProgram(gl, obstacleVert, obstacleFrag);
    this.progBoundary = compileProgram(gl, quadVert, boundaryFrag);
    this.progForce = compileProgram(gl, quadVert, forceFrag);
    this.progReduce = compileProgram(gl, quadVert, reduceFrag);
    this.progSmoke = compileProgram(gl, quadVert, smokeFrag);
    this.progPartUpd = compileProgram(gl, quadVert, particleUpdateFrag);
    this.progPartDraw = compileProgram(gl, particleVert, particleFrag);
    this.progComposite = compileProgram(gl, quadVert, compositeFrag);

    this.allocGridResources();

    // Colormap LUTs
    this.lutSeq = this.createLut(seqLutData());
    this.lutDiv = this.createLut(divLutData());

    if (this.particlesEnabled) {
      this.partA = createFbo(gl, this.partW, this.partH, gl.RGBA32F);
      this.partB = createFbo(gl, this.partW, this.partH, gl.RGBA32F);
      this.seedParticles();
    }
  }

  private allocGridResources(): void {
    const gl = this.gl;
    const { w, h } = this.grid;
    this.simA = createFbo(gl, w, h, this.caps.simFormat, 3);
    this.simB = createFbo(gl, w, h, this.caps.simFormat, 3);
    this.obstacleRaw = createFbo(gl, w, h, gl.RGBA8);
    this.obstacle = createFbo(gl, w, h, gl.RGBA8);
    this.force = createFbo(gl, w, h, this.caps.simFormat);
    this.reduceChain = [];
    let rw = Math.ceil(w / 2);
    let rh = Math.ceil(h / 2);
    for (;;) {
      this.reduceChain.push(createFbo(gl, rw, rh, this.caps.simFormat));
      if (rw === 1 && rh === 1) break;
      rw = Math.max(1, Math.ceil(rw / 2));
      rh = Math.max(1, Math.ceil(rh / 2));
    }
  }

  private freeGridResources(): void {
    const gl = this.gl;
    for (const f of [this.simA, this.simB, this.obstacleRaw, this.obstacle, this.force, ...this.reduceChain]) destroyFbo(gl, f);
    this.reduceChain = [];
  }

  private createLut(data: Uint8Array): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return tex;
  }

  private seedParticles(): void {
    // Scatter initial positions across the tunnel so streaks appear immediately.
    const gl = this.gl;
    const data = new Float32Array(this.partW * this.partH * 4);
    for (let i = 0; i < this.particleCount; i++) {
      const row = i % RAKE_ROWS;
      const u = ((i * 2654435761) >>> 0) / 4294967296;
      const v = ((i * 40503 + this.seed) >>> 0 % 65536) / 65536 % 1;
      data[i * 4] = 2 + u * (this.grid.w - 8);
      data[i * 4 + 1] = ((row + 0.5 + (v - 0.5) * 0.3) / RAKE_ROWS) * this.grid.h;
      data[i * 4 + 2] = u * 500;
      data[i * 4 + 3] = row;
    }
    for (const fbo of [this.partA!, this.partB!]) {
      gl.bindTexture(gl.TEXTURE_2D, fbo.textures[0]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.partW, this.partH, gl.RGBA, gl.FLOAT, data);
    }
  }

  // ---------- Backend interface ----------

  setShape(shape: ShapeSpec | null): void {
    const gl = this.gl;
    this.shape = shape;
    if (this.shapeVao) {
      gl.deleteVertexArray(this.shapeVao);
      gl.deleteBuffer(this.shapeVbo);
      gl.deleteBuffer(this.shapeIbo);
      this.shapeVao = null;
      this.shapeIndexCount = 0;
    }
    if (shape) {
      const mesh = triangulate(shape.points, shape.pivot);
      if (mesh) {
        this.shapeVao = gl.createVertexArray()!;
        gl.bindVertexArray(this.shapeVao);
        this.shapeVbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.shapeVbo);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        this.shapeIbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shapeIbo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        this.shapeIndexCount = mesh.indices.length;
      }
    }
    this.obstacleDirty = true;
  }

  setPose(pose: PoseState): void {
    if (pose.theta !== this.pose.theta || pose.bend[0] !== this.pose.bend[0] || pose.bend[1] !== this.pose.bend[1]) {
      this.pose = { theta: pose.theta, bend: [pose.bend[0], pose.bend[1]] };
      this.obstacleDirty = true;
    }
  }

  setProbe(p: [number, number] | null): void {
    if (!p) {
      this.probeCell = null;
      return;
    }
    const cx = Math.min(this.grid.w - 1, Math.max(0, Math.round((p[0] / ASPECT) * this.grid.w)));
    const cy = Math.min(this.grid.h - 1, Math.max(0, Math.round(p[1] * this.grid.h)));
    this.probeCell = [cx, cy];
  }

  private updateObstacle(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.obstacleRaw.fbo);
    gl.viewport(0, 0, this.grid.w, this.grid.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.shapeVao && this.shapeIndexCount > 0) {
      gl.useProgram(this.progObstacle);
      gl.uniform2f(gl.getUniformLocation(this.progObstacle, 'uPivot'), this.shape!.pivot[0], this.shape!.pivot[1]);
      gl.uniform2f(gl.getUniformLocation(this.progObstacle, 'uBend'), this.pose.bend[0], this.pose.bend[1]);
      gl.uniform2f(gl.getUniformLocation(this.progObstacle, 'uCosSin'), Math.cos(this.pose.theta), Math.sin(this.pose.theta));
      gl.uniform1f(gl.getUniformLocation(this.progObstacle, 'uAspect'), ASPECT);
      gl.bindVertexArray(this.shapeVao);
      gl.drawElements(gl.TRIANGLES, this.shapeIndexCount, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
    }
    // boundary-flag pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.obstacle.fbo);
    gl.useProgram(this.progBoundary);
    this.bindTex(this.progBoundary, 'uRaw', this.obstacleRaw.textures[0], 0);
    gl.uniform2i(gl.getUniformLocation(this.progBoundary, 'uSize'), this.grid.w, this.grid.h);
    this.drawQuad();
    this.obstacleDirty = false;
  }

  step(n: number, inputs: StepInputs): void {
    const gl = this.gl;
    this.lastUin = inputs.uIn;
    if (this.obstacleDirty) this.updateObstacle();

    gl.useProgram(this.progLbm);
    gl.uniform2i(gl.getUniformLocation(this.progLbm, 'uSize'), this.grid.w, this.grid.h);
    gl.uniform1f(gl.getUniformLocation(this.progLbm, 'uUin'), inputs.uIn);
    gl.uniform1f(gl.getUniformLocation(this.progLbm, 'uTau'), inputs.tau);
    gl.uniform1f(gl.getUniformLocation(this.progLbm, 'uSpongeFrac'), 0.06);
    gl.viewport(0, 0, this.grid.w, this.grid.h);
    for (let s = 0; s < n; s++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.simB.fbo);
      this.bindTex(this.progLbm, 'uF0', this.simA.textures[0], 0);
      this.bindTex(this.progLbm, 'uF1', this.simA.textures[1], 1);
      this.bindTex(this.progLbm, 'uF2', this.simA.textures[2], 2);
      this.bindTex(this.progLbm, 'uObstacle', this.obstacle.textures[0], 3);
      this.drawQuad();
      const t = this.simA;
      this.simA = this.simB;
      this.simB = t;
    }
    this.lastStepCount = n;
    this.frame++;
  }

  /** Force + badness pass, reduced to 1×1. Called every frame after step(). */
  private runForceReduce(): void {
    const gl = this.gl;
    const pivotCells: [number, number] = this.shape
      ? [((this.shape.pivot[0] + this.pose.bend[0]) / ASPECT) * this.grid.w, (this.shape.pivot[1] + this.pose.bend[1]) * this.grid.h]
      : [this.grid.w / 2, this.grid.h / 2];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.force.fbo);
    gl.viewport(0, 0, this.grid.w, this.grid.h);
    gl.useProgram(this.progForce);
    this.bindTex(this.progForce, 'uF0', this.simA.textures[0], 0);
    this.bindTex(this.progForce, 'uF1', this.simA.textures[1], 1);
    this.bindTex(this.progForce, 'uF2', this.simA.textures[2], 2);
    this.bindTex(this.progForce, 'uObstacle', this.obstacle.textures[0], 3);
    gl.uniform2i(gl.getUniformLocation(this.progForce, 'uSize'), this.grid.w, this.grid.h);
    gl.uniform2f(gl.getUniformLocation(this.progForce, 'uPivotCells'), pivotCells[0], pivotCells[1]);
    this.drawQuad();

    gl.useProgram(this.progReduce);
    let src: Fbo = this.force;
    for (const dst of this.reduceChain) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, dst.w, dst.h);
      this.bindTex(this.progReduce, 'uSrc', src.textures[0], 0);
      gl.uniform2i(gl.getUniformLocation(this.progReduce, 'uSrcSize'), src.w, src.h);
      this.drawQuad();
      src = dst;
    }
  }

  requestForces(): void {
    const gl = this.gl;
    this.runForceReduce();
    const last = this.reduceChain[this.reduceChain.length - 1];
    if (!this.forceReader.busy) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, last.fbo);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
      this.forceReader.request(0, 0, 1, 1);
    }
    if (this.probeCell && !this.probeReader.busy) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.simA.fbo);
      gl.readBuffer(gl.COLOR_ATTACHMENT2);
      this.probeReader.request(this.probeCell[0], this.probeCell[1], 1, 1);
      gl.readBuffer(gl.COLOR_ATTACHMENT0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  pollReadbacks(): { force?: ForceSample; probe?: ProbeResult; bad?: boolean } {
    const out: { force?: ForceSample; probe?: ProbeResult; bad?: boolean } = {};
    const f = this.forceReader.poll();
    if (f) {
      const bad = !isFinite(f[0]) || !isFinite(f[1]) || f[3] > 0.0004;
      out.force = { fx: f[0], fy: f[1], tz: f[2] };
      out.bad = bad;
    }
    const p = this.probeReader.poll();
    if (p) out.probe = { speed: Math.hypot(p[2], p[3]), rho: p[1] };
    return out;
  }

  /** Debug/harness: count solid pixels in the rasterized obstacle texture. */
  countSolidPixels(): number {
    const gl = this.gl;
    if (this.obstacleDirty) this.updateObstacle();
    const buf = new Uint8Array(this.grid.w * this.grid.h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.obstacleRaw.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, this.grid.w, this.grid.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let n = 0;
    for (let i = 0; i < buf.length; i += 4) if (buf[i] > 127) n++;
    return n;
  }

  /** Blocking force read for the harness. */
  readForceSync(): ForceSample & { bad: boolean } {
    const gl = this.gl;
    this.runForceReduce();
    const last = this.reduceChain[this.reduceChain.length - 1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, last.fbo);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    const f = this.forceReader.readSync(0, 0, 1, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fx: f[0], fy: f[1], tz: f[2], bad: !isFinite(f[0]) || f[3] > 0.0004 };
  }

  reset(uIn: number): void {
    const gl = this.gl;
    if (this.obstacleDirty) this.updateObstacle();
    gl.useProgram(this.progInit);
    gl.uniform1f(gl.getUniformLocation(this.progInit, 'uUin'), uIn);
    gl.viewport(0, 0, this.grid.w, this.grid.h);
    for (const fbo of [this.simA, this.simB]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      this.bindTex(this.progInit, 'uObstacle', this.obstacle.textures[0], 0);
      this.drawQuad();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  resize(grid: GridSize): void {
    if (grid.w === this.grid.w && grid.h === this.grid.h) return;
    this.freeGridResources();
    this.grid = grid;
    this.allocGridResources();
    this.obstacleDirty = true;
    this.reset(this.lastUin);
  }

  render(params: SimParams, _pose: PoseState, _timeSec: number): void {
    const gl = this.gl;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (cw === 0 || ch === 0) return;

    // (Re)allocate smoke buffers at canvas resolution.
    if (params.smoke && (!this.smokeA || this.smokeA.w !== cw || this.smokeA.h !== ch)) {
      if (this.smokeA) destroyFbo(gl, this.smokeA);
      if (this.smokeB) destroyFbo(gl, this.smokeB);
      this.smokeA = createFbo(gl, cw, ch, gl.RGBA16F, 1, gl.LINEAR);
      this.smokeB = createFbo(gl, cw, ch, gl.RGBA16F, 1, gl.LINEAR);
    }

    const steps = params.paused ? 0 : this.lastStepCount;

    if (params.smoke && this.smokeA && this.smokeB) {
      // advect + decay + dye injection
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.smokeB.fbo);
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(this.progSmoke);
      this.bindTex(this.progSmoke, 'uPrev', this.smokeA.textures[0], 0);
      this.bindTex(this.progSmoke, 'uF2', this.simA.textures[2], 1);
      this.bindTex(this.progSmoke, 'uObstacle', this.obstacle.textures[0], 2);
      gl.uniform2i(gl.getUniformLocation(this.progSmoke, 'uSimSize'), this.grid.w, this.grid.h);
      gl.uniform1f(gl.getUniformLocation(this.progSmoke, 'uAdvect'), steps);
      gl.uniform1f(gl.getUniformLocation(this.progSmoke, 'uDecay'), params.reducedMotion ? 0.94 : 0.982);
      const dyeInject = this.particlesEnabled && !params.reducedMotion ? 0 : 0.16;
      gl.uniform1f(gl.getUniformLocation(this.progSmoke, 'uInject'), dyeInject);
      gl.uniform1f(gl.getUniformLocation(this.progSmoke, 'uRakeRows'), RAKE_ROWS);
      this.drawQuad();
      const t = this.smokeA;
      this.smokeA = this.smokeB;
      this.smokeB = t;

      if (this.particlesEnabled && !params.reducedMotion && this.partA && this.partB && steps > 0) {
        // particle update
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.partB.fbo);
        gl.viewport(0, 0, this.partW, this.partH);
        gl.useProgram(this.progPartUpd);
        this.bindTex(this.progPartUpd, 'uPos', this.partA.textures[0], 0);
        this.bindTex(this.progPartUpd, 'uF2', this.simA.textures[2], 1);
        this.bindTex(this.progPartUpd, 'uObstacle', this.obstacle.textures[0], 2);
        gl.uniform2i(gl.getUniformLocation(this.progPartUpd, 'uSimSize'), this.grid.w, this.grid.h);
        gl.uniform2i(gl.getUniformLocation(this.progPartUpd, 'uPosSize'), this.partW, this.partH);
        gl.uniform1f(gl.getUniformLocation(this.progPartUpd, 'uSteps'), steps);
        gl.uniform1f(gl.getUniformLocation(this.progPartUpd, 'uFrame'), this.frame % 100000);
        gl.uniform1f(gl.getUniformLocation(this.progPartUpd, 'uRakeRows'), RAKE_ROWS);
        gl.uniform1f(gl.getUniformLocation(this.progPartUpd, 'uSeed'), this.seed % 1000);
        this.drawQuad();
        const pt = this.partA;
        this.partA = this.partB;
        this.partB = pt;

        // splat into smoke buffer (additive)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.smokeA.fbo);
        gl.viewport(0, 0, cw, ch);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(this.progPartDraw);
        this.bindTex(this.progPartDraw, 'uPos', this.partA.textures[0], 0);
        this.bindTex(this.progPartDraw, 'uF2', this.simA.textures[2], 1);
        gl.uniform2i(gl.getUniformLocation(this.progPartDraw, 'uPosSize'), this.partW, this.partH);
        gl.uniform2i(gl.getUniformLocation(this.progPartDraw, 'uSimSize'), this.grid.w, this.grid.h);
        gl.uniform1f(gl.getUniformLocation(this.progPartDraw, 'uPointSize'), Math.max(1.8, ch / 260));
        gl.uniform1f(gl.getUniformLocation(this.progPartDraw, 'uUin'), Math.max(this.lastUin, 1e-4));
        gl.uniform3f(gl.getUniformLocation(this.progPartDraw, 'uColor'), 0.5, 0.78, 1.0);
        gl.uniform1f(gl.getUniformLocation(this.progPartDraw, 'uIntensity'), 0.08);
        gl.bindVertexArray(this.emptyVao);
        gl.drawArrays(gl.POINTS, 0, this.particleCount);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      }
    }

    // composite to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(this.progComposite);
    this.bindTex(this.progComposite, 'uF2', this.simA.textures[2], 0);
    this.bindTex(this.progComposite, 'uObstacle', this.obstacle.textures[0], 1);
    this.bindTex(this.progComposite, 'uSmoke', (params.smoke && this.smokeA ? this.smokeA.textures[0] : this.obstacleRaw.textures[0]), 2);
    this.bindTex(this.progComposite, 'uLutSeq', this.lutSeq, 3);
    this.bindTex(this.progComposite, 'uLutDiv', this.lutDiv, 4);
    gl.uniform2i(gl.getUniformLocation(this.progComposite, 'uSize'), this.grid.w, this.grid.h);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uUin'), Math.max(this.lastUin, 1e-4));
    gl.uniform1i(gl.getUniformLocation(this.progComposite, 'uOverlay'), OVERLAY_INT[params.overlay]);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uTime'), _timeSec);
    gl.uniform1f(gl.getUniformLocation(this.progComposite, 'uSmokeOn'), params.smoke ? 1 : 0);
    this.drawQuad();
  }

  /** Engine tells us how many substeps ran this frame (drives smoke/particle advection). */
  lastStepCount = 0;

  dispose(): void {
    const gl = this.gl;
    this.freeGridResources();
    if (this.smokeA) destroyFbo(gl, this.smokeA);
    if (this.smokeB) destroyFbo(gl, this.smokeB);
    if (this.partA) destroyFbo(gl, this.partA);
    if (this.partB) destroyFbo(gl, this.partB);
    this.forceReader.dispose();
    this.probeReader.dispose();
  }

  // ---------- helpers ----------

  private bindTex(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  private drawQuad(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}
