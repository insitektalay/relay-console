export const DEFAULT_DEPARTMENT_COLOR = "#0A84FF"

export function getColorInputValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_DEPARTMENT_COLOR
}
