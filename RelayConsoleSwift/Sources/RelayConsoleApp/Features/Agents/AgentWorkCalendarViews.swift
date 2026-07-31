import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct AgentWorkCalendarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var sortedRows: [AgentWorkCalendarAgentRow] {
    sortedCalendarRows(
      model.agentWorkCalendar?.rows ?? [], sortMode: model.selectedCalendarSortMode)
  }

  var calendarDays: [AgentWorkCalendarDay] {
    model.agentWorkCalendar?.rows.first?.days ?? []
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      NativeGroupedSection {
        AgentThemedCard(tint: RCTheme.accentBlue) {
          HStack(alignment: .center, spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
              WorkCalendarSortMenu(
                selection: model.selectedCalendarSortMode,
                onSelect: { model.selectCalendarSortMode($0) }
              )
              .frame(width: WorkCalendarLayout.sortPickerWidth, alignment: .leading)
              WorkCalendarGroupFilterButtons(
                selection: model.selectedCalendarGroup,
                onSelect: { model.selectCalendarGroup($0) }
              )
              .frame(width: WorkCalendarLayout.groupPickerWidth, alignment: .leading)
            }
            Spacer()
            StatusBadge(
              title: "\(sortedRows.count)", tone: .blue,
              accessibilityLabelText: "\(sortedRows.count) work rows")
          }
        }
      }

      if model.loading {
        LoadingView(title: "Loading work calendar...")
      } else if model.agentWorkCalendar == nil {
        EmptyMini(
          title: "Could not load the agent work calendar.", body: "Refresh Relay Console to retry.")
      } else if sortedRows.isEmpty {
        EmptyMini(
          title: "No agent work in this range",
          body: "Agent chat activity for the selected group and date range will appear here.")
      } else {
        NativeGroupedSection {
          WorkCalendarGrid(rows: sortedRows, days: calendarDays)
        }
      }
    }
  }
}

enum WorkCalendarLayout {
  static let agentWidth: CGFloat = 220
  static let sortPickerWidth: CGFloat = 188
  static let totalWidth: CGFloat = 110
  static let dayWidth: CGFloat = 84
  static let rowHeight: CGFloat = 48
  static let headerHeight: CGFloat = 30
  static let columnSpacing: CGFloat = 6
  static let timelineInset: CGFloat = 8
  static let groupPickerWidth: CGFloat = 340
}

struct WorkCalendarSortMenu: View {
  var selection: AgentWorkCalendarSortMode
  var onSelect: (AgentWorkCalendarSortMode) -> Void

  var body: some View {
    StyledToolbarDropdown(
      title: "Sort calendar",
      selection: Binding(
        get: { selection },
        set: { onSelect($0) }
      ),
      options: AgentWorkCalendarSortMode.allCases.map {
        StyledToolbarDropdownOption(
          value: $0, title: $0.title, icon: $0.systemImage, tint: $0.tint, detail: $0.detail)
      },
      fallbackTitle: selection.title,
      fallbackIcon: selection.systemImage,
      fallbackTint: RCTheme.accentBlue,
      popoverWidth: 292
    )
    .help("Sort agent work calendar")
    .accessibilityLabel("Sort work calendar by \(selection.title)")
  }
}

struct StyledToolbarDropdownOption<Value: Hashable>: Identifiable {
  var value: Value
  var title: String
  var icon: String
  var tint: Color
  var detail: String? = nil

  var id: String { "\(value)" }
}

struct StyledToolbarDropdown<Value: Hashable>: View {
  var title: String
  @Binding var selection: Value
  var options: [StyledToolbarDropdownOption<Value>]
  var fallbackTitle: String
  var fallbackIcon: String
  var fallbackTint: Color = RCTheme.accentBlue
  var popoverWidth: CGFloat = 292
  @State private var isOpen = false

  private var selectedOption: StyledToolbarDropdownOption<Value> {
    options.first { $0.value == selection }
      ?? StyledToolbarDropdownOption(
        value: selection,
        title: fallbackTitle,
        icon: fallbackIcon,
        tint: fallbackTint
      )
  }

