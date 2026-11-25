import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPatentDevice, point } from './patent-model.js';
import { makeSection } from './section.js';

const { MathUtils, Vector3, Color, Group, Mesh, Line } = THREE;
const softer = (start, end, value) => MathUtils.smootherstep(value, start, end);
const blend = MathUtils.lerp;
const v = (x, y, z) => new Vector3(x, y, z);
const SECTION_DEPTH = .003;
const HIGHLIGHTS = {
  base:0x82bbff,active:0x82bbff,channel:0x4ee3c0,
  'gate-upper':0xeeb363,'gate-lower':0xeeb363,drain:0x6bafff,plug:0xe8c085,
  dielectric:0xbba0ff,ild:0x97bfda,spacer:0xf098c3,'contact-face':0x66e5c4,'base-face':0x66e5c4
};
const hueFor = id=>HIGHLIGHTS[id] ?? 0x67dbca;
export const colorForPart = id=>`#${hueFor(id).toString(16).padStart(6,'0')}`;

function neutralColor(color) {
  const gray = .2126*color.r+.7152*color.g+.0722*color.b;
  return color.clone().lerp(new Color(gray,gray,gray),.89);
}

const FINISHES = {
  substrate: [0x51595d,.49,.53],
  silicon: [0x787a77,.42,.45],
  siliconCore: [0x939a97,.42,.36],
  isolation: [0x8d938f,.18,.49],
  cap: [0x9da9b0,.30,.44],
  metal: [0x9a9fa3,.80,.32],
  spacer: [0x6e7983,.32,.46],
  liner: [0xb0a184,.66,.35],
  dielectric: [0x8f76a3,.24,.44],
  innerSpacer: [0x9e8f9c,.30,.46],
  epi: [0x6a8b7d,.39,.42],
  contact: [0xb7aa93,.79,.29],
  barrier: [0x7a695a,.77,.35],
  silicide: [0xb29f84,.63,.42],
  insulator: [0x8f9ba2,.10,.49],
  surface: [0x74ffe1,.24,.24]
};

function makeGrain() {
  const size = 64;
  const data = new Uint8Array(size*size*4);
  let seed = 481;
  for (let index=0;index<data.length;index+=4) {
    seed = (seed*1664525+1013904223)>>>0;
    const shade = 216 + (seed>>>27);
    data.set([shade,shade,shade,255],index);
  }
  const texture = new THREE.DataTexture(data,size,size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeGrid() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i <= size; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i,0);
    ctx.lineTo(i,size);
    ctx.moveTo(0,i);
    ctx.lineTo(size,i);
    ctx.strokeStyle = i%64===0 ? '#7bb4bb64' : '#5892982e';
    ctx.stroke();
  }
  for (let x=0; x<size; x+=32) for (let y=0; y<size; y+=32) {
    ctx.fillStyle = '#9acfd291';
    ctx.fillRect(x-1,y-1,2,2);
  }
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createRadialGradient(255,255,35,255,255,255);
  fade.addColorStop(0,'#fff');
  fade.addColorStop(.63,'#ffffffa0');
  fade.addColorStop(1,'#fff0');
  ctx.fillStyle = fade;
  ctx.fillRect(0,0,size,size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const grid = new Mesh(new THREE.PlaneGeometry(27,27),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.24}));
  grid.rotation.x = -Math.PI/2;
  grid.position.y = -1.63;
  grid.renderOrder = -2;
  return grid;
}

function makeShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const blur = ctx.createRadialGradient(64,64,6,64,64,64);
  blur.addColorStop(0,'#000000e0');
  blur.addColorStop(.48,'#000000aa');
  blur.addColorStop(1,'#0000');
  ctx.fillStyle = blur;
  ctx.fillRect(0,0,128,128);
  const mesh = new Mesh(new THREE.PlaneGeometry(11,8),new THREE.MeshBasicMaterial({
    map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,opacity:.85
  }));
  mesh.rotation.x = -Math.PI/2;
  mesh.position.y = -1.595;
  mesh.renderOrder = -1;
  return mesh;
}

function lineBetween(color,opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));
  return new Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
}

