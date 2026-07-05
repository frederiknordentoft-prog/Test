// WebGL2 context + capability probing + small helpers (programs, FBOs, ping-pong pairs).
// The float-format probe ACTUALLY test-renders — extension flags alone lie on iOS.

export interface GlCaps {
  gl: WebGL2RenderingContext;
  /** Internal format for sim textures: gl.RGBA32F or gl.RGBA16F. */
  simFormat: number;
  simType: number; // FLOAT or HALF_FLOAT
  maxDrawBuffers: number;
}

export function createGl(canvas: HTMLCanvasElement | OffscreenCanvas): GlCaps | null {
  const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  const hasFloat = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear'); // optional, we use NEAREST anyway

  const maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS) as number;
  if (maxDrawBuffers < 3) return null;

  // Probe: can we render to RGBA32F? To RGBA16F? Test for real.
  const try32 = hasFloat && probeRenderable(gl, gl.RGBA32F, gl.FLOAT);
  const try16 = try32 ? true : probeRenderable(gl, gl.RGBA16F, gl.HALF_FLOAT);
  if (!try32 && !try16) return null;

  return {
    gl,
    simFormat: try32 ? gl.RGBA32F : gl.RGBA16F,
    simType: try32 ? gl.FLOAT : gl.HALF_FLOAT,
    maxDrawBuffers,
  };
}

function probeRenderable(gl: WebGL2RenderingContext, internalFormat: number, type: number): boolean {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, 4, 4);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  let readOk = false;
  if (ok) {
    gl.viewport(0, 0, 4, 4);
    gl.clearColor(0.25, 0.5, 0.75, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const buf = new Float32Array(4);
    try {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buf);
      readOk = Math.abs(buf[0] - 0.25) < 0.01;
    } catch {
      readOk = false;
    }
    // Some drivers only allow HALF_FLOAT readback from 16F — accept framebuffer-complete alone then.
    if (!readOk && type === gl.HALF_FLOAT) readOk = ok;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(tex);
  return ok && readOk;
}

export function compileProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    throw new Error(`Shader link failed: ${info}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

function compileShader(gl: WebGL2RenderingContext, kind: number, src: string): WebGLShader {
  const sh = gl.createShader(kind)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    throw new Error(`Shader compile failed: ${info}\n---\n${src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`);
  }
  return sh;
}

export function createTexture(gl: WebGL2RenderingContext, w: number, h: number, internalFormat: number, filter: number = gl.NEAREST): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, w, h);
  return tex;
}

export interface Fbo {
  fbo: WebGLFramebuffer;
  textures: WebGLTexture[];
  w: number;
  h: number;
}

export function createFbo(gl: WebGL2RenderingContext, w: number, h: number, internalFormat: number, attachments = 1, filter?: number): Fbo {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const textures: WebGLTexture[] = [];
  const bufs: number[] = [];
  for (let i = 0; i < attachments; i++) {
    const tex = createTexture(gl, w, h, internalFormat, filter);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex, 0);
    textures.push(tex);
    bufs.push(gl.COLOR_ATTACHMENT0 + i);
  }
  gl.drawBuffers(bufs);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('FBO incomplete');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, textures, w, h };
}

export function destroyFbo(gl: WebGL2RenderingContext, f: Fbo): void {
  for (const t of f.textures) gl.deleteTexture(t);
  gl.deleteFramebuffer(f.fbo);
}

/** Fullscreen-quad VAO (two triangles, position attribute 0). */
export function createQuadVao(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}
