import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      {children}
    </svg>
  );
}

// Round outline stroke: every shape in this style.
const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Small filled dots (info dot, ellipsis, bullets).
const dot = { fill: "currentColor", stroke: "none" } as const;

// Filled silhouettes, brand marks only.
const solid = { fill: "currentColor", stroke: "none" } as const;

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 4v16M4 12h16" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4 12h16" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M6 9l6 6 6-6" />
  </Icon>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M6 15l6-6 6 6" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M15 6l-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M9 6l6 6-6 6" />
  </Icon>
);

export const ChevronsUpDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M7.5 8.5L12 4l4.5 4.5M7.5 15.5L12 20l4.5-4.5" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4 12h16M14 6l6 6-6 6" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M20 12H4M10 6l-6 6 6 6" />
  </Icon>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 20V4M6 10l6-6 6 6" />
  </Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 4v16M6 14l6 6 6-6" />
  </Icon>
);

export const ArrowUpRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M6.5 17.5l11-11M8 6.5h9.5V16" />
  </Icon>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M10 3.5H7.5a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4V14" />
    <path {...line} d="M14.5 3.5h6v6M20 4l-8.5 8.5" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M9 6h11M9 12h11M9 18h11" />
    <circle {...dot} cx="4.5" cy="6" r="1.25" />
    <circle {...dot} cx="4.5" cy="12" r="1.25" />
    <circle {...dot} cx="4.5" cy="18" r="1.25" />
  </Icon>
);

export const MoreHorizontalIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...dot} cx="5" cy="12" r="1.4" />
    <circle {...dot} cx="12" cy="12" r="1.4" />
    <circle {...dot} cx="19" cy="12" r="1.4" />
  </Icon>
);

export const MoreVerticalIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...dot} cx="12" cy="5" r="1.4" />
    <circle {...dot} cx="12" cy="12" r="1.4" />
    <circle {...dot} cx="12" cy="19" r="1.4" />
  </Icon>
);

export const GripVerticalIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...dot} cx="9" cy="5.5" r="1.4" />
    <circle {...dot} cx="15" cy="5.5" r="1.4" />
    <circle {...dot} cx="9" cy="12" r="1.4" />
    <circle {...dot} cx="15" cy="12" r="1.4" />
    <circle {...dot} cx="9" cy="18.5" r="1.4" />
    <circle {...dot} cx="15" cy="18.5" r="1.4" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M8.5 4L4 8.5 8.5 13" />
    <path {...line} d="M4.5 8.5H14a5.5 5.5 0 0 1 0 11h-3.5" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4.7 3.6l2.6-.6c.8-.2 1.6.3 1.9.9l1.4 3.3c.3.6.2 1.4-.5 1.9l-1.7 1.4a11.2 11.2 0 0 0 5.1 5.1l1.4-1.7c.5-.6 1.2-.8 1.9-.5l3.3 1.4c.6.3 1.1 1.1.9 1.9l-.6 2.6c-.2.8-.9 1.2-1.7 1.2C9.8 20.4 3.6 14.2 3.5 5.3c0-.8.5-1.5 1.2-1.7z" />
  </Icon>
);

export const CarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4.8 16.5H3.5a1 1 0 0 1-1-1v-2.3a2 2 0 0 1 1.4-1.9l2.3-.8 2.5-3.4A3 3 0 0 1 11.1 6h3.3a3 3 0 0 1 2.3 1.1l2.8 3.4 1.2.3a2 2 0 0 1 1.5 1.9v2.8a1 1 0 0 1-1 1h-1.3M9.2 16.5h5.6" />
    <path {...line} d="M6.4 10.5h13.1M12.5 6.2v4.3" />
    <circle {...line} cx="7" cy="16.5" r="2.2" />
    <circle {...line} cx="17" cy="16.5" r="2.2" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="11" cy="11" r="8" />
    <path {...line} d="M17 17l4.5 4.5" />
  </Icon>
);

export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4 6.5h16M7 12h10M10 17.5h4" />
  </Icon>
);

export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3 7h7.5M18.5 7H21M3 17h2.5M13.5 17H21" />
    <circle {...line} cx="14.5" cy="7" r="2.5" />
    <circle {...line} cx="9.5" cy="17" r="2.5" />
  </Icon>
);

