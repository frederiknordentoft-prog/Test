/** Små inline-glyffer med ens stregvægt — erstatter emoji med ujævn optisk vægt. */

type IconProps = { size?: number; className?: string; title?: string }

function Svg({
  size = 15,
  className,
  title,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 1.6c.9 2.5-2.6 3.7-2.6 7a4.6 4.6 0 0 0 9.2 0c0-1.4-.6-2.6-1.4-3.6-.3 1-.9 1.6-1.6 1.9C11.9 4.6 10.3 2.7 8 1.6z" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.8 8.6 6.3 12 13.2 4.4" />
    </Svg>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 1.8 9.9 5.7l4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
    </Svg>
  )
}

/** Indstillinger som "sliders" — tre justérbare skydere. */
export function SlidersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 4.5h12M2 8h12M2 11.5h12" />
      <circle cx="6" cy="4.5" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="11" cy="8" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="11.5" r="1.7" fill="currentColor" stroke="none" />
    </Svg>
  )
}