  var body: some View {
    Button {
      isOpen.toggle()
    } label: {
      HStack(spacing: 6) {
        Image(systemName: selectedOption.icon)
          .font(.system(size: 12, weight: .semibold))
          .frame(width: 14)
        Text(selectedOption.title)
          .font(.system(size: 12, weight: .semibold))
          .lineLimit(1)
          .fixedSize(horizontal: true, vertical: false)
        Image(systemName: "chevron.down")
          .font(.system(size: 10, weight: .bold))
          .padding(.leading, 2)
      }
    }
    .buttonStyle(
      AgentFileToolbarButtonStyle(
        role: .normal,
        isActive: true,
        tint: selectedOption.tint
      )
    )
    .popover(isPresented: $isOpen, arrowEdge: .bottom) {
      StyledToolbarDropdownPopover(
        title: title,
        selection: $selection,
        options: options
      ) {
        isOpen = false
      }
      .frame(width: popoverWidth)
    }
  }
}

struct StyledToolbarDropdownPopover<Value: Hashable>: View {
  var title: String
  @Binding var selection: Value
  var options: [StyledToolbarDropdownOption<Value>]
  var onSelect: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.caption.weight(.bold))
        .foregroundStyle(RCTheme.muted)
        .padding(.horizontal, 4)

      VStack(spacing: 6) {
        ForEach(options) { option in
          StyledToolbarDropdownRow(
            option: option,
            selected: selection == option.value
          ) {
            selection = option.value
            onSelect()
          }
        }
      }
    }
    .padding(12)
    .background(RCTheme.sidebarSurface)
    .foregroundStyle(RCTheme.text)
  }
}

struct StyledToolbarDropdownRow<Value: Hashable>: View {
  var option: StyledToolbarDropdownOption<Value>
  var selected: Bool
  var onSelect: () -> Void

