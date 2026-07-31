import type {
  AgentOpsEstateLayout,
  AgentOpsFloor,
  AgentOpsPoint,
  AgentOpsRoom,
  AgentOpsRoomStatus,
  AgentOpsRoomVariant,
  AgentOpsRoomVariantSize,
  AgentOpsScreenAnchor,
  AgentOpsWorkstation,
  AgentOpsZone,
} from "./estate-types"
import {
  DEFAULT_AGENTOPS_APPLICATIONS,
  DEFAULT_AGENTOPS_BUSINESS_UNITS,
  DEFAULT_AGENTOPS_OUTPUT_TYPES,
  DEFAULT_AGENTOPS_WEBSITES,
  DEFAULT_AGENTOPS_WORKFLOWS,
} from "./default-business-entities"
import DEFAULT_OPERATIONS_FLOOR from "./default-operations-floor-layout.json"

type RoomSpec = {
  id: string
  label: string
  kind: AgentOpsRoom["kind"]
  x: number
  y: number
  width: number
  height: number
  departmentId?: string
  businessUnitId?: string
  applicationIds?: string[]
  websiteIds?: string[]
  workflowIds?: string[]
  outputTypeIds?: string[]
  status?: AgentOpsRoomStatus
  variant?: AgentOpsRoomVariantSize
  theme?: string
}

const FLOOR_WIDTH = 1840
const FLOOR_HEIGHT = 1180

export const DEFAULT_AGENTOPS_LAYOUT: AgentOpsEstateLayout = {
  id: "agentops_estate_default",
  version: 1,
  businessUnits: DEFAULT_AGENTOPS_BUSINESS_UNITS,
  applications: DEFAULT_AGENTOPS_APPLICATIONS,
  websites: DEFAULT_AGENTOPS_WEBSITES,
  outputTypes: DEFAULT_AGENTOPS_OUTPUT_TYPES,
  workflows: DEFAULT_AGENTOPS_WORKFLOWS,
  departmentAssignments: [],
  buildings: [
    {
      id: "agentops_tower",
      label: "AgentOps Tower",
      type: "tower",
      defaultFloorId: "floor_01_operations",
      status: "expanding",
      floors: [
        makeFloor({
          id: "floor_00_lobby",
          label: "Lobby & Shared Facilities",
          level: 0,
          kind: "lobby",
          status: "active",
          zones: [
            zone("lobby_social", "Shared Facilities", "social", 0, 0, FLOOR_WIDTH, FLOOR_HEIGHT, [
              room({ id: "reception", label: "Reception", kind: "reception", x: 40, y: 50, width: 330, height: 180, status: "idle", variant: "small", theme: "operations" }),
              room({ id: "common_room", label: "Common Room", kind: "social", x: 420, y: 50, width: 400, height: 250, status: "idle", variant: "medium", theme: "social" }),
              room({ id: "canteen", label: "Canteen", kind: "canteen", x: 860, y: 50, width: 390, height: 250, status: "idle", variant: "medium", theme: "social" }),
              room({ id: "games_room", label: "Games Room", kind: "games", x: 1290, y: 50, width: 330, height: 250, status: "idle", variant: "small", theme: "social" }),
              room({ id: "toilets", label: "Toilets", kind: "toilets", x: 40, y: 290, width: 220, height: 160, status: "idle", variant: "small", theme: "support" }),
              room({ id: "outdoor_fresh_air", label: "Outdoor / Fresh Air", kind: "outdoor", x: 1270, y: 350, width: 500, height: 300, status: "idle", variant: "medium", theme: "social" }),
              room({ id: "archive_memory_room", label: "Archive / Memory Room", kind: "archive", x: 420, y: 730, width: 430, height: 260, status: "idle", variant: "medium", theme: "archive" }),
              room({ id: "future_lobby_suite", label: "Future Lobby Suite", kind: "expansion", x: 900, y: 730, width: 420, height: 260, status: "under_construction", variant: "under_construction", theme: "expansion" }),
            ]),
          ],
        }),
        DEFAULT_OPERATIONS_FLOOR as AgentOpsFloor,
        makeFloor({
          id: "floor_02_growth",
          label: "Growth Expansion Floor",
          level: 2,
          kind: "expansion",
          status: "dim",
          zones: [
            zone("growth_expansion", "Empty Growth Suites", "expansion", 0, 0, FLOOR_WIDTH, FLOOR_HEIGHT, [
              room({ id: "future_product_lab_a", label: "Future Product Lab A", kind: "expansion", x: 60, y: 70, width: 520, height: 310, status: "empty", variant: "empty", theme: "expansion" }),
              room({ id: "future_product_lab_b", label: "Future Product Lab B", kind: "expansion", x: 650, y: 70, width: 520, height: 310, status: "under_construction", variant: "under_construction", theme: "expansion" }),
              room({ id: "future_revenue_floor", label: "Future Revenue Ops", kind: "office", x: 1240, y: 70, width: 520, height: 310, status: "locked", variant: "inactive", theme: "finance" }),
            ]),
          ],
        }),
        makeFloor({
          id: "floor_03_studios",
          label: "Studios & Labs",
          level: 3,
          kind: "studio",
          status: "under_construction",
          zones: [
            zone("studios_under_construction", "Studios Under Construction", "expansion", 0, 0, FLOOR_WIDTH, FLOOR_HEIGHT, [
              room({ id: "future_video_studio", label: "Future Video Studio", kind: "studio", x: 80, y: 80, width: 760, height: 420, status: "under_construction", variant: "under_construction", theme: "studio" }),
              room({ id: "future_design_lab", label: "Future Design Lab", kind: "lab", x: 980, y: 80, width: 760, height: 420, status: "empty", variant: "empty", theme: "creative" }),
            ]),
          ],
        }),
        makeFloor({
          id: "floor_archive_basement",
          label: "Archive Basement",
          level: -1,
          kind: "archive",
          status: "dim",
          zones: [
            zone("archive_basement_zone", "Archive & Memory", "support", 0, 0, FLOOR_WIDTH, FLOOR_HEIGHT, [
              room({ id: "deep_archive", label: "Deep Archive", kind: "archive", x: 120, y: 120, width: 620, height: 360, status: "inactive", variant: "inactive", theme: "archive" }),
              room({ id: "memory_index", label: "Memory Index", kind: "archive", x: 900, y: 120, width: 620, height: 360, status: "idle", variant: "medium", theme: "archive" }),
            ]),
          ],
        }),
      ],
    },
  ],
}