export const SortIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M19.94 11A8 8 0 0 0 5.39 7.5M4.06 13a8 8 0 0 0 14.55 3.5" />
    <path {...line} d="M5.4 3v4.5h4.5M18.6 21v-4.5h-4.5" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M10.5 7.5l1.6-1.6a4.6 4.6 0 0 1 6.5 6.5L17 14M13.5 16.5l-1.6 1.6a4.6 4.6 0 0 1-6.5-6.5L7 10M9.5 14.5l5-5" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="8" y="8" width="13.5" height="13.5" rx="3.5" />
    <path {...line} d="M15.8 4.8A3.5 3.5 0 0 0 12.5 2.5H6A3.5 3.5 0 0 0 2.5 6v6.5a3.5 3.5 0 0 0 2.3 3.3" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 15V3.5M7.5 8L12 3.5 16.5 8M3.5 15v1.5a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4V15" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5M3.5 15v1.5a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4V15" />
  </Icon>
);

export const CodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M8 6.5L2.5 12 8 17.5M16 6.5l5.5 5.5-5.5 5.5" />
  </Icon>
);

export const TerminalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4.5 6.5L10 12l-5.5 5.5M12.5 18h7" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M12 6.5V12l3.5 2.5" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M12 16.5v-5" />
    <circle {...dot} cx="12" cy="8" r="1.1" />
  </Icon>
);

export const AlertCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M12 7.5V13" />
    <circle {...dot} cx="12" cy="16.5" r="1.1" />
  </Icon>
);

export const HelpCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M9.2 9.4a2.9 2.9 0 0 1 5.7.8c0 1.9-2.9 2.3-2.9 4.1" />
    <circle {...dot} cx="12" cy="17.3" r="1.1" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M8 12.3l2.8 2.8L16.2 9.6" />
  </Icon>
);

export const XCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M9 9l6 6M15 9l-6 6" />
  </Icon>
);