function placeLine(line,a,b) {
  const position = line.geometry.attributes.position;
  position.setXYZ(0,a.x,a.y,a.z);
  position.setXYZ(1,b.x,b.y,b.z);
  position.needsUpdate = true;
  line.frustumCulled = false;
}

export class ChipScene {
  constructor(stage,{hero=false,onPick,nameFor}={}) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');
    const webgl = this.canvas.getContext('webgl2',{antialias:true,alpha:true,powerPreference:'high-performance'});
    if (!webgl) throw new Error('WebGL2 unavailable');
    this.renderer = new THREE.WebGLRenderer({canvas:this.canvas,context:webgl,alpha:true,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.07;
    this.renderer.setClearColor(0x000000,0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    this.clipPlane = new THREE.Plane(v(0,0,-1),SECTION_DEPTH);
    this.clipPlanes = [this.clipPlane];
    this.section = false;
    this.sectionBlend = 0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34,1,.1,120);
    this.camera.position.set(10,8,13);
    this.ray = new THREE.Raycaster();
    this.pointerVector = new THREE.Vector2();
    this.hero = hero;
    this.onPick = onPick;
    this.nameFor = nameFor;
    this.parts = [];
    this.guides = [];
    this.amount = this.targetAmount = hero ? 0 : .66;
    this.highlights = [];
    this.mode = 'default';
    this.visible = true;
    this.userTurn = this.targetTurn = 0;
    this.userTilt = this.targetTilt = 0;
    this.zoom = this.targetZoom = 1;
    this.started = performance.now();
    this.last = this.started;
    this.intro = hero;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.hitPoint = v(0,0,0);
    this.tooltip = stage.querySelector('.model-tooltip');
    this.marker = stage.querySelector('.scene-marker');
    this.labels = [
      {part:'gate-upper',text:'160 · 게이트',lead:[-.21,.12,.7]},
      {part:'channel',text:'141–143 · 채널층',lead:[.27,.07,.38]},
      {part:'drain',text:'150 · 소스/드레인',lead:[.17,.16,.12]},
      {part:'base',text:'101 · 기판',lead:[-.85,-.08,.76]}
    ].map(label=>{
      const element = document.createElement('span');
      element.className = 'scene-marker overview-marker';
      element.textContent = label.text;
      element.hidden = true;
      stage.append(element);
      return {...label,element,offset:v(...label.lead)};
    });
    this.cameraTarget = v(0,1,0);
    this.frame = null;

    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment,.065).texture;
    this.scene.environmentIntensity = .87;
    this.grain = makeGrain();
    environment.dispose();
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0xc7f6ff,0x233039,.91));
    this.light(0xe8fcff,2.38,[-6,10,7],true);
    this.light(0x72badc,1.5,[4,4,-8]);
    this.light(0xf6ae78,1.04,[6,3,4]);
    this.scene.add(makeGrid(),makeShadow());

    this.model = new Group();
    this.scene.add(this.model);
    buildPatentDevice(this);
    this.makeGuides();

    this.dimensions = Array.from({length:6},()=>lineBetween(0x9ffff0,.95));
    this.dimensions.forEach(line => this.scene.add(line));
    this.dimensionLabels = Array.from({length:2},()=>{
      const element = document.createElement('span');
      element.className = 'measure-tag';
      stage.append(element);
      return element;
    });

    this.canvas.addEventListener('pointerdown',e=>this.down(e));
    this.canvas.addEventListener('pointermove',e=>this.move(e));
    this.canvas.addEventListener('pointerup',e=>this.up(e));
    this.canvas.addEventListener('pointercancel',()=>this.cancel());
    this.canvas.addEventListener('pointerleave',()=>this.hideTooltip());
    stage.querySelectorAll('[data-action]').forEach(button=>
      button.addEventListener('click',()=>this.rotate(button.dataset.action))
    );

    new ResizeObserver(()=>this.queue()).observe(stage);
    new IntersectionObserver(([entry])=>{
      this.visible = entry.isIntersecting;
      if (this.visible) this.queue();
    }).observe(stage);
    this.queue();
  }

  light(color,intensity,position,shadows=false) {
    const light = new THREE.DirectionalLight(color,intensity);
    light.position.set(...position);
    if (shadows) {
      light.target.position.set(0,3,0);
      light.castShadow = true;
      light.shadow.mapSize.set(1024,1024);
      Object.assign(light.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:24});
      light.shadow.normalBias = .018;
      this.scene.add(light.target);
    }
    this.scene.add(light);
  }

  box(part,finish,position,size,move,window,options={}) {
    const radius = Math.min(options.radius ?? .05,...size.map(n=>n*.37));
    const geometry = new RoundedBoxGeometry(...size,2,radius);
    return this.mesh(part,finish,position,geometry,move,window,options);
  }

  mesh(part,finish,position,geometry,move,window,options={}) {
    const [color,metalness,roughness] = FINISHES[finish];
    const material = new THREE.MeshPhysicalMaterial({
      color,metalness,roughness,roughnessMap:this.grain,clearcoat:.08,clearcoatRoughness:.42,
      side:options.twoSided ? THREE.DoubleSide : THREE.FrontSide,
      transparent:options.alpha<1,opacity:options.alpha ?? 1
    });
    const mesh = new Mesh(geometry,material);
    mesh.receiveShadow = true;
    mesh.userData.part = part;
    const home = v(...position);
    mesh.position.copy(home);
    this.model.add(mesh);
    const {cap:cutShape} = makeSection(geometry,SECTION_DEPTH-home.z);
    let cut;
    if (cutShape) {
      const fill = new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
      cut = new Mesh(cutShape,fill);
      cut.userData.part = part;
      cut.visible = false;
      cut.frustumCulled = false;
      mesh.add(cut);
    }
    this.parts.push({
      mesh,cut,home,move:v(...move),window,part, mode:options.mode,rotation:options.rotation ?? [0,0,0],
      color:neutralColor(new Color(color)),accent:new Color(hueFor(part)),glow:0,opacity:options.alpha ?? 1
    });
    return mesh;
  }

  makeGuides() {
    for (const [x,top] of [[-2.94,4.0],[0,4.9],[2.94,4.0]]) {
      const line = lineBetween(0x78baad,0);
      this.scene.add(line);
      this.guides.push({line,x,top});
    }
  }

  setAmount(amount) {
    this.targetAmount = amount;
    this.queue();
  }

  setSection(enabled) {
    this.section = enabled;
    if (!this.width) this.sectionBlend = Number(enabled);
    this.queue();
  }

  setSelection(highlights,mode) {
    this.highlights = highlights;
    this.mode = mode;
    this.targetTurn = highlights.includes('contact-face') ? -.36 : highlights.includes('spacer') ? -.23 : 0;
    this.targetTilt = highlights.includes('levels') ? -.18 : highlights.includes('dimensions') ? -.12 : 0;
    this.targetZoom = highlights.length === 1 && !highlights.includes('active') && !highlights.includes('base') ? 1.05 : 1;
    this.queue();
  }

  rotate(action) {
    this.intro = false;
    if (action === 'reset') {
      this.targetTurn = this.userTurn + Math.atan2(Math.sin(-this.userTurn),Math.cos(-this.userTurn));
      this.targetTilt = 0;
      this.targetZoom = 1;
    } else {
      this.targetTurn += action === 'left' ? -.45 : .45;
    }
    this.queue();
  }

  down(event) {
    if (!event.isPrimary || event.button !== 0) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,didMove:false};
    this.hideTooltip();
  }

  move(event) {
    const pointer = this.pointer;
    if (pointer && pointer.id === event.pointerId) {
      const dx = event.clientX-pointer.x, dy = event.clientY-pointer.y;
      if (!pointer.didMove && Math.hypot(dx,dy)<4) return;
      pointer.didMove = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      this.targetTurn -= dx*.009;
      this.targetTilt = MathUtils.clamp(this.targetTilt+dy*.007,-.38,.37);
      this.intro = false;
      this.canvas.classList.add('dragging');
      this.queue();
      return;
    }
    if (!this.tooltip || event.pointerType === 'touch') return;
    const name = this.nameFor?.(this.pick(event));
    this.canvas.classList.toggle('pickable',Boolean(name && this.onPick));
    if (!name) {
      this.hideTooltip();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.tooltip.hidden = false;
    this.tooltip.textContent = name;
    this.tooltip.style.left = `${MathUtils.clamp(event.clientX-rect.left+14,5,rect.width-this.tooltip.offsetWidth-5)}px`;
    this.tooltip.style.top = `${MathUtils.clamp(event.clientY-rect.top-35,5,rect.height-34)}px`;
  }

  up(event) {
    if (this.pointer?.id !== event.pointerId) return;
    if (!this.pointer.didMove && this.onPick) {
      const part = this.pick(event);
      if (part) this.onPick(part);
    }
    this.cancel();
  }

  cancel() {
    this.pointer = null;
    this.canvas.classList.remove('dragging');
  }

  hideTooltip() {
    if (this.tooltip) this.tooltip.hidden = true;
  }

  pick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerVector.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.ray.setFromCamera(this.pointerVector,this.camera);
    const targets = this.parts.filter(part=>part.mesh.visible && part.opacity>.15)
      .flatMap(part=>part.cut?.visible ? [part.mesh,part.cut] : [part.mesh]);
    return this.ray.intersectObjects(targets,false)
      .find(hit=>!this.section || hit.point.z<=SECTION_DEPTH+.001)?.object.userData.part;
  }

  showPart(part) {
    switch (part.mode) {
      case 'drain-rounded': return this.mode !== 'facet-flat';
      case 'drain-flat': return this.mode === 'facet-flat';
      case 'dielectric-context': return this.mode !== 'dielectric';
      case 'gate-dielectrics': return this.mode !== 'dielectric';
      case 'channel-face': return this.highlights.includes('contact-face');
      case 'base-face': return this.highlights.includes('base-face');
      default: return !part.mode || part.mode === this.mode;
    }
  }

  queue() {
    if (this.frame || !this.visible) return;
    this.frame = requestAnimationFrame(time=>this.draw(time));
  }

  draw(time) {
    this.frame = null;
    const width = this.stage.clientWidth, height = this.stage.clientHeight;
    if (!width || !height) return;
    const dt = Math.min(.05,Math.max(1/120,(time-this.last)/1000));
    this.last = time;
    const reduced = this.reduced.matches;
    const move = reduced ? 1 : 1-Math.exp(-10*dt);
    const light = reduced ? 1 : 1-Math.exp(-9*dt);
    this.amount = blend(this.amount,this.targetAmount,move);
    this.userTurn = blend(this.userTurn,this.targetTurn,move);
    this.userTilt = blend(this.userTilt,this.targetTilt,move);
    this.zoom = blend(this.zoom,this.targetZoom,move);
    this.sectionBlend = blend(this.sectionBlend,Number(this.section),move);
    const a = this.amount;
    const cutEnabled = this.section && a<.025;
    const intro = this.intro && !reduced ? 1-softer(0,2.8,(time-this.started)/1000) : 0;
    let lightMoving = false;

    for (const part of this.parts) {
      const {mesh,home,window} = part;
      mesh.visible = this.showPart(part);
      if (!mesh.visible) continue;
      const s = softer(window[0],window[1],a);
      mesh.position.copy(home).addScaledVector(part.move,s);
      if (!this.section && part.part === 'gate-upper' && this.highlights.includes('dielectric')) mesh.position.y += .06;
      const arc = Math.sin(Math.PI*s);
      mesh.rotation.set(
        part.rotation[0]*(s+arc*.28),
        part.rotation[1]*(s+arc*.28),
        part.rotation[2]*(s+arc*.28)
      );
      const selected = this.highlights.includes(part.part);
      part.glow = blend(part.glow,selected ? 1 : 0,light);
      const dimmed = this.highlights.length && !selected;
      mesh.material.color.copy(part.color).multiplyScalar(dimmed ? .62 : 1).lerp(part.accent,part.glow*.82);
      mesh.material.emissive.copy(part.accent);
      mesh.material.emissiveIntensity = part.glow*.28;
      mesh.material.transparent = part.opacity<1 || Boolean(dimmed);
      mesh.material.opacity = part.opacity * (dimmed ? .235 : 1);
      mesh.material.depthWrite = !dimmed && part.opacity>=.99;
      mesh.material.clipShadows = true;
      mesh.castShadow = mesh.material.depthWrite;
      mesh.material.clippingPlanes = cutEnabled ? this.clipPlanes : null;
      if (part.cut) {
        part.cut.visible = cutEnabled;
        part.cut.material.color.copy(part.color).multiplyScalar(dimmed ? .55 : .92).lerp(part.accent,part.glow*.94);
        part.cut.material.transparent = mesh.material.transparent;
        part.cut.material.opacity = mesh.material.opacity;
        part.cut.material.depthWrite = mesh.material.depthWrite;
      }
      lightMoving ||= Math.abs(part.glow-(selected ? 1 : 0)) > .005;
    }

    for (const {line,x,top} of this.guides) {
      const s = softer(.22,.68,a);
      line.visible = s>.01;
      line.material.opacity = s*.26;
      if (line.visible) placeLine(line,v(x,.20,0),v(x+Math.sign(x)*s*.57,top+s*1.58,0));
    }

    if (width!==this.width || height!==this.height) {
      this.width = width;
      this.height = height;
      this.renderer.setSize(width,height,false);
      this.camera.aspect = width/height;
      this.camera.updateProjectionMatrix();
    }

    // The room turns from an assembled three-quarter view to a lower cutaway.
    const approach = softer(.0,.30,a);
    const reveal = softer(.26,.89,a);
    const yaw = blend(.62+approach*.15-reveal*.52,.24,this.sectionBlend) + this.userTurn+intro*.10;
    const elevation = blend(.46+approach*.12-reveal*.29,.22,this.sectionBlend) + this.userTilt;
    const framing = Math.max(1,.77/this.camera.aspect);
    const distance = (17.25-approach*.20+reveal*5.88) * framing / this.zoom + intro*.8;
    this.cameraTarget.set(0,blend(2.61,3.58,softer(.15,1,a)),0);
    if (width<590) this.cameraTarget.y += .35;
    if (this.hero && width>710) {
      const slide = Math.min(1.42,width*.00137);
      this.cameraTarget.addScaledVector(v(Math.cos(yaw),0,-Math.sin(yaw)),-slide);
    }
    this.camera.position.set(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation))
      .multiplyScalar(distance).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
    this.drawMeasurements();
    this.renderer.render(this.scene,this.camera);
    this.drawMarker();

    if (intro>.001 || lightMoving || Math.abs(this.amount-this.targetAmount)+Math.abs(this.userTurn-this.targetTurn)+
      Math.abs(this.userTilt-this.targetTilt)+Math.abs(this.zoom-this.targetZoom)+
      Math.abs(this.sectionBlend-Number(this.section))>.002) this.queue();
  }

  anchor(element,point) {
    const coordinate = point.clone().project(this.camera);
    const x = (coordinate.x + 1)*this.width/2, y = (1-coordinate.y)*this.height/2;
    element.hidden = x<9 || x>this.width-10 || y<12 || y>this.height-18;
    if (!element.hidden) {
      element.style.left = `${Math.min(x,this.width-element.offsetWidth-9)}px`;
      element.style.top = `${y}px`;
    }
  }

  drawMarker() {
    if (!this.marker) return;
    const ids = this.highlights.filter(id=>!['dimensions','center-gap','levels'].includes(id));
    for (const label of this.labels) {
      label.element.hidden = true;
      if (ids.length || this.amount<.94 || this.width<590) continue;
      const candidate = this.parts.filter(part=>part.part===label.part && part.mesh.visible).at(label.part==='channel' ? 1 : 0);
      if (candidate) this.anchor(label.element,candidate.mesh.position.clone().add(label.offset));
    }
    if (ids.length!==1 || this.width<530 || this.highlights.includes('levels')) {
      this.marker.hidden = true;
      return;
    }
    const candidates = this.parts.filter(part=>part.part===ids[0] && part.mesh.visible);
    if (!candidates.length) {
      this.marker.hidden = true;
      return;
    }
    const target = candidates.reduce((a,b)=>a.mesh.position.y>b.mesh.position.y ? a : b);
    this.marker.textContent = this.nameFor?.(target.part) ?? '';
    this.marker.style.setProperty('--part-accent',colorForPart(target.part));
    this.hitPoint.copy(target.mesh.position);
    this.hitPoint.y += .14;
    this.hitPoint.z += .5;
    this.anchor(this.marker,this.hitPoint);
  }

  drawMeasurements() {
    for (const line of this.dimensions) line.visible = false;
    for (const label of this.dimensionLabels) label.hidden = true;
    const ids = this.highlights;
    const showLevels = ids.includes('levels');
    const showGap = ids.includes('center-gap');
    if (!showLevels && !showGap && !ids.includes('dimensions')) return;

    const find = id=>this.parts.find(part=>part.part===id && part.mesh.visible).mesh.position;
    const channel = find('channel'), lower = find('gate-lower'), source = find('drain');
    const [gapX1,gapY] = point(211.5,214.5);
    const [gapX2] = point(269,214.5);
    const front = .70;
    const dimensions = showLevels
      ? [[v(source.x-.22,1.539,front),v(source.x+.65,1.539,front),'소스/드레인 최하부'],
         [v(lower.x-.18,1.863,front),v(lower.x+.74,1.863,front),'게이트 하부 최하부']]
      : [[v(channel.x-.567,channel.y,channel.z+.50),v(channel.x+.567,channel.y,channel.z+.50),'채널층 폭'],
         showGap
          ? [v(gapX1,gapY,front),v(gapX2,gapY,front),'외측면 사이 폭']
          : [v(lower.x-.6804,lower.y,lower.z+.75),v(lower.x+.6804,lower.y,lower.z+.75),'게이트 하부 폭']];
    dimensions.forEach(([a,b,text],index)=>{
      for (const [offset,from,to] of [[0,a,b],[1,v(a.x,a.y-.055,a.z),v(a.x,a.y+.055,a.z)],
          [2,v(b.x,b.y-.055,b.z),v(b.x,b.y+.055,b.z)]]) {
        const line = this.dimensions[index*3+offset];
        line.visible = true;
        placeLine(line,from,to);
      }
      const label = this.dimensionLabels[index];
      label.textContent = text;
      this.anchor(label,b.clone().add(v(.13,.04,0)));
    });
  }

}

