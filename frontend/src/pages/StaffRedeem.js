import { useState } from "react";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Search, CheckCircle2, XCircle, Gift, User, Calendar } from "lucide-react";

export default function StaffRedeem() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  const verifyCode = async () => {
    setError("");
    setVerifyResult(null);
    setRedeemed(false);
    setLoading(true);
    try {
      const res = await api.get(`/tenant/rewards/${code}/verify`);
      setVerifyResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Code not found");
    } finally {
      setLoading(false);
    }
  };

  const redeemCode = async () => {
    setError("");
    setLoading(true);
    try {
      await api.post(`/tenant/rewards/${code}/redeem`);
      setRedeemed(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to redeem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background" data-testid="staff-redeem-page">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{t("redeem.title")}</h1>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input
                  data-testid="redeem-code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t("redeem.enter")}
                  className="font-mono text-lg tracking-wider"
                  onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                />
                <Button data-testid="verify-code-btn" onClick={verifyCode} disabled={!code || loading} className="rounded-full px-6">
                  <Search className="w-4 h-4 mr-1" /> {t("redeem.verify")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive/50 mb-4">
              <CardContent className="pt-6 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-medium text-destructive">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {redeemed && (
            <Card className="border-green-200 bg-green-50 mb-4">
              <CardContent className="pt-6 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">{t("redeem.success")}</p>
                  <p className="text-sm text-green-600">Code: {code}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {verifyResult && !redeemed && (
            <Card className="animate-fade-in">
              <CardHeader><CardTitle className="text-base">Code Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Prize</p>
                      <p className="font-medium text-sm">{verifyResult.prize?.label || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Player</p>
                      <p className="font-medium text-sm">{verifyResult.player?.email || "N/A"}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="text-sm">{verifyResult.reward?.expires_at ? new Date(verifyResult.reward.expires_at).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant={verifyResult.reward?.status === "active" ? "default" : "destructive"} className="capitalize">
                    {verifyResult.reward?.status}
                  </Badge>
                </div>

                {verifyResult.reward?.status === "active" && (
                  <Button data-testid="confirm-redeem-btn" onClick={redeemCode} disabled={loading} className="w-full rounded-full" size="lg">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> {t("redeem.confirm")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