function makeFloor(input: Omit<AgentOpsFloor, "buildingId" | "bounds" | "waypointGraphId">): AgentOpsFloor {
  return {
    ...input,
    buildingId: "agentops_tower",
    bounds: { x: 0, y: 0, width: FLOOR_WIDTH, height: FLOOR_HEIGHT },
    waypointGraphId: `${input.id}_waypoints`,
  }
}

function zone(
  id: string,
  label: string,
  kind: AgentOpsZone["kind"],
  x: number,
  y: number,
  width: number,
  height: number,
  rooms: AgentOpsRoom[]
): AgentOpsZone {
  return { id, floorId: "", label, kind, bounds: { x, y, width, height }, rooms: rooms.map((entry) => ({ ...entry, zoneId: id })) }
}

function room(spec: RoomSpec): AgentOpsRoom {
  const variant = makeVariant(spec)
  const entry = { x: spec.x + spec.width / 2, y: spec.y + spec.height - 8 }
  const lights = [
    { x: spec.x + spec.width * 0.28, y: spec.y + 24 },
    { x: spec.x + spec.width * 0.72, y: spec.y + 24 },
  ]
  return {
    id: spec.id,
    zoneId: "",
    label: spec.label,
    kind: spec.kind,
    departmentId: spec.departmentId ?? null,
    businessUnitId: spec.businessUnitId ?? null,
    applicationIds: spec.applicationIds ?? [],
    websiteIds: spec.websiteIds ?? [],
    workflowIds: spec.workflowIds ?? [],
    outputTypeIds: spec.outputTypeIds ?? [],
    currentVariantId: variant.id,
    variants: [
      variant,
      makeVariant({ ...spec, variant: "small" }),
      makeVariant({ ...spec, variant: "medium" }),
      makeVariant({ ...spec, variant: "large" }),
      makeVariant({ ...spec, variant: "empty" }),
      makeVariant({ ...spec, variant: "inactive" }),
      makeVariant({ ...spec, variant: "under_construction" }),
    ].filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index),
    status: spec.status ?? "idle",
    capacity: variant.capacity,
    bounds: { x: spec.x, y: spec.y, width: spec.width, height: spec.height },
    entryAnchors: [entry],
    idleAnchors: variant.idleAnchors,
    workstations: variant.workstations,
    screenAnchors: variant.screenAnchors,
    lightAnchors: lights,
  }
}

function makeVariant(spec: RoomSpec): AgentOpsRoomVariant {
  const size = spec.variant ?? "small"
  const capacity = size === "large" ? 10 : size === "medium" ? 6 : size === "small" ? 4 : 0
  const workstations = makeWorkstations(spec, capacity)
  const screenAnchors = makeScreens(spec, size)
  return {
    id: size,
    label: titleCase(size),
    size,
    capacity,
    workstations,
    screenAnchors,
    idleAnchors: makeIdleAnchors(spec, Math.max(2, Math.min(5, capacity || 3))),
    visualTheme: spec.theme,
  }
}

function makeWorkstations(spec: RoomSpec, count: number): AgentOpsWorkstation[] {
  if (!count) return []
  const cols = count > 6 ? 5 : count > 4 ? 3 : 2
  const rows = Math.ceil(count / cols)
  const points: AgentOpsWorkstation[] = []
  for (let i = 0; i < count; i += 1) {
    const col = i % cols
    const row = Math.floor(i / cols)
    points.push({
      id: `${spec.id}_desk_${i + 1}`,
      position: {
        x: spec.x + 44 + (col * Math.max(46, spec.width - 88)) / Math.max(1, cols - 1),
        y: spec.y + 72 + (row * Math.max(44, spec.height - 126)) / Math.max(1, rows - 1),
      },
      facing: row % 2 ? "north" : "south",
    })
  }
  return points
}

function makeScreens(spec: RoomSpec, size: AgentOpsRoomVariantSize): AgentOpsScreenAnchor[] {
  if (["empty", "inactive", "under_construction"].includes(size)) return []
  return [
    {
      id: `${spec.id}_screen_main`,
      position: { x: spec.x + spec.width - 60, y: spec.y + 24 },
      width: Math.min(84, spec.width * 0.24),
      height: 34,
      theme: spec.theme,
    },
  ]
}

function makeIdleAnchors(spec: RoomSpec, count: number): AgentOpsPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: spec.x + 38 + ((index + 1) * (spec.width - 76)) / (count + 1),
    y: spec.y + spec.height - 48 - (index % 2) * 34,
  }))
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

for (const building of DEFAULT_AGENTOPS_LAYOUT.buildings) {
  for (const floor of building.floors) {
    for (const floorZone of floor.zones) {
      floorZone.floorId = floor.id
      floorZone.rooms = floorZone.rooms.map((entry) => ({ ...entry, zoneId: floorZone.id }))
    }
  }
}
