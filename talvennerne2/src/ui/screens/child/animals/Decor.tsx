// The eight decor pieces of Dyrehaven (SPEC §5.7 "Pynt"), drawn as small UI scenes: flat shapes with
// a coloured outline, colours from the design tokens (zoo.css), a handful of elements each so the
// meadow stays inside the DOM budget. Only the fountain's drops and the lantern's glow move, and only
// with transform/opacity (stopped in calm mode).
import type { ReactElement } from 'react'
import type { DecorId } from '../../../../engine/types'
import { cx } from '../../../design/cx'

const SHAPES: Readonly<Record<DecorId, () => ReactElement>> = {
  'pynt-blomsterbed': () => (
    <>
      <ellipse className="zd-soil" cx="60" cy="88" rx="48" ry="13" />
      <path className="zd-stem" d="M28 84V58M44 86V50M60 86V44M76 86V52M92 84V60M36 72l-8-6M68 70l9-7" />
      <circle className="zd-pink" cx="28" cy="54" r="8" />
      <circle className="zd-sun" cx="44" cy="46" r="9" />
      <circle className="zd-lilac" cx="60" cy="38" r="9" />
      <circle className="zd-sun" cx="76" cy="48" r="8" />
      <circle className="zd-pink" cx="92" cy="56" r="8" />
    </>
  ),
  'pynt-lygte': () => (
    <>
      <circle className="zd-glow" cx="60" cy="34" r="26" />
      <path className="zd-wood" d="M55 50h10v44H55z" />
      <ellipse className="zd-stone" cx="60" cy="95" rx="18" ry="6" />
      <rect className="zd-sun" x="45" y="22" width="30" height="28" rx="7" />
      <path className="zd-roof" d="M40 24L60 8L80 24z" />
    </>
  ),
  'pynt-baenk': () => (
    <>
      <ellipse className="zd-shadow" cx="60" cy="94" rx="46" ry="6" />
      <path className="zd-wood-dark" d="M24 70v22M96 70v22M30 62V40M90 62V40" />
      <rect className="zd-wood" x="18" y="32" width="84" height="16" rx="6" />
      <rect className="zd-wood" x="14" y="60" width="92" height="14" rx="6" />
    </>
  ),
  'pynt-gynge': () => (
    <>
      <ellipse className="zd-shadow" cx="60" cy="96" rx="48" ry="6" />
      <path className="zd-wood-dark" d="M16 94L34 14M104 94L86 14M30 14h60" />
      <path className="zd-rope" d="M46 16v54M74 16v54" />
      <rect className="zd-pink" x="38" y="68" width="44" height="10" rx="5" />
    </>
  ),
  'pynt-dam': () => (
    <>
      <ellipse className="zd-stone" cx="60" cy="78" rx="54" ry="20" />
      <ellipse className="zd-water" cx="60" cy="78" rx="44" ry="14" />
      <path className="zd-stem" d="M14 74V48M20 72V54M106 74V50" />
      <ellipse className="zd-duck" cx="64" cy="72" rx="16" ry="10" />
      <circle className="zd-duck" cx="52" cy="58" r="8" />
      <path className="zd-beak" d="M44 58l-8 2l8 3z" />
    </>
  ),
  'pynt-traehus': () => (
    <>
      <ellipse className="zd-shadow" cx="60" cy="98" rx="34" ry="5" />
      <path className="zd-trunk" d="M54 98V60h12v38z" />
      <circle className="zd-leaf" cx="36" cy="40" r="22" />
      <circle className="zd-leaf" cx="84" cy="40" r="22" />
      <circle className="zd-leaf" cx="60" cy="24" r="22" />
      <rect className="zd-wood" x="40" y="40" width="40" height="28" rx="4" />
      <path className="zd-roof" d="M34 42L60 22L86 42z" />
      <rect className="zd-door" x="54" y="50" width="12" height="18" rx="5" />
      <path className="zd-rope" d="M84 66v30M94 66v30M84 76h10M84 86h10" />
    </>
  ),
  'pynt-springvand': () => (
    <>
      <path className="zd-stone" d="M14 74h92l-8 22H22z" />
      <ellipse className="zd-water" cx="60" cy="74" rx="46" ry="8" />
      <rect className="zd-stone" x="54" y="36" width="12" height="38" rx="3" />
      <ellipse className="zd-stone" cx="60" cy="36" rx="22" ry="6" />
      <path className="zd-spray" d="M60 30C60 14 40 12 30 30M60 30C60 14 80 12 90 30" />
      <g className="zd-drops">
        <circle className="zd-drop" cx="30" cy="40" r="3" />
        <circle className="zd-drop" cx="90" cy="40" r="3" />
        <circle className="zd-drop" cx="60" cy="10" r="3" />
      </g>
    </>
  ),
  'pynt-regnbuebue': () => (
    <>
      <path className="zd-band zd-band--1" d="M14 92A46 46 0 0 1 106 92" />
      <path className="zd-band zd-band--2" d="M22 92A38 38 0 0 1 98 92" />
      <path className="zd-band zd-band--3" d="M30 92A30 30 0 0 1 90 92" />
      <path className="zd-band zd-band--4" d="M38 92A22 22 0 0 1 82 92" />
      <ellipse className="zd-cloud" cx="18" cy="92" rx="16" ry="9" />
      <ellipse className="zd-cloud" cx="102" cy="92" rx="16" ry="9" />
    </>
  ),
}

/** One decor piece, 120 × 104 units; decorative (the cell around it speaks its name). */
export function DecorArt({ id, className }: { id: DecorId; className?: string }) {
  const draw = SHAPES[id]
  return (
    <svg className={cx('zoo-decor', className)} viewBox="0 0 120 104" aria-hidden data-decor={id}>
      {draw()}
    </svg>
  )
}
