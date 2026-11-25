import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Path, Shape } from 'three';

// Model units preserve the proportions of the drawing. These are not process dimensions.
// Fig. 2a: I/I′ provides X and elevation, II/II′ the gate’s transverse profile,
// and III/III′ the transverse source/drain and contact profiles.
const SCALE = .027;
const X0 = 240.5;
const Z0 = 322;
const LEFT = 132, RIGHT = 349;
const DEPTH = 49;
const GATES = [185.6,294.1];
const JUNCTIONS = [131.7,240.1,348.7];
const ROWS = [229,201,174];
export const point = (x,z,y = 0) => [(x-X0)*SCALE,(Z0-z)*SCALE,y*SCALE];

function trace(path,vertices) {
  path.moveTo(...vertices[0]);
  for (const vertex of vertices.slice(1)) path.lineTo(...vertex);
  path.closePath();
  return path;
}

function sheet(outline,holes,depth) {
  const shape = trace(new Shape(),outline);
  shape.holes = holes.map(hole=>trace(new Path(),hole));
  return new ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:1});
}

function spatialMesh(viewer,id,finish,geometry,move,window,options) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const pivot = bounds.min.clone().add(bounds.max).multiplyScalar(.5);
  geometry.translate(-pivot.x,-pivot.y,-pivot.z);
  return viewer.mesh(id,finish,pivot.toArray(),geometry,move,window,options);
}

function transverse(shape,holes,x1,x2) {
  const toPlane = ([z,y])=>[-y*SCALE,(Z0-z)*SCALE];
  const geometry = sheet(shape.map(toPlane),holes.map(hole=>hole.map(toPlane)),(x2-x1)*SCALE);
  geometry.rotateY(Math.PI/2);
  geometry.translate((x1-X0)*SCALE,0,0);
  return geometry;
}

function longitudinal(shape,y1,y2) {
  const outline = shape.map(([x,z])=>[(x-X0)*SCALE,(Z0-z)*SCALE]);
  const geometry = sheet(outline,[],(y2-y1)*SCALE);
  geometry.translate(0,0,y1*SCALE);
  return geometry;
}

function profile(z,halfDepth,halfHeight,corner = 2) {
  const a = z-halfHeight,b = z+halfHeight,m = halfDepth;
  return [[a,-m+corner],[a,m-corner],[a+corner,m],[b-corner,m],
    [b,m-corner],[b,-m+corner],[b-corner,-m],[a+corner,-m]];
}

function loft(rings, closed = true) {
  const positions = [];
  const triangle = (a,b,c)=>positions.push(...a,...b,...c);
  const count = rings[0].length;
  for (let row=1;row<rings.length;row++) {
    const a = rings[row-1],b = rings[row];
    for (let i=0;i<count;i++) {
      const j = (i+1)%count;
      triangle(a[i],b[j],b[i]);
      triangle(a[i],a[j],b[j]);
    }
  }
  if (closed) {
    const top = rings[0],bottom = rings.at(-1);
    for (let i=1;i<count-1;i++) {
      triangle(top[0],top[i+1],top[i]);
      triangle(bottom[0],bottom[i],bottom[i+1]);
    }
  }
  const mesh = new BufferGeometry();
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3));
  mesh.computeVertexNormals();
  return mesh;
}

function clipX(x) {
  return Math.max(LEFT,Math.min(RIGHT,x));
}

function epi(center,flat) {
  // The longitudinal edge bulges toward each nanosheet. The transverse body
  // broadens around its middle and narrows at the contact and active-fin junction.
  const profile = [[165,18,14],[168,27,15],[171,33.7,16],[174,34.0,17],[179,33.7,18],
    [184,27,20],[191,26,24],[195,28,28],[198,33.7,30],[202,34.0,33],[206,33.7,35],
    [211,27,37],[218,26,40],[223,32,39],[226,33.7,37],[230,34.0,34],[234,33.7,31],
    [241,28,29],[248,27,25],[255,25,22],[260,21,20],[263,17,19],[265,14,18]];
  const rings = profile.map(([z,l,w])=>{
    const shoulder = .72*l;
    const section = [[-l,-w*.48],[-shoulder,-w],[shoulder,-w],[l,-w*.48],
      [l,w*.48],[shoulder,w],[-shoulder,w],[-l,w*.48]];
    return section.map(([x,y])=>point(clipX(center+x),flat && z>261 ? 261 : z,y));
  });
  return loft(rings);
}