export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M10 4.4a2.3 2.3 0 0 1 4 0l7.6 13.3a2.3 2.3 0 0 1-2 3.4H4.4a2.3 2.3 0 0 1-2-3.4z" />
    <path {...line} d="M12 9.5v4.5" />
    <circle {...dot} cx="12" cy="17.3" r="1.1" />
  </Icon>
);

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M2 12h20M12 2c2.7 2.7 4 6 4 10s-1.3 7.3-4 10c-2.7-2.7-4-6-4-10s1.3-7.3 4-10z" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2" y="4" width="20" height="16" rx="4.5" />
    <path {...line} d="M6 8.5l4.3 3.1a3 3 0 0 0 3.4 0L18 8.5" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="4" width="19" height="17.5" rx="4.5" />
    <path {...line} d="M8 2.5v3M16 2.5v3M2.5 9.5h19" />
  </Icon>
);
export const SidebarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M9 3.5v17" />
  </Icon>
);
export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="3" y="3" width="7.5" height="7.5" rx="2.5" />
    <rect {...line} x="13.5" y="3" width="7.5" height="7.5" rx="2.5" />
    <rect {...line} x="3" y="13.5" width="7.5" height="7.5" rx="2.5" />
    <rect {...line} x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5" />
  </Icon>
);
export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M2.6 13.1a2.4 2.4 0 010-2.2C4.6 7 8 5 12 5s7.4 2 9.4 5.9a2.4 2.4 0 010 2.2C19.4 17 16 19 12 19s-7.4-2-9.4-5.9z" />
    <circle {...line} cx="12" cy="12" r="3" />
  </Icon>
);
export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M9.9 5.2A10 10 0 0112 5c4 0 7.4 2 9.4 5.9a2.4 2.4 0 010 2.2 12 12 0 01-1.8 2.6M14.6 18.7A10 10 0 0112 19c-4 0-7.4-2-9.4-5.9a2.4 2.4 0 010-2.2 12 12 0 012.9-3.6M14.1 14.1a3 3 0 01-4.2-4.2" />
    <path {...line} d="M3.5 3.5l17 17" />
  </Icon>
);
export const LoaderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 3a9 9 0 109 9" />
  </Icon>
);
export const BoldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M7 6.5a2 2 0 012-2h3.5a3.75 3.75 0 010 7.5H7zM7 12h6.5a3.75 3.75 0 010 7.5H9a2 2 0 01-2-2z" />
  </Icon>
);
export const ItalicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M10 4.5h8M6 19.5h8M15 4.5l-6 15" />
  </Icon>
);
export const UnderlineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M7 4v6.5a5 5 0 0010 0V4M5 20.5h14" />
  </Icon>
);
export const StrikethroughIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M17 6.8c-.8-1.5-2.5-2.5-5-2.5-3 0-5 1.6-5 3.7 0 1 .4 1.8 1.2 2.4M4 12h16M7 17.2c.8 1.5 2.6 2.5 5.2 2.5 3 0 5-1.6 5-3.8 0-.6-.1-1.1-.4-1.6" />
  </Icon>
);
export const HighlighterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M14.6 3.9a2 2 0 0 1 2.8 0l2.7 2.7a2 2 0 0 1 0 2.8L13 16.5 7.5 11z" />
    <path {...line} d="M7.5 11l-1.5 1.5a1.5 1.5 0 0 0-.3 1.7l.5 1.1-2.7 2.7h4.2l.8-.8 1.1.5a1.5 1.5 0 0 0 1.7-.3l1.7-1.9" />
    <path {...line} d="M13.5 20.5h7" />
  </Icon>
);
export const BaselineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M6.5 16l4.6-10.4a1 1 0 011.8 0L17.5 16M8.3 12h7.4M4 20.5h16" />
  </Icon>
);
export const ListOrderedIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M10.5 6.5h10M10.5 12h10M10.5 17.5h10M3.8 4.6l1.7-1.1v6" />
    <path {...line} d="M3.7 15a1.7 1.7 0 013.2.8c0 1.6-3.2 2.3-3.2 4.2h3.4" />
  </Icon>
);
export const ListTodoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="3" y="3.5" width="6.5" height="6.5" rx="2" />
    <path {...line} d="M3.5 17l2 2 3.5-4M13 6.75h8M13 17h8" />
  </Icon>
);
export const QuoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4 4v16M9 6.5h11M9 12h11M9 17.5h7" />
  </Icon>
);
export const TypeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4.5 7.5V6a2 2 0 012-2h11a2 2 0 012 2v1.5M12 4v16M9 20h6" />
  </Icon>
);
export const TableIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M2.5 9.5h19M9.5 9.5v11" />
  </Icon>
);
export const ListCollapseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4 4.5l3 3-3 3M11 7.5h10M11 16.5h10" />
    <circle {...dot} cx="5.5" cy="16.5" r="1.25" />
  </Icon>
);
export const SquareCodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="2.5" width="19" height="19" rx="4.5" />
    <path {...line} d="M10 9l-3 3 3 3M14 9l3 3-3 3" />
  </Icon>
);
export const CalloutIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2" y="4" width="20" height="16" rx="4.5" />
    <circle {...dot} cx="7" cy="9.5" r="1.25" />
    <path {...line} d="M10.5 9.5H17M7 14.5h10" />
  </Icon>
);
export const AlignLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3 4.5h18M3 9.5h11M3 14.5h18M3 19.5h11" />
  </Icon>
);
export const AlignCenterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3 4.5h18M6.5 9.5h11M3 14.5h18M6.5 19.5h11" />
  </Icon>
);
export const AlignRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3 4.5h18M10 9.5h11M3 14.5h18M10 19.5h11" />
  </Icon>
);
export const SmartphoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="5" y="2" width="14" height="20" rx="4" />
    <path {...line} d="M10.5 18h3" />
  </Icon>
);
export const PanelBottomIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M2.5 14.5h19" />
  </Icon>
);
export const RectangleHorizontalIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2" y="6" width="20" height="12" rx="4" />
    <path {...line} d="M8.5 12h7" />
  </Icon>
);
export const MoveVerticalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 3.5v17M8.5 7L12 3.5 15.5 7M8.5 17l3.5 3.5 3.5-3.5" />
  </Icon>
);
export const BracesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M8.5 3.5H8a2.5 2.5 0 00-2.5 2.5v3.5C5.5 10.9 4.5 12 3 12c1.5 0 2.5 1.1 2.5 2.5V18A2.5 2.5 0 008 20.5h.5M15.5 3.5h.5A2.5 2.5 0 0118.5 6v3.5c0 1.4 1 2.5 2.5 2.5-1.5 0-2.5 1.1-2.5 2.5V18a2.5 2.5 0 01-2.5 2.5h-.5" />
  </Icon>
);
export const GitBranchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="18" cy="6" r="3" />
    <path {...line} d="M6 3v18M18 9v.5a6.5 6.5 0 01-6.5 6.5H6" />
  </Icon>
);
export const CircleDotIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <circle {...line} cx="12" cy="12" r="3" />
  </Icon>
);
export const GitPullRequestIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="6" cy="5.5" r="2.5" />
    <circle {...line} cx="6" cy="18.5" r="2.5" />
    <circle {...line} cx="18" cy="18.5" r="2.5" />
    <path {...line} d="M6 8v8M18 16V9.5a3 3 0 00-3-3h-4M13.5 4L11 6.5 13.5 9" />
  </Icon>
);
export const PanelRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M15 3.5v17" />
  </Icon>
);
export const CornerDownRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M5 4.5V10a4 4 0 004 4h10.5M15 9.5l4.5 4.5-4.5 4.5" />
  </Icon>
);
export const AsteriskIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 4v16M5.07 8l13.86 8M5.07 16l13.86-8" />
  </Icon>
);
export const ApertureIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="10" />
    <path {...line} d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94" />
  </Icon>
);
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 20.5c-.4 0-.8-.1-1.1-.4C6.3 16.7 2.5 13.5 2.5 9a4.9 4.9 0 0 1 9.5-1.7A4.9 4.9 0 0 1 21.5 9c0 4.5-3.8 7.7-8.4 11.1-.3.3-.7.4-1.1.4z" />
  </Icon>
);
export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12.82 4.31L14.45 7.73Q14.88 8.64 15.87 8.77L19.63 9.26Q21.51 9.51 20.13 10.82L17.39 13.43Q16.66 14.11 16.84 15.1L17.53 18.82Q17.88 20.69 16.21 19.78L12.88 17.98Q12 17.5 11.12 17.98L7.79 19.78Q6.12 20.69 6.47 18.82L7.16 15.1Q7.34 14.11 6.61 13.43L3.87 10.82Q2.49 9.51 4.37 9.26L8.13 8.77Q9.12 8.64 9.55 7.73L11.18 4.31Q12 2.6 12.82 4.31z" />
  </Icon>
);
export const BoltIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M13.23 3.03L5.4 13.01Q4.6 14.04 5.9 14.04L10.54 14.04Q11.44 14.04 11.28 14.92L10.2 20.71Q9.96 21.99 10.77 20.97L18.6 10.99Q19.4 9.96 18.1 9.96L13.46 9.96Q12.56 9.96 12.72 9.08L13.8 3.29Q14.04 2.01 13.23 3.03z" />
  </Icon>
);
export const SparklesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M10.5 3.5c.9 4.3 2.5 5.9 6.8 6.8-4.3.9-5.9 2.5-6.8 6.8-.9-4.3-2.5-5.9-6.8-6.8 4.3-.9 5.9-2.5 6.8-6.8z" />
    <path {...line} d="M18.5 14.5c.4 2 1.1 2.6 3 3-1.9.4-2.6 1.1-3 3-.4-1.9-1-2.6-3-3 2-.4 2.6-1 3-3z" />
  </Icon>
);
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3 10.6c0-.9.4-1.7 1.1-2.3l5.6-4.6a3.6 3.6 0 0 1 4.6 0l5.6 4.6c.7.6 1.1 1.4 1.1 2.3V18a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 18z" />
    <path {...line} d="M9.5 21.5V17a2.5 2.5 0 0 1 5 0v4.5" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="7.5" r="4.5" />
    <path {...line} d="M4 20.5c0-3.3 3.6-6 8-6s8 2.7 8 6" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="9" cy="7.5" r="4" />
    <path {...line} d="M2.5 20.5c0-3.2 2.9-5.7 6.5-5.7s6.5 2.5 6.5 5.7" />
    <path {...line} d="M15.5 3.7a4 4 0 0 1 0 7.6" />
    <path {...line} d="M18.2 15.2c1.9.8 3.3 2.7 3.3 5.3" />
  </Icon>
);

