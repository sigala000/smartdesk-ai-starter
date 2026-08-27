type DashboardIconProps = Readonly<{
  name:
    | "brand"
    | "overview"
    | "requests"
    | "handoffs"
    | "organization"
    | "whatsapp"
    | "search"
    | "user"
    | "arrow"
    | "shield"
    | "empty";
  size?: number;
}>;

const paths: Readonly<Record<DashboardIconProps["name"], React.ReactNode>> = {
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  brand: <path d="m13 2-8 11h6l-1 9 9-12h-6V2Z" />,
  empty: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M10.5 7v7M7 10.5h7" />
    </>
  ),
  handoffs: (
    <>
      <path d="M5 18v2l3-2h8a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 2.7" />
      <path d="M8 8h8M8 12h5" />
    </>
  ),
  organization: (
    <>
      <path d="M4 21V8l8-4 8 4v13M8 21v-4h8v4M8 10h1M12 10h1M16 10h1M8 14h1M12 14h1M16 14h1" />
    </>
  ),
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  requests: (
    <>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v5h4M10 13l2 2 4-4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  shield: (
    <path d="M12 3 5 6v5c0 4.7 2.8 8.4 7 10 4.2-1.6 7-5.3 7-10V6l-7-3Zm-3 9 2 2 4-4" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M4 20l1.2-4A8.5 8.5 0 1 1 8 19.2L4 20Z" />
      <path d="M9 8.5c.5 3 2 4.5 5 5" />
    </>
  ),
};

export function DashboardIcon({ name, size = 20 }: DashboardIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {paths[name]}
      </g>
    </svg>
  );
}
