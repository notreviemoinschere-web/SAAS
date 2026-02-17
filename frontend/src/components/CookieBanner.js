import { useState, useEffect } from "react";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Cookie, X } from "lucide-react";
import api from "../lib/api";

export default function CookieBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [prefs, setPrefs] = useState({ necessary: true, analytics: false, marketing: false });

  useEffect(() => {
    const consent = localStorage.getItem("pwp_cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const saveConsent = async (categories) => {
    localStorage.setItem("pwp_cookie_consent", JSON.stringify(categories));
    setVisible(false);
    try { await api.post("/cookie-consent", { categories }); } catch {}
  };

  const acceptAll = () => saveConsent({ necessary: true, analytics: true, marketing: true });
  const rejectAll = () => saveConsent({ necessary: true, analytics: false, marketing: false });
  const savePrefs = () => saveConsent(prefs);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" data-testid="cookie-banner">
      <Card className="max-w-2xl mx-auto shadow-xl border-border">
        <CardContent className="pt-5 pb-4">
          {!showManage ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <Cookie className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{t("cookie.text")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button data-testid="cookie-accept" onClick={acceptAll} size="sm" className="rounded-full">{t("cookie.accept")}</Button>
                <Button data-testid="cookie-reject" onClick={rejectAll} variant="outline" size="sm" className="rounded-full">{t("cookie.reject")}</Button>
                <Button data-testid="cookie-manage" onClick={() => setShowManage(true)} variant="ghost" size="sm" className="rounded-full">{t("cookie.manage")}</Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Cookie Preferences</h3>
                <button onClick={() => setShowManage(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Necessary Cookies</Label>
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Analytics Cookies</Label>
                  <Switch data-testid="cookie-analytics" checked={prefs.analytics} onCheckedChange={(v) => setPrefs({...prefs, analytics: v})} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Marketing Cookies</Label>
                  <Switch data-testid="cookie-marketing" checked={prefs.marketing} onCheckedChange={(v) => setPrefs({...prefs, marketing: v})} />
                </div>
              </div>
              <Button data-testid="cookie-save-prefs" onClick={savePrefs} size="sm" className="w-full rounded-full">{t("common.save")}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