export const PaletteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 2.5a9.5 9.5 0 0 0 0 19c1.2 0 2-.8 2-1.9 0-1.3-1-1.7-1-2.8 0-1 .8-1.8 1.8-1.8h2c2.7 0 4.7-2 4.7-4.6C21.5 6.1 17.3 2.5 12 2.5z" />
    <circle {...dot} cx="7.3" cy="12" r="1.3" />
    <circle {...dot} cx="8.6" cy="7.6" r="1.3" />
    <circle {...dot} cx="13.4" cy="6.6" r="1.3" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M9.47 4.99Q10.58 4.53 10.7 3.34L10.71 3.16Q10.82 2.07 11.92 2.07L12.08 2.07Q13.18 2.07 13.29 3.16L13.3 3.34Q13.42 4.53 14.53 4.99L15.16 5.25Q16.27 5.71 17.2 4.96L17.34 4.84Q18.19 4.15 18.97 4.92L19.08 5.03Q19.85 5.81 19.16 6.66L19.04 6.8Q18.29 7.73 18.75 8.84L19.01 9.47Q19.47 10.58 20.66 10.7L20.84 10.71Q21.93 10.82 21.93 11.92L21.93 12.08Q21.93 13.18 20.84 13.29L20.66 13.3Q19.47 13.42 19.01 14.53L18.75 15.16Q18.29 16.27 19.04 17.2L19.16 17.34Q19.85 18.19 19.08 18.97L18.97 19.08Q18.19 19.85 17.34 19.16L17.2 19.04Q16.27 18.29 15.16 18.75L14.53 19.01Q13.42 19.47 13.3 20.66L13.29 20.84Q13.18 21.93 12.08 21.93L11.92 21.93Q10.82 21.93 10.71 20.84L10.7 20.66Q10.58 19.47 9.47 19.01L8.84 18.75Q7.73 18.29 6.8 19.04L6.66 19.16Q5.81 19.85 5.03 19.08L4.92 18.97Q4.15 18.19 4.84 17.34L4.96 17.2Q5.71 16.27 5.25 15.16L4.99 14.53Q4.53 13.42 3.34 13.3L3.16 13.29Q2.07 13.18 2.07 12.08L2.07 11.92Q2.07 10.82 3.16 10.71L3.34 10.7Q4.53 10.58 4.99 9.47L5.25 8.84Q5.71 7.73 4.96 6.8L4.84 6.66Q4.15 5.81 4.92 5.03L5.03 4.92Q5.81 4.15 6.66 4.84L6.8 4.96Q7.73 5.71 8.84 5.25z" />
    <circle {...line} cx="12" cy="12" r="3" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M5.2 15.6l.3-5.1a6.5 6.5 0 0 1 13 0l.3 5.1 1.1 1.6c.6.9 0 2-1 2H5.1c-1 0-1.6-1.1-1-2z" />
    <path {...line} d="M9.5 21.5h5" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="3.5" y="10" width="17" height="11.5" rx="4" />
    <path {...line} d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" />
    <path {...line} d="M12 14.5v2.5" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M19.5 6l-.7 11.6a4 4 0 0 1-4 3.9H9.2a4 4 0 0 1-4-3.9L4.5 6" />
    <path {...line} d="M3 6h18M8.5 6l.7-2a2 2 0 0 1 1.9-1.5h1.8a2 2 0 0 1 1.9 1.5l.7 2M10 11v5.5M14 11v5.5" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M16.3 3.9a2.6 2.6 0 0 1 3.7 0l.1.1a2.6 2.6 0 0 1 0 3.7L8.6 19.2a3 3 0 0 1-1.4.8l-3.9 1.1 1.1-3.9a3 3 0 0 1 .8-1.4z" />
    <path {...line} d="M14 6.2l3.8 3.8" />
  </Icon>
);

