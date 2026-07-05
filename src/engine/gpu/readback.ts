// Non-blocking GPU readback: readPixels into a PBO, fence, poll later.
// Falls back to decoding HALF_FLOAT if the driver refuses RGBA/FLOAT readback (iOS 16F path).

export class AsyncReader {
  private gl: WebGL2RenderingContext;
  private pbo: WebGLBuffer;
  private fence: WebGLSync | null = null;
  private pending = false;
  private useHalf = false;
  private count: number;
  private floatBuf: Float32Array;
  private halfBuf: Uint16Array;

  constructor(gl: WebGL2RenderingContext, pixels: number) {
    this.gl = gl;
    this.count = pixels * 4;
    this.pbo = gl.createBuffer()!;
    this.floatBuf = new Float32Array(this.count);
    this.halfBuf = new Uint16Array(this.count);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, this.count * 4, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  get busy(): boolean {
    return this.pending;
  }

  /** Start a readback of the currently bound framebuffer's read buffer. */
  request(x: number, y: number, w: number, h: number): void {
    if (this.pending) return;
    const gl = this.gl;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    let ok = true;
    if (!this.useHalf) {
      try {
        gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, 0);
        if (gl.getError() !== gl.NO_ERROR) ok = false;
      } catch {
        ok = false;
      }
      if (!ok) {
        console.warn('readback: RGBA/FLOAT readPixels failed, switching to HALF_FLOAT');
        this.useHalf = true;
      }
    }
    if (this.useHalf) {
      gl.readPixels(x, y, w, h, gl.RGBA, gl.HALF_FLOAT, 0);
      ok = gl.getError() === gl.NO_ERROR;
      if (!ok) console.warn('readback: HALF_FLOAT readPixels also failed');
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    if (!ok) return;
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.pending = true;
  }

  /** Poll: returns the data once ready, else null. Never blocks. */
  poll(): Float32Array | null {
    if (!this.pending || !this.fence) return null;
    const gl = this.gl;
    const status = gl.clientWaitSync(this.fence, 0, 0);
    if (status !== gl.ALREADY_SIGNALED && status !== gl.CONDITION_SATISFIED) return null;
    gl.deleteSync(this.fence);
    this.fence = null;
    this.pending = false;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    if (this.useHalf) {
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.halfBuf);
      for (let i = 0; i < this.count; i++) this.floatBuf[i] = halfToFloat(this.halfBuf[i]);
    } else {
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.floatBuf);
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return this.floatBuf;
  }

  /**
   * Blocking read for the test harness. Bypasses the PBO entirely — rewriting a
   * fenced PBO discards driver shadow copies (SwiftShader) and returns garbage.
   */
  readSync(x: number, y: number, w: number, h: number): Float32Array {
    const gl = this.gl;
    if (this.pending && this.fence) {
      gl.deleteSync(this.fence);
      this.fence = null;
      this.pending = false;
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.finish();
    if (!this.useHalf) {
      gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, this.floatBuf);
      if (gl.getError() === gl.NO_ERROR) return this.floatBuf;
      this.useHalf = true;
    }
    gl.readPixels(x, y, w, h, gl.RGBA, gl.HALF_FLOAT, this.halfBuf);
    for (let i = 0; i < this.count; i++) this.floatBuf[i] = halfToFloat(this.halfBuf[i]);
    return this.floatBuf;
  }

  dispose(): void {
    if (this.fence) this.gl.deleteSync(this.fence);
    this.gl.deleteBuffer(this.pbo);
  }
}

export function halfToFloat(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity);
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}
