import { useRelayConsoleNavigation } from "./phase-13-navigation"
import { buildRelayConsoleControllerPart1 } from "./build-part-1"
import { buildRelayConsoleControllerPart2 } from "./build-part-2"
import { buildRelayConsoleControllerPart3 } from "./build-part-3"

export function buildRelayConsoleController(
  input: ReturnType<typeof useRelayConsoleNavigation>,
) {
  return Object.assign(
    buildRelayConsoleControllerPart1(input),
    buildRelayConsoleControllerPart2(input),
    buildRelayConsoleControllerPart3(input),
  )
}