export const BookmarkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M5.5 6.5A4 4 0 0 1 9.5 2.5h5a4 4 0 0 1 4 4v13.1c0 1-1.1 1.6-1.9 1L12 17.2l-4.6 3.4c-.8.6-1.9 0-1.9-1z" />
  </Icon>
);

export const FlagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4.5 21.5V4.6c1-.9 2.3-1.4 4-1.4 3.2 0 4.8 2 7.6 2 1.4 0 2.5-.3 3.4-.9.5-.3 1 0 1 .6v9.4c0 .4-.2.7-.5.9-1 .6-2.3.9-3.9.9-2.8 0-4.4-2-7.6-2-1.7 0-3 .4-4 1.2" />
  </Icon>
);

export const TagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M2.5 4.8v5.8c0 .8.3 1.6.9 2.1l8.1 8.1a2.6 2.6 0 0 0 3.6 0l5.8-5.8a2.6 2.6 0 0 0 0-3.6L12.8 3.3c-.6-.6-1.3-.9-2.1-.9H4.9a2.4 2.4 0 0 0-2.4 2.4z" />
    <circle {...line} cx="7.6" cy="7.6" r="1.6" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 4.6 4.5 8.8 6.3 10.4.7.6 1.7.6 2.4 0 1.8-1.6 6.3-5.8 6.3-10.4A7.5 7.5 0 0 0 12 2.5z" />
    <circle {...line} cx="12" cy="10" r="2.75" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M2.5 7.5A3.5 3.5 0 0 1 6 4h2.6a2 2 0 0 1 1.6.8l1 1.4a2 2 0 0 0 1.6.8H18a3.5 3.5 0 0 1 3.5 3.5V17a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 17z" />
  </Icon>
);

