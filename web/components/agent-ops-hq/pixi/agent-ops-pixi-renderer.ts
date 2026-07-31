import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type FederatedPointerEvent,
} from "pixi.js"
import type {
  AgentOpsAgentState,
  AgentOpsEditableAnchorGroup,
  AgentOpsLayoutEditorState,
  AgentOpsLayoutPathPatch,
  AgentOpsLayoutRoomPatch,
  AgentOpsPathEdge,
  AgentOpsPathTag,
  AgentOpsPathWaypoint,
  AgentOpsPoint,
  AgentOpsRect,
  AgentOpsRenderSnapshot,
  AgentOpsRoom,
  AgentOpsRoomStatus,
} from "../domain/estate-types"
import {
  getAgentOpsAgentSprite,
  type AgentOpsAgentSpriteAsset,
  type AgentOpsSpriteAnimationKey,
} from "../domain/agent-sprite-manifest"
import { getAgentOpsFloorAsset } from "../domain/asset-manifest"
import { getRoomLabelPosition } from "../domain/layout-editor"
import { roomVariant } from "../domain/estate-types"

type RendererOptions = {
  onSelect?: (type: "agent" | "room", id: string) => void
  onRoomPatch?: (patch: AgentOpsLayoutRoomPatch) => void
  onPathPatch?: (patch: AgentOpsLayoutPathPatch) => void
  onPathSelect?: (item: AgentOpsLayoutEditorState["selectedPathItem"], connectFromId?: string | null) => void
  onPathAddPoint?: (point: AgentOpsPoint) => void
  onAnchorSelect?: (anchor: NonNullable<AgentOpsLayoutEditorState["selectedAnchor"]>) => void
  onMouseWorldChange?: (point: AgentOpsPoint | null) => void
  onViewportChange?: (viewport: { scale: number; pan: AgentOpsPoint }) => void
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w"

type EditDrag =
  | {
      kind: "room"
      roomId: string
      startWorld: AgentOpsPoint
      lastWorld: AgentOpsPoint
      startBounds: AgentOpsRect
    }
  | {
      kind: "resize"
      roomId: string
      handle: ResizeHandle
      startWorld: AgentOpsPoint
      startBounds: AgentOpsRect
    }
  | {
      kind: "anchor"
      roomId: string
      group: AgentOpsEditableAnchorGroup
      index: number
      startWorld: AgentOpsPoint
      startPosition: AgentOpsPoint
    }
  | {
      kind: "label"
      roomId: string
      startWorld: AgentOpsPoint
      startPosition: AgentOpsPoint
    }
  | {
      kind: "waypoint"
      floorId: string
      waypointId: string
      startWorld: AgentOpsPoint
      startPosition: AgentOpsPoint
    }

const THEME_COLORS: Record<string, number> = {
  executive: 0x8fa8d9,
  infrastructure: 0x508dd7,
  monitoring: 0x55c6c7,
  approval: 0xd7b95e,
  youtube: 0xff5468,
  studio: 0x9b8ad7,
  research: 0x64d78d,
  seo: 0x5fb9ff,
  affiliate: 0x7cd992,
  lab: 0x55c6c7,
  link: 0xd7b95e,
  creative: 0xc98bff,
  copy: 0xe7ddc5,
  growth: 0x64d78d,
  finance: 0xd7b95e,
  operations: 0x9aa6b2,
  social: 0x7dc9ff,
  archive: 0x9b8ad7,
  civic: 0xd7d7e2,
  expansion: 0x5e646a,
  support: 0x9aa6b2,
}

export class AgentOpsPixiRenderer {
  private app: Application | null = null
  private root = new Container()
  private backgroundLayer = new Container()
  private roomLayer = new Container()
  private lightingLayer = new Container()
  private screenLayer = new Container()
  private agentLayer = new Container()
  private effectsLayer = new Container()
  private debugLayer = new Container()
  private snapshot: AgentOpsRenderSnapshot | null = null
  private container: HTMLElement | null = null
  private mounted = false
  private scale = 1
  private minScale = 1
  private maxScale = 2.75
  private pan: AgentOpsPoint = { x: 0, y: 0 }
  private cameraInitialized = false
  private activeFloorId: string | null = null
  private dragging = false
  private editDrag: EditDrag | null = null
  private lastPointer: AgentOpsPoint | null = null
  private mouseWorld: AgentOpsPoint | null = null
  private floorTextures = new Map<string, Texture>()
  private loadingFloorTextures = new Set<string>()
  private agentTextures = new Map<string, Texture>()
  private loadingAgentTextures = new Set<string>()
  private failedAgentTextures = new Set<string>()
  private destroyed = false
  private editor: AgentOpsLayoutEditorState = {
    enabled: false,
    selectedRoomId: null,
    selectedAnchor: null,
    anchorVisibility: {
      workstations: true,
      screenAnchors: true,
      entryAnchors: true,
      idleAnchors: true,
      lightAnchors: true,
    },
    snapToGrid: false,
    roomOverlayAlpha: 0.72,
    showLabels: true,
    pathEditing: false,
    showPathNetwork: false,
    pathAddMode: false,
    selectedPathItem: null,
    pathConnectFromId: null,
    activePathTags: ["main", "idle"],
  }

  constructor(private readonly options: RendererOptions = {}) {}

  async mount(container: HTMLElement) {
    this.destroyed = false
    this.container = container
    const app = new Application()
    this.app = app
    await app.init({
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      resizeTo: container,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    })
    if (this.destroyed || this.app !== app || this.container !== container) {
      app.destroy(true)
      return
    }
    this.mounted = true
    container.appendChild(app.canvas)
    this.root.addChild(
      this.backgroundLayer,
      this.roomLayer,
      this.lightingLayer,
      this.screenLayer,
      this.agentLayer,
      this.effectsLayer,
      this.debugLayer
    )
    app.stage.addChild(this.root)
    app.stage.eventMode = "static"
    app.stage.hitArea = app.screen
    app.stage.on("pointerdown", this.handlePointerDown)
    app.stage.on("pointermove", this.handlePointerMove)
    app.stage.on("pointerup", this.handlePointerUp)
    app.stage.on("pointerupoutside", this.handlePointerUp)
    container.addEventListener("wheel", this.handleWheel, { passive: false })
    this.applyTransform()
  }

  update(snapshot: AgentOpsRenderSnapshot) {
    const floorChanged = this.activeFloorId !== snapshot.activeFloorId
    this.snapshot = snapshot
    this.activeFloorId = snapshot.activeFloorId
    if (!this.isReady()) return
    this.recalculateCamera(floorChanged || !this.cameraInitialized)
    this.ensureFloorBackgroundLoaded(snapshot)
    this.ensureAgentSpritesLoaded(snapshot)
    this.render()
  }

  updateEditor(editor: AgentOpsLayoutEditorState) {
    this.editor = editor
    if (this.isReady()) this.render()
  }

  resize() {
    if (!this.isReady()) return
    const viewportCenter = this.screenToWorld({
      x: (this.app?.screen?.width ?? 0) / 2,
      y: (this.app?.screen?.height ?? 0) / 2,
    })
    this.app?.renderer.resize(
      this.container?.clientWidth ?? 1,
      this.container?.clientHeight ?? 1
    )
    if (this.app) {
      this.app.stage.hitArea = this.app.screen
    }
    this.recalculateCamera(!this.cameraInitialized, viewportCenter)
  }

  destroy() {
    this.destroyed = true
    this.container?.removeEventListener("wheel", this.handleWheel)
    this.app?.stage?.off("pointerdown", this.handlePointerDown)
    this.app?.stage?.off("pointermove", this.handlePointerMove)
    this.app?.stage?.off("pointerup", this.handlePointerUp)
    this.app?.stage?.off("pointerupoutside", this.handlePointerUp)
    this.options.onMouseWorldChange?.(null)
    this.clearLayers()
    if (this.mounted) {
      this.app?.destroy(true)
    }
    this.app = null
    this.container = null
    this.mounted = false
  }

  jumpTo(point: AgentOpsPoint) {
    if (!this.isReady()) return
    this.pan = {
      x: (this.app?.screen?.width ?? 0) / 2 - point.x * this.scale,
      y: (this.app?.screen?.height ?? 0) / 2 - point.y * this.scale,
    }
    this.clampPan()
    this.applyTransform()
  }

  private recalculateCamera(forceFit: boolean, preferredWorldCenter?: AgentOpsPoint | null) {
    if (!this.app || !this.snapshot) return
    const bounds = this.getActiveFloorBounds()
    const viewport = this.getViewportSize()
    const coverScale = Math.max(
      viewport.width / bounds.width,
      viewport.height / bounds.height
    )
    this.minScale = coverScale
    this.maxScale = coverScale * 2.75

    if (forceFit) {
      this.scale = coverScale
      this.centerFloor(bounds)
      this.cameraInitialized = true
      this.applyTransform()
      return
    }

    const worldCenter = preferredWorldCenter ?? this.screenToWorld({
      x: viewport.width / 2,
      y: viewport.height / 2,
    })
    this.scale = clamp(this.scale, this.minScale, this.maxScale)
    this.pan = {
      x: viewport.width / 2 - worldCenter.x * this.scale,
      y: viewport.height / 2 - worldCenter.y * this.scale,
    }
    this.clampPan()
    this.cameraInitialized = true
    this.applyTransform()
  }

  private centerFloor(bounds: AgentOpsRect) {
    if (!this.app) return
    const viewport = this.getViewportSize()
    this.pan = {
      x: viewport.width / 2 - (bounds.x + bounds.width / 2) * this.scale,
      y: viewport.height / 2 - (bounds.y + bounds.height / 2) * this.scale,
    }
    this.clampPan(bounds)
  }

  private clampPan(bounds = this.getActiveFloorBounds()) {
    if (!this.app) return
    const viewport = this.getViewportSize()
    const scaledWidth = bounds.width * this.scale
    const scaledHeight = bounds.height * this.scale
    const left = bounds.x * this.scale
    const right = (bounds.x + bounds.width) * this.scale
    const top = bounds.y * this.scale
    const bottom = (bounds.y + bounds.height) * this.scale

    if (scaledWidth <= viewport.width) {
      this.pan.x = viewport.width / 2 - (bounds.x + bounds.width / 2) * this.scale
    } else {
      this.pan.x = clamp(this.pan.x, viewport.width - right, -left)
    }

    if (scaledHeight <= viewport.height) {
      this.pan.y = viewport.height / 2 - (bounds.y + bounds.height / 2) * this.scale
    } else {
      this.pan.y = clamp(this.pan.y, viewport.height - bottom, -top)
    }
  }

  private getActiveFloorBounds(): AgentOpsRect {
    const floor = this.snapshot?.layout.buildings
      .flatMap((building) => building.floors)
      .find((entry) => entry.id === this.snapshot?.activeFloorId)
    return floor?.bounds ?? { x: 0, y: 0, width: 1840, height: 1180 }
  }

  private getViewportSize() {
    const screen = this.app?.screen
    return {
      width: Math.max(1, screen?.width ?? this.container?.clientWidth ?? 1),
      height: Math.max(1, screen?.height ?? this.container?.clientHeight ?? 1),
    }
  }

  private isReady() {
    const app = this.app
    return Boolean(
      app &&
        this.mounted &&
        !this.destroyed &&
        app.canvas &&
        app.renderer &&
        app.stage &&
        app.screen
    )
  }

  private screenToWorld(point: AgentOpsPoint): AgentOpsPoint {
    return {
      x: (point.x - this.pan.x) / this.scale,
      y: (point.y - this.pan.y) / this.scale,
    }
  }

  private render() {
    const snapshot = this.snapshot
    if (!snapshot) return
    this.clearLayers()
    this.drawBackground(snapshot)
    snapshot.rooms.forEach((room) => this.drawRoom(snapshot, room))
    if (this.editor.enabled && (this.editor.pathEditing || this.editor.showPathNetwork)) {
      this.drawPathNetwork(snapshot, true)
    }
    if (this.editor.enabled) return
    snapshot.agents.forEach((agent) => this.drawAgent(snapshot, agent))
    this.drawEffects(snapshot)
    if (snapshot.debug.showBounds || snapshot.debug.showWaypoints || snapshot.debug.showPaths) {
      this.drawDebug(snapshot)
    }
  }

  private drawBackground(snapshot: AgentOpsRenderSnapshot) {
    const floor = snapshot.layout.buildings
      .flatMap((building) => building.floors)
      .find((entry) => entry.id === snapshot.activeFloorId)
    const bounds = floor?.bounds ?? { x: 0, y: 0, width: 1840, height: 1180 }
    const floorAsset = getAgentOpsFloorAsset(floor?.backgroundAssetId)
    const floorTexture = floorAsset ? this.floorTextures.get(floorAsset.id) : null

    if (floorAsset && floorTexture) {
      const backing = new Graphics()
      backing.rect(bounds.x, bounds.y, bounds.width, bounds.height)
      backing.fill({ color: 0x0d141b, alpha: 1 })
      this.backgroundLayer.addChild(backing)

      const sprite = new Sprite(floorTexture)
      sprite.x = bounds.x
      sprite.y = bounds.y
      sprite.width = bounds.width
      sprite.height = bounds.height
      this.backgroundLayer.addChild(sprite)

      const edge = new Graphics()
      edge.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 18)
      edge.stroke({ color: 0x2c3a45, alpha: 0.74, width: 2 })
      this.backgroundLayer.addChild(edge)
      return
    }

    const g = new Graphics()
    g.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 18)
    g.fill({ color: 0x101820, alpha: 1 })
    g.stroke({ color: 0x2c3a45, alpha: 0.82, width: 2 })
    for (let x = bounds.x + 80; x < bounds.width; x += 80) {
      g.moveTo(x, bounds.y)
      g.lineTo(x, bounds.y + bounds.height)
    }
    for (let y = bounds.y + 80; y < bounds.height; y += 80) {
      g.moveTo(bounds.x, y)
      g.lineTo(bounds.x + bounds.width, y)
    }
    g.stroke({ color: 0x1f2b34, alpha: 0.34, width: 1 })
    this.backgroundLayer.addChild(g)
    this.backgroundLayer.addChild(
      label(floor?.label ?? "AgentOps Floor", bounds.x + 28, bounds.y + 18, 18, 0xe8edf4)
    )
  }

  private ensureFloorBackgroundLoaded(snapshot: AgentOpsRenderSnapshot) {
    const floor = snapshot.layout.buildings
      .flatMap((building) => building.floors)
      .find((entry) => entry.id === snapshot.activeFloorId)
    const floorAsset = getAgentOpsFloorAsset(floor?.backgroundAssetId)
    if (!floorAsset) return
    if (this.floorTextures.has(floorAsset.id) || this.loadingFloorTextures.has(floorAsset.id)) return

    this.loadingFloorTextures.add(floorAsset.id)
    Assets.load<Texture>(floorAsset.src)
      .then((texture) => {
        this.floorTextures.set(floorAsset.id, texture)
        this.loadingFloorTextures.delete(floorAsset.id)
        if (this.snapshot?.activeFloorId === floor?.id) {
          this.render()
        }
      })
      .catch(() => {
        this.loadingFloorTextures.delete(floorAsset.id)
      })
  }

  private ensureAgentSpritesLoaded(snapshot: AgentOpsRenderSnapshot) {
    for (const agent of snapshot.agents) {
      const spriteId = snapshot.visualProfiles[agent.agentId]?.spriteId
      const spriteAsset = getAgentOpsAgentSprite(spriteId)
      if (!spriteAsset) continue
      if (
        this.agentTextures.has(spriteAsset.id) ||
        this.loadingAgentTextures.has(spriteAsset.id) ||
        this.failedAgentTextures.has(spriteAsset.id)
      ) {
        continue
      }
      this.loadingAgentTextures.add(spriteAsset.id)
      Assets.load<Texture>(spriteAsset.src)
        .then((texture) => {
          this.agentTextures.set(spriteAsset.id, texture)
          this.loadingAgentTextures.delete(spriteAsset.id)
          this.render()
        })
        .catch(() => {
          this.loadingAgentTextures.delete(spriteAsset.id)
          this.failedAgentTextures.add(spriteAsset.id)
        })
    }
  }

  private drawRoom(snapshot: AgentOpsRenderSnapshot, room: AgentOpsRoom) {
    const editing = this.editor.enabled
    const selected = editing && this.editor.selectedRoomId === room.id
    const active = roomActivity(snapshot, room)
    const status = active.status ?? room.status
    if (editing) {
      const theme = roomVariant(room)?.visualTheme ?? "operations"
      const color = THEME_COLORS[theme] ?? 0x508dd7
      const g = new Graphics()
      const fill = statusFill(status)
      g.roundRect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height, 8)
      g.fill({
        color: fill,
        alpha: room.status === "locked" ? 0.26 : this.editor.roomOverlayAlpha,
      })
      g.stroke({
        color: selected ? 0xfff0a5 : color,
        alpha: selected ? 1 : room.status === "under_construction" ? 0.52 : 0.42,
        width: selected ? 3 : 1,
      })
      g.hitArea = new Rectangle(
        room.bounds.x - 6,
        room.bounds.y - 6,
        room.bounds.width + 12,
        room.bounds.height + 12
      )
      g.eventMode = "static"
      g.cursor = "move"
      g.on("pointerdown", (event) => this.beginRoomDrag(event, room))
      this.roomLayer.addChild(g)
    }

    if (room.status === "under_construction") {
      const stripes = new Graphics()
      for (let x = room.bounds.x - room.bounds.height; x < room.bounds.x + room.bounds.width; x += 28) {
        stripes.moveTo(x, room.bounds.y + room.bounds.height)
        stripes.lineTo(x + room.bounds.height, room.bounds.y)
      }
      stripes.stroke({ color: 0xd7b95e, alpha: 0.18, width: 5 })
      this.roomLayer.addChild(stripes)
    }

    if (!editing && active.intensity) {
      const light = new Graphics()
      for (const anchor of room.lightAnchors) {
        light.circle(anchor.x, anchor.y, 72)
        light.fill({ color: 0xf4efe4, alpha: 0.035 + active.intensity * 0.045 })
      }
      this.lightingLayer.addChild(light)
    }

    if (this.editor.showLabels) {
      const labelPosition = getRoomLabelPosition(room)
      this.roomLayer.addChild(roomLabel(room.label, labelPosition.x, labelPosition.y, editing))
    }
    if (selected) this.drawEditControls(room)
  }

  private drawEditControls(room: AgentOpsRoom) {
    const dragSurface = new Graphics()
    dragSurface.rect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height)
    dragSurface.fill({ color: 0xffffff, alpha: 0.001 })
    dragSurface.hitArea = new Rectangle(
      room.bounds.x,
      room.bounds.y,
      room.bounds.width,
      room.bounds.height
    )
    dragSurface.eventMode = "static"
    dragSurface.cursor = "move"
    dragSurface.on("pointerdown", (event) => this.beginRoomDrag(event, room))
    this.debugLayer.addChild(dragSurface)

    const outline = new Graphics()
    outline.rect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height)
    outline.stroke({ color: 0xfff0a5, alpha: 0.95, width: 2 })
    this.debugLayer.addChild(outline)

    for (const handle of getResizeHandles(room.bounds)) {
      const g = new Graphics()
      g.rect(handle.point.x - 5, handle.point.y - 5, 10, 10)
      g.fill({ color: 0xfff0a5, alpha: 0.94 })
      g.stroke({ color: 0x101820, alpha: 0.9, width: 1 })
      g.eventMode = "static"
      g.cursor = "pointer"
      g.on("pointerdown", (event) =>
        this.beginResizeDrag(event, room, handle.id)
      )
      this.debugLayer.addChild(g)
    }

    this.drawLabelHandle(room)
    this.drawAnchorHandles(room, "entryAnchors", room.entryAnchors, 0xf59e0b)
    this.drawAnchorHandles(room, "workstations", room.workstations.map((entry) => entry.position), 0x22c55e)
    this.drawAnchorHandles(room, "screenAnchors", room.screenAnchors.map((entry) => entry.position), 0x38bdf8)
    this.drawAnchorHandles(room, "idleAnchors", room.idleAnchors, 0xa78bfa)
    this.drawAnchorHandles(room, "lightAnchors", room.lightAnchors, 0xfacc15)
  }

  private drawLabelHandle(room: AgentOpsRoom) {
    const position = getRoomLabelPosition(room)
    const g = new Graphics()
    g.roundRect(position.x - 8, position.y - 8, 16, 16, 4)
    g.fill({ color: 0xffffff, alpha: 0.94 })
    g.stroke({ color: 0x101820, alpha: 0.9, width: 1 })
    g.eventMode = "static"
    g.cursor = "grab"
    g.on("pointerdown", (event) => this.beginLabelDrag(event, room))
    this.debugLayer.addChild(g)
  }

  private drawAnchorHandles(
    room: AgentOpsRoom,
    group: AgentOpsEditableAnchorGroup,
    points: AgentOpsPoint[],
    color: number
  ) {
    if (!this.editor.anchorVisibility[group]) return
    points.forEach((point, index) => {
      const selected =
        this.editor.selectedAnchor?.roomId === room.id &&
        this.editor.selectedAnchor.group === group &&
        this.editor.selectedAnchor.index === index
      const g = new Graphics()
      drawAnchorShape(g, group, point, selected)
      g.fill({ color, alpha: selected ? 1 : 0.92 })
      g.stroke({
        color: selected ? 0xffffff : 0x101820,
        alpha: selected ? 1 : 0.9,
        width: selected ? 3 : 1,
      })
      g.hitArea = new Rectangle(point.x - 16, point.y - 16, 32, 32)
      g.eventMode = "static"
      g.cursor = "grab"
      g.on("pointerdown", (event) =>
        this.beginAnchorDrag(event, room, group, index, point)
      )
      this.debugLayer.addChild(g)
    })
  }

  private drawPathNetwork(snapshot: AgentOpsRenderSnapshot, interactive: boolean) {
    const floor = snapshot.layout.buildings
      .flatMap((building) => building.floors)
      .find((entry) => entry.id === snapshot.activeFloorId)
    const network = floor?.pathNetwork
    if (!floor || !network) return
    const waypointById = new Map(network.waypoints.map((waypoint) => [waypoint.id, waypoint]))
    const connectingFrom = interactive && this.editor.pathConnectFromId
      ? waypointById.get(this.editor.pathConnectFromId)
      : null
    if (connectingFrom && this.mouseWorld) {
      const preview = new Graphics()
      preview.moveTo(connectingFrom.position.x, connectingFrom.position.y)
      preview.lineTo(this.mouseWorld.x, this.mouseWorld.y)
      preview.stroke({
        color: pathColor(this.editor.activePathTags),
        alpha: 0.7,
        width: 3,
      })
      this.debugLayer.addChild(preview)
    }
    for (const edge of network.edges) {
      const from = waypointById.get(edge.from)
      const to = waypointById.get(edge.to)
      if (!from || !to || !this.pathTagsVisible(edge.tags, interactive)) continue
      const selected = this.editor.selectedPathItem?.type === "edge" && this.editor.selectedPathItem.id === edge.id
      const g = new Graphics()
      g.moveTo(from.position.x, from.position.y)
      g.lineTo(to.position.x, to.position.y)
      g.stroke({
        color: pathColor(edge.tags),
        alpha: selected ? 1 : interactive ? 0.64 : 0.58,
        width: selected ? 5 : interactive ? 3 : 2,
      })
      if (interactive) {
        g.eventMode = "static"
        g.cursor = "pointer"
        g.on("pointertap", () => this.selectPathEdge(edge))
      }
      this.debugLayer.addChild(g)
    }
    for (const waypoint of network.waypoints) {
      if (!this.pathTagsVisible(waypoint.tags, interactive)) continue
      const selected = this.editor.selectedPathItem?.type === "waypoint" && this.editor.selectedPathItem.id === waypoint.id
      const g = new Graphics()
      g.circle(waypoint.position.x, waypoint.position.y, selected ? 8 : interactive ? 6 : 4)
      g.fill({ color: pathColor(waypoint.tags), alpha: selected ? 1 : interactive ? 0.88 : 0.72 })
      g.stroke({ color: 0xffffff, alpha: selected ? 1 : interactive ? 0.5 : 0.28, width: selected ? 2 : 1 })
      if (interactive) {
        g.hitArea = new Rectangle(waypoint.position.x - 18, waypoint.position.y - 18, 36, 36)
        g.eventMode = "static"
        g.cursor = "grab"
        g.on("pointerdown", (event) => this.beginWaypointDrag(event, floor.id, waypoint))
      }
      this.debugLayer.addChild(g)
    }
  }

  private pathTagsVisible(tags: AgentOpsPathTag[], interactive: boolean) {
    if (!interactive) return true
    return tags.some((tag) => this.editor.activePathTags.includes(tag))
  }

  private selectPathWaypoint(floorId: string, waypoint: AgentOpsPathWaypoint) {
    this.options.onPathSelect?.({ type: "waypoint", id: waypoint.id }, this.editor.pathConnectFromId)
    if (this.editor.pathConnectFromId && this.editor.pathConnectFromId !== waypoint.id) {
      this.options.onPathPatch?.({
        type: "connect_waypoints",
        floorId,
        from: this.editor.pathConnectFromId,
        to: waypoint.id,
        tags: this.editor.activePathTags.length ? this.editor.activePathTags : ["main"],
      })
    }
  }

  private selectPathEdge(edge: AgentOpsPathEdge) {
    this.options.onPathSelect?.({ type: "edge", id: edge.id }, null)
  }

  private drawAgent(snapshot: AgentOpsRenderSnapshot, agent: AgentOpsAgentState) {
    if (agent.visibleState === "offline_hidden") return
    const profile = snapshot.visualProfiles[agent.agentId]
    const spriteAsset = getAgentOpsAgentSprite(profile?.spriteId)
    const spriteTexture = spriteAsset ? this.agentTextures.get(spriteAsset.id) : null
    if (spriteAsset && spriteTexture) {
      this.drawAgentSprite(snapshot, agent, spriteAsset, spriteTexture)
      return
    }
    this.drawAgentFallback(snapshot, agent)
  }

  private drawAgentSprite(
    snapshot: AgentOpsRenderSnapshot,
    agent: AgentOpsAgentState,
    spriteAsset: AgentOpsAgentSpriteAsset,
    texture: Texture
  ) {
    const profile = snapshot.visualProfiles[agent.agentId]
    const animationKey = chooseAgentAnimationKey(agent)
    const animation =
      spriteAsset.animations[animationKey] ??
      spriteAsset.animations[fallbackAnimationKey(animationKey)] ??
      spriteAsset.animations.idle_down
    if (!animation) {
      this.drawAgentFallback(snapshot, agent)
      return
    }
    const fps = animation.fps ?? 1
    const frame = animation.frames > 1
      ? Math.floor((Date.now() / 1000) * fps) % animation.frames
      : 0
    const frameTexture = new Texture({
      source: texture.source,
      frame: new Rectangle(
        frame * spriteAsset.frameWidth,
        animation.row * spriteAsset.frameHeight,
        spriteAsset.frameWidth,
        spriteAsset.frameHeight
      ),
    })
    const sprite = new Sprite(frameTexture)
    const anchor = spriteAsset.anchor ?? { x: 0.5, y: 0.82 }
    sprite.anchor.set(anchor.x, anchor.y)
    sprite.x = agent.position.x
    sprite.y = agent.position.y
    sprite.scale.set((profile?.scale ?? 1) * spriteAsset.scale)
    sprite.eventMode = "static"
    sprite.cursor = "pointer"
    sprite.on("pointertap", () => this.options.onSelect?.("agent", agent.agentId))
    this.agentLayer.addChild(sprite)
    this.agentLayer.addChild(label(profile?.displayName ?? "Agent", agent.position.x + 14, agent.position.y - 18, 10, 0xf6f8fb))
  }

  private drawAgentFallback(snapshot: AgentOpsRenderSnapshot, agent: AgentOpsAgentState) {
    const profile = snapshot.visualProfiles[agent.agentId]
    const color = parseInt((profile?.color ?? "#508dd7").replace("#", ""), 16)
    const g = new Graphics()
    g.circle(agent.position.x, agent.position.y, 11)
    g.fill({ color, alpha: 0.96 })
    g.stroke({ color: 0xffffff, alpha: 0.62, width: 1.5 })
    const stateColor =
      agent.realState === "error"
        ? 0xff5468
        : agent.realState === "waiting_for_approval"
          ? 0xd7b95e
          : agent.realState === "completed"
            ? 0x64d78d
            : 0x508dd7
    g.circle(agent.position.x + 8, agent.position.y - 8, 4)
    g.fill({ color: stateColor, alpha: 1 })
    g.eventMode = "static"
    g.cursor = "pointer"
    g.on("pointertap", () => this.options.onSelect?.("agent", agent.agentId))
    this.agentLayer.addChild(g)
    this.agentLayer.addChild(label(profile?.displayName ?? "Agent", agent.position.x + 14, agent.position.y - 8, 10, 0xf6f8fb))
  }

  private drawEffects(snapshot: AgentOpsRenderSnapshot) {
    const latest = snapshot.events.slice(0, 12)
    for (const event of latest) {
      const room = event.roomId ? snapshot.rooms.find((entry) => entry.id === event.roomId) : null
      if (!room) continue
      const color = event.severity === "error" ? 0xff5468 : event.severity === "warning" ? 0xd7b95e : event.severity === "success" ? 0x64d78d : event.severity === "revenue" ? 0xd7b95e : 0x508dd7
      const age = Math.max(0, Date.now() - new Date(event.timestamp).getTime())
      const alpha = Math.max(0, 1 - age / 10000)
      if (!alpha) continue
      const g = new Graphics()
      g.roundRect(room.bounds.x - 5, room.bounds.y - 5, room.bounds.width + 10, room.bounds.height + 10, 11)
      g.stroke({ color, alpha: alpha * 0.55, width: 4 })
      this.effectsLayer.addChild(g)
    }
  }

  private drawDebug(snapshot: AgentOpsRenderSnapshot) {
    const g = new Graphics()
    if (snapshot.debug.showBounds) {
      for (const room of snapshot.rooms) {
        g.rect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height)
      }
      g.stroke({ color: 0xffffff, alpha: 0.25, width: 1 })
    }
    if (snapshot.debug.showWaypoints) {
      for (const room of snapshot.rooms) {
        for (const point of [...room.entryAnchors, ...room.idleAnchors]) {
          g.circle(point.x, point.y, 4)
          g.fill({ color: 0xffffff, alpha: 0.45 })
        }
      }
    }
    if (snapshot.debug.showPaths) {
      this.drawPathNetwork(snapshot, false)
      for (const agent of snapshot.agents) {
        if (!agent.path.length) continue
        g.moveTo(agent.position.x, agent.position.y)
        for (const point of agent.path) g.lineTo(point.x, point.y)
      }
      g.stroke({ color: 0xfff0a5, alpha: 0.72, width: 2 })
    }
    this.debugLayer.addChild(g)
  }

  private clearLayers() {
    for (const layer of [
      this.backgroundLayer,
      this.roomLayer,
      this.lightingLayer,
      this.screenLayer,
      this.agentLayer,
      this.effectsLayer,
      this.debugLayer,
    ]) {
      const removed = layer.removeChildren()
      for (const child of removed) {
        child.destroy({ children: true })
      }
    }
  }

  private applyTransform() {
    this.root.scale.set(this.scale)
    this.root.position.set(this.pan.x, this.pan.y)
    this.options.onViewportChange?.({
      scale: this.scale,
      pan: { ...this.pan },
    })
  }

  private handlePointerDown = (event: FederatedPointerEvent) => {
    if (this.editDrag) return
    if (this.editor.enabled && this.editor.pathEditing && this.editor.pathConnectFromId) {
      return
    }
    if (this.editor.enabled && this.editor.pathEditing && this.editor.pathAddMode) {
      const world = this.screenToWorld(event.global)
      this.mouseWorld = world
      this.options.onMouseWorldChange?.(world)
      this.options.onPathAddPoint?.(world)
      return
    }
    this.dragging = true
    this.lastPointer = { x: event.global.x, y: event.global.y }
  }

  private handlePointerMove = (event: FederatedPointerEvent) => {
    if (this.editor.enabled) {
      this.mouseWorld = this.screenToWorld(event.global)
      this.options.onMouseWorldChange?.(this.mouseWorld)
      if (this.editor.pathConnectFromId) this.render()
    }
    if (this.editDrag) {
      this.updateEditDrag(this.screenToWorld(event.global))
      return
    }
    if (!this.dragging || !this.lastPointer) return
    const next = { x: event.global.x, y: event.global.y }
    this.pan = {
      x: this.pan.x + next.x - this.lastPointer.x,
      y: this.pan.y + next.y - this.lastPointer.y,
    }
    this.clampPan()
    this.lastPointer = next
    this.applyTransform()
  }

  private handlePointerUp = () => {
    this.editDrag = null
    this.dragging = false
    this.lastPointer = null
  }

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const rect = this.container?.getBoundingClientRect()
    const mouse = {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    }
    const world = this.screenToWorld(mouse)
    const wheelDelta = Math.max(-90, Math.min(90, event.deltaY))
    const zoomFactor = Math.exp(-wheelDelta * 0.0042)
    this.scale = clamp(this.scale * zoomFactor, this.minScale, this.maxScale)
    this.pan = {
      x: mouse.x - world.x * this.scale,
      y: mouse.y - world.y * this.scale,
    }
    this.clampPan()
    this.applyTransform()
  }

  private beginRoomDrag(event: FederatedPointerEvent, room: AgentOpsRoom) {
    event.stopPropagation()
    if (this.editor.pathEditing && this.editor.pathConnectFromId) {
      return
    }
    const startWorld = this.screenToWorld(event.global)
    this.options.onSelect?.("room", room.id)
    this.editDrag = {
      kind: "room",
      roomId: room.id,
      startWorld,
      lastWorld: startWorld,
      startBounds: { ...room.bounds },
    }
  }

  private beginResizeDrag(
    event: FederatedPointerEvent,
    room: AgentOpsRoom,
    handle: ResizeHandle
  ) {
    event.stopPropagation()
    const startWorld = this.screenToWorld(event.global)
    this.options.onSelect?.("room", room.id)
    this.editDrag = {
      kind: "resize",
      roomId: room.id,
      handle,
      startWorld,
      startBounds: { ...room.bounds },
    }
  }

  private beginAnchorDrag(
    event: FederatedPointerEvent,
    room: AgentOpsRoom,
    group: AgentOpsEditableAnchorGroup,
    index: number,
    point: AgentOpsPoint
  ) {
    event.stopPropagation()
    this.options.onSelect?.("room", room.id)
    this.options.onAnchorSelect?.({ roomId: room.id, group, index })
    this.editDrag = {
      kind: "anchor",
      roomId: room.id,
      group,
      index,
      startWorld: this.screenToWorld(event.global),
      startPosition: { ...point },
    }
  }

  private beginLabelDrag(event: FederatedPointerEvent, room: AgentOpsRoom) {
    event.stopPropagation()
    this.options.onSelect?.("room", room.id)
    this.editDrag = {
      kind: "label",
      roomId: room.id,
      startWorld: this.screenToWorld(event.global),
      startPosition: getRoomLabelPosition(room),
    }
  }

  private beginWaypointDrag(
    event: FederatedPointerEvent,
    floorId: string,
    waypoint: AgentOpsPathWaypoint
  ) {
    event.stopPropagation()
    this.selectPathWaypoint(floorId, waypoint)
    if (this.editor.pathConnectFromId && this.editor.pathConnectFromId !== waypoint.id) {
      return
    }
    this.editDrag = {
      kind: "waypoint",
      floorId,
      waypointId: waypoint.id,
      startWorld: this.screenToWorld(event.global),
      startPosition: waypoint.position,
    }
  }

  private updateEditDrag(world: AgentOpsPoint) {
    if (!this.editDrag) return
    const delta = {
      x: world.x - this.editDrag.startWorld.x,
      y: world.y - this.editDrag.startWorld.y,
    }
    if (this.editDrag.kind === "room") {
      const nextX = this.snap(this.editDrag.startBounds.x + delta.x)
      const nextY = this.snap(this.editDrag.startBounds.y + delta.y)
      const lastDelta = {
        x: this.snap(this.editDrag.startBounds.x + this.editDrag.lastWorld.x - this.editDrag.startWorld.x),
        y: this.snap(this.editDrag.startBounds.y + this.editDrag.lastWorld.y - this.editDrag.startWorld.y),
      }
      this.editDrag.lastWorld = world
      this.options.onRoomPatch?.({
        roomId: this.editDrag.roomId,
        translate: {
          x: nextX - lastDelta.x,
          y: nextY - lastDelta.y,
        },
      })
      return
    }
    if (this.editDrag.kind === "resize") {
      this.options.onRoomPatch?.({
        roomId: this.editDrag.roomId,
        bounds: resizeBounds(
          this.editDrag.startBounds,
          this.editDrag.handle,
          delta,
          (value) => this.snap(value)
        ),
      })
      return
    }
    if (this.editDrag.kind === "label") {
      this.options.onRoomPatch?.({
        roomId: this.editDrag.roomId,
        labelPosition: {
          x: this.snap(this.editDrag.startPosition.x + delta.x),
          y: this.snap(this.editDrag.startPosition.y + delta.y),
        },
      })
      return
    }
    if (this.editDrag.kind === "waypoint") {
      this.options.onPathPatch?.({
        type: "move_waypoint",
        floorId: this.editDrag.floorId,
        waypointId: this.editDrag.waypointId,
        position: {
          x: this.snap(this.editDrag.startPosition.x + delta.x),
          y: this.snap(this.editDrag.startPosition.y + delta.y),
        },
      })
      return
    }
    this.options.onRoomPatch?.({
      roomId: this.editDrag.roomId,
      anchor: {
        group: this.editDrag.group,
        index: this.editDrag.index,
        position: {
          x: this.snap(this.editDrag.startPosition.x + delta.x),
          y: this.snap(this.editDrag.startPosition.y + delta.y),
        },
      },
    })
  }

  private snap(value: number) {
    if (!this.editor.snapToGrid) return Math.round(value)
    return Math.round(value / 8) * 8
  }

}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getResizeHandles(bounds: AgentOpsRect): Array<{ id: ResizeHandle; point: AgentOpsPoint }> {
  const midX = bounds.x + bounds.width / 2
  const midY = bounds.y + bounds.height / 2
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height
  return [
    { id: "nw", point: { x: bounds.x, y: bounds.y } },
    { id: "n", point: { x: midX, y: bounds.y } },
    { id: "ne", point: { x: right, y: bounds.y } },
    { id: "e", point: { x: right, y: midY } },
    { id: "se", point: { x: right, y: bottom } },
    { id: "s", point: { x: midX, y: bottom } },
    { id: "sw", point: { x: bounds.x, y: bottom } },
    { id: "w", point: { x: bounds.x, y: midY } },
  ]
}

