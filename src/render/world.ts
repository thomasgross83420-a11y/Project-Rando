import Phaser from 'phaser';
import {
  clientPoint,
  fit as fitWorld,
  pan,
  project,
  unproject,
  zoomAt,
  type Camera,
  type Point,
} from './projection';
export class WorldView {
  readonly camera: Camera = { x: 30, y: 30, zoom: 1, view: 0, width: 412, height: 400 };
  game: Phaser.Game;
  graphics: Phaser.GameObjects.Graphics | undefined;
  ready = false;
  selected: Point = { x: 30, y: 30 };
  constructor(
    readonly parent: HTMLElement,
    readonly status: (message: string) => void,
  ) {
    const owner = this;
    class Scene extends Phaser.Scene {
      create(): void {
        owner.graphics = this.add.graphics();
        owner.ready = true;
        owner.resize();
        owner.draw();
      }
    }
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: parent.clientWidth,
      height: parent.clientHeight,
      backgroundColor: '#111923',
      pixelArt: true,
      antialias: false,
      banner: false,
      audio: { noAudio: true },
      fps: { target: 30 },
      scene: Scene,
    });
    new ResizeObserver(() => this.resize()).observe(parent);
    this.game.canvas.setAttribute(
      'aria-label',
      'Fortress world. Use coordinate fields and camera controls below.',
    );
    this.game.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.status('Renderer paused. Restoring world…');
    });
    this.game.canvas.addEventListener('webglcontextrestored', () => {
      this.draw();
      this.status('Renderer restored. Camera and saved state preserved.');
    });
    this.bindInput();
  }
  resize(): void {
    this.camera.width = this.parent.clientWidth;
    this.camera.height = this.parent.clientHeight;
    if (!this.ready) return;
    this.game.scale.resize(this.camera.width, this.camera.height);
    this.draw();
  }
  point(event: PointerEvent): Point {
    return clientPoint(
      { x: event.clientX, y: event.clientY },
      this.game.canvas.getBoundingClientRect(),
      this.camera,
    );
  }
  bindInput(): void {
    const canvas = this.game.canvas;
    const pointers = new Map<number, Point>();
    let start: Point | undefined;
    let moved = false;
    let oldPinch = 0;
    canvas.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, this.point(e));
      canvas.setPointerCapture(e.pointerId);
      start = this.point(e);
      moved = false;
      oldPinch = 0;
    });
    canvas.addEventListener('pointermove', (e) => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const current = this.point(e);
      pointers.set(e.pointerId, current);
      const list = Array.from(pointers.values());
      if (list.length === 2) {
        moved = true;
        const a = list[0],
          b = list[1];
        if (!a || !b) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (oldPinch)
          zoomAt(this.camera, (this.camera.zoom * distance) / oldPinch, {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          });
        oldPinch = distance;
      } else if (list.length === 1 && start) {
        if (Math.hypot(current.x - start.x, current.y - start.y) > 8) moved = true;
        if (moved) pan(this.camera, current.x - previous.x, current.y - previous.y);
      }
      this.draw();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!moved && pointers.size === 1) {
        this.selected = unproject(this.point(e), this.camera);
        this.status(`Cell ${Math.floor(this.selected.x)}, ${Math.floor(this.selected.y)}`);
      }
      pointers.delete(e.pointerId);
      start = undefined;
      oldPinch = 0;
      this.draw();
    });
    canvas.addEventListener('pointercancel', (e) => {
      pointers.delete(e.pointerId);
      start = undefined;
      oldPinch = 0;
      moved = true;
      this.status('Gesture cancelled. No purchase.');
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        zoomAt(
          this.camera,
          this.camera.zoom * (e.deltaY < 0 ? 1.1 : 0.9),
          clientPoint({ x: e.clientX, y: e.clientY }, canvas.getBoundingClientRect(), this.camera),
        );
        this.draw();
      },
      { passive: false },
    );
  }
  command(command: string): void {
    if (command === 'fit') fitWorld(this.camera);
    if (command === 'recenter') {
      this.camera.x = 30;
      this.camera.y = 30;
    }
    if (command === 'rotate') this.camera.view = ((this.camera.view + 1) % 4) as Camera['view'];
    if (command === 'in' || command === 'out')
      zoomAt(this.camera, this.camera.zoom * (command === 'in' ? 1.25 : 0.8), {
        x: this.camera.width / 2,
        y: this.camera.height / 2,
      });
    if (command === 'left') pan(this.camera, 48, 0);
    if (command === 'right') pan(this.camera, -48, 0);
    if (command === 'up') pan(this.camera, 0, 48);
    if (command === 'down') pan(this.camera, 0, -48);
    this.draw();
  }
  draw(): void {
    const g = this.graphics;
    if (!g) return;
    g.clear();
    g.lineStyle(1, 0x46505b, 1);
    for (let i = 0; i <= 60; i++) {
      for (const [a, b] of [
        [
          { x: i, y: 0 },
          { x: i, y: 60 },
        ],
        [
          { x: 0, y: i },
          { x: 60, y: i },
        ],
      ] as [Point, Point][]) {
        const p = project(a, this.camera),
          q = project(b, this.camera);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    }
    const p = project(this.selected, this.camera);
    g.fillStyle(0x58d7c3);
    g.fillCircle(p.x, p.y, 6);
  }
}