export const FileIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M13.6 2.5H8.5a4 4 0 0 0-4 4v11a4 4 0 0 0 4 4h7a4 4 0 0 0 4-4V8.4c0-.5-.2-1-.6-1.4l-3.9-3.9c-.4-.4-.9-.6-1.4-.6z" />
    <path {...line} d="M13.5 2.8V6.5a2 2 0 0 0 2 2h3.7" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <circle {...line} cx="8.5" cy="9" r="1.75" />
    <path {...line} d="M21.2 15.6l-3.3-3.3a2 2 0 0 0-2.8 0L6.8 20.4" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M2.5 9.5A3.5 3.5 0 0 1 6 6h1.5c.6 0 1.2-.3 1.5-.8l.8-1.1c.4-.6 1-.9 1.6-.9h1.2c.6 0 1.2.3 1.6.9l.8 1.1c.3.5.9.8 1.5.8H18a3.5 3.5 0 0 1 3.5 3.5V17a3.5 3.5 0 0 1-3.5 3.5H6A3.5 3.5 0 0 1 2.5 17z" />
    <circle {...line} cx="12" cy="13" r="3.75" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M7 3.5h10a4.5 4.5 0 0 1 4.5 4.5v6a4.5 4.5 0 0 1-4.5 4.5h-4l-4.3 3.2c-.7.5-1.7 0-1.7-.8v-2.4A4.5 4.5 0 0 1 2.5 14V8A4.5 4.5 0 0 1 7 3.5z" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M4.6 3.7l15.8 7.2c.9.4.9 1.8 0 2.2L4.6 20.3c-.9.4-1.8-.5-1.4-1.4L6 12 3.2 5.1c-.4-.9.5-1.8 1.4-1.4z" />
    <path {...line} d="M6 12h5.5" />
  </Icon>
);

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="8.5" y="2.5" width="7" height="12" rx="3.5" />
    <path {...line} d="M5 11a7 7 0 0 0 14 0" />
    <path {...line} d="M12 18v3.5" />
  </Icon>
);

export const AttachIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M16.5 6.5l-8 8.2a2 2 0 0 0 2.8 2.8l8.1-8.2a4 4 0 0 0-5.7-5.7l-8.1 8.2a6 6 0 0 0 8.5 8.5l8-8.1" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M6.5 5.3v13.4c0 1.2 1.3 1.9 2.3 1.3l10.4-6.7c.9-.6.9-2 0-2.6L8.8 4c-1-.6-2.3.1-2.3 1.3z" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="5" y="3.5" width="5" height="17" rx="2.25" />
    <rect {...line} x="14" y="3.5" width="5" height="17" rx="2.25" />
  </Icon>
);

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="4" y="4" width="16" height="16" rx="4.5" />
  </Icon>
);

export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2" y="3" width="20" height="14" rx="4" />
    <path {...line} d="M12 17v4M8 21h8" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="12" cy="12" r="4" />
    <path {...line} d="M19 12L21.5 12M16.95 16.95L18.72 18.72M12 19L12 21.5M7.05 16.95L5.28 18.72M5 12L2.5 12M7.05 7.05L5.28 5.28M12 5L12 2.5M16.95 7.05L18.72 5.28" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M11.4 2.6a7.2 7.2 0 0 0 10 10A9.5 9.5 0 1 1 11.4 2.6z" />
  </Icon>
);

export const CloudIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M17.5 19.5H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z" />
  </Icon>
);

