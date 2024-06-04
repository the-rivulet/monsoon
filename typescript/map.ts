import type { Creature } from "./creature.js";
import type { Item } from "./item.js";
import { CORE, Coordinates, canvas, ctx, hoverPos, nextUUID, scrX, scrY, tileSize } from "./globals/core.js";

export function toScreen(i: Coordinates): Coordinates { return {
  x: Math.round(0.5 * canvas.width - scrX + i.x * tileSize - renderedPosition.x),
  y: Math.round(0.5 * canvas.height - scrY + i.y * tileSize - renderedPosition.y)
}};
class Endpoint {
  beginsSegment?: boolean;
  segment?: Segment;
  angle?: number;
  c: Coordinates;
  constructor(c: Coordinates) {
    this.c = c;
  }
}
class Segment {
  p1: Endpoint;
  p2: Endpoint;
  d = 0;
  constructor(c1: Coordinates, c2: Coordinates) {
    this.p1 = new Endpoint(c1);
    this.p2 = new Endpoint(c2);
    this.p1.segment = this;
    this.p2.segment = this;
  }
}

let leftOf = (s: Segment, p: Coordinates) => (s.p2.c.x - s.p1.c.x) * (p.y - s.p1.c.y) - (s.p2.c.y - s.p1.c.y) * (p.x - s.p1.c.x) < 0;
let interpolate = (a: Coordinates, b: Coordinates, f: number): Coordinates => ({x: a.x * (1-f) + b.x * f, y: a.y * (1-f) + b.y * f});
function segmentInFrontOf (segmentA: Segment, segmentB: Segment, relativePoint: Coordinates) {
  let a1 = leftOf(segmentA, interpolate(segmentB.p1.c, segmentB.p2.c, 0.01));
  let a2 = leftOf(segmentA, interpolate(segmentB.p2.c, segmentB.p1.c, 0.01));
  let a3 = leftOf(segmentA, relativePoint);
  let b1 = leftOf(segmentB, interpolate(segmentA.p1.c, segmentA.p2.c, 0.01));
  let b2 = leftOf(segmentB, interpolate(segmentA.p2.c, segmentA.p1.c, 0.01));
  let b3 = leftOf(segmentB, relativePoint);
  if (b1 === b2 && b2 !== b3) {
    return true;
  }
  if (a1 === a2 && a2 === a3) {
    return true;
  }
  if (a1 === a2 && a2 !== a3) {
    return false;
  }
  if (b1 === b2 && b2 === b3) {
    return false;
  }

  return false;
};
function lineIntersection(point1: Coordinates, point2: Coordinates, point3: Coordinates, point4: Coordinates) {
  let s = (
    (point4.x - point3.x) * (point1.y - point3.y) -
    (point4.y - point3.y) * (point1.x - point3.x)
  ) / (
    (point4.y - point3.y) * (point2.x - point1.x) -
    (point4.x - point3.x) * (point2.y - point1.y)
  );

  return {x: point1.x + s * (point2.x - point1.x), y: point1.y + s * (point2.y - point1.y)};
}

export class Position implements Coordinates {
  x: number;
  y: number;
  region: Region;
  constructor(x: number, y: number, r: Region) {
    this.x = x;
    this.y = y;
    this.region = r;
  }
  get copy() { return new Position(this.x, this.y, this.region); }
  get center() { return new Position(this.x + 0.5, this.y + 0.5, this.region); }
  /** Take the floor of the X and Y positions. */
  get fix() { return new Position(Math.floor(this.x), Math.floor(this.y), this.region); }
  plus(x: number, y: number) { return new Position(this.x + x, this.y + y, this.region); }
  is(other: Position) { return this.x == other.x && this.y == other.y && this.region == other.region; }
  dist(other: Position) { return this.region == other.region ? Math.abs(this.x - other.x) + Math.abs(this.y - other.y) : Infinity; }
  near(other: Position) { return Math.abs(this.x - other.x) <= 1 && Math.abs(this.y - other.y) <= 1; }
  canSee(other: Position, center = true) {
    if(other.region != this.region) return false;
    let p = center ? this.center : this.copy;
    other = center ? other.center : other;
    let x = p.x, y = p.y, dx = other.x - p.x, dy = other.y - p.y;
    dx /= 100; dy /= 100;
    for(let i = 0; i < 100; i++) {
      x += dx; y += dy;
      if(this.region.tileAt(x, y) && this.region.tileAt(x, y).solidity == Solidity.solid) return false;
    }
    return true;
  }
  toString() {
    return `(${this.x}, ${this.y}) in ${this.region}`;
  }
}

