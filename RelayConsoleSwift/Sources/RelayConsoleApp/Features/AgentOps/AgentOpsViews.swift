import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct AgentOpsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(
        title: "AgentOps HQ", subtitle: "Live operations", icon: "building.2.crop.circle"
      ) {
        Button {
          model.refreshAgentOps()
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .buttonStyle(IconButtonStyle())
        .help("Refresh")
        .accessibilityLabel("Refresh AgentOps live state")
      }
      SearchField(text: $model.agentOpsSearch, placeholder: "Search agents")
      AgentOpsMiniStats()
      ScrollView {
        LazyVStack(spacing: 8) {
          if model.filteredAgentOpsStates.isEmpty {
            EmptyMini(
              title: "No agents are available", body: "Connected runtime agents will appear here.")
          }
          ForEach(model.filteredAgentOpsStates) { state in
            AgentOpsAgentRow(
              state: state, selected: model.selectedAgentOpsState?.agentId == state.agentId)
          }
        }
      }
      HStack(spacing: 8) {
        Button("Bounds") {
          model.toggleAgentOpsBounds()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help(model.agentOpsBoundsVisible ? "Hide AgentOps bounds" : "Show AgentOps bounds")
        Button("Paths") {
          model.toggleAgentOpsPaths()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help(model.agentOpsPathsVisible ? "Hide AgentOps paths" : "Show AgentOps paths")
        Button("Edit Layout") {
          model.toggleAgentOpsLayoutEditor()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Edit Layout")
      }
    }
    .sidebarPanelChrome()
  }
}

struct AgentOpsMiniStats: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    let snapshot = model.agentOpsSnapshot
    HStack(spacing: 8) {
      AgentOpsStatTile(title: "ACTIVE", value: "\(snapshot?.activeCount ?? 0)", tone: .green)
      AgentOpsStatTile(
        title: "WAITING", value: "\(snapshot?.waitingApprovalCount ?? 0)", tone: .amber)
      AgentOpsStatTile(title: "ERRORS", value: "\(snapshot?.errorCount ?? 0)", tone: .red)
    }
  }
}

struct AgentOpsStatTile: View {
  let title: String
  let value: String
  let tone: ComponentTone

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(tone.color)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(RCTheme.surfaceLevel2)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(tone.color.opacity(0.28)))
  }
}

struct AgentOpsAgentRow: View {
  @EnvironmentObject var model: AppViewModel
  let state: AgentOpsLiveAgentState
  let selected: Bool

  private var agentDisplayName: String {
    model.resolveAgentDisplayName(agentId: state.agentId, fallback: state.agentName)
  }

  var body: some View {
    Button {
      model.selectAgentOpsAgent(state)
    } label: {
      HStack(spacing: 10) {
        AgentAvatarView(
          name: agentDisplayName, avatarURL: model.agentAvatar(state.agentId), size: 34)
        VStack(alignment: .leading, spacing: 4) {
          Text(agentDisplayName)
            .font(.system(size: 13, weight: .semibold))
            .lineLimit(1)
          Text("\(state.visibleState.rawValue) - \(state.source.rawValue)")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer()
        StatusBadge(
          title: state.visibleState.rawValue, tone: agentOpsTone(state.visibleState),
          accessibilityLabelText: "Visible state \(state.visibleState.rawValue)")
      }
      .padding(10)
      .rcHoverFocusSurface(selected: selected)
    }
    .buttonStyle(.plain)
    .help("Select \(agentDisplayName)")
    .accessibilityLabel("Select AgentOps agent \(agentDisplayName)")
    .accessibilityValue(selected ? "Selected" : state.visibleState.rawValue)
  }
}

struct AgentOpsHQScreen: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 0) {
      AgentOpsHeader()
      GeometryReader { proxy in
        ZStack(alignment: .topLeading) {
          AgentOpsVisualSceneView()
          VStack(alignment: .leading, spacing: 10) {
            if model.agentOpsStatusVisible {
              AgentOpsStatusStrip()
                .frame(maxWidth: min(proxy.size.width - 36, 760))
            }
            Spacer()
            if model.agentOpsLayoutEditorVisible {
              AgentOpsLayoutEditorPanel()
                .frame(width: min(360, max(280, proxy.size.width * 0.34)))
            }
          }
          .padding(18)

        }
      }
    }
    .accessibilityLabel("AgentOps HQ")
  }
}

struct AgentOpsVisualSceneView: View {
  @EnvironmentObject var model: AppViewModel
  @State private var zoom: CGFloat = 1
  @State private var panOffset: CGSize = .zero
  @State private var dragStartOffset: CGSize?

  private let zoomStep: CGFloat = 0.18
  private let minimumZoom: CGFloat = 1
  private let maximumZoom: CGFloat = 3.2

