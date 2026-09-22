import { Application, Geometry, Mesh, Shader, Graphics, Text } from 'pixi.js';

const vertex = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(){
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUv = aPosition;
}`;
const fragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 finalColor;
uniform float uTime;
uniform vec2 uSize;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p*=2.02;a*=.5;}return s;}
void main(){
  vec2 uv = vUv / uSize;
  float x = uv.x*3. + fbm(vec2(uv.x*2., uTime*.1))*1.5;
  float curtain = smoothstep(.6,.0,abs(uv.y-.35 - .1*sin(x*2.+uTime*.3)))*fbm(vec2(x*8., uTime*.2));
  vec3 sky = mix(vec3(.02,.04,.1), vec3(.04,.1,.23), uv.y);
  vec3 col = sky + curtain*vec3(.24,1.,.69);
  finalColor = vec4(col,1.);
}`;

async function boot() {
  const app = new Application();
  await app.init({ resizeTo: window, background: '#050B1A', antialias: true, preference: 'webgl', resolution: Math.min(devicePixelRatio, 2), autoDensity: true });
  document.getElementById('app')!.appendChild(app.canvas);
  const w = app.screen.width, h = app.screen.height;
  const geometry = new Geometry({ attributes: { aPosition: [0, 0, w, 0, w, h, 0, h] }, indexBuffer: [0, 1, 2, 0, 2, 3] });
  const shader = Shader.from({ gl: { vertex, fragment }, resources: { u: { uTime: { value: 0, type: 'f32' }, uSize: { value: [w, h], type: 'vec2<f32>' } } } });
  const mesh = new Mesh({ geometry, shader });
  app.stage.addChild(mesh);
  const g = new Graphics().roundRect(w / 2 - 150, h / 2 - 150, 300, 300, 24).fill({ color: 0x0b1b3a, alpha: 0.5 }).stroke({ color: 0x9cc9ff, width: 3 });
  app.stage.addChild(g);
  const t = new Text({ text: 'NORDLYS', style: { fill: 0xeaf8ff, fontSize: 48, fontWeight: '800', fontFamily: 'system-ui' } });
  t.anchor.set(0.5); t.position.set(w / 2, h / 2); app.stage.addChild(t);
  app.ticker.add((tk) => { (shader.resources.u as any).uniforms.uTime += tk.deltaMS / 1000; });
  const gl = (app.renderer as any).gl as WebGL2RenderingContext;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  (window as any).__probe = { webgl: (app.renderer as any).context.webGLVersion, renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
}
boot();