/** Something that has a place in the world, and can be removed from it. */
export interface Positioned {
  pos: Position;
  destroy: () => void;
}
export interface Renderable extends Positioned {
  render(x: number, y: number, tileSize: number): void;
}

export enum Solidity { solid, background, air }

/** A position in the world. */
export abstract class Tile implements Renderable {
  /** Should be unique to this type of tile and in the form author.mod.tile. */
  abstract id: string;
  uuid: number;
  pos: Position;
  /** How solid this tile is, which determines whether creatures can move through it. */
  abstract solidity: Solidity;
  constructor(x: number, y: number, r: Region) {
    this.pos = new Position(x, y, r);
    if(!r.tiles.includes(this)) r.tiles.push(this);
    this.uuid = nextUUID();
  }
  destroy() {
    this.pos.region.tiles.splice(this.pos.region.tiles.indexOf(this), 1);
  }
  abstract render(x: number, y: number): void;
}

export function walkable(pos: Position) { return pos.region.tileAt(pos.x, pos.y) && pos.region.tileAt(pos.x, pos.y).solidity != Solidity.solid && !pos.region.creatureAt(pos.x, pos.y) }

/** A 2D grid of tiles. */
export class Region {
  tiles: Tile[] = [];
  creatures: Creature[] = [];
  items: Item[] = [];
  /** Get the tile at a particular position. */
  tileAt(x: number, y: number) {
    return this.tiles.find(tile => tile.pos.x == Math.floor(x) && tile.pos.y == Math.floor(y));
  }
  /** Get the creature at a particular position. */
  creatureAt(x: number, y: number) {
    return this.creatures.find(creature => creature.pos.x == Math.floor(x) && creature.pos.y == Math.floor(y));
  }
  /** Get the item at a particular position. */
  itemAt(x: number, y: number) {
    return this.items.find(item => item.pos.x == Math.floor(x) && item.pos.y == Math.floor(y));
  }
  /** Get the bounding box of the region. Returns [x1y1, x2y2]. */
  get boundingBox(): Coordinates[] {
    let x = this.tiles.sort((a, b) => a.pos.x - b.pos.x);
    let y = this.tiles.sort((a, b) => a.pos.y - b.pos.y);
    let x1 = x[0], x2 = x[x.length - 1], y1 = y[0], y2 = y[y.length - 1];
    return [{x: x1.pos.x, y: y1.pos.y}, {x: x2.pos.x + 1, y: y2.pos.y + 1}];
  }
  lighting(origin: Coordinates) {
    let segments: Segment[] = [];
    // push the bounding box stuff
    let b = this.boundingBox;
    let corners = [b[0], {x: b[1].x, y: b[0].y}, b[1], {x: b[0].x, y: b[1].y}];
    for(let corner = 0; corner < corners.length; corner++) {
      let next = (corner + 1 == corners.length ? 0 : corner + 1);
      let c1 = corners[corner], c2 = corners[next];
      segments.push(new Segment(c1, c2));
    }
    for(let i of this.tiles.filter(x => x.solidity == Solidity.solid)) {
      // push the four corners of the tile
      let corners = [[0,0], [1,0], [1,1], [0,1]];
      for(let corner = 0; corner < corners.length; corner++) {
        let next = (corner + 1 == corners.length ? 0 : corner + 1);
        let c1 = corners[corner], c2 = corners[next];
        segments.push(new Segment({x: i.pos.x + c1[0], y: i.pos.y + c1[1]}, {x: i.pos.x + c2[0], y: i.pos.y + c2[1]}));
      }
    }
    for(let segment of segments) {
      let dx = 0.5 * (segment.p1.c.x + segment.p2.c.x) - origin.x;
      let dy = 0.5 * (segment.p1.c.y + segment.p2.c.y) - origin.y;
      segment.d = (dx * dx) + (dy * dy);
      segment.p1.angle = Math.atan2(segment.p1.c.y - origin.y, segment.p1.c.x - origin.x);
      segment.p2.angle = Math.atan2(segment.p2.c.y - origin.y, segment.p2.c.x - origin.x);
      let dAngle = segment.p2.angle - segment.p1.angle;
      if (dAngle <= -Math.PI) dAngle += 2 * Math.PI;
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
      segment.p1.beginsSegment = dAngle > 0;
      segment.p2.beginsSegment = !segment.p1.beginsSegment;
    }
    let endpoints = segments.map(x => [x.p1, x.p2]).flat();
    endpoints.sort((pointA, pointB) => {
      if (pointA.angle > pointB.angle) return 1;
      if (pointA.angle < pointB.angle) return -1;
      if (!pointA.beginsSegment && pointB.beginsSegment) return 1;
      if (pointA.beginsSegment && !pointB.beginsSegment) return -1;
      return 0;
    });
    let os: Segment[] = [];
    let output: Coordinates[][] = [];
    let beginAngle = 0;
    for(let pass = 0; pass < 2; pass++) {
      for(let endpoint of endpoints) {
        let s = os[0];
        if (endpoint.beginsSegment) {
          let index = 0;
          let segment = os[index];
          while (segment && segmentInFrontOf(endpoint.segment, segment, origin)) {
            index += 1;
            segment = os[index];
          }
          if(!segment) os.push(endpoint.segment);
          else os.splice(index, 0, endpoint.segment);
        } else {
          let index = os.indexOf(endpoint.segment);
          if (index > -1) { os.splice(index, 1); }
        }
        if(s != os[0]) {
          if(pass == 1) {
            let p1 = origin;
            let p2 = {x: origin.x + Math.cos(beginAngle), y: origin.y + Math.sin(beginAngle)};
            let p3 = {x: 0, y: 0};
            let p4 = {x: 0, y: 0};
            if(s) {
              p3.x = s.p1.c.x;
              p3.y = s.p1.c.y;
              p4.x = s.p2.c.x;
              p4.y = s.p2.c.y;
            } else {
              p3.x = origin.x + Math.cos(beginAngle) * 200;
              p3.y = origin.y + Math.sin(beginAngle) * 200;
              p4.x = origin.x + Math.cos(endpoint.angle) * 200;
              p4.y = origin.y + Math.sin(endpoint.angle) * 200;
            }
            let pBegin = lineIntersection(p3, p4, p1, p2);
            p2.x = origin.x + Math.cos(endpoint.angle);
            p2.y = origin.y + Math.sin(endpoint.angle);
            let pEnd = lineIntersection(p3, p4, p1, p2);
            output.push([pBegin, pEnd]);
          }
          beginAngle = endpoint.angle;
        }
      }
    }
    // now the actual render
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "white";
    ctx.fillStyle = "white";
    for (let points of output) {
      ctx.beginPath();
      let camPos = toScreen(origin);
      ctx.moveTo(camPos.x, camPos.y);
      points = points.map(x => toScreen(x));
      ctx.lineTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.closePath();
      ctx.fill();
      //ctx.stroke();
    }
    ctx.restore();
  }
  /** Update the region's visuals. */
  render(camX: number, camY: number) { try {
    renderedPosition = new Position(camX, camY, this);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for(let i of [...this.tiles, ...this.creatures, ...this.items.filter(x => !x.slot)]) {
      let t = toScreen(i.pos);
      i.render(t.x, t.y, tileSize);
    }
    this.lighting(renderedPosition.center);
  } catch(e) { alert("ERROR::RENDER::'" + e + "'"); } }
}

