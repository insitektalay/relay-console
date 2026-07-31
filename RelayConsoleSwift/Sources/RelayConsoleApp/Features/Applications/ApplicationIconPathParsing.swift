import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct ApplicationsSVGPathShape: Shape {
  let pathData: String
  var viewBoxSize = CGSize(width: 24, height: 24)
  var viewBoxOrigin = CGPoint.zero

  func path(in rect: CGRect) -> Path {
    var parser = ApplicationsSVGPathParser(pathData: pathData)
    let basePath = parser.parse()
    let scale = min(rect.width / viewBoxSize.width, rect.height / viewBoxSize.height)
    let x = rect.midX - (viewBoxSize.width * scale / 2)
    let y = rect.midY - (viewBoxSize.height * scale / 2)
    return basePath.applying(
      CGAffineTransform(
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        tx: x - (viewBoxOrigin.x * scale),
        ty: y - (viewBoxOrigin.y * scale)
      )
    )
  }
}
struct ApplicationsSVGPathParser {
  private let characters: [Character]
  private var index = 0

  init(pathData: String) {
    self.characters = Array(pathData)
  }

  mutating func parse() -> Path {
    var path = Path()
    var current = CGPoint.zero
    var subpathStart = CGPoint.zero
    var command: Character?

    while true {
      skipSeparators()
      guard index < characters.count else { break }
      if isCommand(characters[index]) {
        command = characters[index]
        index += 1
      }
      guard let command else { break }
      switch command {
      case "M", "m":
        parseMove(
          relative: command == "m", path: &path, current: &current, subpathStart: &subpathStart)
      case "L", "l":
        parseLine(relative: command == "l", path: &path, current: &current)
      case "H", "h":
        parseHorizontal(relative: command == "h", path: &path, current: &current)
      case "V", "v":
        parseVertical(relative: command == "v", path: &path, current: &current)
      case "C", "c":
        parseCubic(relative: command == "c", path: &path, current: &current)
      case "Z", "z":
        path.closeSubpath()
        current = subpathStart
      default:
        index = characters.count
      }
    }

    return path
  }

  private mutating func parseMove(
    relative: Bool, path: inout Path, current: inout CGPoint, subpathStart: inout CGPoint
  ) {
    var firstPoint = true
    while let x = readNumber(), let y = readNumber() {
      let point = resolvedPoint(x: x, y: y, current: current, relative: relative)
      if firstPoint {
        path.move(to: point)
        subpathStart = point
        firstPoint = false
      } else {
        path.addLine(to: point)
      }
      current = point
      if nextTokenIsCommand() { break }
    }
  }

  private mutating func parseLine(relative: Bool, path: inout Path, current: inout CGPoint) {
    while let x = readNumber(), let y = readNumber() {
      let point = resolvedPoint(x: x, y: y, current: current, relative: relative)
      path.addLine(to: point)
      current = point
      if nextTokenIsCommand() { break }
    }
  }

  private mutating func parseHorizontal(relative: Bool, path: inout Path, current: inout CGPoint) {
    while let x = readNumber() {
      let point = CGPoint(x: relative ? current.x + x : x, y: current.y)
      path.addLine(to: point)
      current = point
      if nextTokenIsCommand() { break }
    }
  }

  private mutating func parseVertical(relative: Bool, path: inout Path, current: inout CGPoint) {
    while let y = readNumber() {
      let point = CGPoint(x: current.x, y: relative ? current.y + y : y)
      path.addLine(to: point)
      current = point
      if nextTokenIsCommand() { break }
    }
  }

  private mutating func parseCubic(relative: Bool, path: inout Path, current: inout CGPoint) {
    while let x1 = readNumber(),
      let y1 = readNumber(),
      let x2 = readNumber(),
      let y2 = readNumber(),
      let x = readNumber(),
      let y = readNumber()
    {
      let control1 = resolvedPoint(x: x1, y: y1, current: current, relative: relative)
      let control2 = resolvedPoint(x: x2, y: y2, current: current, relative: relative)
      let point = resolvedPoint(x: x, y: y, current: current, relative: relative)
      path.addCurve(to: point, control1: control1, control2: control2)
      current = point
      if nextTokenIsCommand() { break }
    }
  }

  private func resolvedPoint(x: CGFloat, y: CGFloat, current: CGPoint, relative: Bool) -> CGPoint {
    if relative {
      return CGPoint(x: current.x + x, y: current.y + y)
    }
    return CGPoint(x: x, y: y)
  }

