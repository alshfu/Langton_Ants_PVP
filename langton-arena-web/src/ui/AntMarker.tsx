// src/ui/AntMarker.tsx
// Маленький значок-индикатор муравья для UI-карточек.

export function AntMarker({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" fill={color} />
      <circle cx="10" cy="8" r="1.5" fill="#000" opacity=".25" />
    </svg>
  );
}
