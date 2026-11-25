import { BufferGeometry, Float32BufferAttribute, Path, Shape, ShapeGeometry } from 'three';

function pathFrom(path,points) {
  path.moveTo(points[0][0],points[0][1]);
  for (const [x,y] of points.slice(1)) path.lineTo(x,y);
  path.closePath();
  return path;
}

function contains([x,y],polygon) {
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const [a,b] = polygon[i], [c,d] = polygon[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) inside = !inside;
  }
  return inside;
}

function triangles(geometry,callback) {
  const position = geometry.attributes.position;
  const indices = geometry.index;
  const count = indices ? indices.count : position.count;
  for (let offset=0;offset<count;offset+=3) {
    callback([0,1,2].map(step=>{
      const i = indices ? indices.getX(offset+step) : offset+step;
      return [position.getX(i),position.getY(i),position.getZ(i)];
    }));
  }
}

function closeContours(points,edges) {
  const contours = [];
  const consume = (a,b)=>{
    edges.get(a)?.delete(b);
    edges.get(b)?.delete(a);
  };
  for (const [start,neighbors] of edges) {
    for (const next of neighbors) {
      const contour = [points.get(start)];
      let cursor = next;
      consume(start,cursor);
      while (cursor!==start && edges.get(cursor)?.size) {
        contour.push(points.get(cursor));
        const following = edges.get(cursor).values().next().value;
        consume(cursor,following);
        cursor = following;
      }
      if (cursor===start && contour.length>=3) contours.push(contour);
    }
  }
  return contours;
}

export function makeSection(geometry,limit,{includeBody = false} = {}) {
  const points = new Map(), edges = new Map(), body = [];
  const keyOf = ([x,y])=>`${Math.round(x*1e6)},${Math.round(y*1e6)}`;
  function connect(a,b) {
    const aKey = keyOf(a), bKey = keyOf(b);
    if (aKey===bKey) return;
    if (!edges.has(aKey)) edges.set(aKey,new Set());
    if (!edges.has(bKey)) edges.set(bKey,new Set());
    edges.get(aKey).add(bKey);
    edges.get(bKey).add(aKey);
    points.set(aKey,a);
    points.set(bKey,b);
  }

  triangles(geometry,triangle=>{
    const polygon = [], crossings = [];
    for (let index=0;index<3;index++) {
      const a = triangle[index],b = triangle[(index+1)%3];
      const inside = a[2]<=limit, nextInside = b[2]<=limit;
      if (inside) polygon.push(a);
      if (inside!==nextInside) {
        const t = (limit-a[2])/(b[2]-a[2]);
        const cut = [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,limit];
        polygon.push(cut);
        crossings.push(cut);
      }
    }
    if (crossings.length===2) connect(...crossings);
    if (includeBody) for (let i=1;i<polygon.length-1;i++) body.push(...polygon[0],...polygon[i],...polygon[i+1]);
  });

  const contours = closeContours(points,edges);
  const depth = contours.map((contour,index)=>
    contours.filter((candidate,i)=>index!==i && contains(contour[0],candidate)).length
  );
  const shapes = contours.flatMap((contour,index)=>{
    if (depth[index]%2) return [];
    const shape = pathFrom(new Shape(),contour);
    shape.holes = contours.flatMap((hole,i)=>
      depth[i]===depth[index]+1 && contains(hole[0],contour) ? [pathFrom(new Path(),hole)] : []
    );
    return [shape];
  });
  const cap = shapes.length ? new ShapeGeometry(shapes) : null;
  if (cap) cap.translate(0,0,limit+.0007);

  const clipped = includeBody ? new BufferGeometry() : null;
  if (clipped) clipped.setAttribute('position',new Float32BufferAttribute(body,3));
  return {cap,clipped};
}
