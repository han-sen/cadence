// WebGL halftone used by the seed loader: the cover drawn as dots in its own colors on
// off-white paper ("color print"). Darker areas get bigger dots. The paper is opaque, so the
// page background never shows through the cover. Plain WebGL, no library: one full-screen
// quad and one fragment shader.

const VERT = `attribute vec2 p; varying vec2 v_uv; void main(){ v_uv = p*.5+.5; gl_Position = vec4(p,0.,1.); }`;

// u_detail 0..1: coarse to fine dots (tied to chart progress).
// u_resolve 0..1: dots shrink to pixels and cross-fade to the plain cover.
const FRAG = `
precision highp float;
uniform sampler2D u_tex; uniform vec2 u_res; uniform float u_time, u_detail, u_resolve;
varying vec2 v_uv;
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
vec3 boost(vec3 c){ return clamp(mix(vec3(lum(c)), c, 1.45), 0., 1.); }
void main(){
  float cells = mix(14., 72., u_detail);
  cells = mix(cells, 240., u_resolve);
  vec2 g = v_uv * cells; vec2 id = floor(g); vec2 f = fract(g) - .5;
  vec3 c = texture2D(u_tex, (id + .5) / cells).rgb;
  float L = lum(c);
  float pulse = .05 * sin(u_time * 2.2 - id.x * .32 - id.y * .21) * (1. - u_resolve);
  float aa = cells / u_res.x * 1.2;
  float r = sqrt(.15 + .85 * (1. - L * .75)) * .6 + pulse;
  float ink = 1. - smoothstep(r - aa, r + aa, length(f));
  vec3 print = mix(vec3(.96, .95, .92), boost(c), ink);
  vec3 orig = texture2D(u_tex, v_uv).rgb;
  float k = smoothstep(.3, 1., u_resolve);
  gl_FragColor = vec4(mix(print, orig, k), 1.);
}`;

export type Halftone = {
  setImage: (src: TexImageSource) => void;
  draw: (v: { time: number; detail: number; resolve: number }) => void;
  dispose: () => void;
};

// Returns null when WebGL isn't available, so the caller can fall back to a plain cover.
export function createHalftone(canvas: HTMLCanvasElement): Halftone | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader failed to compile");
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Two triangles covering the canvas.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const U = { res: u("u_res"), time: u("u_time"), detail: u("u_detail"), resolve: u("u_resolve") };
  let ready = false;

  return {
    setImage(src) {
      // Copy into a square power-of-two canvas: WebGL 1 is happiest with those, and covers
      // aren't always exactly square.
      const square = document.createElement("canvas");
      square.width = square.height = 512;
      square.getContext("2d")!.drawImage(src as CanvasImageSource, 0, 0, 512, 512);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, square);
      ready = true;
    },
    draw({ time, detail, resolve }) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== size) canvas.width = canvas.height = size;
      gl.viewport(0, 0, size, size);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!ready) return;
      gl.uniform2f(U.res, size, size);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.detail, detail);
      gl.uniform1f(U.resolve, resolve);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      // Free the GPU objects but keep the context: React's dev mode runs effects twice on the
      // same canvas, and a lost context can't be got back.
      gl.deleteProgram(program);
    },
  };
}

// A stand-in "cover" for albums with no art, or art that fails to load.
export function fallbackCover(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, "#2b2a33");
  grad.addColorStop(1, "#5a4b3c");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(240,239,236,.85)";
  g.font = "220px serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("♪", 256, 270);
  return c;
}

// Cover Art Archive sends CORS headers on every redirect, so with crossOrigin="anonymous"
// WebGL is allowed to read the pixels. Resolves with the fallback if the image fails.
export function loadCoverForWebGL(url: string | undefined): Promise<TexImageSource> {
  if (!url) return Promise.resolve(fallbackCover());
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(fallbackCover());
    img.src = url;
  });
}