function resizeBounds(
  bounds: AgentOpsRect,
  handle: ResizeHandle,
  delta: AgentOpsPoint,
  snap: (value: number) => number
) {
  const minSize = 28
  let left = bounds.x
  let top = bounds.y
  let right = bounds.x + bounds.width
  let bottom = bounds.y + bounds.height
  if (handle.includes("w")) left = snap(bounds.x + delta.x)
  if (handle.includes("e")) right = snap(bounds.x + bounds.width + delta.x)
  if (handle.includes("n")) top = snap(bounds.y + delta.y)
  if (handle.includes("s")) bottom = snap(bounds.y + bounds.height + delta.y)
  if (right - left < minSize) {
    if (handle.includes("w")) left = right - minSize
    else right = left + minSize
  }
  if (bottom - top < minSize) {
    if (handle.includes("n")) top = bottom - minSize
    else bottom = top + minSize
  }
  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  }
}

function chooseAgentAnimationKey(agent: AgentOpsAgentState): AgentOpsSpriteAnimationKey {
  const direction = toCardinalDirection(agent.direction ?? directionFromFacing(agent.facing) ?? "down")
  if (agent.path.length || agent.visibleState === "walking_to_work" || agent.visibleState === "returning_to_idle") {
    return `walk_${direction}`
  }
  if (agent.realState === "waiting_for_approval") return `approval_${direction}`
  if (agent.realState === "error") return `error_${direction}`
  if (agent.visibleState === "desk_work" || agent.realState === "working" || agent.realState === "tooling") {
    return `work_${toCardinalDirection(directionFromFacing(agent.facing) ?? direction)}`
  }
  return `idle_${direction}`
}

