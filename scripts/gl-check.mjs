// Diagnose WebGL2 capabilities in headless Chromium.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
const info = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  if (!gl) return { webgl2: false };
  const ext = gl.getExtension('EXT_color_buffer_float');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  // try 32F render + read
  const probe = (ifmt, name) => {
    try {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, ifmt, 4, 4);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.viewport(0, 0, 4, 4);
      gl.clearColor(0.25, 0.5, 0.75, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const buf = new Float32Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, buf);
      const err = gl.getError();
      return { name, complete, read: buf[0], err };
    } catch (e) {
      return { name, error: String(e) };
    }
  };
  return {
    webgl2: true,
    renderer,
    extFloat: !!ext,
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
    p32: probe(gl.RGBA32F, '32F'),
    p16: probe(gl.RGBA16F, '16F'),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