export function buildCanvasModel() {
  const geometries = [];
  const toCanvas = ([x,y,z]) => [x,-z,y];
  function readFaces(geometry) {
      if (!geometry) return [];
      const position = geometry.attributes.position;
      const index = geometry.index;
      const count = index ? index.count : position.count;
      const faces = [];
      for (let offset=0;offset<count;offset+=3) {
        const vertices = [0,1,2].map(step=>{
          const vertex = index ? index.getX(offset+step) : offset+step;
          return v(position.getX(vertex),position.getY(vertex),position.getZ(vertex));
        });
        const [a,b,c] = vertices;
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        if (normal.lengthSq()<1e-12) continue;
        faces.push({
          points:vertices.map(vertex=>toCanvas(vertex.toArray())),
          midpoint:toCanvas(a.clone().add(b).add(c).divideScalar(3).toArray()),
          normal:toCanvas(normal.normalize().toArray())
        });
      }
      return faces;
  }
  const collect = {
    box(id,finish,center,size,move,window,options) {
      this.mesh(id,finish,center,new THREE.BoxGeometry(...size),move,window,options);
    },
    mesh(id,finish,center,geometry,move,window,options = {}) {
      const {cap,clipped} = makeSection(geometry,SECTION_DEPTH-center[2],{includeBody:true});
      const [color,metal] = FINISHES[finish];
      geometries.push({
        id,center:toCanvas(center),offset:toCanvas(move),window,faces:readFaces(geometry),
        cutFaces:[...readFaces(clipped),...readFaces(cap)],mode:options.mode,
        opacity:options.alpha ?? 1,color:`#${neutralColor(new Color(color)).getHexString()}`,accent:colorForPart(id),metal
      });
      geometry.dispose();
      cap?.dispose();
      clipped.dispose();
    }
  };
  buildPatentDevice(collect);
  return geometries;
}
