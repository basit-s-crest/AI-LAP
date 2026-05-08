import type { Role } from "@/types/role";
import {
  LayoutDashboard,
  Smile,
  UsersRound,
  MessageCircle,
  Sparkles,
  BookOpen,
  UserCircle,
  Users,
  Calendar,
  Mail,
  Clock,
  FileText,
  Building2,
  BarChart3,
  UserCheck,
  Settings,
  Shield,
  Image,
  Flag,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
  badge?: string;
  portal?: boolean;
}

export const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/mood-mapping", label: "Mood Mapping", icon: Smile },
  { href: "/community-groups", label: "Community", icon: UsersRound },
  { href: "/coaching", label: "Coaching", icon: MessageCircle },
  { href: "/empowerment-kit", label: "Empowerment Kit", icon: Sparkles },
  { href: "/resources", label: "Resources", icon: BookOpen, section: "Support" },
  { href: "/profile", label: "My Profile", icon: UserCircle, section: "Support" },
];

export const COACH_NAV: NavItem[] = [
  { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "My Clients", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Calendar },
  { href: "/messages", label: "Messages", icon: Mail, badge: "2" },
  { href: "/risk-dashboard", label: "Live Risk Dashboard", icon: Activity },
  { href: "/availability", label: "Availability", icon: Clock },
  { href: "/notes", label: "Session Notes", icon: FileText },
];

export const ORG_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/outcomes", label: "Outcomes & Reports", icon: BarChart3 },
  { href: "/coaches", label: "Our Coaches", icon: UserCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const SUPERADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Admin Platform" },
  { href: "/users", label: "Users", icon: Users, section: "Admin Platform", badge: "1" },
  { href: "/admin/coaches", label: "Coaches", icon: UserCheck, section: "Admin Platform" },
  {
    href: "/admin/groups",
    label: "Community Groups",
    icon: UsersRound,
    section: "Admin Platform",
  },
  { href: "/media", label: "Media & Photos", icon: Image, section: "Admin Platform" },
  { href: "/moderation", label: "Moderation", icon: Flag, section: "Admin Platform", badge: "3" },
  { href: "/organizations", label: "Client Orgs", icon: Building2, section: "Admin Platform" },
  { href: "/activity", label: "Activity Log", icon: Activity, section: "Admin Platform" },
  {
    href: "/impersonate/org",
    label: "Client Org Portal",
    icon: Building2,
    section: "Switch Portal",
    portal: true,
  },
  {
    href: "/impersonate/coach",
    label: "Coach Portal",
    icon: UserCheck,
    section: "Switch Portal",
    portal: true,
  },
  {
    href: "/impersonate/member",
    label: "Member App",
    icon: Sparkles,
    section: "Switch Portal",
    portal: true,
  },
];

export function navForRole(role: Role): NavItem[] {
  switch (role) {
    case "user":
      return USER_NAV;
    case "coach":
      return COACH_NAV;
    case "organization":
      return ORG_NAV;
    case "superadmin":
      return SUPERADMIN_NAV;
    default:
      return USER_NAV;
  }
}

export function roleAccent(role: Role): string {
  switch (role) {
    case "user":
      return "#7AB882";
    case "coach":
      return "#3A6E99";
    case "organization":
      return "#B8832A";
    case "superadmin":
      return "#7AB882";
    default:
      return "#7AB882";
  }
}

export function roleSidebarLabel(role: Role): string {
  switch (role) {
    case "user":
      return "Member";
    case "coach":
      return "Coach Portal";
    case "organization":
      return "Client Organization";
    case "superadmin":
      return "Super Admin";
    default:
      return "";
  }
}
