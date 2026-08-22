import { CLAW4_SCREEN_HEIGHT, CLAW4_SCREEN_WIDTH } from "./claw4-compat";

export type SimUiEvent = {
  object: number;
  id: string;
  type: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  time_ms: number;
  pointer: number;
};

export type SimDeviceOperation = {
  action: string;
  args: Record<string, unknown>;
};

type UiNode = {
  id: number;
  type: string;
  eventId: string;
  el: HTMLElement;
};

function cssColor(value: unknown, fallback = "#ffffff"): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
  }
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class DisplayHost {
  readonly root: HTMLDivElement;
  private readonly nodes = new Map<number, UiNode>();
  private readonly events: SimUiEvent[] = [];
  private nextId = 1;
  private screenEl: HTMLDivElement | null = null;
  private svgEl: SVGSVGElement | null = null;
  private flowY = 24;
  private lastTouch = { x: 0, y: 0, active: false };
  private pollWaiters: Array<(event: SimUiEvent | null) => void> = [];
  startedAt = performance.now();

  constructor(root: HTMLDivElement) {
    this.root = root;
    root.style.cssText = [
      "position:relative",
      `width:${CLAW4_SCREEN_WIDTH}px`,
      `height:${CLAW4_SCREEN_HEIGHT}px`,
      "overflow:hidden",
      "background:#101418",
      "color:#fff",
      "font-family:system-ui,sans-serif",
      "font-size:22px",
      "line-height:1.35",
      "user-select:none",
      "touch-action:none",
    ].join(";");
    root.replaceChildren();
  }

  nowMs(): number {
    return Math.floor(performance.now() - this.startedAt);
  }

  clear(): void {
    this.nodes.clear();
    this.events.length = 0;
    this.nextId = 1;
    this.screenEl = null;
    this.svgEl = null;
    this.flowY = 24;
    this.root.replaceChildren();
    this.root.style.background = "#101418";
  }

  emitEvent(partial: Omit<SimUiEvent, "time_ms" | "pointer" | "dx" | "dy"> & Partial<SimUiEvent>): void {
    const event: SimUiEvent = {
      dx: 0,
      dy: 0,
      pointer: 0,
      time_ms: this.nowMs(),
      ...partial,
    };
    if (this.pollWaiters.length) {
      const waiters = this.pollWaiters.splice(0);
      waiters.forEach((resolve) => resolve(event));
      return;
    }
    if (this.events.length >= 24) this.events.shift();
    this.events.push(event);
  }

  pollEvent(): SimUiEvent | null {
    return this.events.shift() ?? null;
  }

  cancelPolls(): void {
    const waiters = this.pollWaiters.splice(0);
    waiters.forEach((resolve) => resolve(null));
  }

  waitPoll(timeoutMs: number, cancelled: () => boolean): Promise<SimUiEvent | null> {
    const immediate = this.pollEvent();
    if (immediate || timeoutMs <= 0) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.pollWaiters = this.pollWaiters.filter((item) => item !== onEvent);
        resolve(cancelled() ? null : this.pollEvent());
      }, timeoutMs);
      const onEvent = (event: SimUiEvent | null) => {
        window.clearTimeout(timer);
        resolve(event);
      };
      this.pollWaiters.push(onEvent);
    });
  }

  screenSize(): { width: number; height: number } {
    return { width: CLAW4_SCREEN_WIDTH, height: CLAW4_SCREEN_HEIGHT };
  }

  screen(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    this.clear();
    this.root.style.background = cssColor(opts.background, "#101418");
    const screen = document.createElement("div");
    screen.style.cssText = "position:absolute;inset:0;";
    this.root.appendChild(screen);
    this.screenEl = screen;
    const id = this.add("screen", screen, "screen");
    this.bindPointer(screen, id, "screen");
    return id;
  }

  load(_id?: number): void {
    // Native surface is always visible.
  }

  label(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const { x, y, w, flow } = this.place(opts);
    const el = document.createElement("div");
    el.textContent = String(opts.text ?? "");
    el.style.cssText = [
      "position:absolute",
      `left:${x}px`,
      `top:${y}px`,
      w ? `width:${w}px` : "",
      "white-space:pre-wrap",
      "word-break:break-word",
      `color:${cssColor(opts.color)}`,
      "pointer-events:none",
    ]
      .filter(Boolean)
      .join(";");
    this.parent().appendChild(el);
    this.advance(el, y, flow);
    return this.add("label", el);
  }

  button(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const { x, y, w, flow } = this.place(opts);
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = String(opts.text ?? "Button");
    el.style.cssText = [
      "position:absolute",
      `left:${x}px`,
      `top:${y}px`,
      w ? `width:${w}px` : "padding:8px 16px",
      opts.height ? `height:${num(opts.height)}px` : "",
      `background:${cssColor(opts.color, "#2563eb")}`,
      `color:${cssColor(opts.text_color)}`,
      `border-radius:${num(opts.radius, 6)}px`,
      "border:0",
      "font:inherit",
      "cursor:pointer",
    ]
      .filter(Boolean)
      .join(";");
    const id = this.add("button", el, String(opts.event_id ?? "button"));
    this.parent().appendChild(el);
    this.bindPointer(el, id, String(opts.event_id ?? "button"));
    this.advance(el, y, flow);
    return id;
  }

  rect(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const { x, y, w, flow } = this.place(opts, 40);
    const el = document.createElement("div");
    el.style.cssText = [
      "position:absolute",
      `left:${x}px`,
      `top:${y}px`,
      `width:${w ?? 40}px`,
      `height:${num(opts.height, 40)}px`,
      `background:${cssColor(opts.color, "#30363d")}`,
      `border-radius:${num(opts.radius)}px`,
    ].join(";");
    const eventId = typeof opts.event_id === "string" ? opts.event_id : "";
    const id = this.add("rect", el, eventId);
    this.parent().appendChild(el);
    if (eventId) this.bindPointer(el, id, eventId);
    this.advance(el, y, flow);
    return id;
  }

  circle(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const radius = Math.max(1, num(opts.radius, 10));
    const { x, y, flow } = this.place(opts);
    const el = document.createElement("div");
    el.style.cssText = [
      "position:absolute",
      `left:${x}px`,
      `top:${y}px`,
      `width:${radius * 2}px`,
      `height:${radius * 2}px`,
      "border-radius:50%",
      `background:${cssColor(opts.color)}`,
      `opacity:${num(opts.opacity, 255) / 255}`,
    ].join(";");
    const eventId = typeof opts.event_id === "string" ? opts.event_id : "";
    const id = this.add("circle", el, eventId);
    this.parent().appendChild(el);
    if (eventId) this.bindPointer(el, id, eventId);
    this.advance(el, y, flow);
    return id;
  }

  line(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const points = Array.isArray(opts.points) ? opts.points : [];
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute(
      "points",
      points
        .map((point) => {
          const item = asRecord(point);
          return `${num(item.x)},${num(item.y)}`;
        })
        .join(" "),
    );
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", cssColor(opts.color));
    polyline.setAttribute("stroke-width", String(num(opts.width ?? opts.line_width, 1)));
    polyline.setAttribute("stroke-linecap", opts.rounded ? "round" : "butt");
    this.svg().appendChild(polyline);
    const eventId = typeof opts.event_id === "string" ? opts.event_id : "";
    return this.add("line", polyline as unknown as HTMLElement, eventId);
  }

  arc(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const { x, y } = this.place(opts);
    const width = num(opts.width, 72);
    const height = num(opts.height, 72);
    const cx = x + width / 2;
    const cy = y + height / 2;
    const rx = width / 2;
    const ry = height / 2;
    const start = num(opts.start_angle);
    const end = num(opts.end_angle, 360);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", this.arcPath(cx, cy, rx, ry, start, end));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", cssColor(opts.color, "#20c997"));
    path.setAttribute("stroke-width", String(num(opts.line_width, 6)));
    this.svg().appendChild(path);
    const eventId = typeof opts.event_id === "string" ? opts.event_id : "";
    const id = this.add("arc", path as unknown as HTMLElement, eventId);
    this.nodes.get(id)!.el.dataset.start = String(start);
    this.nodes.get(id)!.el.dataset.end = String(end);
    this.nodes.get(id)!.el.dataset.cx = String(cx);
    this.nodes.get(id)!.el.dataset.cy = String(cy);
    this.nodes.get(id)!.el.dataset.rx = String(rx);
    this.nodes.get(id)!.el.dataset.ry = String(ry);
    return id;
  }

  image(optsRaw: unknown): number {
    const opts = asRecord(optsRaw);
    const { x, y, flow } = this.place(opts);
    const el = document.createElement("div");
    el.style.cssText = [
      "position:absolute",
      `left:${x}px`,
      `top:${y}px`,
      "width:44px",
      "height:44px",
      "background:#30363d",
      `opacity:${num(opts.opacity, 255) / 255}`,
    ].join(";");
    const eventId = typeof opts.event_id === "string" ? opts.event_id : "";
    const id = this.add("image", el, eventId);
    this.parent().appendChild(el);
    if (eventId) this.bindPointer(el, id, eventId);
    this.advance(el, y, flow);
    return id;
  }

  setText(id: number, text: string): void {
    const node = this.nodes.get(id);
    if (!node || node.type !== "label") throw new Error("object is not a label");
    node.el.textContent = String(text ?? "");
  }

  update(id: number, optsRaw: unknown): void {
    const node = this.nodes.get(id);
    if (!node) throw new Error("invalid UI object");
    const opts = asRecord(optsRaw);
    if (opts.x !== undefined) node.el.style.left = `${num(opts.x)}px`;
    if (opts.y !== undefined) node.el.style.top = `${num(opts.y)}px`;
    if (opts.width !== undefined) node.el.style.width = `${num(opts.width)}px`;
    if (opts.height !== undefined) node.el.style.height = `${num(opts.height)}px`;
    if (opts.text !== undefined) node.el.textContent = String(opts.text);
    if (opts.color !== undefined) {
      if (node.type === "label" || node.type === "button") node.el.style.color = cssColor(opts.color);
      else if (node.type === "line" || node.type === "arc")
        node.el.setAttribute("stroke", cssColor(opts.color));
      else node.el.style.background = cssColor(opts.color);
    }
    if (opts.opacity !== undefined) node.el.style.opacity = String(num(opts.opacity) / 255);
    if (opts.hidden !== undefined) node.el.style.display = opts.hidden ? "none" : "";
    if (node.type === "arc" && (opts.start_angle !== undefined || opts.end_angle !== undefined)) {
      const start = num(opts.start_angle, Number(node.el.dataset.start || 0));
      const end = num(opts.end_angle, Number(node.el.dataset.end || 360));
      node.el.dataset.start = String(start);
      node.el.dataset.end = String(end);
      node.el.setAttribute(
        "d",
        this.arcPath(
          Number(node.el.dataset.cx),
          Number(node.el.dataset.cy),
          Number(node.el.dataset.rx),
          Number(node.el.dataset.ry),
          start,
          end,
        ),
      );
    }
  }

  delete(id: number): void {
    const node = this.nodes.get(id);
    if (!node) throw new Error("invalid UI object");
    if (node.type === "screen") throw new Error("the owned screen cannot be deleted");
    node.el.remove();
    this.nodes.delete(id);
  }

  private add(type: string, el: HTMLElement, eventId = ""): number {
    const id = this.nextId++;
    el.dataset.uiId = String(id);
    this.nodes.set(id, { id, type, eventId, el });
    return id;
  }

  private parent(): HTMLElement {
    if (!this.screenEl) throw new Error("ui.screen() must be called first");
    return this.screenEl;
  }

  private svg(): SVGSVGElement {
    if (!this.svgEl) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", String(CLAW4_SCREEN_WIDTH));
      svg.setAttribute("height", String(CLAW4_SCREEN_HEIGHT));
      svg.style.cssText = "position:absolute;inset:0;pointer-events:none;";
      this.parent().appendChild(svg);
      this.svgEl = svg;
    }
    return this.svgEl;
  }

  private place(
    opts: Record<string, unknown>,
    defaultWidth?: number,
  ): { x: number; y: number; w?: number; flow: boolean } {
    if (opts.x == null && opts.y == null) {
      return {
        x: 24,
        y: this.flowY,
        w: num(opts.width, defaultWidth ?? CLAW4_SCREEN_WIDTH - 48),
        flow: true,
      };
    }
    return {
      x: num(opts.x),
      y: num(opts.y),
      w: opts.width == null ? defaultWidth : num(opts.width),
      flow: false,
    };
  }

  private advance(el: HTMLElement, y: number, flow: boolean): void {
    if (!flow) return;
    const height = el.offsetHeight || 28;
    this.flowY = Math.max(this.flowY, y + height + 16);
  }

  private bindPointer(el: HTMLElement, objectId: number, eventId: string): void {
    const point = (event: PointerEvent) => {
      const rect = this.root.getBoundingClientRect();
      return {
        x: Math.round(((event.clientX - rect.left) * CLAW4_SCREEN_WIDTH) / Math.max(1, rect.width)),
        y: Math.round(((event.clientY - rect.top) * CLAW4_SCREEN_HEIGHT) / Math.max(1, rect.height)),
      };
    };
    el.addEventListener("pointerdown", (event) => {
      const { x, y } = point(event);
      this.lastTouch = { x, y, active: true };
      this.emitEvent({ object: objectId, id: eventId, type: "pressed", x, y });
      el.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    el.addEventListener("pointermove", (event) => {
      if (!this.lastTouch.active && event.buttons === 0) return;
      const { x, y } = point(event);
      const dx = x - this.lastTouch.x;
      const dy = y - this.lastTouch.y;
      if (dx === 0 && dy === 0) return;
      this.lastTouch = { x, y, active: true };
      this.emitEvent({ object: objectId, id: eventId, type: "moved", x, y, dx, dy });
    });
    const end = (event: PointerEvent, type: string) => {
      const { x, y } = point(event);
      this.lastTouch.active = false;
      this.emitEvent({ object: objectId, id: eventId, type, x, y });
    };
    el.addEventListener("pointerup", (event) => {
      end(event, "released");
      this.emitEvent({
        object: objectId,
        id: eventId,
        type: "clicked",
        ...point(event),
      });
    });
    el.addEventListener("pointercancel", (event) => end(event, "lost"));
  }

  private arcPath(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    startDeg: number,
    endDeg: number,
  ): string {
    const start = ((startDeg - 90) * Math.PI) / 180;
    const end = ((endDeg - 90) * Math.PI) / 180;
    const x1 = cx + rx * Math.cos(start);
    const y1 = cy + ry * Math.sin(start);
    const x2 = cx + rx * Math.cos(end);
    const y2 = cy + ry * Math.sin(end);
    const large = Math.abs(endDeg - startDeg) % 360 > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${rx} ${ry} 0 ${large} 1 ${x2} ${y2}`;
  }
}
