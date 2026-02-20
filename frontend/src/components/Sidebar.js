import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Gift, LayoutDashboard, Megaphone, Users, UserCog, CreditCard, Award, TicketCheck, Shield, ScrollText, ShieldAlert, Globe, Menu, X, LogOut, ChevronDown, Building2 } from "lucide-react";

export default function Sidebar() {
  const { t, lang, switchLang } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === "super_admin";
  const isStaff = user?.role === "tenant_staff";

  const adminLinks = [
    { path: "/admin", label: t("nav.dashboard"), icon: LayoutDashboard },
  ];

  const tenantLinks = [
    { path: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { path: "/dashboard/profile", label: "Mon Entreprise", icon: Building2 },
    { path: "/dashboard/campaigns/new", label: t("tenant.new_campaign"), icon: Megaphone },
    { path: "/dashboard/redeem", label: t("nav.redeem"), icon: TicketCheck },
    { path: "/dashboard/billing", label: t("nav.billing"), icon: CreditCard },
  ];

  const staffLinks = [
    { path: "/dashboard/redeem", label: t("nav.redeem"), icon: TicketCheck },
  ];

  const links = isAdmin ? adminLinks : isStaff ? staffLinks : tenantLinks;

  const navContent = (
    <>
      <div className="flex items-center gap-2 px-4 py-5 border-b">
        <Link to="/" className="flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">{t("app.name")}</span>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {links.map((link) => {
          const active = location.pathname === link.path;
          return (
            <button
              key={link.path}
              onClick={() => { navigate(link.path); setOpen(false); }}
              data-testid={`nav-${link.path.replace(/\//g, "-").slice(1)}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <link.icon className="w-4.5 h-4.5" />
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4 space-y-3">
        <button
          onClick={() => switchLang(lang === "en" ? "fr" : "en")}
          data-testid="sidebar-lang-toggle"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Globe className="w-4.5 h-4.5" />
          {lang === "en" ? "Francais" : "English"}
        </button>
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
            {(user?.name || user?.email || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace("_", " ")}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-muted-foreground" data-testid="sidebar-logout">
          <LogOut className="w-4 h-4 mr-2" /> {t("nav.logout")}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border"
        data-testid="mobile-menu-toggle"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {open && <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r z-40 flex flex-col transition-transform ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`} data-testid="sidebar">
        {navContent}
      </aside>
    </>
  );
}
