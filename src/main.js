(() => {
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance'
  });

  if (!gl) {
    document.body.innerHTML = '<div style="display:grid;place-items:center;height:100%;background:#030008;color:white;font:18px system-ui">WebGL is not available in this browser.</div>';
    return;
  }

  const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  const particleCount = isMobile ? 18000 : 32000;
  const starCount = isMobile ? 1800 : 3800;
  const streamCount = isMobile ? 2800 : 5200;
  const wingCount = isMobile ? 7600 : 13000;
  const sparkCount = isMobile ? 650 : 1100;

  const palette = [
    [1.0, 0.12, 0.7],
    [1.0, 0.28, 0.42],
    [0.58, 0.15, 1.0],
    [0.06, 0.82, 1.0],
    [1.0, 0.78, 0.95]
  ];

  const rand = (min, max) => min + Math.random() * (max - min);

  const particleVertex = `
    precision highp float;

    attribute vec3 aPosition;
    attribute vec3 aTarget;
    attribute vec3 aColor;
    attribute vec4 aSeed;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uBeat;
    uniform float uExplosion;
    uniform float uIntro;
    uniform vec3 uPointer;
    uniform float uRatio;

    varying vec3 vColor;
    varying float vAlpha;

    float hash(float n) {
      return fract(sin(n) * 43758.5453123);
    }

    void main() {
      vec3 target = aTarget;
      float coreDistance = length(target.xy);
      float beatWave = sin(coreDistance * 2.35 - uTime * 8.2) * uBeat;
      float pulse = 1.0 + uBeat * 0.12 + beatWave * 0.06;
      vec3 dir = normalize(target + vec3(aSeed.z * 0.9, 0.22, sin(aSeed.x)));

      float loose = smoothstep(0.8, 1.0, sin(uTime * 0.3 + aSeed.x) * 0.5 + 0.5) * 0.26;
      vec3 p = target * pulse;
      p += vec3(
        sin(uTime * 1.7 + aSeed.x) * 0.08,
        cos(uTime * 1.25 + aSeed.y) * 0.08,
        sin(uTime * 1.1 + aSeed.x + aSeed.y) * 0.1
      );
      p = mix(p, p + dir * (7.0 + hash(aSeed.x) * 12.0), loose);
      p = mix(p, p + dir * (18.0 + aSeed.w * 17.0), uExplosion);
      p = mix(aPosition, p, 1.0 - uIntro);

      float influence = smoothstep(3.45, 0.0, distance(p, uPointer));
      p += normalize(p - uPointer + vec3(0.001)) * influence * (0.62 + uBeat * 0.7);

      vec4 mv = uView * vec4(p, 1.0);
      gl_Position = uProjection * mv;
      gl_PointSize = (10.0 + aSeed.w * 16.0) * uRatio * (1.0 + uBeat * 0.75 + uExplosion * 1.6) / max(1.0, -mv.z * 0.38);

      vColor = aColor;
      vAlpha = 0.7 + uBeat * 0.25 + uExplosion * 0.15;
    }
  `;

  const glowFragment = `
    precision highp float;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float core = smoothstep(0.5, 0.025, d);
      float halo = smoothstep(0.5, 0.0, d) * 0.35;
      gl_FragColor = vec4(vColor * (core * 1.9 + halo), (core + halo) * vAlpha);
    }
  `;

  const simpleVertex = `
    precision highp float;

    attribute vec3 aPosition;
    attribute vec3 aColor;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uBeat;
    uniform float uRatio;
    uniform float uSpin;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec3 p = aPosition;
      float r = length(p.xz);
      float angle = atan(p.z, p.x) + uTime * uSpin;
      p.x = cos(angle) * r;
      p.z = sin(angle) * r;
      p.y += sin(angle * 3.0 + uTime * 1.5) * 0.14;

      vec4 mv = uView * vec4(p, 1.0);
      gl_Position = uProjection * mv;
      gl_PointSize = (4.0 + uBeat * 7.0) * uRatio / max(1.0, -mv.z * 0.22);

      vColor = aColor;
      vAlpha = 0.38 + uBeat * 0.42;
    }
  `;

  const starVertex = `
    precision highp float;

    attribute vec3 aPosition;
    attribute vec3 aColor;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uRatio;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec3 p = aPosition;
      float angle = uTime * 0.015;
      float c = cos(angle);
      float s = sin(angle);
      p.xz = mat2(c, -s, s, c) * p.xz;

      vec4 mv = uView * vec4(p, 1.0);
      gl_Position = uProjection * mv;
      gl_PointSize = 2.0 * uRatio / max(0.5, -mv.z * 0.04);

      vColor = aColor;
      vAlpha = 0.62;
    }
  `;

  const wingVertex = `
    precision highp float;

    attribute vec3 aPosition;
    attribute vec4 aSeed;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform float uTime;
    uniform float uWing;
    uniform float uRatio;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec3 p = aPosition;
      p.x += aSeed.x * sin(aSeed.y * 10.0 + uTime * 2.0) * 0.2;
      p.y += cos(aSeed.z * 8.0 + uTime * 1.5) * 0.14;
      p *= 0.78 + uWing * 0.32;

      vec4 mv = uView * vec4(p, 1.0);
      gl_Position = uProjection * mv;
      gl_PointSize = (7.0 + aSeed.z * 14.0) * uRatio / max(1.0, -mv.z * 0.42);

      vColor = mix(vec3(0.08, 0.78, 1.0), vec3(1.0, 0.22, 0.78), aSeed.y);
      vAlpha = uWing * smoothstep(0.0, 0.2, aSeed.y) * (1.0 - smoothstep(0.96, 1.0, aSeed.y));
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  const programs = {
    heart: createProgram(particleVertex, glowFragment),
    simple: createProgram(simpleVertex, glowFragment),
    star: createProgram(starVertex, glowFragment),
    wing: createProgram(wingVertex, glowFragment)
  };

  function heartPoint() {
    const t = Math.random() * Math.PI * 2;
    const shell = Math.pow(Math.random(), 0.34);
    const x2d = 16 * Math.pow(Math.sin(t), 3);
    const y2d = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const z = rand(-2.9, 2.9) * shell;
    const taper = 1.0 - Math.min(0.42, Math.abs(z) * 0.035);
    return [x2d * 0.19 * shell * taper, (y2d - 2.2) * 0.19 * shell, z];
  }

  function createBuffer(data, stride, attributes, program, usage = gl.STATIC_DRAW) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    return {
      data,
      buffer,
      stride,
      attributes,
      program,
      count: data.length / (stride / 4)
    };
  }

  function makeHeart() {
    const stride = 13;
    const data = new Float32Array(particleCount * stride);

    for (let i = 0; i < particleCount; i += 1) {
      const target = heartPoint();
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(rand(-1, 1));
      const radius = rand(26, 44);
      const start = [
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      ];
      const color = palette[(Math.random() * palette.length) | 0];
      const white = Math.random() * 0.22;
      const offset = i * stride;

      data.set(start, offset);
      data.set(target, offset + 3);
      data[offset + 6] = color[0] + (1 - color[0]) * white;
      data[offset + 7] = color[1] + (1 - color[1]) * white;
      data[offset + 8] = color[2] + (1 - color[2]) * white;
      data[offset + 9] = Math.random() * 1000;
      data[offset + 10] = Math.random() * 1000;
      data[offset + 11] = rand(-1, 1);
      data[offset + 12] = Math.random();
    }

    return createBuffer(data, stride * 4, [
      ['aPosition', 3, 0],
      ['aTarget', 3, 3],
      ['aColor', 3, 6],
      ['aSeed', 4, 9]
    ], programs.heart);
  }

  function makeStars() {
    const stride = 6;
    const data = new Float32Array(starCount * stride);

    for (let i = 0; i < starCount; i += 1) {
      const radius = rand(26, 82);
      const angle = Math.random() * Math.PI * 2;
      const color = palette[(Math.random() * palette.length) | 0];
      const offset = i * stride;

      data[offset] = Math.cos(angle) * radius;
      data[offset + 1] = rand(-28, 28);
      data[offset + 2] = Math.sin(angle) * radius;
      data[offset + 3] = color[0] * 0.8 + 0.25;
      data[offset + 4] = color[1] * 0.8 + 0.25;
      data[offset + 5] = color[2] * 0.8 + 0.25;
    }

    return createBuffer(data, stride * 4, [
      ['aPosition', 3, 0],
      ['aColor', 3, 3]
    ], programs.star);
  }

  function makeStreams() {
    const stride = 6;
    const data = new Float32Array(streamCount * stride);

    for (let i = 0; i < streamCount; i += 1) {
      const loop = i / streamCount;
      const ring = (i % 10) / 10;
      const angle = loop * Math.PI * 2 * 10.0;
      const radius = 3.25 + ring * 2.2;
      const tilt = 0.55 + ring * 1.2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle * 1.12 + ring * 6.0) * 1.05;
      const z = Math.sin(angle) * radius * 0.34;
      const cy = Math.cos(tilt);
      const sy = Math.sin(tilt);
      const offset = i * stride;

      data[offset] = x * cy - z * sy;
      data[offset + 1] = y;
      data[offset + 2] = x * sy + z * cy;
      data[offset + 3] = ring < 0.34 ? 0.08 : 1.0;
      data[offset + 4] = ring < 0.34 ? 0.82 : 0.2;
      data[offset + 5] = ring < 0.34 ? 1.0 : 0.78;
    }

    return createBuffer(data, stride * 4, [
      ['aPosition', 3, 0],
      ['aColor', 3, 3]
    ], programs.simple);
  }

  function makeWings() {
    const stride = 7;
    const data = new Float32Array(wingCount * stride);

    for (let i = 0; i < wingCount; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const u = Math.random();
      const v = Math.random();
      const spread = Math.sin(u * Math.PI);
      const offset = i * stride;

      data[offset] = side * (1.05 + u * 6.25);
      data[offset + 1] = -0.3 + spread * 3.8 - v * 2.1;
      data[offset + 2] = rand(-0.75, 0.75) - u * 0.8;
      data[offset + 3] = side;
      data[offset + 4] = u;
      data[offset + 5] = v;
      data[offset + 6] = Math.random() * 100;
    }

    return createBuffer(data, stride * 4, [
      ['aPosition', 3, 0],
      ['aSeed', 4, 3]
    ], programs.wing);
  }

  function makeCenterGlow() {
    const count = 900;
    const stride = 6;
    const data = new Float32Array(count * stride);

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius = i % 3 === 0 ? 0.5 : rand(0.66, 1.12);
      const offset = i * stride;

      data[offset] = Math.cos(angle) * radius;
      data[offset + 1] = Math.sin(angle) * radius * 0.52 - 0.12;
      data[offset + 2] = rand(-0.05, 0.05);
      data[offset + 3] = i % 2 ? 1 : 0.08;
      data[offset + 4] = i % 2 ? 0.18 : 0.84;
      data[offset + 5] = i % 2 ? 0.72 : 1;
    }

    return createBuffer(data, stride * 4, [
      ['aPosition', 3, 0],
      ['aColor', 3, 3]
    ], programs.simple);
  }

  const heart = makeHeart();
  const stars = makeStars();
  const streams = makeStreams();
  const wings = makeWings();
  const centerGlow = makeCenterGlow();

  const sparkData = new Float32Array(sparkCount * 6);
  const sparkVelocity = new Float32Array(sparkCount * 3);
  const sparkLife = new Float32Array(sparkCount);
  const sparks = createBuffer(sparkData, 6 * 4, [
    ['aPosition', 3, 0],
    ['aColor', 3, 3]
  ], programs.star, gl.DYNAMIC_DRAW);

  const state = {
    beat: 0,
    explosion: 0,
    intro: 1,
    wing: 0,
    boost: 0
  };

  const pointer = {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    world: [0, 0, 0]
  };

  let startTime = performance.now();
  let lastTime = startTime;

  function drawBuffer(item, mode, uniforms) {
    gl.useProgram(item.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, item.buffer);

    for (const [name, size, offset] of item.attributes) {
      const location = gl.getAttribLocation(item.program, name);
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, item.stride, offset * 4);
    }

    for (const key in uniforms) {
      const location = gl.getUniformLocation(item.program, key);
      const value = uniforms[key];
      if (location === null || value === undefined) continue;
      if (value.length === 16) gl.uniformMatrix4fv(location, false, value);
      else if (value.length === 3) gl.uniform3fv(location, value);
      else gl.uniform1f(location, value);
    }

    gl.drawArrays(mode, 0, item.count);
  }

  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function lookAt(eye, center, up) {
    const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    const x = normalize(cross(up, z));
    const y = cross(z, x);

    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
  }

  function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function resize() {
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function movePointer(clientX, clientY) {
    pointer.tx = (clientX / innerWidth) * 2 - 1;
    pointer.ty = -(clientY / innerHeight) * 2 + 1;
  }

  function explode() {
    state.explosion = 1;
    state.wing = 1;
    state.boost = 1;
    triggerSparks();
  }

  function triggerSparks() {
    for (let i = 0; i < sparkCount; i += 1) {
      const dataOffset = i * 6;
      const velocityOffset = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const z = rand(-1, 1);
      const radius = Math.sqrt(1 - z * z);
      const speed = rand(2.5, 8.5);

      sparkData[dataOffset] = pointer.world[0];
      sparkData[dataOffset + 1] = pointer.world[1];
      sparkData[dataOffset + 2] = pointer.world[2];
      sparkData[dataOffset + 3] = 1;
      sparkData[dataOffset + 4] = rand(0.45, 0.95);
      sparkData[dataOffset + 5] = rand(0.78, 1);

      sparkVelocity[velocityOffset] = Math.cos(theta) * radius * speed;
      sparkVelocity[velocityOffset + 1] = z * speed;
      sparkVelocity[velocityOffset + 2] = Math.sin(theta) * radius * speed;
      sparkLife[i] = rand(0.65, 1);
    }
  }

  function updateSparks(delta) {
    for (let i = 0; i < sparkCount; i += 1) {
      if (sparkLife[i] <= 0) continue;

      const dataOffset = i * 6;
      const velocityOffset = i * 3;
      sparkLife[i] -= delta * 0.65;
      sparkData[dataOffset] += sparkVelocity[velocityOffset] * delta;
      sparkData[dataOffset + 1] += sparkVelocity[velocityOffset + 1] * delta;
      sparkData[dataOffset + 2] += sparkVelocity[velocityOffset + 2] * delta;
      sparkData[dataOffset + 3] = 1;
      sparkData[dataOffset + 4] = Math.max(0.1, sparkLife[i]);
      sparkData[dataOffset + 5] = Math.max(0.35, sparkLife[i]);
      sparkVelocity[velocityOffset] *= 0.984;
      sparkVelocity[velocityOffset + 1] *= 0.984;
      sparkVelocity[velocityOffset + 2] *= 0.984;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, sparks.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, sparkData, gl.DYNAMIC_DRAW);
  }

  function animate(now) {
    const time = (now - startTime) / 1000;
    const delta = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;

    state.intro += (0 - state.intro) * 0.016;
    state.explosion += (0 - state.explosion) * 0.018;
    state.wing += (0 - state.wing) * 0.008;
    state.boost += (0 - state.boost) * 0.012;

    const beatTarget = Math.pow(Math.max(0, Math.sin(time * 2.05)), 18);
    state.beat += (beatTarget - state.beat) * 0.18;

    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    pointer.world = [pointer.x * 4.2, pointer.y * 3.4, 0];

    updateSparks(delta);

    const aspect = canvas.width / canvas.height;
    const projection = perspective((52 * Math.PI) / 180, aspect, 0.1, 150);
    const orbit = time * (0.085 + state.boost * 0.04);
    const cameraRadius = isMobile ? 13.4 : 12.0;
    const eye = [
      Math.sin(orbit) * (2.0 + state.boost * 1.2),
      0.48 + Math.sin(time * 0.16) * 0.42,
      Math.cos(orbit) * cameraRadius + state.intro * 14
    ];
    const view = lookAt(eye, [0, -0.1, 0], [0, 1, 0]);
    const uniforms = {
      uProjection: projection,
      uView: view,
      uTime: time,
      uBeat: state.beat,
      uExplosion: state.explosion,
      uIntro: state.intro,
      uPointer: pointer.world,
      uRatio: dpr,
      uWing: state.wing,
      uSpin: 0.32
    };

    gl.clearColor(0.012, 0.0, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    drawBuffer(stars, gl.POINTS, { ...uniforms, uSpin: 0.015 });
    drawBuffer(streams, gl.POINTS, uniforms);
    drawBuffer(wings, gl.POINTS, uniforms);
    drawBuffer(centerGlow, gl.POINTS, { ...uniforms, uBeat: state.beat + 0.55, uSpin: 0.7 });
    drawBuffer(heart, gl.POINTS, uniforms);
    drawBuffer(sparks, gl.POINTS, { ...uniforms, uSpin: 0 });

    requestAnimationFrame(animate);
  }

  addEventListener('resize', resize);
  addEventListener('pointermove', (event) => movePointer(event.clientX, event.clientY), { passive: true });
  addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (touch) movePointer(touch.clientX, touch.clientY);
  }, { passive: true });
  addEventListener('pointerdown', explode);

  resize();
  requestAnimationFrame(animate);
})();
