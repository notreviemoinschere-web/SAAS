import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Gift, Users, BarChart3, Zap, Check, ArrowRight, Globe } from "lucide-react";

const PLANS = [
  {
    id: "free",
    features: ["1 active campaign", "500 plays/month", "Basic analytics", "SaaS branding visible"],
  },
  {
    id: "pro",
    price: 29,
    features: ["Unlimited campaigns", "10,000 plays/month", "CSV export", "Advanced analytics", "Up to 5 staff", "Remove SaaS branding"],
  },
  {
    id: "business",
    price: 99,
    features: ["Unlimited plays", "Multi-location", "Webhooks", "Custom domain", "OTP verification", "API access", "White label", "Priority support"],
  },
];

export default function Landing() {
  const { t, lang, switchLang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Gift className="w-7 h-7 text-primary" />
            <span className="font-semibold text-xl tracking-tight">{t("app.name")}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="lang-toggle"
              onClick={() => switchLang(lang === "en" ? "fr" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Globe className="w-4 h-4" />
              {lang === "en" ? "FR" : "EN"}
            </button>
            {user ? (
              <Button data-testid="goto-dashboard" onClick={() => navigate(user.role === "super_admin" ? "/admin" : "/dashboard")} size="sm">
                {t("nav.dashboard")}
              </Button>
            ) : (
              <>
                <Button data-testid="goto-login" variant="ghost" onClick={() => navigate("/login")} size="sm">
                  {t("nav.login")}
                </Button>
                <Button data-testid="goto-signup" onClick={() => navigate("/signup")} size="sm" className="rounded-full px-5">
                  {t("nav.signup")}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium rounded-full">
            Gamification for local businesses
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
            {t("landing.hero")}
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("landing.subtitle")}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button data-testid="hero-signup-btn" onClick={() => navigate("/signup")} size="lg" className="rounded-full px-8 text-base">
              {t("landing.cta")} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button data-testid="hero-demo-btn" variant="outline" size="lg" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full px-8 text-base">
              {t("landing.demo")}
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: t("landing.feat1.title"), desc: t("landing.feat1.desc") },
              { icon: Users, title: t("landing.feat2.title"), desc: t("landing.feat2.desc") },
              { icon: BarChart3, title: t("landing.feat3.title"), desc: t("landing.feat3.desc") },
            ].map((f, i) => (
              <Card key={i} className={`border-0 shadow-none bg-muted/30 animate-fade-in stagger-${i + 1}`}>
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-base md:text-lg font-semibold text-primary mb-2">Pricing</h2>
          <h3 className="text-2xl sm:text-3xl font-bold mb-3">{t("landing.pricing")}</h3>
          <p className="text-muted-foreground mb-12">{t("landing.pricing.sub")}</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan, i) => (
              <Card key={plan.id} className={`relative overflow-hidden ${plan.id === "pro" ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border"}`}>
                {plan.id === "pro" && (
                  <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-1 text-center">
                    Most Popular
                  </div>
                )}
                <CardHeader className={plan.id === "pro" ? "pt-10" : ""}>
                  <CardTitle className="text-lg">{t(`billing.${plan.id}`)}</CardTitle>
                  <div className="mt-3">
                    {plan.price ? (
                      <span className="text-3xl font-bold">${plan.price}<span className="text-base font-normal text-muted-foreground">{t("billing.month")}</span></span>
                    ) : (
                      <span className="text-3xl font-bold">{t("billing.free")}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-left">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    data-testid={`pricing-${plan.id}-btn`}
                    className="w-full mt-6 rounded-full"
                    variant={plan.id === "pro" ? "default" : "outline"}
                    onClick={() => navigate("/signup")}
                  >
                    {plan.price ? t("landing.cta") : "Get Started"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-4 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gift className="w-5 h-5" />
            <span className="text-sm">&copy; 2026 PrizeWheel Pro. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="/cookies" className="hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