  var body: some View {
    GeometryReader { proxy in
      let scene = model.agentOpsSceneSnapshot
      let floor =
        scene?.floors.first { $0.id == scene?.activeFloorId } ?? scene?.floors.first
        ?? agentOpsDefaultFloor()
      let bounds = floor.bounds
      let scale = agentOpsSceneScale(bounds: bounds, in: proxy.size, zoom: zoom)
      let clampedPan = agentOpsClampedPanOffset(
        panOffset, bounds: bounds, scale: scale, in: proxy.size)
      let offset = agentOpsSceneOffset(
        bounds: bounds, scale: scale, in: proxy.size, pan: clampedPan)
      let activeFloorId = floor.id
      let rooms = scene?.rooms.filter { $0.floorId == activeFloorId } ?? []
      let entities = model.filteredAgentOpsSceneEntities.filter { $0.floorId == activeFloorId }
      let agentEntities = entities.filter { $0.kind == .agent }
      let roomEntities = Dictionary(
        uniqueKeysWithValues: entities.filter { $0.kind == .room }.map { ($0.id, $0) })
      ZStack(alignment: .topLeading) {
        ZStack(alignment: .topLeading) {
          AgentOpsSceneBackdrop(floor: floor, bounds: bounds, scale: scale, offset: offset)
          if model.agentOpsPathsVisible, let scene {
            AgentOpsSceneConnections(
              connections: scene.connections,
              rooms: rooms,
              entities: agentEntities,
              scale: scale,
              offset: offset
            )
          }
          ForEach(rooms) { room in
            AgentOpsSceneRoomView(
              room: room,
              roomEntity: roomEntities["room-\(room.id)"],
              scale: scale,
              offset: offset,
              showBounds: model.agentOpsBoundsVisible
            )
          }
          ForEach(agentEntities) { entity in
            AgentOpsSceneEntityNode(entity: entity, scale: scale, offset: offset)
          }
          if model.agentOpsLayoutEditorVisible {
            AgentOpsLayoutEditorSceneOverlay(
              rooms: rooms,
              bounds: bounds,
              scale: scale,
              offset: offset
            )
          }
        }
        .coordinateSpace(name: "agentopsScene")
        .contentShape(Rectangle())
        .gesture(scenePanGesture(bounds: bounds, scale: scale, size: proxy.size))
        .simultaneousGesture(
          SpatialTapGesture()
            .onEnded { value in
              guard model.agentOpsLayoutEditorVisible, model.agentOpsLayoutPathAddMode else {
                return
              }
              let point = agentOpsImagePoint(
                value.location,
                bounds: bounds,
                scale: scale,
                offset: offset,
                snapToGrid: model.agentOpsLayoutSnapToGrid
              )
              model.addAgentOpsPathWaypoint(at: point)
            }
        )
        .onContinuousHover(coordinateSpace: .local) { phase in
          switch phase {
          case .active(let location):
            let point = agentOpsImagePoint(
              location,
              bounds: bounds,
              scale: scale,
              offset: offset,
              snapToGrid: model.agentOpsLayoutSnapToGrid
            )
            model.updateAgentOpsLayoutCursor(point)
          case .ended:
            model.updateAgentOpsLayoutCursor(nil)
          }
        }
        .onHover { hovering in
          if hovering {
            NSCursor.openHand.set()
          } else {
            NSCursor.arrow.set()
          }
        }

        AgentOpsSceneZoomControls(
          canZoomIn: zoom < maximumZoom,
          canZoomOut: zoom > minimumZoom,
          zoomIn: { setZoom(zoom + zoomStep, bounds: bounds, size: proxy.size) },
          zoomOut: { setZoom(zoom - zoomStep, bounds: bounds, size: proxy.size) }
        )
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .zIndex(20)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color(red: 0.06, green: 0.09, blue: 0.12))
      .clipped()
      .accessibilityLabel("AgentOps native visual scene")
    }
  }

  private func scenePanGesture(bounds: AgentOpsVisualRect, scale: CGFloat, size: CGSize)
    -> some Gesture
  {
    DragGesture(minimumDistance: 1)
      .onChanged { value in
        NSCursor.closedHand.set()
        let start =
          dragStartOffset
          ?? agentOpsClampedPanOffset(panOffset, bounds: bounds, scale: scale, in: size)
        dragStartOffset = start
        let next = CGSize(
          width: start.width + value.translation.width,
          height: start.height + value.translation.height
        )
        panOffset = agentOpsClampedPanOffset(next, bounds: bounds, scale: scale, in: size)
      }
      .onEnded { _ in
        dragStartOffset = nil
        panOffset = agentOpsClampedPanOffset(panOffset, bounds: bounds, scale: scale, in: size)
        NSCursor.openHand.set()
      }
  }

