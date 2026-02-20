import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Gift, Globe, CheckCircle2, Loader2 } from "lucide-react";
import api from "../lib/api";

export default function Signup() {
  const { t, lang, switchLang } = useI18n();
  const { signup, login } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form"); // form, verifying, done

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await signup(businessName, email, password);
      setStep("verifying");
      
      // Auto-verify email
      try {
        await api.post("/auth/verify-email", { token: data.verification_token });
      } catch {}
      
      // Auto-login
      try {
        await login(email, password);
        setStep("done");
        setTimeout(() => navigate("/dashboard"), 500);
      } catch {
        // If auto-login fails, redirect to login page
        navigate("/login");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  if (step === "verifying") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="signup-verifying">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardContent className="pt-8 pb-6">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Setting up your account...</h2>
            <p className="text-muted-foreground">Please wait while we create your space.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="signup-success">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardContent className="pt-8 pb-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
            <p className="text-muted-foreground mb-4">Your account is ready. Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="signup-page">
      <div className="absolute top-4 right-4">
        <button data-testid="lang-toggle-signup" onClick={() => switchLang(lang === "en" ? "fr" : "en")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Globe className="w-4 h-4" />{lang === "en" ? "FR" : "EN"}
        </button>
      </div>
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            <Gift className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">{t("app.name")}</span>
          </Link>
          <CardTitle className="text-2xl">{t("auth.signup.title")}</CardTitle>
          <CardDescription>{t("auth.signup.sub")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div data-testid="signup-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="business">{t("auth.business")}</Label>
              <Input data-testid="signup-business" id="business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="My Restaurant" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input data-testid="signup-email" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input data-testid="signup-password" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
            </div>
            <Button data-testid="signup-submit" type="submit" className="w-full rounded-full" disabled={loading}>
              {loading ? t("common.loading") : t("landing.cta")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.hasaccount")}{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">{t("nav.login")}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
