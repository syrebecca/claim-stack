'use strict';

const TAU = Math.PI * 2;
const mix = (start, end, t) => start + (end - start) * t;
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function unit(vector) {
  const length = Math.hypot(...vector);
  return vector.map(value => value / (length || 1));
}

const LIGHT = unit([-0.65, -0.7, 1.20]);
const RIM = unit([0.4, 0.75, 0.65]);

function paint(color, brightness, tint = 0) {
  const value = parseInt(color.slice(1), 16);
  const channels = [value >> 16, value >> 8 & 255, value & 255];
  const illumination = [152, 251, 235];
  return `rgb(${channels.map((channel, index) => Math.round(clamp(channel * brightness + illumination[index] * tint, 0, 255))).join(' ')})`;
}

function polygon(context, points) {
  context.beginPath();
  context.moveTo(...points[0].slice(0,2));
  for (const [x,y] of points.slice(1)) context.lineTo(x,y);
  context.closePath();
}

function isInside([x,y], points) {
  let inside = false;
  for (let i = 0, last = points.length - 1; i < points.length; last = i++) {
    const [x1,y1] = points[i], [x2,y2] = points[last];
    if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

class ChipScene {
  constructor(stage, {hero = false, onPick, nameFor} = {}) {
    this.stage = stage;
    this.canvas = stage.querySelector('canvas');
    this.context = this.canvas.getContext('2d');
    this.tooltip = stage.querySelector('.model-tooltip');
    this.hero = hero;
    this.onPick = onPick;
    this.nameFor = nameFor;
    this.amount = this.targetAmount = hero ? 0 : .63;
    this.yaw = this.targetYaw = .70;
    this.pitch = this.targetPitch = .51;
    this.visible = true;
    this.highlights = [];
    this.mode = 'default';
    this.faces = [];
    this.parts = window.ClaimStack3D.buildCanvasModel();
    this.section = false;
    this.sectionBlend = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    new ResizeObserver(() => this.queue()).observe(this.canvas);
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.queue();
    }).observe(stage);
    this.canvas.addEventListener('pointerdown', event => this.beginDrag(event));
    this.canvas.addEventListener('pointermove', event => this.move(event));
    this.canvas.addEventListener('pointerup', event => this.endDrag(event));
    this.canvas.addEventListener('pointercancel', () => this.cancelDrag());
    this.canvas.addEventListener('pointerleave', () => this.hideTooltip());
    stage.querySelectorAll('[data-action]').forEach(button =>
      button.addEventListener('click', () => this.rotate(button.dataset.action))
    );
    this.queue();
  }

  setAmount(amount) {
    this.targetAmount = amount;
    this.queue();
  }

  setSection(enabled) {
    this.section = enabled;
    this.queue();
  }

  setSelection(highlights, mode) {
    this.highlights = highlights;
    this.mode = mode;
    this.queue();
  }

  rotate(action) {
    if (action === 'reset') {
      this.targetYaw = this.yaw + Math.atan2(Math.sin(.70-this.yaw),Math.cos(.70-this.yaw));
      this.targetPitch = .51;
    } else {
      this.targetYaw += action === 'left' ? -.36 : .36;
    }
    this.queue();
  }

  beginDrag(event) {
    if (!event.isPrimary || event.button !== 0) return;
    this.pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
    this.canvas.setPointerCapture(event.pointerId);
    this.hideTooltip();
  }

  move(event) {
    const pointer = this.pointer;
    if (pointer && event.pointerId === pointer.id) {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.moved && Math.hypot(dx,dy) < 5) return;
      pointer.moved = true;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      this.targetYaw += dx * .010;
      this.targetPitch = clamp(this.targetPitch + dy * .008,.16,1.18);
      this.canvas.classList.add('dragging');
      this.queue();
      return;
    }
    const face = this.picked(event);
    const name = face && this.nameFor?.(face.id);
    this.canvas.classList.toggle('pickable',Boolean(name && this.onPick));
    if (!name || event.pointerType === 'touch') {
      this.hideTooltip();
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.tooltip.textContent = name;
    this.tooltip.hidden = false;
    this.tooltip.style.left = `${clamp(event.clientX-rect.left+13,5,rect.width-this.tooltip.offsetWidth-5)}px`;
    this.tooltip.style.top = `${clamp(event.clientY-rect.top-37,5,rect.height-34)}px`;
  }

  endDrag(event) {
    if (event.pointerId !== this.pointer?.id) return;
    if (!this.pointer.moved && this.onPick) {
      const face = this.picked(event);
      if (face) this.onPick(face.id);
    }
    this.cancelDrag();
  }

  cancelDrag() {
    this.pointer = null;
    this.canvas.classList.remove('dragging');
  }

  picked(event) {
    const rect = this.canvas.getBoundingClientRect();
    const point = [event.clientX-rect.left,event.clientY-rect.top];
    return this.faces.findLast(face => face.opacity > .62 && isInside(point,face.screen));
  }

  hideTooltip() {
    this.tooltip.hidden = true;
  }

  queue() {
    if (!this.visible || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const ease = this.reducedMotion.matches ? 1 : .24;
      this.amount = mix(this.amount,this.targetAmount,ease);
      this.yaw = mix(this.yaw,this.targetYaw,ease);
      this.pitch = mix(this.pitch,this.targetPitch,ease);
      this.sectionBlend = mix(this.sectionBlend,Number(this.section),ease);
      this.draw();
      if (Math.abs(this.amount-this.targetAmount) + Math.abs(this.yaw-this.targetYaw) + Math.abs(this.pitch-this.targetPitch) + Math.abs(this.sectionBlend-Number(this.section)) > .001) this.queue();
    });
  }

  showSolid(solid) {
    switch (solid.mode) {
      case 'drain-rounded': return this.mode !== 'facet-flat';
      case 'drain-flat': return this.mode === 'facet-flat';
      case 'dielectric-context':
      case 'gate-dielectrics': return this.mode !== 'dielectric';
      case 'channel-face': return this.highlights.includes('contact-face');
      case 'base-face': return this.highlights.includes('base-face');
      default: return !solid.mode || this.mode===solid.mode;
    }
  }

  partPosition(part) {
    const ratio = clamp((this.amount-part.window[0])/(part.window[1]-part.window[0]),0,1);
    const motion = ratio*ratio*ratio*(ratio*(ratio*6-15)+10);
    return part.center.map((value,index)=>value+part.offset[index]*motion);
  }

  draw() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height || !this.context) return;
    const ratio = Math.min(devicePixelRatio || 1,2);
    const bufferWidth = Math.round(width*ratio), bufferHeight = Math.round(height*ratio);
    if (this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
    }
    const ctx = this.context;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);

    const yaw = this.yaw - this.amount*.40 - this.sectionBlend*.40;
    const pitch = this.pitch - this.amount*.16 - this.sectionBlend*.29;
    const right = [Math.cos(yaw), Math.sin(yaw), 0];
    const up = [-Math.sin(yaw)*Math.sin(pitch), Math.cos(yaw)*Math.sin(pitch), Math.cos(pitch)];
    const eye = cross(right,up);
    const spread = this.amount * this.amount * (3-2*this.amount);
    const center = [0,0,2.61 + spread*.65];

    const projectAtUnitScale = point => {
      const local = subtract(point,center);
      const depth = dot(local,eye);
      const perspective = 19 / (19 - depth);
      return [dot(local,right)*perspective,-dot(local,up)*perspective,depth];
    };

    const faces = [];
    let left = Infinity, top = Infinity, rightmost = -Infinity, bottom = -Infinity;
    for (const solid of this.parts) {
      if (!this.showSolid(solid)) continue;
      const id = solid.id;
      const selected = this.highlights.includes(id);
      const muted = this.highlights.length && !selected;
      const position = this.partPosition(solid);
      const polygons = this.section && this.amount<.025 ? solid.cutFaces : solid.faces;
      for (const face of polygons) {
        if (dot(face.normal,eye) < .006) continue;
        const screen = face.points.map(point => projectAtUnitScale(add(point,position)));
        for (const [x,y] of screen) {
          left = Math.min(left,x);
          top = Math.min(top,y);
          rightmost = Math.max(rightmost,x);
          bottom = Math.max(bottom,y);
        }
        const depth = projectAtUnitScale(add(face.midpoint,position))[2];
        faces.push({...face,id,screen,depth,selected,muted,opacity:solid.opacity,color:solid.color,accent:solid.accent,metal:solid.metal});
      }
    }
    const widthFraction = this.hero && width > 500 ? .78 : .87;
    const heightFraction = this.hero ? .82 : .77;
    const scale = Math.min(width*widthFraction/(rightmost-left),height*heightFraction/(bottom-top));
    const anchorX = width*(this.hero && width>710 ? .56 : .5) - (left+rightmost)*.5*scale;
    const anchorY = height*.51 - (top+bottom)*.5*scale;
    const toScreen = ([x,y,depth]) => [anchorX+x*scale,anchorY+y*scale,depth];
    const project = point => toScreen(projectAtUnitScale(point));
    this.drawGrid(ctx,project,scale,spread);
    for (const face of faces) face.screen = face.screen.map(toScreen);
    faces.sort((a,b) => a.depth-b.depth);
    this.faces = faces;

    for (const face of faces) {
      const {metal} = face;
      const color = face.selected ? face.accent : face.color;
      const light = Math.max(0,dot(face.normal,LIGHT));
      const rim = Math.max(0,dot(face.normal,RIM));
      let brightness = .39 + light*.64 + rim*.15;
      let shine = light * .055 + rim * .026;
      if (face.selected) {
        brightness = brightness*.74 + .40;
        shine += .055;
      } else if (face.muted) {
        brightness *= .73;
      }
      const xs = face.screen.map(point => point[0]);
      const ys = face.screen.map(point => point[1]);
      const left = Math.min(...xs), top = Math.min(...ys);
      const rightmost = Math.max(...xs), bottom = Math.max(...ys);
      const gradient = ctx.createLinearGradient(left,top,rightmost+.01,bottom+.01);
      gradient.addColorStop(0,paint(color,brightness+.13+metal*.10,shine+.056));
      gradient.addColorStop(.28,paint(color,brightness+.075,shine));
      gradient.addColorStop(.60,paint(color,brightness-.025,shine));
      gradient.addColorStop(1,paint(color,brightness*.68,shine*.72));

      ctx.globalAlpha = face.opacity * (face.muted ? .40 : 1);
      polygon(ctx,face.screen);
      if (face.selected && face.normal[2] > .6) {
        ctx.strokeStyle = face.accent;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = face.accent;
        ctx.shadowBlur = 11;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = face.selected ? 1.0 : .53;
      ctx.strokeStyle = gradient;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (this.highlights.includes('dimensions')) this.drawDimensions(ctx,project,spread);
    if (this.highlights.includes('center-gap')) this.drawDimensions(ctx,project,spread,true);
    if (this.highlights.includes('levels')) this.drawLevels(ctx,project,spread);
  }

  drawGrid(ctx,project,scale,spread) {
    const z = -1.60-spread*.15;
    const [x,y] = project([0,0,z]);
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(1,.49);
    ctx.beginPath();
    ctx.arc(0,0,scale*5,0,TAU);
    const shadow = ctx.createRadialGradient(0,0,0,0,0,scale*5);
    shadow.addColorStop(0,'#06020bd9');
    shadow.addColorStop(.61,'#11071c80');
    shadow.addColorStop(1,'#0a061100');
    ctx.fillStyle = shadow;
    ctx.fill();
    ctx.restore();

    for (let index = -9; index <= 9; index++) {
      const offset = index*.65;
      const alpha = index === 0 ? '.20' : String(.12-Math.abs(index)*.008);
      for (const axis of [0,1]) {
        const points = axis === 0 ? [[offset,-5.85,z],[offset,5.85,z]] : [[-5.85,offset,z],[5.85,offset,z]];
        const [a,b] = points.map(project);
        const gradient = ctx.createLinearGradient(a[0],a[1],b[0],b[1]);
        gradient.addColorStop(0,'#6a9aab00');
        gradient.addColorStop(.47,`rgba(106,154,171,${alpha})`);
        gradient.addColorStop(1,'#6a9aab00');
        this.line(ctx,a,b,gradient,.8);
      }
    }

    const points = [[-4.02,-2.73,z],[4.02,-2.73,z],[4.02,2.73,z],[-4.02,2.73,z]].map(project);
    polygon(ctx,points);
    ctx.lineWidth = .7;
    ctx.strokeStyle = '#6a9aab30';
    ctx.stroke();
  }

  line(ctx,a,b,color,width = 1) {
    ctx.beginPath();
    ctx.moveTo(a[0],a[1]);
    ctx.lineTo(b[0],b[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  drawDimensions(ctx,project,spread,centerGap = false) {
    const channel = this.partPosition(this.parts.find(part=>part.id==='channel'));
    const lower = this.partPosition(this.parts.find(part=>part.id==='gate-lower'));
    const measures = [
      [[channel[0]-.567,channel[1]-.5,channel[2]],[channel[0]+.567,channel[1]-.5,channel[2]],'채널층 폭'],
      centerGap
        ? [[-.783,-.7,2.9025],[.7695,-.7,2.9025],'외측면 사이 폭']
        : [[lower[0]-.6804,lower[1]-.75,lower[2]],[lower[0]+.6804,lower[1]-.75,lower[2]],'게이트 하부 폭']
    ];
    for (const [start,end,label] of measures) {
      const a = project(start), b = project(end);
      this.line(ctx,a,b,'#b6fff1');
      for (const [x,y] of [a,b]) this.line(ctx,[x,y-4],[x,y+4],'#b6fff1');
      this.note(ctx,label,b[0]+7,b[1]+2);
    }
  }

  drawLevels(ctx,project) {
    const levels = [
      [[-2.42,-.7,1.539],'소스/드레인 최하부'],
      [[-1.15,-.7,1.863],'게이트 하부 최하부']
    ];
    for (const [point,label] of levels) {
      const [x,y] = project(point);
      this.line(ctx,[x-7,y],[x+20,y],'#b6fff1');
      this.note(ctx,label,x+23,y);
    }
  }

  note(ctx,label,x,y) {
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    const width = ctx.measureText(label).width;
    if (x+width+12 > this.canvas.clientWidth) x -= width+32;
    ctx.fillStyle = '#0b1820e8';
    ctx.fillRect(x-4,y-11,width+8,16);
    ctx.fillStyle = '#c5f8ef';
    ctx.fillText(label,x,y+1);
  }
}