  private func setZoom(_ nextZoom: CGFloat, bounds: AgentOpsVisualRect, size: CGSize) {
    let boundedZoom = min(max(nextZoom, minimumZoom), maximumZoom)
    zoom = boundedZoom
    let nextScale = agentOpsSceneScale(bounds: bounds, in: size, zoom: boundedZoom)
    panOffset = agentOpsClampedPanOffset(panOffset, bounds: bounds, scale: nextScale, in: size)
  }
}

struct AgentOpsSceneZoomControls: View {
  let canZoomIn: Bool
  let canZoomOut: Bool
  let zoomIn: () -> Void
  let zoomOut: () -> Void

  var body: some View {
    VStack(spacing: 8) {
      Button(action: zoomIn) {
        Image(systemName: "plus.magnifyingglass")
      }
      .buttonStyle(IconButtonStyle())
      .help("Zoom in")
      .accessibilityLabel("Zoom in AgentOps floor")
      .disabled(!canZoomIn)

      Button(action: zoomOut) {
        Image(systemName: "minus.magnifyingglass")
      }
      .buttonStyle(IconButtonStyle())
      .help("Zoom out")
      .accessibilityLabel("Zoom out AgentOps floor")
      .disabled(!canZoomOut)
    }
  }
}

struct AgentOpsSceneBackdrop: View {
  let floor: AgentOpsVisualFloor?
  let bounds: AgentOpsVisualRect
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    ZStack(alignment: .topLeading) {
      Color(red: 0.06, green: 0.09, blue: 0.12)
      if let image = agentOpsFloorImage(floor) {
        Image(nsImage: image)
          .resizable()
          .interpolation(.high)
          .frame(width: CGFloat(bounds.width) * scale, height: CGFloat(bounds.height) * scale)
          .position(
            x: offset.x + CGFloat(bounds.width) * scale / 2,
            y: offset.y + CGFloat(bounds.height) * scale / 2
          )
          .accessibilityHidden(true)
      } else {
        LinearGradient(
          colors: [
            Color(red: 0.06, green: 0.09, blue: 0.12),
            Color(red: 0.08, green: 0.13, blue: 0.15),
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      }
    }
  }
}

struct AgentOpsSceneRoomView: View {
  @EnvironmentObject var model: AppViewModel
  let room: AgentOpsVisualRoom
  let roomEntity: AgentOpsVisualEntity?
  let scale: CGFloat
  let offset: CGPoint
  let showBounds: Bool

  var body: some View {
    let rect = agentOpsSceneRect(room.bounds, scale: scale, offset: offset)
    let selected = roomEntity?.selected ?? false
    Button {
      if let roomEntity {
        model.selectAgentOpsEntity(roomEntity)
      }
    } label: {
      ZStack(alignment: .topLeading) {
        RoundedRectangle(cornerRadius: 4)
          .fill(
            (showBounds || selected)
              ? agentOpsTone(room.status).color.opacity(selected ? 0.20 : 0.08) : Color.clear)
        RoundedRectangle(cornerRadius: 4)
          .stroke(
            (showBounds || selected)
              ? agentOpsTone(room.status).color.opacity(selected ? 0.88 : 0.42) : Color.clear,
            lineWidth: selected ? 2 : 1)
        if showBounds || selected {
          VStack(alignment: .leading, spacing: 4) {
            Text(room.title)
              .font(.system(size: 10, weight: .bold))
              .lineLimit(1)
              .foregroundStyle(RCTheme.text)
            Text("\(room.zone) · \(room.agentCount)")
              .font(.system(size: 8, weight: .bold))
              .foregroundStyle(RCTheme.muted)
              .lineLimit(1)
          }
          .padding(6)
        }
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .frame(width: rect.width, height: rect.height, alignment: .topLeading)
    .position(x: rect.midX, y: rect.midY)
    .help("Select room \(room.title)")
    .accessibilityLabel(
      "AgentOps room \(room.title), \(room.status.rawValue), \(room.agentCount) agents")
  }
}

struct AgentOpsSceneConnections: View {
  let connections: [AgentOpsVisualConnection]
  let rooms: [AgentOpsVisualRoom]
  let entities: [AgentOpsVisualEntity]
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    let roomMap = Dictionary(uniqueKeysWithValues: rooms.map { ($0.id, $0) })
    let entityMap = Dictionary(uniqueKeysWithValues: entities.map { ($0.id, $0) })
    Path { path in
      for connection in connections {
        guard let entity = entityMap[connection.fromEntityId],
          let room = roomMap[connection.toRoomId]
        else { continue }
        let rawPoints =
          connection.waypoints ?? [
            entity.position,
            AgentOpsVisualPoint(x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + 30),
          ]
        let points = rawPoints.map { agentOpsScenePoint($0, scale: scale, offset: offset) }
        guard let first = points.first else { continue }
        path.move(to: first)
        for point in points.dropFirst() {
          path.addLine(to: point)
        }
      }
    }
    .stroke(RCTheme.accentGreen.opacity(0.32), style: StrokeStyle(lineWidth: 1.2, dash: [6, 6]))
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityLabel("AgentOps source-backed room assignment paths")
  }
}

struct AgentOpsSceneEntityNode: View {
  @EnvironmentObject var model: AppViewModel
  let entity: AgentOpsVisualEntity
  let scale: CGFloat
  let offset: CGPoint

