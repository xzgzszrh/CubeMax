import {
  BookmarkCheck,
  Building2,
  Cpu,
  Hammer,
  HousePlug,
  Info,
  type LucideIcon,
  Settings,
  TicketPercent,
  UserCircle,
  UserStar,
  Wallet,
} from "lucide-react";

export type SettingsPage =
  | "profile"
  | "cubeCat"
  | "smartHome"
  | "workspace"
  | "general"
  | "wallet"
  | "redeemCDK"
  | "tools"
  | "subscribe"
  | "about"
  | "personalized";

export type SettingsNavItem = {
  id: SettingsPage;
  name: string;
  icon: LucideIcon;
};

export type SettingsNavGroup = {
  label: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: "settings.nav.account.label",
    items: [
      { id: "profile", name: "settings.nav.account.profile", icon: UserCircle },
      {
        id: "cubeCat",
        name: "settings.nav.account.cubeCat",
        icon: Cpu,
      },
      {
        id: "smartHome",
        name: "settings.nav.account.smartHome",
        icon: HousePlug,
      },
      { id: "workspace", name: "settings.nav.account.workspace", icon: Building2 },
      { id: "wallet", name: "settings.nav.account.wallet", icon: Wallet },
      {
        id: "subscribe",
        name: "settings.nav.account.subscribe",
        icon: BookmarkCheck,
      },
      {
        id: "redeemCDK",
        name: "settings.nav.account.redeemCardKey",
        icon: TicketPercent,
      },
    ],
  },
  {
    label: "settings.nav.general.label",
    items: [
      { id: "general", name: "settings.nav.general.general", icon: Settings },
      { id: "about", name: "settings.nav.general.about", icon: Info },
    ],
  },
  {
    label: "settings.nav.ai.label",
    items: [
      { id: "personalized", name: "settings.nav.ai.personalized", icon: UserStar },
      { id: "tools", name: "settings.nav.ai.tools", icon: Hammer },
    ],
  },
];
