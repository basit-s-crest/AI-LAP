/**
 * Utility to generate consistent pastel colors for community groups
 * Based on the group's emoji or name, returns the same color every time
 */

// Pastel color palette matching the UI design
const COLOR_PALETTE = [
  "#FFE5E5", // Light pink
  "#E5F3FF", // Light blue
  "#F0E5FF", // Light purple
  "#E5FFE5", // Light green
  "#FFF5E5", // Light peach
  "#FFE5F5", // Light rose
  "#E5FFFF", // Light cyan
  "#F5FFE5", // Light lime
];

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a consistent color for a group based on its emoji or name
 * @param emoji - The group's emoji
 * @param name - The group's name (fallback if emoji is not unique enough)
 * @returns A hex color code from the palette
 */
export function getGroupColor(emoji: string, name: string): string {
  // Use emoji as primary identifier, fallback to name
  const identifier = emoji || name;
  const hash = hashString(identifier);
  const colorIndex = hash % COLOR_PALETTE.length;
  return COLOR_PALETTE[colorIndex];
}