  private var title: String {
    model.resolveAgentDisplayName(agentId: entity.agentId, fallback: entity.title)
  }

  private var accessibilityLabel: String {
    guard entity.kind == .agent else { return entity.accessibilityLabel }
    return "Agent \(title), \(entity.state.rawValue), source \(entity.source.rawValue)"
  }

  var body: some View {
    let point = agentOpsScenePoint(entity.position, scale: scale, offset: offset)
    let spriteSize = max(22, min(48, 64 * scale * CGFloat(entity.spriteScale ?? 0.75)))
    Button {
      model.selectAgentOpsEntity(entity)
    } label: {
      ZStack(alignment: .bottomTrailing) {
        ZStack {
          if let image = agentOpsSpriteImage(entity) {
            Image(nsImage: image)
              .resizable()
              .interpolation(.none)
              .frame(width: spriteSize, height: spriteSize)
              .opacity(entity.visualFallbackOnly ? 0.72 : 1)
              .shadow(color: Color.black.opacity(0.45), radius: 4, x: 0, y: 2)
          } else {
            Circle()
              .fill(
                agentOpsTone(entity.state).color.opacity(entity.visualFallbackOnly ? 0.36 : 0.9)
              )
              .frame(width: spriteSize * 0.72, height: spriteSize * 0.72)
            Text(title.prefix(1).uppercased())
              .font(.system(size: max(10, spriteSize * 0.26), weight: .black))
              .foregroundStyle(Color.black.opacity(0.78))
          }
          Circle()
            .stroke(
              agentOpsTone(entity.state).color.opacity(0.9), lineWidth: entity.selected ? 2.4 : 1.2
            )
            .frame(
              width: spriteSize + (entity.selected ? 10 : 6),
              height: spriteSize + (entity.selected ? 10 : 6))
        }
        Circle()
          .fill(agentOpsTone(entity.state).color)
          .frame(width: 8, height: 8)
          .overlay(Circle().stroke(Color.black.opacity(0.45), lineWidth: 1))
      }
      .frame(width: spriteSize + 16, height: spriteSize + 16)
      .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .help(accessibilityLabel)
    .accessibilityLabel(accessibilityLabel)
    .position(x: point.x, y: point.y)
  }
}

struct AgentOpsLayoutEditorSceneOverlay: View {
  @EnvironmentObject var model: AppViewModel
  let rooms: [AgentOpsVisualRoom]
  let bounds: AgentOpsVisualRect
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    ZStack(alignment: .topLeading) {
      if model.agentOpsLayoutShowPathNetwork {
        AgentOpsEditablePathNetworkView(bounds: bounds, scale: scale, offset: offset)
      }
      ForEach(rooms) { room in
        AgentOpsRoomAnchorOverlay(room: room, bounds: bounds, scale: scale, offset: offset)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .opacity(model.agentOpsLayoutOverlayOpacity)
    .accessibilityLabel("AgentOps editable paths and room anchors")
  }
}

struct AgentOpsEditablePathNetworkView: View {
  @EnvironmentObject var model: AppViewModel
  let bounds: AgentOpsVisualRect
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    let waypointMap = Dictionary(
      uniqueKeysWithValues: model.agentOpsLayoutPathWaypoints.map { ($0.id, $0) })
    ZStack(alignment: .topLeading) {
      ForEach(model.agentOpsLayoutPathEdges) { edge in
        if let from = waypointMap[edge.from], let to = waypointMap[edge.to] {
          AgentOpsEditablePathEdge(
            edge: edge,
            from: from.position,
            to: to.position,
            scale: scale,
            offset: offset
          )
        }
      }
      ForEach(model.agentOpsLayoutPathWaypoints) { waypoint in
        AgentOpsEditableWaypointNode(
          waypoint: waypoint,
          bounds: bounds,
          scale: scale,
          offset: offset
        )
      }
    }
  }
}

struct AgentOpsEditablePathEdge: View {
  @EnvironmentObject var model: AppViewModel
  let edge: AgentOpsLayoutEdge
  let from: AgentOpsVisualPoint
  let to: AgentOpsVisualPoint
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    let start = agentOpsScenePoint(from, scale: scale, offset: offset)
    let end = agentOpsScenePoint(to, scale: scale, offset: offset)
    let mid = CGPoint(x: (start.x + end.x) / 2, y: (start.y + end.y) / 2)
    let dx = end.x - start.x
    let dy = end.y - start.y
    let length = max(1, hypot(dx, dy))
    let angle = Angle(radians: atan2(dy, dx))
    let selected = model.agentOpsLayoutSelectedPathItem == .edge(edge.id)
    ZStack(alignment: .topLeading) {
      Path { path in
        path.move(to: start)
        path.addLine(to: end)
      }
      .stroke(
        agentOpsPathColor(edge.tags).opacity(selected ? 0.98 : 0.68),
        style: StrokeStyle(
          lineWidth: selected ? 4 : 2.4, lineCap: .round,
          dash: edge.tags.contains(.idle) ? [7, 5] : []))

      Rectangle()
        .fill(Color.clear)
        .contentShape(Rectangle())
        .frame(width: length, height: 18)
        .position(mid)
        .rotationEffect(angle)
        .onTapGesture {
          model.selectAgentOpsPathEdge(edge.id)
        }
        .accessibilityLabel("AgentOps path edge \(edge.id)")
    }
  }
}

struct AgentOpsEditableWaypointNode: View {
  @EnvironmentObject var model: AppViewModel
  let waypoint: AgentOpsLayoutWaypoint
  let bounds: AgentOpsVisualRect
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    let point = agentOpsScenePoint(waypoint.position, scale: scale, offset: offset)
    let selected = model.agentOpsLayoutSelectedPathItem == .waypoint(waypoint.id)
    Circle()
      .fill(agentOpsPathColor(waypoint.tags))
      .frame(width: selected ? 14 : 11, height: selected ? 14 : 11)
      .overlay(Circle().stroke(Color.black.opacity(0.74), lineWidth: 1.4))
      .overlay(
        Circle().stroke(Color.white.opacity(selected ? 0.9 : 0.32), lineWidth: selected ? 2 : 1)
      )
      .position(point)
      .contentShape(Circle())
      .onTapGesture {
        model.selectAgentOpsPathWaypoint(waypoint.id)
      }
      .gesture(
        DragGesture(minimumDistance: 1, coordinateSpace: .named("agentopsScene"))
          .onChanged { value in
            let point = agentOpsImagePoint(
              value.location,
              bounds: bounds,
              scale: scale,
              offset: offset,
              snapToGrid: model.agentOpsLayoutSnapToGrid
            )
            model.moveAgentOpsPathWaypoint(waypoint.id, to: point)
          }
      )
      .help("Waypoint \(waypoint.id)")
      .accessibilityLabel("AgentOps waypoint \(waypoint.id)")
  }
}

struct AgentOpsRoomAnchorOverlay: View {
  @EnvironmentObject var model: AppViewModel
  let room: AgentOpsVisualRoom
  let bounds: AgentOpsVisualRect
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    ZStack(alignment: .topLeading) {
      ForEach(AgentOpsLayoutAnchorGroup.allCases) { group in
        if model.agentOpsLayoutAnchorVisibility.contains(group) {
          let points = agentOpsAnchorPoints(room: room, group: group)
          ForEach(Array(points.enumerated()), id: \.offset) { index, point in
            AgentOpsRoomAnchorNode(
              roomId: room.id,
              group: group,
              index: index,
              point: point,
              bounds: bounds,
              scale: scale,
              offset: offset
            )
          }
        }
      }
    }
  }
}