export const LightbulbIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M9 16.5c-.3-1.2-1-2.1-1.9-2.9a7 7 0 1 1 9.8 0c-.9.8-1.6 1.7-1.9 2.9" />
    <path {...line} d="M9 19h6M10.2 21.7h3.6" />
  </Icon>
);

export const ThumbsUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M7.5 10.5v11M7.5 21.5H5A2.5 2.5 0 0 1 2.5 19v-6A2.5 2.5 0 0 1 5 10.5h2.2a2 2 0 0 0 1.8-1.1l2.6-5.4c.3-.6 1-.9 1.6-.7 1.5.5 2.4 2.1 2 3.7l-.7 3h4.2a2.5 2.5 0 0 1 2.4 3.2l-1.9 6.5c-.4 1.1-1.4 1.8-2.5 1.8z" />
  </Icon>
);

export const ThumbsDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M 7.5 13.5 v -11 M 7.5 2.5 H 5 A 2.5 2.5 0 0 0 2.5 5 v 6 A 2.5 2.5 0 0 0 5 13.5 h 2.2 a 2 2 0 0 1 1.8 1.1 l 2.6 5.4 c 0.3 0.6 1 0.9 1.6 0.7 1.5 -0.5 2.4 -2.1 2 -3.7 l -0.7 -3 h 4.2 a 2.5 2.5 0 0 0 2.4 -3.2 l -1.9 -6.5 c -0.4 -1.1 -1.4 -1.8 -2.5 -1.8 z" />
  </Icon>
);

export const CartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M2.5 3h1.4c.9 0 1.7.6 1.9 1.5l2 9.3a2.5 2.5 0 0 0 2.4 2h7.9a2.5 2.5 0 0 0 2.4-1.9l1.3-5.4a1.5 1.5 0 0 0-1.5-1.9H5.4" />
    <circle {...line} cx="9.5" cy="20" r="1.5" />
    <circle {...line} cx="17.5" cy="20" r="1.5" />
  </Icon>
);

export const CreditCardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2" y="4.5" width="20" height="15" rx="4" />
    <path {...line} d="M2 9.5h20M6.5 15h3" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M11.2 2.8l-6 2.3c-.8.3-1.2 1-1.2 1.8v4.9c0 4.6 3.3 8.1 7.3 9.5.5.2 1 .2 1.4 0 4-1.4 7.3-4.9 7.3-9.5V6.9c0-.8-.5-1.5-1.2-1.8l-6-2.3c-.5-.2-1.1-.2-1.6 0z" />
  </Icon>
);

export const KeyIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle {...line} cx="7.5" cy="16.5" r="5" />
    <path {...line} d="M11 13L20.5 3.5M15.5 8.5l3 3M18.5 5.5l2.5 2.5" />
  </Icon>
);

export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M9.5 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h2.5" />
    <path {...line} d="M15.5 7.5L20 12l-4.5 4.5M20 12H9.5" />
  </Icon>
);

export const DatabaseIcon = (p: IconProps) => (
  <Icon {...p}>
    <ellipse {...line} cx="12" cy="5.5" rx="8" ry="3" />
    <path {...line} d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
    <path {...line} d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="13" width="4" height="8" rx="2" />
    <rect {...line} x="10" y="3" width="4" height="18" rx="2" />
    <rect {...line} x="17.5" y="8.5" width="4" height="12.5" rx="2" />
  </Icon>
);

export const BotIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M12 6.5V3.5" />
    <rect {...line} x="3" y="6.5" width="18" height="14" rx="4.5" />
    <path {...line} d="M9 12v2.5M15 12v2.5" />
  </Icon>
);

export const TerminalSquareIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="2.5" width="19" height="19" rx="5" />
    <path {...line} d="M7.5 9l3 3-3 3M13 15h3.5" />
  </Icon>
);

export const ShapesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M11.19 3.88Q12 2.5 12.81 3.88L15.79 8.92Q16.6 10.3 15 10.3L9 10.3Q7.4 10.3 8.21 8.92z" />
    <rect {...line} x="2.5" y="13.5" width="7.5" height="7.5" rx="2.25" />
    <circle {...line} cx="17.5" cy="17.25" r="3.9" />
  </Icon>
);

export const NavigationIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M19.7 3.53Q21 3 20.47 4.3L14.33 19.3Q13.8 20.6 13.4 19.26L11.69 13.56Q11.4 12.6 10.44 12.31L4.74 10.6Q3.4 10.2 4.7 9.67z" />
  </Icon>
);