function fallbackAnimationKey(key: AgentOpsSpriteAnimationKey): AgentOpsSpriteAnimationKey {
  if (key.startsWith("approval_")) return key.replace("approval_", "idle_") as AgentOpsSpriteAnimationKey
  if (key.startsWith("error_")) return key.replace("error_", "idle_") as AgentOpsSpriteAnimationKey
  if (key.includes("up-left") || key.includes("up-right")) return key.replace(/up-left|up-right/, "up") as AgentOpsSpriteAnimationKey
  if (key.includes("down-left") || key.includes("down-right")) return key.replace(/down-left|down-right/, "down") as AgentOpsSpriteAnimationKey
  return "idle_down"
}

function directionFromFacing(facing: AgentOpsAgentState["facing"]) {
  if (facing === "north") return "up"
  if (facing === "south") return "down"
  if (facing === "east") return "right"
  if (facing === "west") return "left"
  return null
}

function toCardinalDirection(direction: NonNullable<AgentOpsAgentState["direction"]> | "down") {
  if (direction === "up-left" || direction === "up-right") return "up"
  if (direction === "down-left" || direction === "down-right") return "down"
  return direction
}

function drawAnchorShape(
  graphics: Graphics,
  group: AgentOpsEditableAnchorGroup,
  point: AgentOpsPoint,
  selected: boolean
) {
  const size = selected ? 9 : 7
  if (group === "entryAnchors") {
    graphics.moveTo(point.x, point.y - size)
    graphics.lineTo(point.x + size, point.y)
    graphics.lineTo(point.x, point.y + size)
    graphics.lineTo(point.x - size, point.y)
    graphics.closePath()
    return
  }
  if (group === "workstations") {
    graphics.roundRect(point.x - size, point.y - size * 0.72, size * 2, size * 1.44, 3)
    return
  }
  if (group === "screenAnchors") {
    graphics.rect(point.x - size, point.y - size * 0.65, size * 2, size * 1.3)
    return
  }
  if (group === "lightAnchors") {
    graphics.star(point.x, point.y, 5, size, size * 0.45)
    return
  }
  graphics.circle(point.x, point.y, size)
}