  private mutating func readNumber() -> CGFloat? {
    skipSeparators()
    guard index < characters.count, !isCommand(characters[index]) else { return nil }

    let start = index
    if characters[index] == "-" || characters[index] == "+" {
      index += 1
    }
    var hasDigits = consumeDigits()
    if index < characters.count, characters[index] == "." {
      index += 1
      hasDigits = consumeDigits() || hasDigits
    }
    if index < characters.count, characters[index] == "e" || characters[index] == "E" {
      let exponentStart = index
      index += 1
      if index < characters.count, characters[index] == "-" || characters[index] == "+" {
        index += 1
      }
      if !consumeDigits() {
        index = exponentStart
      }
    }
    guard hasDigits else {
      index = start
      return nil
    }

    return Double(String(characters[start..<index])).map { CGFloat($0) }
  }

  @discardableResult
  private mutating func consumeDigits() -> Bool {
    let start = index
    while index < characters.count, isDigit(characters[index]) {
      index += 1
    }
    return index > start
  }

  private mutating func skipSeparators() {
    while index < characters.count, isSeparator(characters[index]) {
      index += 1
    }
  }

  private mutating func nextTokenIsCommand() -> Bool {
    skipSeparators()
    return index < characters.count && isCommand(characters[index])
  }

  private func isSeparator(_ character: Character) -> Bool {
    character == " " || character == "\n" || character == "\t" || character == "\r"
      || character == ","
  }

  private func isCommand(_ character: Character) -> Bool {
    guard let value = character.unicodeScalars.first?.value else { return false }
    return (65...90).contains(value) || (97...122).contains(value)
  }

  private func isDigit(_ character: Character) -> Bool {
    guard let value = character.unicodeScalars.first?.value else { return false }
    return (48...57).contains(value)
  }
}

struct ApplicationsIconFallbackView: View {
  let icon: MarketplaceIconFallback
  var size: CGFloat = 36

  var body: some View {
    Text(icon.initials)
      .font(.system(size: size > 40 ? 18 : 13, weight: .bold))
      .foregroundStyle(iconTextColor)
      .frame(width: size, height: size)
      .background(iconColor.opacity(0.20))
      .clipShape(RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius))
      .overlay(
        RoundedRectangle(cornerRadius: RCComponentBaseline.cornerRadius).stroke(
          iconColor.opacity(0.48))
      )
      .help("Deterministic app icon fallback")
      .accessibilityLabel("Deterministic app icon fallback \(icon.initials)")
  }

  private var iconColor: Color {
    switch icon.colorName {
    case "green":
      return RCTheme.accentGreen
    case "amber":
      return RCTheme.accentAmber
    case "purple":
      return RCTheme.accentPurple
    case "red":
      return RCTheme.accentRed
    case "teal":
      return Color(red: 0.361, green: 0.820, blue: 0.753)
    default:
      return RCTheme.accentBlue
    }
  }

  private var iconTextColor: Color {
    Color.white.opacity(0.94)
  }
}

func appStatusTone(_ app: MarketplaceCatalogApp) -> ComponentTone {
  switch app.availability {
  case .available:
    return app.installState == .installed ? .green : .blue
  case .comingSoon:
    return .purple
  case .betaUnavailable:
    return .amber
  case .unavailable:
    return .red
  }
}

func actionTone(_ app: MarketplaceCatalogApp) -> ComponentTone {
  switch ApplicationsService.rowActionTitle(for: app) {
  case "Connect":
    return .blue
  case "Install":
    return .green
  case "View":
    return .purple
  default:
    return .amber
  }
}

func providerConnectionTone(_ connection: MarketplaceProviderConnection?) -> ComponentTone {
  guard let connection else { return .amber }
  switch connection.status {
  case .connected:
    return connection.health.state == .ready ? .green : .blue
  case .validating, .disconnecting:
    return .purple
  case .expired, .authRequired, .reauthorizeRequired:
    return .amber
  case .healthError, .senderInvalid, .unavailable:
    return .red
  case .disconnected:
    return .amber
  }
}

func applicationsSidebarConnectionStatusTitle(
  for app: MarketplaceCatalogApp,
  connection: MarketplaceProviderConnection?
) -> String {
  guard let connection,
    connection.status == .connected,
    connection.health.state == .ready
  else { return "Not connected" }
  return "Connected"
}

func applicationsSidebarConnectionTone(
  for app: MarketplaceCatalogApp,
  connection: MarketplaceProviderConnection?
) -> ComponentTone {
  guard let connection,
    connection.status == .connected,
    connection.health.state == .ready
  else { return .amber }
  return .green
}