export const ServerIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="2.75" width="19" height="7.5" rx="3.5" />
    <rect {...line} x="2.5" y="13.75" width="19" height="7.5" rx="3.5" />
    <circle {...dot} cx="6.75" cy="6.5" r="1.2" />
    <circle {...dot} cx="6.75" cy="17.5" r="1.2" />
  </Icon>
);

export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M2.5 13h4.2c.6 0 1.1.4 1.3.9l.5 1.4c.2.5.7.9 1.3.9h4.4c.6 0 1.1-.4 1.3-.9l.5-1.4c.2-.5.7-.9 1.3-.9h4.2" />
  </Icon>
);

export const CalendarDaysIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="4" width="19" height="17.5" rx="4.5" />
    <path {...line} d="M8 2.5v3M16 2.5v3M2.5 9.5h19" />
    <circle {...dot} cx="7.5" cy="13.5" r="1.1" />
    <circle {...dot} cx="12" cy="13.5" r="1.1" />
    <circle {...dot} cx="16.5" cy="13.5" r="1.1" />
    <circle {...dot} cx="7.5" cy="17.25" r="1.1" />
    <circle {...dot} cx="12" cy="17.25" r="1.1" />
    <circle {...dot} cx="16.5" cy="17.25" r="1.1" />
  </Icon>
);

export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M2.5 12a9.5 9.5 0 1 0 2.8-6.7L2.5 8" />
    <path {...line} d="M2.5 3.5V8H7" />
    <path {...line} d="M12 7v5l3.5 2" />
  </Icon>
);

export const ClipboardListIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="4" y="4" width="16" height="17.5" rx="4" />
    <rect {...line} x="8.5" y="2.5" width="7" height="4" rx="1.75" />
    <circle {...dot} cx="8.5" cy="11.5" r="1.1" />
    <circle {...dot} cx="8.5" cy="16" r="1.1" />
    <path {...line} d="M11.5 11.5h4.5M11.5 16h4.5" />
  </Icon>
);

export const QinyangLogoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2" y="2" width="20" height="20" rx="6" />
    <circle {...line} cx="11.5" cy="10.5" r="3.75" />
    <path {...line} d="M15.25 7v10.5" />
  </Icon>
);

export const GithubIcon = (p: IconProps) => (
  <Icon {...p}>
    <path {...solid} d="M 6.14 2.67 c 1.03 0 2.75 1.2 3.61 2.06 a 14.45 14.45 0 0 1 5.5 0 c 0.86 -0.86 2.58 -2.06 3.61 -2.06 0.52 1.38 0.69 3.1 0.34 4.47 1.03 1.2 1.55 2.58 1.55 4.13 0 3.78 -2.24 5.68 -5.68 6.19 0.52 0.69 0.69 1.55 0.69 2.58 v 1.89 H 9.23 v -1.89 c 0 -1.03 0.17 -1.89 0.69 -2.58 -3.44 -0.52 -5.68 -2.41 -5.68 -6.19 0 -1.55 0.52 -2.92 1.55 -4.13 -0.34 -1.38 -0.17 -3.1 0.34 -4.47 z" />
    <path {...line} d="M 9.23 21.07 c -2.24 0 -3.44 -0.69 -4.3 -1.89" />
  </Icon>
);
export const Columns2Icon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M12 3.5v17" />
  </Icon>
);
export const Rows2Icon = (p: IconProps) => (
  <Icon {...p}>
    <rect {...line} x="2.5" y="3.5" width="19" height="17" rx="4.5" />
    <path {...line} d="M2.5 12h19" />
  </Icon>
);
export const Heading1Icon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3.5 5.5v13M11.5 5.5v13M3.5 12h8M16 10l3-2v10.5" />
  </Icon>
);
export const Heading2Icon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3.5 5.5v13M11.5 5.5v13M3.5 12h8M15.5 10a2.5 2.5 0 015 .6c0 2.6-5 4.4-5 7.9h5" />
  </Icon>
);
export const Heading3Icon = (p: IconProps) => (
  <Icon {...p}>
    <path {...line} d="M3.5 5.5v13M11.5 5.5v13M3.5 12h8M15.5 8.5h4.5l-2.6 3.6a3 3 0 11-2.2 5.6" />
  </Icon>
);