function plugRing(center,z,halfX,halfY) {
  const c = 1.7;
  return [[-halfX+c,-halfY],[halfX-c,-halfY],[halfX,-halfY+c],[halfX,halfY-c],
    [halfX-c,halfY],[-halfX+c,halfY],[-halfX,halfY-c],[-halfX,-halfY+c]]
    .map(([x,y])=>point(clipX(center+x),z,y));
}

function plug(center,wall = false) {
  const outer = [[82,22.1,21.2],[125,20,19.5],[182,17.3,16.7]].map(data=>plugRing(center,...data));
  if (!wall) return loft([[82,20.3,19.6],[125,18.2,17.8],[181,15.5,15.1]].map(data=>plugRing(center,...data)));
  // Open at the bottom for the contact compound, with the liner visible at the top.
  const inner = [[82,20.3,19.6],[125,18.2,17.8],[181,15.5,15.1]].map(data=>plugRing(center,...data));
  const surfaces = [loft(outer,false),loft(inner.map(ring=>[...ring].reverse()),false),loft([outer[0],inner[0]],false)];
  const result = new BufferGeometry();
  result.setAttribute('position',new Float32BufferAttribute(surfaces.flatMap(mesh=>Array.from(mesh.attributes.position.array)),3));
  result.computeVertexNormals();
  return result;
}

