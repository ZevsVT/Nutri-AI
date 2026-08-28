import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "scan"
  | "book"
  | "chart"
  | "sparkles"
  | "recipe"
  | "user"
  | "bell"
  | "search"
  | "plus"
  | "minus"
  | "arrow"
  | "arrow-up-right"
  | "camera"
  | "upload"
  | "check"
  | "chevron"
  | "chevron-right"
  | "clock"
  | "more"
  | "water"
  | "leaf"
  | "flame"
  | "send"
  | "bookmark"
  | "bookmark-filled"
  | "settings"
  | "shield"
  | "shield-check"
  | "download"
  | "trash"
  | "close"
  | "edit"
  | "info"
  | "alert"
  | "menu"
  | "utensils"
  | "external"
  | "refresh"
  | "copy"
  | "sliders"
  | "calendar"
  | "layers"
  | "tag";

const paths: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-4.25v-6h-6.5v6H4.5A1.5 1.5 0 0 1 3 18.5v-8Z",
  scan: "M8 3H5.5A2.5 2.5 0 0 0 3 5.5V8m13-5h2.5A2.5 2.5 0 0 1 21 5.5V8m0 8v2.5a2.5 2.5 0 0 1-2.5 2.5H16M3 16v2.5A2.5 2.5 0 0 0 5.5 21H8m-2-9h12m-6-6v12",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm0 0v16M8 7h8m-8 4h6",
  chart: "M4 19V5m0 14h16M8 16v-4m4 4V7m4 9v-7",
  sparkles: "m12 3 1.2 4.3L17.5 9l-4.3 1.2L12 14.5l-1.2-4.3L6.5 9l4.3-1.7L12 3Zm6.5 12 .6 2.1 2.1.6-2.1.6-.6 2.1-.6-2.1-2.1-.6 2.1-.6.6-2.1ZM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15Z",
  recipe: "M6 3h12a1 1 0 0 1 1 1v16l-7-3-7 3V4a1 1 0 0 1 1-1Zm3 5h6m-6 3h6",
  user: "M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
  search: "m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  plus: "M12 5v14m-7-7h14",
  minus: "M5 12h14",
  arrow: "M5 12h13m-5-5 5 5-5 5",
  "arrow-up-right": "M7 17 17 7m0 0H7m10 0v10",
  camera: "M4 7h3l1.5-2h7L17 7h3v12H4V7Zm5 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z",
  upload: "M12 16V4m0 0L7 9m5-5 5 5M5 20h14",
  check: "m5 12 4.5 4.5L19 7",
  chevron: "m6 9 6 6 6-6",
  "chevron-right": "m9 18 6-6-6-6",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  water: "M12 3s6 6.1 6 11a6 6 0 1 1-12 0c0-4.9 6-11 6-11Z",
  leaf: "M20 4C9 4 4 9 4 17c0 1.1.9 2 2 2 8 0 13-5 14-15ZM4 19c2.5-3.5 5.5-5.5 9-7",
  flame: "M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-4 4-4 8a6 6 0 0 0 6 6Z",
  send: "m22 2-7 20-4-9-9-4 20-7ZM11 13l4-4",
  bookmark: "M6 3h12v18l-6-3-6 3V3Z",
  "bookmark-filled": "M6 3h12v18l-6-3-6 3V3Z",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.7 7.7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a8 8 0 0 0-1.7-1L15 3.6h-4L10.3 6a8 8 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a8 8 0 0 0 1.7 1l.7 2.4h4l.7-2.4a8 8 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1Z",
  shield: "M12 21s8-3.5 8-10V5l-8-3-8 3v6c0 6.5 8 10 8 10Z",
  "shield-check": "M12 21s8-3.5 8-10V5l-8-3-8 3v6c0 6.5 8 10 8 10Zm-3-10 2 2 4-4",
  download: "M12 3v12m0 0 5-5m-5 5-5-5M4 21h16",
  trash: "M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 14h10l1-14",
  close: "M6 6l12 12M18 6 6 18",
  edit: "m4 16.5-.8 3.3 3.3-.8L18 7.5 15.5 5 4 16.5ZM14 6.5l3.5 3.5",
  info: "M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  alert: "M12 9v4m0 4h.01M10.3 3.6 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.6a2 2 0 0 0-3.4 0Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  utensils: "M7 3v8m0 0c-2 0-3-1.3-3-3V3m3 8c2 0 3-1.3 3-3V3m-3 8v10m8-10V3m0 8c2 0 3-1.3 3-3V3m-3 8v10",
  external: "M14 5h5v5m0-5-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5",
  refresh: "M21 12a9 9 0 1 1-2.6-6.4L21 8m0-6v6h-6",
  copy: "M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Zm-4 6H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1",
  sliders: "M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6",
  calendar: "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm12-4v4M8 1v4M4 9h16",
  layers: "m12 2 10 5.5-10 5.5L2 7.5 12 2Zm0 11 10 5.5-10 5.5L2 18.5 12 13Z",
  tag: "m12.5 3.5 8 8-9 9-8-8v-9h9Zm-3.5 4.5h.01",
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className = "",
  ...props
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
