// src/lib/roomCodes.ts
//
// Stage 8 Day 32: генерация room invitation codes.
//
// Format: 6 символов из upper-alphanumeric без визуально-двусмысленных
// (I, l, O, 0, 1) для удобного передачи голосом / печати без ошибки.
//
// Кириллица не нужна — английский alphabet универсальнее, и server
// принимает любой room code без валидации (Stage 8). При collision
// (~1 на миллион) — два игрока просто окажутся в разных rooms если
// откроют URL'ы одновременно.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_LENGTH = 6;

/**
 * Generate random room code из ALPHABET. Default 6 chars.
 * Использует Math.random — для room codes этого достаточно
 * (не security-critical, просто unique-enough для сессии).
 */
export function generateRoomCode(length: number = DEFAULT_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Build full match URL для navigation. Опционально включает ?bot=
 * параметр для auto-spawn бота.
 */
export function buildMatchUrl(roomCode: string, bot?: 'easy' | 'normal' | 'hard'): string {
  const baseUrl = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const botSuffix = bot ? `&bot=${bot}` : '';
  return `${baseUrl}?room=${encodeURIComponent(roomCode)}${botSuffix}`;
}

/** Validate room code char (для potential input filtering в Stage 9). */
export function isValidRoomCodeChar(ch: string): boolean {
  return ALPHABET.includes(ch.toUpperCase());
}