export function buildPatentDevice(viewer) {
  const box = (id,finish,x,z,y,dimensions,move,window,options={})=>
    viewer.box(id,finish,point(x,z,y),dimensions.map(d=>d*SCALE),move,window,{radius:.014,...options});
  const yz = (id,finish,shape,holes,x1,x2,move,window,options)=>
    spatialMesh(viewer,id,finish,transverse(shape,holes,x1,x2),move,window,options);
  const xz = (id,finish,shape,y1,y2,move,window,options)=>
    spatialMesh(viewer,id,finish,longitudinal(shape,y1,y2),move,window,options);
  const baseMove = [0,-.62,0], baseWindow = [.44,.95];

  box('base','substrate',240.5,339,0,[217,34,98],baseMove,baseWindow,{radius:.023});

  const fin = [[LEFT,265],[142,265],[151,262],[157,255],[161,249],[210,249],[216,256],
    [222,262],[229,265],[252,265],[260,262],[267,255],[270,249],[320,249],
    [324,256],[330,262],[338,265],[RIGHT,265],[RIGHT,322],[LEFT,322]];
  xz('active','silicon',fin,-18,18,[0,.19,0],[.10,.54]);

  const isolation = [[LEFT,277],[147,275],[153,272],[162,253],[212,253],[218,270],
    [228,277],[254,277],[263,271],[270,253],[320,253],[329,271],[337,276],
    [RIGHT,277],[RIGHT,322],[LEFT,322]];
  for (const side of [-1,1]) {
    const a = side<0 ? -DEPTH : 18,b = side<0 ? -18 : DEPTH;
    xz('base','isolation',isolation,a,b,[0,-.19,side*.43],[.43,.95]);
  }

  for (const [index,center] of GATES.entries()) {
    const direction = index ? 1 : -1;
    const cap = [[center-27,82],[center+27,82],[center+27,103],[center+19,110],
      [center+8,112],[center-8,112],[center-19,110],[center-27,103]];
    const upper = [[center-25,106],[center-18,112],[center+18,112],[center+25,106],
      [center+25,163],[center-25,163]];
    const up = [direction*.22,1.96,-.48];
    xz('gate-upper','cap',cap,-DEPTH,DEPTH,[direction*.30,3.02,-.56],[.13,.80]);
    xz('gate-upper','metal',upper,-DEPTH,DEPTH,up,[.20,.84]);

    for (const side of [-1,1]) {
      const edge = center+side*27;
      xz('gate-upper','spacer',[[edge-2.8,82],[edge+2.8,82],[edge+2.8,168],[edge-2.8,168]],
        -DEPTH,DEPTH,[direction*.22+side*.39,1.76,-.53],[.14,.81]);
    }

    for (const [row,level] of ROWS.entries()) {
      const top = [215,187.5,163][row], bottom = [253,215,187.5][row];
      const lower = [[top,-DEPTH],[top,DEPTH],[bottom,DEPTH],[bottom,-DEPTH]];
      if (row===0) lower.splice(3,0,[bottom,20],[248,20],[248,-20],[bottom,-20]);
      const channel = profile(level,16.8,5.45,1.1);
      const inner = profile(level,18.6,6.95,1.65);
      const outer = profile(level,21,8.65,2.15);
      const metalMotion = [direction*.19,.11+row*.70,-.33-row*.18];
      const channelMotion = [direction*.63,.36+row*.72,1.92+row*.33];
      const outerMotion = [direction*.34,.24+row*.70,.80+row*.32];
      const begin = [.27-row*.045,.94-row*.045];
      yz('gate-lower','metal',lower,[outer],center-25.2,center+25.2,metalMotion,begin);
      yz('gate-lower','liner',outer,[inner],center-23.5,center+23.5,outerMotion,begin,{mode:'gate-dielectrics'});
      yz('gate-lower','dielectric',inner,[channel],center-22.3,center+22.3,outerMotion,begin,{mode:'gate-dielectrics'});
      if (row===0) {
        xz('gate-lower','dielectric',[[center-25,245],[center+25,245],[center+25,248],[center-25,248]],
          -18.5,18.5,metalMotion,begin);
      }
      yz('channel','siliconCore',channel,[],center-21,center+21,channelMotion,begin);

      // Dielectric is independently selectable when the clause calls it out.
      yz('dielectric','liner',outer,[inner],center-23.65,center+23.65,outerMotion,begin,{mode:'dielectric'});
      yz('dielectric','dielectric',inner,[channel],center-22.45,center+22.45,outerMotion,begin,{mode:'dielectric'});
      for (const side of [-1,1]) {
        const end = center+side*21;
        yz('contact-face','surface',profile(level,16.65,5.35,1.1),[],end-.38,end+.38,
          channelMotion,begin,{mode:'channel-face'});
        const spacerCenter = center+side*23.2;
        const wedge = [[spacerCenter-2.3,level+5.5],[spacerCenter+2.3,level+5.5],
          [spacerCenter+2.8,level+11],[spacerCenter-2.7,level+14]];
        xz('spacer','innerSpacer',wedge,-19.8,19.8,
          [outerMotion[0]+side*.35,outerMotion[1],outerMotion[2]+.46],begin,{mode:'spacer'});
      }
    }

    const topLiner = [[center-25.5,162],[center+25.5,162],[center+25.5,165],[center-25.5,165]];
    xz('dielectric','liner',topLiner,-DEPTH,DEPTH,up,[.20,.84],{mode:'dielectric'});
  }

  for (const [index,center] of JUNCTIONS.entries()) {
    const side = index-1;
    const sourceMove = [side*1.46,.26,index===1 ? 1.31 : .42];
    const contactMove = [side*1.39,2.28,index===1 ? 1.37 : .18];
    const sdWindow = [.26,.86], plugWindow = [.04,.52];
    for (const flat of [false,true]) {
      spatialMesh(viewer,'drain','epi',epi(center,flat),sourceMove,sdWindow,
        {mode:flat ? 'drain-flat' : 'drain-rounded',twoSided:true});
    }
    spatialMesh(viewer,'plug','contact',plug(center),contactMove,plugWindow,{twoSided:true});
    spatialMesh(viewer,'plug','barrier',plug(center,true),contactMove,plugWindow,{twoSided:true});
    spatialMesh(viewer,'plug','silicide',loft([plugRing(center,182,16.7,16.1),plugRing(center,185,16.4,15.8)]),
      contactMove,plugWindow,{twoSided:true});

    const left = clipX(center-29),right = clipX(center+29);
    const wall = [[left,82],[right,82],[right,205],[right-4,227],[left+4,227],[left,205]];
    // The visible field dielectric is a cutaway; the missing portion exposes the buried structures.
    xz('ild','insulator',wall,-DEPTH,-28,[side*.33,1.31,-.79],[.17,.80],
      {alpha:.17,twoSided:true,mode:'dielectric-context'});
    xz('ild','insulator',wall,-DEPTH,-28,[side*.33,1.31,-.79],[.17,.80],
      {alpha:.51,twoSided:true,mode:'dielectric'});

    const leftFacet = clipX(center-13),rightFacet = clipX(center+13);
    xz('base-face','surface',[[leftFacet,263],[rightFacet,263],[rightFacet,265],[leftFacet,265]],
      -15,15,[0,.19,0],[.10,.54],{mode:'base-face'});
  }
}