  var body: some View {
    Button {
      onSelect()
    } label: {
      HStack(spacing: 10) {
        Image(systemName: option.icon)
          .font(.system(size: 13, weight: .semibold))
          .frame(width: 18)
          .foregroundStyle(option.tint)
        VStack(alignment: .leading, spacing: 2) {
          Text(option.title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(RCTheme.text)
          if let detail = option.detail, !detail.isEmpty {
            Text(detail)
              .font(.caption2)
              .foregroundStyle(RCTheme.muted)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 8)
        if selected {
          Image(systemName: "checkmark")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(option.tint)
        }
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 9)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(selected ? option.tint.opacity(0.14) : RCTheme.surfaceInset.opacity(0.72))
      .clipShape(RoundedRectangle(cornerRadius: 6))
      .overlay(
        RoundedRectangle(cornerRadius: 6)
          .stroke(selected ? option.tint.opacity(0.52) : RCTheme.borderSoft.opacity(0.62))
      )
    }
    .buttonStyle(.plain)
    .accessibilityLabel(option.title)
    .accessibilityValue(selected ? "Selected" : "")
  }
}

struct WorkCalendarGroupFilterButtons: View {
  var selection: AgentWorkCalendarGroupFilter
  var onSelect: (AgentWorkCalendarGroupFilter) -> Void

  var body: some View {
    HStack(spacing: 8) {
      ForEach(AgentWorkCalendarGroupFilter.allCases) { filter in
        Button {
          onSelect(filter)
        } label: {
          HStack(spacing: 6) {
            Image(systemName: filter.systemImage)
              .font(.system(size: 12, weight: .semibold))
              .frame(width: 14)
            Text(filter.title)
              .font(.system(size: 12, weight: .semibold))
              .lineLimit(1)
              .fixedSize(horizontal: true, vertical: false)
          }
        }
        .buttonStyle(
          AgentFileToolbarButtonStyle(
            role: .normal,
            isActive: selection == filter,
            tint: filter.tint
          )
        )
        .help("Show \(filter.title.lowercased()) work calendar rows")
        .accessibilityLabel("\(filter.title) work calendar filter")
        .accessibilityAddTraits(selection == filter ? .isSelected : [])
      }
    }
  }
}

extension AgentWorkCalendarSortMode {
  fileprivate var systemImage: String {
    switch self {
    case .recentHours:
      return "clock.arrow.circlepath"
    case .rangeHours:
      return "chart.bar"
    case .name:
      return "person.crop.circle"
    }
  }

  fileprivate var tint: Color {
    switch self {
    case .recentHours:
      return RCTheme.accentBlue
    case .rangeHours:
      return RCTheme.accentGreen
    case .name:
      return RCTheme.accentPurple
    }
  }

  fileprivate var detail: String {
    switch self {
    case .recentHours:
      return "Agents with the most recent work first"
    case .rangeHours:
      return "Highest total hours in the visible date range"
    case .name:
      return "Agent names from A to Z"
    }
  }
}

extension AgentWorkCalendarGroupFilter {
  fileprivate var systemImage: String {
    switch self {
    case .all:
      return "square.grid.2x2"
    case .business:
      return "building.2"
    case .family:
      return "house"
    case .personal:
      return "person.crop.circle"
    }
  }

  fileprivate var tint: Color {
    switch self {
    case .all:
      return RCTheme.accentBlue
    case .business:
      return RCTheme.accentGreen
    case .family:
      return RCTheme.accentPurple
    case .personal:
      return RCTheme.accentAmber
    }
  }
}

struct WorkCalendarGrid: View {
  @EnvironmentObject var model: AppViewModel
  var rows: [AgentWorkCalendarAgentRow]
  var days: [AgentWorkCalendarDay]

  var body: some View {
    ScrollView(.vertical) {
      HStack(alignment: .top, spacing: 0) {
        VStack(alignment: .leading, spacing: 6) {
          WorkCalendarHeaderCell(
            title: "Agent", width: WorkCalendarLayout.agentWidth,
            height: WorkCalendarLayout.headerHeight, alignment: .leading)
          ForEach(rows) { row in
            WorkCalendarAgentCell(row: row)
              .frame(
                width: WorkCalendarLayout.agentWidth, height: WorkCalendarLayout.rowHeight,
                alignment: .leading)
          }
        }
        ScrollViewReader { proxy in
          ScrollView(.horizontal) {
            VStack(alignment: .leading, spacing: 6) {
              HStack(spacing: WorkCalendarLayout.columnSpacing) {
                ForEach(days) { day in
                  WorkCalendarDateHeader(day: day)
                    .frame(
                      width: WorkCalendarLayout.dayWidth, height: WorkCalendarLayout.headerHeight
                    )
                    .id(dayScrollId(day))
                }
              }
              ForEach(rows) { row in
                HStack(spacing: WorkCalendarLayout.columnSpacing) {
                  ForEach(days) { day in
                    WorkCalendarCountCell(day: row.days.first { $0.date == day.date })
                      .frame(
                        width: WorkCalendarLayout.dayWidth, height: WorkCalendarLayout.rowHeight)
                  }
                }
              }
            }
            .frame(
              minWidth: max(
                CGFloat(days.count)
                  * (WorkCalendarLayout.dayWidth + WorkCalendarLayout.columnSpacing), 760),
              alignment: .leading
            )
            .padding(.horizontal, WorkCalendarLayout.timelineInset)
          }
          .onAppear {
            scrollToLatestDay(proxy)
          }
          .onChange(of: latestDayScrollId) { _, _ in
            scrollToLatestDay(proxy)
          }
        }
        VStack(alignment: .trailing, spacing: 6) {
          WorkCalendarHeaderCell(
            title: "TOTAL", width: WorkCalendarLayout.totalWidth,
            height: WorkCalendarLayout.headerHeight, alignment: .trailing)
          ForEach(rows) { row in
            WorkCalendarTotalCell(row: row)
              .frame(
                width: WorkCalendarLayout.totalWidth, height: WorkCalendarLayout.rowHeight,
                alignment: .trailing)
          }
        }
      }
    }
    .frame(maxHeight: 540)
    .accessibilityLabel("Work calendar grid")
  }

  private var latestDayScrollId: String? {
    days.last.map(dayScrollId)
  }

  private func dayScrollId(_ day: AgentWorkCalendarDay) -> String {
    "work-calendar-day-\(day.date)"
  }

  private func scrollToLatestDay(_ proxy: ScrollViewProxy) {
    guard let latestDayScrollId else { return }
    Task { @MainActor in
      await Task.yield()
      proxy.scrollTo(latestDayScrollId, anchor: .trailing)
    }
  }
}

struct WorkCalendarHeaderCell: View {
  var title: String
  var width: CGFloat
  var height: CGFloat
  var alignment: Alignment

  var body: some View {
    Text(title)
      .font(.caption.weight(.semibold))
      .foregroundStyle(RCTheme.muted)
      .padding(.horizontal, 8)
      .frame(width: width, height: height, alignment: alignment)
      .background(RCTheme.surfaceLevel1.opacity(0.72))
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
  }
}

struct WorkCalendarDateHeader: View {
  var day: AgentWorkCalendarDay

  var body: some View {
    VStack(spacing: 1) {
      Text(shortCalendarDate(day.date))
        .font(.caption.weight(.semibold))
      Text(day.date.suffix(2))
        .font(.system(size: 9, weight: .medium))
        .foregroundStyle(RCTheme.muted)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(RCTheme.surfaceLevel1.opacity(0.72))
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    .accessibilityLabel("Date \(day.date)")
  }
}

struct WorkCalendarAgentCell: View {
  @EnvironmentObject var model: AppViewModel
  var row: AgentWorkCalendarAgentRow

  var displayName: String {
    model.agents.first(where: { $0.id == row.agentId }).map(model.resolveAgentDisplayName)
      ?? row.agentName
  }

  var body: some View {
    HStack(spacing: 8) {
      AgentAvatarView(name: displayName, avatarURL: model.agentAvatar(row.agentId), size: 30)
      Text(displayName)
        .font(.caption.weight(.semibold))
        .lineLimit(1)
      Spacer(minLength: 4)
    }
    .padding(8)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(RCTheme.surfaceInset)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(RoundedRectangle(cornerRadius: 4).stroke(RCTheme.borderSoft))
    .accessibilityLabel("\(displayName), \(formatCalendarHours(calendarTotalMinutes(row))) worked")
  }
}

struct WorkCalendarCountCell: View {
  var day: AgentWorkCalendarDay?

  var minutes: Int {
    calendarDayMinutes(day)
  }

  var body: some View {
    Text(formatCalendarHours(minutes))
      .font(.caption.weight(.bold))
      .foregroundStyle(minutes > 0 ? RCTheme.text : RCTheme.muted)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
      .background(minutes > 0 ? RCTheme.sidebarSelected.opacity(0.76) : RCTheme.surfaceInset)
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(
        RoundedRectangle(cornerRadius: 4).stroke(
          minutes > 0 ? RCTheme.accentBlue.opacity(0.38) : RCTheme.borderSoft)
      )
      .help("\(formatCalendarHours(minutes)) worked")
      .accessibilityLabel("\(day?.date ?? "Calendar day"), \(formatCalendarHours(minutes)) worked")
  }
}

struct WorkCalendarTotalCell: View {
  var row: AgentWorkCalendarAgentRow

  var body: some View {
    Text(formatCalendarHours(calendarTotalMinutes(row)))
      .font(.caption.weight(.bold))
      .foregroundStyle(calendarTotalMinutes(row) > 0 ? RCTheme.text : RCTheme.muted)
      .padding(.horizontal, 8)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
      .background(
        calendarTotalMinutes(row) > 0 ? RCTheme.accentPurple.opacity(0.12) : RCTheme.surfaceInset
      )
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .overlay(
        RoundedRectangle(cornerRadius: 4).stroke(
          calendarTotalMinutes(row) > 0 ? RCTheme.accentPurple.opacity(0.34) : RCTheme.borderSoft)
      )
      .accessibilityLabel("Total \(formatCalendarHours(calendarTotalMinutes(row))) worked")
  }
}