struct AgentOpsRoomAnchorNode: View {
  @EnvironmentObject var model: AppViewModel
  let roomId: RelayId
  let group: AgentOpsLayoutAnchorGroup
  let index: Int
  let point: AgentOpsVisualPoint
  let bounds: AgentOpsVisualRect
  let scale: CGFloat
  let offset: CGPoint

  var body: some View {
    let scenePoint = agentOpsScenePoint(point, scale: scale, offset: offset)
    let selected =
      model.agentOpsLayoutSelectedAnchor
      == AgentOpsLayoutAnchorSelection(roomId: roomId, group: group, index: index)
    agentOpsAnchorShape(group: group)
      .fill(agentOpsAnchorColor(group).opacity(selected ? 1 : 0.82))
      .frame(width: selected ? 15 : 11, height: selected ? 15 : 11)
      .overlay(agentOpsAnchorShape(group: group).stroke(Color.black.opacity(0.72), lineWidth: 1.2))
      .overlay(
        agentOpsAnchorShape(group: group).stroke(
          Color.white.opacity(selected ? 0.92 : 0.26), lineWidth: selected ? 2 : 1)
      )
      .position(scenePoint)
      .contentShape(Rectangle())
      .onTapGesture {
        model.selectAgentOpsAnchor(roomId: roomId, group: group, index: index)
      }
      .gesture(
        DragGesture(minimumDistance: 1, coordinateSpace: .named("agentopsScene"))
          .onChanged { value in
            let nextPoint = agentOpsImagePoint(
              value.location,
              bounds: bounds,
              scale: scale,
              offset: offset,
              snapToGrid: model.agentOpsLayoutSnapToGrid
            )
            let selection = AgentOpsLayoutAnchorSelection(
              roomId: roomId, group: group, index: index)
            model.moveAgentOpsAnchor(selection, to: nextPoint)
          }
      )
      .help("\(group.title) anchor \(index + 1)")
      .accessibilityLabel("AgentOps \(group.title) anchor \(index + 1)")
  }
}

struct AgentOpsLayoutEditorPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    let scene = model.agentOpsSceneSnapshot
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Layout Editor")
          .font(.system(size: 14, weight: .semibold))
        Spacer()
        Button("Exit") {
          model.toggleAgentOpsLayoutEditor()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Exit edit mode")
      }
      Text("Coordinates are image pixels on \(scene?.activeFloorId ?? "floor-business").")
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(RCTheme.muted)
      if let point = model.agentOpsLayoutCursorPoint {
        Text("Cursor \(Int(point.x)), \(Int(point.y))")
          .font(.system(size: 10, weight: .bold, design: .monospaced))
          .foregroundStyle(RCTheme.muted)
      }
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          HStack(spacing: 8) {
            AgentOpsEditorToggleButton(
              title: "Snap grid", active: model.agentOpsLayoutSnapToGrid,
              action: model.toggleAgentOpsLayoutSnapGrid)
            AgentOpsEditorToggleButton(
              title: "Labels", active: model.agentOpsLayoutLabelsVisible,
              action: model.toggleAgentOpsLayoutLabels)
            AgentOpsEditorToggleButton(
              title: "Show paths", active: model.agentOpsLayoutShowPathNetwork,
              action: model.toggleAgentOpsLayoutShowPathNetwork)
          }

          AgentOpsPathNetworkEditor()
          AgentOpsAnchorVisibilityEditor()
          AgentOpsSelectedRoomEditor()

          VStack(alignment: .leading, spacing: 6) {
            Text("Overlay opacity")
              .font(.system(size: 11, weight: .bold))
            Slider(value: $model.agentOpsLayoutOverlayOpacity, in: 0.2...1.0)
              .help("Overlay opacity")
          }

          VStack(alignment: .leading, spacing: 6) {
            Text("Path Network")
              .font(.system(size: 11, weight: .bold))
            Text(
              scene?.layoutPersistenceStatus
                ?? "web_default_operations_floor_layout_source_record_backed"
            )
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(2)
            HStack(spacing: 8) {
              AgentOpsEditorMetric(
                label: "points", value: "\(model.agentOpsLayoutPathWaypoints.count)")
              AgentOpsEditorMetric(label: "lines", value: "\(model.agentOpsLayoutPathEdges.count)")
            }
          }

          if let status = model.agentOpsLayoutStatus {
            Text(status)
              .font(.system(size: 10, weight: .bold))
              .foregroundStyle(RCTheme.accentGreen)
              .lineLimit(1)
          }
        }
      }
      .frame(maxHeight: 520)

      HStack(spacing: 8) {
        Button("Copy") {
          model.copyAgentOpsLayoutJSON()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Copy layout JSON")
        Button("Save") {
          model.saveAgentOpsLayoutDraft()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Save local AgentOps layout draft")
        Button("Reset") {
          model.resetAgentOpsLayoutDraft()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .help("Reset local AgentOps layout draft")
      }
    }
    .padding(14)
    .background(RCTheme.sidebarSurface.opacity(0.94))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    .accessibilityLabel("AgentOps Layout Editor")
  }
}

struct AgentOpsPathNetworkEditor: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Path Network")
        .font(.system(size: 11, weight: .bold))
      HStack(spacing: 8) {
        AgentOpsEditorToggleButton(
          title: "Edit paths", active: model.agentOpsLayoutPathEditing,
          action: model.toggleAgentOpsLayoutPathEditing)
        AgentOpsEditorToggleButton(
          title: "Add on map", active: model.agentOpsLayoutPathAddMode,
          action: model.toggleAgentOpsLayoutPathAddMode)
        Button("Add at cursor") {
          model.addAgentOpsPathWaypointAtCursor()
        }
        .buttonStyle(SecondaryLightButtonStyle())
        .disabled(model.agentOpsLayoutCursorPoint == nil)
        .help("Add waypoint at cursor")
      }
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6)
      {
        ForEach(AgentOpsLayoutPathTag.allCases) { tag in
          AgentOpsEditorTagButton(
            title: tag.title,
            active: model.agentOpsLayoutActivePathTags.contains(tag),
            color: agentOpsPathColor([tag])
          ) {
            model.toggleAgentOpsLayoutPathTag(tag)
          }
        }
      }
      AgentOpsSelectedPathEditor()
    }
    .padding(10)
    .background(Color.black.opacity(0.16))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft.opacity(0.8)))
  }
}

