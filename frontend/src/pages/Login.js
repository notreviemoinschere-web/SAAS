import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Gift, Globe } from "lucide-react";

export default function Login() {
  const { t, lang, switchLang } = useI18n();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.role === "super_admin") navigate("/admin");
      else if (data.user.role === "tenant_staff") navigate("/dashboard/redeem");
      else navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="login-page">
      <div className="absolute top-4 right-4">
        <button data-testid="lang-toggle-login" onClick={() => switchLang(lang === "en" ? "fr" : "en")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Globe className="w-4 h-4" />{lang === "en" ? "FR" : "EN"}
        </button>
      </div>
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            <Gift className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">{t("app.name")}</span>
          </Link>
          <CardTitle className="text-2xl">{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.sub")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div data-testid="login-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input data-testid="login-email" id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input data-testid="login-password" id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">{t("auth.forgot")}</Link>
            </div>
            <Button data-testid="login-submit" type="submit" className="w-full rounded-full" disabled={loading}>
              {loading ? t("common.loading") : t("nav.login")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.noaccount")}{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">{t("nav.signup")}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
