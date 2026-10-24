import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  StickyNote,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Build phase that delivers this section. Sections still in the future are marked "Soon". */
  phase: 1 | 2 | 3 | 4 | 6;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The only place navigation is defined; desktop sidebar, mobile drawer and bottom bar all read it. */
export const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, phase: 1 }] },
  {
    label: "Productivity",
    items: [
      { label: "Tasks", href: "/tasks", icon: CheckSquare, phase: 2 },
      { label: "Calendar", href: "/calendar", icon: CalendarDays, phase: 2 },
      { label: "Habits", href: "/habits", icon: Repeat, phase: 2 },
      { label: "Goals", href: "/goals", icon: Target, phase: 2 },
      { label: "Notes", href: "/notes", icon: StickyNote, phase: 2 },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Finances", href: "/finances", icon: Wallet, phase: 3 },
      { label: "Financial goals", href: "/financial-goals", icon: PiggyBank, phase: 3 },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Clients", href: "/clients", icon: Users, phase: 4 },
      { label: "Projects", href: "/projects", icon: FolderKanban, phase: 4 },
      { label: "Invoices", href: "/invoices", icon: FileText, phase: 4 },
      { label: "Payments", href: "/payments", icon: CreditCard, phase: 4 },
    ],
  },
  { label: "Insights", items: [{ label: "Reports", href: "/reports", icon: BarChart3, phase: 6 }] },
];

/** Built so far. Bump this as each phase ships. */
export const CURRENT_PHASE = 6;

export const BOTTOM_NAV = ["/dashboard", "/tasks", "/finances", "/invoices"] as const;

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
