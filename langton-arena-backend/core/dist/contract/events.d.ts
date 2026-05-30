import type { Vector2 } from './state';
/** Объединённый тип всех событий, которые могут прийти от логики к UI. */
export type GameEvent = StateUpdateEvent | ScreenTransitionEvent | ToastEvent | ModalEvent | PlaySoundEvent | PlayAnimationEvent | CameraEvent | HapticEvent;
export interface StateUpdateEvent {
    type: 'state_update';
    patch: object;
}
export interface ScreenTransitionEvent {
    type: 'screen_transition';
    from: string;
    to: string;
    reason: string;
}
export interface ToastEvent {
    type: 'toast';
    toast: import('./state').Toast;
}
export interface ModalEvent {
    type: 'modal';
    modal: import('./state').Modal;
}
export interface PlaySoundEvent {
    type: 'play_sound';
    soundId: string;
    volume?: number;
    pan?: number;
    crossfadeMs?: number;
}
export interface PlayAnimationEvent {
    type: 'play_animation';
    animationId: string;
    payload?: unknown;
}
export interface CameraEvent {
    type: 'camera_event';
    suggestion: {
        target: Vector2;
        zoom: number;
        duration: number;
        reason: 'combat' | 'lead_change' | 'critical_event' | 'auto_follow';
        importance: 'low' | 'medium' | 'high';
    };
}
export interface HapticEvent {
    type: 'haptic';
    intensity: 'light' | 'medium' | 'heavy';
}
export type MatchEventType = 'capture' | 'clash' | 'damage' | 'birth' | 'hybrid' | 'wild' | 'wild_die' | 'death' | 'evolution' | 'phoenix' | 'lead_change' | 'combo' | 'totem_built' | 'storm' | 'player_disconnect' | 'player_reconnect';
export interface MatchEvent {
    id: string;
    tick: number;
    type: MatchEventType;
    primaryPlayerId: string | null;
    secondaryPlayerId: string | null;
    position: Vector2 | null;
    payload: Record<string, unknown>;
    displayText: string;
    icon: string;
    iconColor: string;
    playSound: boolean;
    showOverlay: boolean;
}
//# sourceMappingURL=events.d.ts.map