let outskirts = new Region();
export let world = {
  outskirts: outskirts
}
export let renderedPosition = new Position(0, 0, outskirts);
export function hoveredItem() {
  return renderedPosition.region.items.find(i => hoverPos().x == i.pos.x && hoverPos().y == i.pos.y);
}
export function hoveredCreature() {
  return renderedPosition.region.creatures.find(i => hoverPos().x == i.pos.x && hoverPos().y == i.pos.y);
}
export function hoveredTile() {
  return renderedPosition.region.tiles.find(i => hoverPos().x == i.pos.x && hoverPos().y == i.pos.y);
}

export class GroundTile extends Tile {
  id = `${CORE}.ground`;
  solidity = Solidity.solid;
  render(x: number, y: number) {
    ctx.fillStyle = "darkgray";
    ctx.fillRect(x, y, tileSize, tileSize);
  }
}
export class AirTile extends Tile {
  id = `${CORE}.air`;
  solidity = Solidity.air;
  render(x: number, y: number) {
    ctx.fillStyle = "gray";
    ctx.fillRect(x, y, tileSize, tileSize);
  }
}

for(let i = -10; i <= 10; i++) new GroundTile(i, 1, outskirts);
new GroundTile(5, -3, outskirts);

for(let i = -10; i <= 10; i++) {
  for(let j = 5; j >= -10; j--) {
    if(!outskirts.tileAt(i, j)) new AirTile(i, j, outskirts);
  }
}