/**
 * Purpose: Own standard and tactical graph colors shared by the canvas and its overlays.
 * Pattern: Immutable presentation data.
 * Usage: GraphView and the Sigma renderer select one of two concrete appearances.
 * Related: src/ui/components/graph/styles.ts, src/ui/styles/simulation.css
 */
export const GRAPH_PALETTES = {
  standard: { background: "#ffffff", surface: "#ffffff", ink: "#172033", secondary: "#526176", border: "#cbd5e1", grid: "#eaf0f6",
    mutedNode: "#d7dee8", mutedEdge: "rgba(52, 64, 84, 0.42)",
    nodes: ["#93c5fd", "#4c8df6", "#6d5bd0", "#be3455"],
    edges: ["100, 116, 139", "47, 111, 143", "75, 156, 143", "138, 122, 184", "183, 121, 102"] },
  tactical: { background: "#101e30", surface: "#1a2d43", ink: "#e8f0f8", secondary: "#b2c5d8", border: "#3c5772", grid: "#1f344b",
    mutedNode: "#7c94aa", mutedEdge: "rgba(133, 159, 185, 0.48)",
    nodes: ["#93c5fd", "#67e8f9", "#c4b5fd", "#fda4af"],
    edges: ["148, 163, 184", "125, 211, 252", "94, 234, 212", "196, 181, 253", "253, 186, 116"] },
} as const
export type GraphAppearance = keyof typeof GRAPH_PALETTES
export type GraphPalette = typeof GRAPH_PALETTES[GraphAppearance]