function pathColor(tags: AgentOpsPathTag[]) {
  if (tags.includes("main") && tags.includes("idle")) return 0x67f8e3
  if (tags.includes("restricted")) return 0xff5468
  if (tags.includes("outside")) return 0x7cd992
  if (tags.includes("social")) return 0xa78bfa
  if (tags.includes("idle")) return 0x38bdf8
  if (tags.includes("room_entry")) return 0xf59e0b
  if (tags.includes("main")) return 0xf4f6f8
  return 0xf4f6f8
}

function roomActivity(snapshot: AgentOpsRenderSnapshot, room: AgentOpsRoom) {
  const department = room.departmentId ? snapshot.departments[room.departmentId] : null
  return {
    status: department?.status,
    intensity: department?.roomIds.includes(room.id) ? department.intensity : 0,
  }
}

function statusFill(status: AgentOpsRoomStatus | AgentOpsDepartmentStatus | undefined) {
  switch (status) {
    case "active":
      return 0x1b2b31
    case "error":
      return 0x321b22
    case "approval":
      return 0x302817
    case "revenue":
      return 0x253019
    case "empty":
      return 0x151d24
    case "locked":
    case "inactive":
      return 0x10161c
    case "under_construction":
      return 0x1d1b15
    default:
      return 0x17222c
  }
}

type AgentOpsDepartmentStatus = "inactive" | "idle" | "active" | "blocked" | "error" | "approval" | "revenue"

function roomLabel(value: string, x: number, y: number, editing: boolean) {
  const text = new Text({
    text: value,
    style: {
      fill: 0xf4f6f8,
      fontFamily: "Inter, ui-sans-serif, system-ui",
      fontSize: editing ? 12 : 11,
      fontWeight: "600",
      dropShadow: {
      color: 0x071018,
      alpha: 0.85,
      blur: 3,
      distance: 1,
      },
    },
  })
  text.x = x
  text.y = y
  text.resolution = 2
  return text
}

function label(value: string, x: number, y: number, size: number, color: number) {
  const text = new Text({
    text: value,
    style: {
      fill: color,
      fontFamily: "Inter, ui-sans-serif, system-ui",
      fontSize: size,
      fontWeight: size >= 14 ? "600" : "500",
    },
  })
  text.x = x
  text.y = y
  text.resolution = 2
  return text
}
