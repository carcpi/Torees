import React from 'react';
import {
  CHARACTERS,
  MATERIALS,
  type CharacterId,
  type MaterialId,
  type TowerPalette,
  type TowerStatus,
} from '../game/towersCatalog';

interface CharacterSvgProps {
  character: CharacterId;
  x?: number;
  y?: number;
  scale?: number;
}

export const CharacterVector: React.FC<CharacterSvgProps> = ({
  character,
  x = 80,
  y = 44,
  scale = 1,
}) => {
  const spec = CHARACTERS[character];
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      {/* Shadow on tower cap */}
      <ellipse cx="0" cy="24" rx="16" ry="4" fill="rgba(0,0,0,0.35)" />
      {character === 'gorilla' && (
        <g>
          {/* Arms */}
          <path d="M-16,4 C-24,6 -24,18 -16,20" stroke={spec.primaryColor} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M16,4 C24,6 24,18 16,20" stroke={spec.primaryColor} strokeWidth="7" strokeLinecap="round" fill="none" />
          {/* Torso */}
          <ellipse cx="0" cy="10" rx="15" ry="14" fill={spec.primaryColor} stroke="#111827" strokeWidth="1.5" />
          <ellipse cx="0" cy="11" rx="9" ry="8" fill={spec.secondaryColor} />
          {/* Head */}
          <circle cx="0" cy="-6" r="11" fill={spec.primaryColor} stroke="#111827" strokeWidth="1.5" />
          <ellipse cx="0" cy="-3" rx="8" ry="6" fill={spec.secondaryColor} />
          {/* Eyes & Snarl */}
          <circle cx="-4" cy="-8" r="2" fill={spec.eyeColor} />
          <circle cx="4" cy="-8" r="2" fill={spec.eyeColor} />
          <path d="M-4,-1 L4,-1" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" />
          <polygon points="-3,-1 -2,2 -1,-1" fill="#F8FAFC" />
          <polygon points="1,-1 2,2 3,-1" fill="#F8FAFC" />
        </g>
      )}
      {character === 'alien' && (
        <g>
          {/* Antennae */}
          <line x1="-6" y1="-16" x2="-10" y2="-24" stroke={spec.primaryColor} strokeWidth="2.2" />
          <circle cx="-10" cy="-25" r="3" fill={spec.accentColor} />
          <line x1="6" y1="-16" x2="10" y2="-24" stroke={spec.primaryColor} strokeWidth="2.2" />
          <circle cx="10" cy="-25" r="3" fill={spec.accentColor} />
          {/* Body */}
          <path d="M-10,22 L-12,2 L12,2 L10,22 Z" fill={spec.accentColor} stroke="#0F172A" strokeWidth="1.5" />
          {/* Head */}
          <ellipse cx="0" cy="-7" rx="13" ry="11" fill={spec.primaryColor} stroke="#0F172A" strokeWidth="1.5" />
          {/* 3 Eyes */}
          <ellipse cx="-5" cy="-7" rx="2.8" ry="3.6" fill={spec.eyeColor} />
          <ellipse cx="5" cy="-7" rx="2.8" ry="3.6" fill={spec.eyeColor} />
          <circle cx="0" cy="-12" r="2.2" fill={spec.eyeColor} />
          <circle cx="-5.5" cy="-8" r="0.9" fill="#FFFFFF" />
          <circle cx="4.5" cy="-8" r="0.9" fill="#FFFFFF" />
          <path d="M-4,-1 Q0,2 4,-1" stroke="#0F172A" strokeWidth="1.5" fill="none" />
        </g>
      )}
      {character === 'robot' && (
        <g>
          <line x1="0" y1="-18" x2="0" y2="-26" stroke={spec.accentColor} strokeWidth="2.5" />
          <circle cx="0" cy="-27" r="3" fill="#F59E0B" />
          {/* Chassis */}
          <rect x="-13" y="2" width="26" height="20" rx="4" fill={spec.primaryColor} stroke="#0F172A" strokeWidth="1.5" />
          <rect x="-7" y="7" width="14" height="8" rx="2" fill={spec.accentColor} opacity="0.85" />
          {/* Head */}
          <rect x="-11" y="-18" width="22" height="17" rx="4" fill={spec.secondaryColor} stroke="#0F172A" strokeWidth="1.5" />
          <rect x="-8" y="-13" width="16" height="6" rx="2" fill="#0F172A" />
          <circle cx="-4" cy="-10" r="2" fill={spec.eyeColor} />
          <circle cx="4" cy="-10" r="2" fill={spec.eyeColor} />
          <line x1="-5" y1="-4" x2="5" y2="-4" stroke="#0F172A" strokeWidth="1.5" />
        </g>
      )}
      {character === 'king' && (
        <g>
          {/* Cape & Robe */}
          <path d="M-16,22 L-11,2 L11,2 L16,22 Z" fill={spec.primaryColor} stroke="#0F172A" strokeWidth="1.5" />
          <rect x="-3" y="2" width="6" height="20" fill="#F8FAFC" />
          {/* Head & Beard */}
          <circle cx="0" cy="-6" r="10" fill="#FDE68A" stroke="#0F172A" strokeWidth="1.5" />
          <path d="M-9,-3 Q0,11 9,-3 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          <circle cx="-3.5" cy="-8" r="1.6" fill={spec.eyeColor} />
          <circle cx="3.5" cy="-8" r="1.6" fill={spec.eyeColor} />
          {/* Crown */}
          <polygon points="-10,-14 -11,-24 -4,-18 0,-26 4,-18 11,-24 10,-14" fill={spec.secondaryColor} stroke="#78350F" strokeWidth="1.4" />
        </g>
      )}
      {character === 'dragon' && (
        <g>
          {/* Wings */}
          <polygon points="-11,2 -26,-10 -20,12" fill={spec.accentColor} stroke="#7C2D12" strokeWidth="1.4" />
          <polygon points="11,2 26,-10 20,12" fill={spec.accentColor} stroke="#7C2D12" strokeWidth="1.4" />
          {/* Body */}
          <ellipse cx="0" cy="11" rx="13" ry="12" fill={spec.primaryColor} stroke="#431407" strokeWidth="1.5" />
          <ellipse cx="0" cy="12" rx="7" ry="8" fill={spec.secondaryColor} />
          {/* Horns & Head */}
          <polygon points="-8,-14 -14,-25 -3,-16" fill="#FDE047" />
          <polygon points="8,-14 14,-25 3,-16" fill="#FDE047" />
          <ellipse cx="0" cy="-7" rx="11" ry="9" fill={spec.primaryColor} stroke="#431407" strokeWidth="1.5" />
          <circle cx="-4" cy="-9" r="2.1" fill={spec.eyeColor} />
          <circle cx="4" cy="-9" r="2.1" fill={spec.eyeColor} />
          <path d="M-5,-3 L0,-1 L5,-3" stroke="#FEF08A" strokeWidth="1.5" fill="none" />
        </g>
      )}
      {character === 'astronaut' && (
        <g>
          {/* Backpack */}
          <rect x="-16" y="0" width="32" height="16" rx="4" fill={spec.secondaryColor} stroke="#334155" strokeWidth="1.2" />
          {/* Suit */}
          <rect x="-12" y="2" width="24" height="20" rx="6" fill={spec.primaryColor} stroke="#334155" strokeWidth="1.5" />
          <rect x="-6" y="7" width="12" height="7" rx="2" fill={spec.accentColor} />
          {/* Helmet */}
          <circle cx="0" cy="-8" r="12" fill={spec.primaryColor} stroke="#334155" strokeWidth="1.5" />
          <ellipse cx="0" cy="-8" rx="8.5" ry="6.5" fill="#0F172A" stroke={spec.eyeColor} strokeWidth="1.5" />
          <path d="M-5,-11 L-2,-11" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {character === 'kaiju' && (
        <g>
          {/* Dorsal spikes */}
          <polygon points="-14,-4 -22,-10 -13,4" fill={spec.accentColor} />
          <polygon points="14,-4 22,-10 13,4" fill={spec.accentColor} />
          <ellipse cx="0" cy="10" rx="14" ry="13" fill={spec.primaryColor} stroke="#042F2E" strokeWidth="1.5" />
          <ellipse cx="0" cy="11" rx="8" ry="9" fill={spec.secondaryColor} />
          <circle cx="0" cy="-8" r="11" fill={spec.primaryColor} stroke="#042F2E" strokeWidth="1.5" />
          <circle cx="-4.5" cy="-10" r="2.2" fill={spec.eyeColor} />
          <circle cx="4.5" cy="-10" r="2.2" fill={spec.eyeColor} />
          <polygon points="-6,-3 -4,-7 -2,-3" fill="#F8FAFC" />
          <polygon points="2,-3 4,-7 6,-3" fill="#F8FAFC" />
        </g>
      )}
      {character === 'yeti' && (
        <g>
          <ellipse cx="0" cy="10" rx="16" ry="13" fill={spec.primaryColor} stroke="#1E3A8A" strokeWidth="1.5" />
          <polygon points="-9,-14 -15,-23 -4,-16" fill={spec.secondaryColor} stroke="#1E3A8A" strokeWidth="1.2" />
          <polygon points="9,-14 15,-23 4,-16" fill={spec.secondaryColor} stroke="#1E3A8A" strokeWidth="1.2" />
          <circle cx="0" cy="-7" r="11" fill={spec.primaryColor} stroke="#1E3A8A" strokeWidth="1.5" />
          <ellipse cx="0" cy="-6" rx="8" ry="6" fill={spec.secondaryColor} />
          <circle cx="-3.5" cy="-8" r="2" fill={spec.eyeColor} />
          <circle cx="3.5" cy="-8" r="2" fill={spec.eyeColor} />
          <path d="M-4,-2 L4,-2" stroke="#1E3A8A" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
      {character === 'pirate' && (
        <g>
          <path d="M-13,22 L-11,2 L11,2 L13,22 Z" fill={spec.primaryColor} stroke="#0F172A" strokeWidth="1.5" />
          <rect x="-11" y="10" width="22" height="4" fill={spec.accentColor} />
          <circle cx="0" cy="-6" r="10" fill="#FDE68A" stroke="#0F172A" strokeWidth="1.5" />
          {/* Eyepatch & Eye */}
          <line x1="-9" y1="-10" x2="9" y2="-6" stroke="#0F172A" strokeWidth="1.8" />
          <circle cx="-4" cy="-8" r="2.6" fill="#0F172A" />
          <circle cx="4" cy="-8" r="1.8" fill="#0F172A" />
          <path d="M-6,-2 Q0,4 6,-2" stroke="#78350F" strokeWidth="2.5" fill="none" />
          {/* Tricorn Hat */}
          <path d="M-15,-12 Q0,-26 15,-12 L11,-10 L-11,-10 Z" fill="#0F172A" stroke={spec.accentColor} strokeWidth="1.3" />
          <circle cx="0" cy="-16" r="2.2" fill={spec.accentColor} />
        </g>
      )}
      {character === 'cyborg' && (
        <g>
          <rect x="-13" y="2" width="26" height="20" rx="5" fill={spec.primaryColor} stroke="#0F172A" strokeWidth="1.5" />
          <path d="M-8,12 L8,12" stroke={spec.accentColor} strokeWidth="2.5" />
          <circle cx="0" cy="-7" r="11" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.5" />
          {/* Cyber half-mask */}
          <path d="M0,-18 A11,11 0 0,1 0,4 Z" fill={spec.secondaryColor} stroke="#0F172A" strokeWidth="1.2" />
          <circle cx="-4" cy="-8" r="1.8" fill="#0F172A" />
          <rect x="1" y="-11" width="8" height="5" rx="1.5" fill="#0F172A" />
          <circle cx="5" cy="-8.5" r="2" fill={spec.eyeColor} />
        </g>
      )}
    </g>
  );
};

interface TowerThumbnailProps {
  towerNumber: number;
  material: MaterialId;
  character: CharacterId;
  palette: TowerPalette;
  status: TowerStatus;
  wearTier?: 'INTACTA' | 'AGRIETADA' | 'MORDIDA' | 'CRITICA' | 'DERRIBADA';
  leanLevel?: number;
}

export const TowerThumbnailSvg: React.FC<TowerThumbnailProps> = ({
  towerNumber,
  material,
  character,
  palette,
  status,
  wearTier,
  leanLevel = 0,
}) => {
  const mat = MATERIALS[material];
  const isCollapsed = status === 'DERRIBADA';
  const effectiveTier = isCollapsed ? 'DERRIBADA' : wearTier ?? 'INTACTA';
  const rows = 5;

  const tiltSign = leanLevel !== 0 ? Math.sign(leanLevel) : towerNumber % 2 === 0 ? 1 : -1;
  const tiltDeg =
    effectiveTier === 'CRITICA'
      ? tiltSign * 7.2
      : effectiveTier === 'MORDIDA'
        ? tiltSign * 3.6
        : effectiveTier === 'AGRIETADA'
          ? tiltSign * 0.9
          : 0;

  // Determine which blocks (rowIdx 0..4, col 0|1) are visibly missing or cracked for this wearTier
  const isMissingBlock = (rowIdx: number, col: number): boolean => {
    if (effectiveTier === 'MORDIDA') {
      return (rowIdx === 4 && col === (tiltSign > 0 ? 1 : 0)) || (rowIdx === 2 && col === (tiltSign > 0 ? 0 : 1));
    }
    if (effectiveTier === 'CRITICA') {
      return (
        (rowIdx === 4 && col === 1) ||
        (rowIdx === 4 && col === 0 && towerNumber % 2 === 0) ||
        (rowIdx === 3 && col === (tiltSign > 0 ? 1 : 0)) ||
        (rowIdx === 2 && col === (tiltSign > 0 ? 0 : 1)) ||
        (rowIdx === 1 && col === (tiltSign > 0 ? 1 : 0))
      );
    }
    return false;
  };

  const getBlockCrackStrength = (rowIdx: number, col: number): number => {
    if (effectiveTier === 'INTACTA') return 0;
    if (effectiveTier === 'AGRIETADA') {
      return (rowIdx === 2 && col === 1) || (rowIdx === 3 && col === 0) ? 1 : 0;
    }
    if (effectiveTier === 'MORDIDA') {
      return (rowIdx + col + towerNumber) % 2 === 0 ? 2 : 1;
    }
    if (effectiveTier === 'CRITICA') {
      return 3;
    }
    return 0;
  };

  return (
    <svg
      viewBox="0 0 180 156"
      className="w-full h-40 rounded-lg overflow-hidden select-none"
      role="img"
      data-wear-tier={effectiveTier}
      aria-label={`Ilustración de Torre #${towerNumber} de ${mat.label} con ${CHARACTERS[character].label}`}
    >
      <defs>
        <linearGradient id={`sky-${towerNumber}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.skyTop} />
          <stop offset="100%" stopColor={palette.skyBottom} />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="180" height="156" fill={`url(#sky-${towerNumber})`} />
      {/* Horizon glow */}
      <ellipse cx="90" cy="134" rx="76" ry="22" fill={palette.horizonGlow} opacity="0.16" />
      {/* Ground */}
      <rect x="0" y="132" width="180" height="24" fill={palette.platformColor} />
      <line x1="0" y1="132" x2="180" y2="132" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />

      {isCollapsed ? (
        <g>
          {/* Fallen blocks rubble */}
          <rect x="36" y="118" width="28" height="13" rx="2" transform="rotate(-14 50 124)" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="1.5" />
          <rect x="68" y="114" width="30" height="14" rx="2" transform="rotate(9 83 121)" fill={mat.blockFillAlt} stroke={mat.blockStroke} strokeWidth="1.5" />
          <rect x="104" y="118" width="28" height="13" rx="2" transform="rotate(22 118 124)" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="1.5" />
          <rect x="52" y="106" width="24" height="12" rx="2" transform="rotate(-28 64 112)" fill={mat.blockFillAlt} stroke={mat.blockStroke} strokeWidth="1.5" />
          <g transform="translate(122, 114) rotate(72) scale(0.72)">
            <CharacterVector character={character} x={0} y={0} scale={1} />
          </g>
        </g>
      ) : (
        <g>
          {/* Tilted Tower Group anchored at ground center (90, 131) */}
          <g transform={`rotate(${tiltDeg} 90 131)`}>
            {Array.from({ length: rows }).map((_, rowIdx) => {
              const y = 117 - rowIdx * 15;
              const leftMissing = isMissingBlock(rowIdx, 0);
              const rightMissing = isMissingBlock(rowIdx, 1);
              const leftCrack = getBlockCrackStrength(rowIdx, 0);
              const rightCrack = getBlockCrackStrength(rowIdx, 1);

              return (
                <g key={rowIdx}>
                  {!leftMissing && (
                    <g>
                      <rect
                        x="56"
                        y={y}
                        width="33"
                        height="14"
                        rx={material === 'wood' ? 5 : 2}
                        fill={rowIdx % 2 === 0 ? mat.blockFill : mat.blockFillAlt}
                        stroke={mat.blockStroke}
                        strokeWidth="1.4"
                      />
                      {material === 'lego' && (
                        <>
                          <rect x="63" y={y - 2} width="7" height="2.5" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="0.8" />
                          <rect x="75" y={y - 2} width="7" height="2.5" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="0.8" />
                        </>
                      )}
                      <line x1="60" y1={y + 3} x2="84" y2={y + 3} stroke={mat.highlight} strokeWidth="1" opacity="0.45" />
                      {leftCrack >= 1 && (
                        <path
                          d={`M66,${y + 1} L71,${y + 7} L67,${y + 13}`}
                          stroke="#090D16"
                          strokeWidth="1.3"
                          fill="none"
                        />
                      )}
                      {leftCrack >= 2 && (
                        <path
                          d={`M78,${y + 1} L73,${y + 8} L80,${y + 13}`}
                          stroke="#090D16"
                          strokeWidth="1.3"
                          fill="none"
                        />
                      )}
                      {leftCrack >= 3 && (
                        <path
                          d={`M57,${y + 6} L74,${y + 9} L87,${y + 4}`}
                          stroke="#090D16"
                          strokeWidth="1.4"
                          fill="none"
                        />
                      )}
                    </g>
                  )}

                  {!rightMissing && (
                    <g>
                      <rect
                        x="91"
                        y={y}
                        width="33"
                        height="14"
                        rx={material === 'wood' ? 5 : 2}
                        fill={rowIdx % 2 === 0 ? mat.blockFillAlt : mat.blockFill}
                        stroke={mat.blockStroke}
                        strokeWidth="1.4"
                      />
                      {material === 'lego' && (
                        <>
                          <rect x="98" y={y - 2} width="7" height="2.5" fill={mat.blockFillAlt} stroke={mat.blockStroke} strokeWidth="0.8" />
                          <rect x="110" y={y - 2} width="7" height="2.5" fill={mat.blockFillAlt} stroke={mat.blockStroke} strokeWidth="0.8" />
                        </>
                      )}
                      <line x1="95" y1={y + 3} x2="119" y2={y + 3} stroke={mat.highlight} strokeWidth="1" opacity="0.45" />
                      {rightCrack >= 1 && (
                        <path
                          d={`M103,${y + 1} L108,${y + 7} L104,${y + 13}`}
                          stroke="#090D16"
                          strokeWidth="1.3"
                          fill="none"
                        />
                      )}
                      {rightCrack >= 2 && (
                        <path
                          d={`M114,${y + 2} L109,${y + 8} L116,${y + 13}`}
                          stroke="#090D16"
                          strokeWidth="1.3"
                          fill="none"
                        />
                      )}
                      {rightCrack >= 3 && (
                        <path
                          d={`M92,${y + 5} L109,${y + 8} L122,${y + 4}`}
                          stroke="#090D16"
                          strokeWidth="1.4"
                          fill="none"
                        />
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Top Animated Character */}
            <g className="animate-character-idle">
              <CharacterVector character={character} x={90} y={35} scale={0.92} />
              {effectiveTier === 'CRITICA' && (
                <circle cx="109" cy="19" r="2.6" fill="#38BDF8" />
              )}
            </g>
          </g>

          {/* Fallen Debris Chunks on Ground matching wearTier */}
          {effectiveTier === 'AGRIETADA' && (
            <rect x="38" y="126" width="8" height="5" rx="1" transform="rotate(-12 42 128)" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="0.9" />
          )}
          {(effectiveTier === 'MORDIDA' || effectiveTier === 'CRITICA') && (
            <g>
              <rect x="31" y="121" width="16" height="9" rx="1.5" transform="rotate(-16 39 125)" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="1.1" />
              <rect x="132" y="122" width="15" height="8" rx="1.5" transform="rotate(19 139 126)" fill={mat.blockFillAlt} stroke={mat.blockStroke} strokeWidth="1.1" />
            </g>
          )}
          {effectiveTier === 'CRITICA' && (
            <g>
              <rect x="18" y="125" width="12" height="7" rx="1.2" transform="rotate(24 24 128)" fill={mat.blockFillAlt} stroke={mat.blockStroke} strokeWidth="1" />
              <rect x="148" y="125" width="12" height="7" rx="1.2" transform="rotate(-22 154 128)" fill={mat.blockFill} stroke={mat.blockStroke} strokeWidth="1" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
};