struct AgentOpsSelectedPathEditor: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    if let label = model.selectedAgentOpsPathLabel {
      VStack(alignment: .leading, spacing: 8) {
        Text("Selected Path")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(RCTheme.muted)
        Text(label)
          .font(.system(size: 10, weight: .bold, design: .monospaced))
          .foregroundStyle(RCTheme.text)
          .lineLimit(2)
        LazyVGrid(
          columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 3), spacing: 5
        ) {
          ForEach(AgentOpsLayoutPathTag.allCases) { tag in
            AgentOpsEditorTagButton(
              title: tag.title,
              active: selectedTags.contains(tag),
              color: agentOpsPathColor([tag])
            ) {
              var tags = selectedTags
              if tags.contains(tag) {
                tags.remove(tag)
              } else {
                tags.insert(tag)
              }
              model.setSelectedAgentOpsPathTags(tags)
            }
          }
        }
        HStack(spacing: 8) {
          Button(connectLabel) {
            model.toggleAgentOpsPathConnectFromSelected()
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(!selectedWaypoint)
          Button(deleteLabel) {
            model.deleteSelectedAgentOpsLayoutItem()
          }
          .buttonStyle(SecondaryLightButtonStyle())
        }
      }
      .padding(8)
      .background(Color.black.opacity(0.12))
      .clipShape(RoundedRectangle(cornerRadius: 4))
    }
  }

  private var selectedWaypoint: Bool {
    if case .waypoint = model.agentOpsLayoutSelectedPathItem { return true }
    return false
  }

  private var selectedTags: Set<AgentOpsLayoutPathTag> {
    guard let selection = model.agentOpsLayoutSelectedPathItem else { return [] }
    switch selection {
    case .waypoint(let id):
      return model.agentOpsLayoutPathWaypoints.first { $0.id == id }?.tags ?? []
    case .edge(let id):
      return model.agentOpsLayoutPathEdges.first { $0.id == id }?.tags ?? []
    }
  }

  private var connectLabel: String {
    guard case .waypoint(let id) = model.agentOpsLayoutSelectedPathItem else {
      return "Connect from this"
    }
    return model.agentOpsLayoutPathConnectFromId == id ? "Stop connecting" : "Connect from this"
  }

  private var deleteLabel: String {
    if case .edge = model.agentOpsLayoutSelectedPathItem {
      return "Disconnect edge"
    }
    return "Delete selected"
  }
}

struct AgentOpsAnchorVisibilityEditor: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Anchor Visibility")
        .font(.system(size: 11, weight: .bold))
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 2), spacing: 6)
      {
        ForEach(AgentOpsLayoutAnchorGroup.allCases) { group in
          AgentOpsEditorTagButton(
            title: group.title,
            active: model.agentOpsLayoutAnchorVisibility.contains(group),
            color: agentOpsAnchorColor(group)
          ) {
            model.toggleAgentOpsLayoutAnchorVisibility(group)
          }
        }
      }
      Text("Add Anchor At Cursor")
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 2), spacing: 6)
      {
        ForEach(AgentOpsLayoutAnchorGroup.allCases) { group in
          Button(group.title) {
            model.addAgentOpsAnchor(group)
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.selectedAgentOpsRoom == nil || model.agentOpsLayoutCursorPoint == nil)
          .help("Add \(group.title) anchor at cursor")
        }
      }
      if let selected = model.selectedAgentOpsAnchorLabel {
        HStack(spacing: 8) {
          Text(selected)
            .font(.system(size: 10, weight: .bold, design: .monospaced))
            .foregroundStyle(RCTheme.text)
            .lineLimit(1)
          Spacer()
          Button("Delete selected anchor") {
            model.deleteSelectedAgentOpsLayoutItem()
          }
          .buttonStyle(SecondaryLightButtonStyle())
        }
      }
    }
    .padding(10)
    .background(Color.black.opacity(0.16))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft.opacity(0.8)))
  }
}

struct AgentOpsSelectedRoomEditor: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(model.selectedAgentOpsRoom?.title ?? "No room selected")
        .font(.system(size: 11, weight: .bold))
        .lineLimit(1)
      if let room = model.selectedAgentOpsRoom {
        LazyVGrid(
          columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6
        ) {
          AgentOpsEditorMetric(label: "entry", value: "\(room.entryAnchors?.count ?? 0)")
          AgentOpsEditorMetric(label: "desk", value: "\(room.workstationAnchors?.count ?? 0)")
          AgentOpsEditorMetric(label: "screen", value: "\(room.screenAnchors?.count ?? 0)")
          AgentOpsEditorMetric(label: "idle", value: "\(room.idleAnchors?.count ?? 0)")
          AgentOpsEditorMetric(label: "light", value: "\(room.lightAnchors?.count ?? 0)")
          AgentOpsEditorMetric(label: "agents", value: "\(room.agentCount)")
        }
      }
    }
    .padding(10)
    .background(Color.black.opacity(0.16))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft.opacity(0.8)))
  }
}

