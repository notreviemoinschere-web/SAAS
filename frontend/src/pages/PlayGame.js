import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { WheelOfFortune } from "../components/WheelOfFortune";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Gift, Globe, Copy, CheckCircle2, XCircle } from "lucide-react";
import api from "../lib/api";

export default function PlayGame() {
  const { slug } = useParams();
  const { t, lang, switchLang } = useI18n();
  const [campaign, setCampaign] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/game/${slug}?lang=${lang}`);
        setCampaign(res.data.campaign);
        setPrizes(res.data.prizes);
        setTenantInfo(res.data.tenant);
        setPhase("form");
      } catch (err) {
        setError(err.response?.data?.detail || "Campaign not found");
        setPhase("error");
      }
    };
    load();
  }, [slug, lang]);

  const handleSpin = async () => {
    if (!email || !consent) {
      setError("Please enter your email and accept terms");
      return null;
    }
    setError("");
    setSpinning(true);
    setPhase("spinning");

    try {
      const res = await api.post(`/game/${slug}/play`, {
        email,
        phone: phone || null,
        consent_accepted: true,
        device_hash: navigator.userAgent,
        lang,
      });

      setTimeout(() => {
        setResult(res.data);
        setSpinning(false);
        setPhase("result");
      }, 4200);

      return res.data.prize_index;
    } catch (err) {
      setSpinning(false);
      setPhase("form");
      setError(err.response?.data?.detail || "Failed to play");
      return null;
    }
  };

  const copyCode = () => {
    if (result?.reward?.code) {
      navigator.clipboard.writeText(result.reward.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="game-error">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">{error}</p>
            <a href="/" className="text-primary text-sm hover:underline">Go to homepage</a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="play-game-page">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">{tenantInfo?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {campaign?.status === "test" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">TEST MODE</Badge>}
          <button data-testid="game-lang-toggle" onClick={() => switchLang(lang === "en" ? "fr" : "en")} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:bg-muted transition-colors">
            <Globe className="w-3.5 h-3.5" />{lang === "en" ? "FR" : "EN"}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-display text-3xl sm:text-4xl tracking-wider text-foreground">
            {t("game.spin_to_win")}
          </h1>
          {campaign?.description && <p className="text-sm text-muted-foreground mt-2 max-w-md">{campaign.description}</p>}
        </div>

        {/* Wheel */}
        <WheelOfFortune
          prizes={prizes}
          onSpinRequest={handleSpin}
          spinning={spinning}
          resultIndex={result?.prize_index}
        />

        {/* Form / Result */}
        {phase === "form" && (
          <Card className="w-full max-w-sm animate-slide-up">
            <CardContent className="pt-6 space-y-4">
              {error && <div data-testid="game-play-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{error}</div>}
              <div>
                <Label className="text-sm">{t("game.enter_email")}</Label>
                <Input data-testid="game-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
              </div>
              <div>
                <Label className="text-sm">{t("game.enter_phone")}</Label>
                <Input data-testid="game-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 ..." />
              </div>
              <div className="flex items-start gap-2">
                <input
                  data-testid="game-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  id="consent"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-[hsl(243,75%,59%)]"
                />
                <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  {t("game.accept_terms")}
                  {campaign?.legal_text && (
                    <span className="block mt-1 text-xs opacity-70 max-h-20 overflow-y-auto">{campaign.legal_text}</span>
                  )}
                </Label>
              </div>
              <Button data-testid="spin-btn" onClick={handleSpin} disabled={!email || !consent || spinning} className="w-full rounded-full font-display text-xl tracking-wider py-6" size="lg">
                {spinning ? t("game.spinning") : t("game.spin")}
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "spinning" && (
          <p className="text-lg font-medium text-muted-foreground animate-pulse">{t("game.spinning")}</p>
        )}

        {phase === "result" && result && (
          <Card className="w-full max-w-sm animate-slide-up">
            <CardContent className="pt-6 text-center space-y-4">
              {result.won ? (
                <>
                  <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
                  <h2 className="text-xl font-bold">{t("game.congrats")}</h2>
                  <p className="text-muted-foreground">
                    {t("game.you_won")}: <span className="font-semibold text-foreground">{result.reward?.prize_label}</span>
                  </p>
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">{t("game.your_code")}</p>
                    <div className="flex items-center justify-center gap-2">
                      <code data-testid="reward-code" className="text-2xl font-mono font-bold tracking-widest">{result.reward?.code}</code>
                      <button onClick={copyCode} className="p-1 hover:bg-background rounded transition-colors" data-testid="copy-code-btn">
                        {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                      </button>
                    </div>
                    {result.reward?.expires_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t("game.code_expires")}: {new Date(result.reward.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {result.is_test && <Badge variant="outline" className="bg-amber-50 text-amber-700">TEST - Not redeemable</Badge>}
                </>
              ) : (
                <>
                  <XCircle className="w-14 h-14 text-muted-foreground mx-auto" />
                  <h2 className="text-xl font-bold">{t("game.no_prize")}</h2>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Rules */}
      {campaign?.rules && (
        <footer className="px-4 py-4 border-t bg-white">
          <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">{campaign.rules}</p>
        </footer>
      )}
    </div>
  );
}
