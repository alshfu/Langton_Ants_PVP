// src/screens/MenuScreen.tsx
//
// Главное меню с фоновой симуляцией Лэнгтона + кнопками навигации.

import { useMemo, useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { LangtonField } from '@components/LangtonField';
import { LA_RULES } from '@core/langton/rules';
import { PLAYER_PALETTE } from '@core/shared/constants';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Logo } from '@ui/Logo';
import { BotInviteDialog } from '@components/BotInviteDialog';
import type { BotDifficulty } from '@lib/botPlayer';
import { generateRoomCode, buildMatchUrl } from '@lib/roomCodes';

export function MenuScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
  const { setScreen } = useAppState();
  // Day 32: bot difficulty picker state
  const [botDialogOpen, setBotDialogOpen] = useState(false);

  const ants = useMemo(() => {
    const list = [];
    const W = 60, H = 36;
    for (let p = 0; p < 6; p++) {
      for (let i = 0; i < 2; i++) {
        const angle = ((p * 2 + i) / 12) * Math.PI * 2;
        list.push({
          id: `bg_${p}_${i}`,
          owner: p,
          x: Math.floor(W / 2 + Math.cos(angle) * 18),
          y: Math.floor(H / 2 + Math.sin(angle) * 12),
          dir: (p % 4) as 0 | 1 | 2 | 3,
          rule: LA_RULES.spiral!,
          hp: 3,
          maxHp: 3,
        });
      }
    }
    return list;
  }, []);

  const palette = PLAYER_PALETTE.slice(0, 6).map((c) => c.hex);

  return (
    <div style={{
      width: '100vw', height: '100vh', position: 'relative',
      background: T.bg, color: T.textPrimary, overflow: 'hidden',
    }}>
      {/* Background sim — faded */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.35,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 55%, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 55%, black 30%, transparent 80%)',
      }}>
        <LangtonField w={60} h={36} cellSize={18} ants={ants} palette={palette}
          tps={18} glow={false} showTrail antScale={0.85} bg={T.bg} />
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, transparent 30%, ${T.bg} 95%)`,
      }}/>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 24, left: 32, right: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={24} />
          <Eyebrow>v0.1 · web prototype</Eyebrow>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => setScreen('settings')}>⚙</Button>
        </div>
      </div>

      {/* Center */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
        padding: 24,
      }}>
        <div style={{
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          maxWidth: 720, width: '100%',
        }}>
          <h1 style={{
            margin: 0, fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 900, letterSpacing: -3,
            lineHeight: 1, color: T.textPrimary,
          }}>{t('menu.title', 'Langton Arena')}</h1>
          <div style={{ color: T.textMuted, fontSize: 14, marginTop: -12 }}>
            {t('menu.subtitle', 'PvP cellular automata')}
          </div>

          {/* Day 32: tagline объясняет game для first-time visitors */}
          <div style={{
            color: T.textPrimary, fontSize: 'clamp(14px, 2.5vw, 16px)',
            maxWidth: 540, lineHeight: 1.5, opacity: 0.9,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}>
            {t('menu.tagline',
              'Real-time PvP based on Langton\'s Ant cellular automaton. ' +
              'Deploy ants, capture territory, outmaneuver your opponent in 30 seconds.')}
          </div>

          {/* Day 32: primary PvP actions — Play vs Bot + Play vs Friend */}
          <div style={{
            display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <Button
              size="lg"
              onClick={() => setBotDialogOpen(true)}
              data-testid="menu-play-vs-bot"
            >
              🤖 {t('menu.button.playVsBot', 'Play vs Bot')}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={handlePlayVsFriend}
              data-testid="menu-play-vs-friend"
            >
              👥 {t('menu.button.playVsFriend', 'Play vs Friend')}
            </Button>
          </div>

          {/* Day 32: secondary actions — Sandbox / Profile */}
          <div style={{
            display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <Button size="md" variant="ghost" onClick={() => setScreen('sandbox')}>
              ★ {t('menu.button.sandbox', 'Sandbox')}
            </Button>
            <Button size="md" variant="ghost" onClick={() => setScreen('profile')}>
              👤 {t('menu.button.profile', 'Profile')}
            </Button>
          </div>
        </div>
      </div>

      {/* Day 32: bot difficulty dialog (открывается с menu Play vs Bot) */}
      {botDialogOpen && (
        <BotInviteDialog
          onSelect={(difficulty) => {
            setBotDialogOpen(false);
            startBotMatch(difficulty);
          }}
          onCancel={() => setBotDialogOpen(false)}
        />
      )}
    </div>
  );

  function startBotMatch(difficulty: BotDifficulty): void {
    const code = generateRoomCode();
    const url = buildMatchUrl(code, difficulty);
    window.location.href = url;
  }

  function handlePlayVsFriend(): void {
    const code = generateRoomCode();
    const url = buildMatchUrl(code);
    window.location.href = url;
  }
}