struct AgentOpsEditorToggleButton: View {
  let title: String
  let active: Bool
  let action: () -> Void

  var body: some View {
    Button(title) {
      action()
    }
    .buttonStyle(SecondaryLightButtonStyle())
    .foregroundStyle(active ? RCTheme.accentGreen : RCTheme.muted)
    .help(title)
    .accessibilityLabel(title)
  }
}

struct AgentOpsEditorTagButton: View {
  let title: String
  let active: Bool
  let color: Color
  let action: () -> Void

  var body: some View {
    Button {
      action()
    } label: {
      HStack(spacing: 5) {
        Circle()
          .fill(color)
          .frame(width: 7, height: 7)
        Text(title)
          .font(.system(size: 10, weight: .bold))
          .lineLimit(1)
          .minimumScaleFactor(0.72)
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(SecondaryLightButtonStyle())
    .foregroundStyle(active ? RCTheme.text : RCTheme.muted)
    .opacity(active ? 1 : 0.58)
    .help(title)
    .accessibilityLabel(title)
  }
}

struct AgentOpsEditorMetric: View {
  let label: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label.uppercased())
        .font(.system(size: 8, weight: .black))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.system(size: 13, weight: .black))
        .foregroundStyle(RCTheme.text)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(7)
    .background(Color.black.opacity(0.12))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft.opacity(0.55)))
  }
}

struct AgentOpsHeader: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    HStack(spacing: 12) {
      Spacer()
      StatusBadge(title: "Live mode", tone: .green, accessibilityLabelText: "AgentOps live mode")
      AgentOpsToggleButton(
        icon: model.agentOpsStatusVisible ? "eye.slash" : "eye",
        help: model.agentOpsStatusVisible ? "Hide AgentOps status" : "Show AgentOps status",
        action: model.toggleAgentOpsStatus
      )
      AgentOpsToggleButton(
        icon: model.agentOpsBoundsVisible ? "rectangle.dashed" : "rectangle",
        help: model.agentOpsBoundsVisible ? "Hide AgentOps bounds" : "Show AgentOps bounds",
        action: model.toggleAgentOpsBounds
      )
      AgentOpsToggleButton(
        icon: "point.topleft.down.curvedto.point.bottomright.up",
        help: model.agentOpsPathsVisible ? "Hide AgentOps paths" : "Show AgentOps paths",
        action: model.toggleAgentOpsPaths
      )
      AgentOpsToggleButton(
        icon: "slider.horizontal.3",
        help: model.agentOpsLayoutEditorVisible ? "Exit edit mode" : "Edit Layout",
        action: model.toggleAgentOpsLayoutEditor
      )
      Button {
        model.refreshAgentOps()
      } label: {
        Image(systemName: "arrow.clockwise")
      }
      .buttonStyle(IconButtonStyle())
      .help("Refresh")
      .accessibilityLabel("Refresh AgentOps live state")
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 9)
    .background(RCTheme.surfaceLevel0)
    .overlay(alignment: .bottom) {
      Rectangle().fill(RCTheme.borderLow.opacity(0.45)).frame(height: 1)
    }
  }
}

struct AgentOpsToggleButton: View {
  let icon: String
  let help: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: icon)
    }
    .buttonStyle(IconButtonStyle())
    .help(help)
    .accessibilityLabel(help)
  }
}

struct AgentOpsStatusStrip: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    if model.agentOpsStatusVisible {
      let snapshot = model.agentOpsSnapshot
      HStack(spacing: 10) {
        AgentOpsMetric(title: "Agents", value: "\(snapshot?.agents.count ?? 0)", tone: .blue)
        AgentOpsMetric(title: "Active", value: "\(snapshot?.activeCount ?? 0)", tone: .green)
        AgentOpsMetric(
          title: "Waiting", value: "\(snapshot?.waitingApprovalCount ?? 0)", tone: .amber)
        AgentOpsMetric(title: "Errors", value: "\(snapshot?.errorCount ?? 0)", tone: .red)
        AgentOpsMetric(
          title: "Fallbacks", value: "\(snapshot?.visualFallbackCount ?? 0)", tone: .purple)
        AgentOpsMetric(
          title: "Refreshed", value: snapshot.map { relativeTime($0.refreshedAt) } ?? "not loaded",
          tone: .neutral)
      }
    }
  }
}

struct AgentOpsMetric: View {
  let title: String
  let value: String
  let tone: ComponentTone

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      Text(title)
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.system(size: 17, weight: .semibold))
        .foregroundStyle(tone.color)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(12)
    .background(RCTheme.sidebarSurface)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(tone.color.opacity(0.26)))
  }
}

struct AgentOpsFact: View {
  let label: String
  let value: String

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label)
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(RCTheme.muted)
      Text(value)
        .font(.system(size: 12, weight: .semibold))
        .lineLimit(2)
        .foregroundStyle(RCTheme.text)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }
}
