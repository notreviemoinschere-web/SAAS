import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Check, CreditCard, Loader2 } from "lucide-react";

const PLANS = {
  free: { name: "Free", price: 0, features: ["1 active campaign", "500 plays/month", "Basic analytics"] },
  pro: { name: "Pro", price: 29, features: ["Unlimited campaigns", "10,000 plays/month", "CSV export", "Advanced analytics", "Up to 5 staff", "No SaaS branding"] },
  business: { name: "Business", price: 99, features: ["Unlimited plays", "Multi-location", "Webhooks", "API access", "White label", "Priority support"] },
};

export default function Billing() {
  const { t } = useI18n();
  const { tenant, fetchMe } = useAuth();
  const [searchParams] = useSearchParams();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const sessionId = searchParams.get("session_id");
  const currentPlan = tenant?.plan || "free";

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get("/billing/invoices");
      setInvoices(res.data.invoices);
    } catch {}
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Poll payment status if returning from Stripe
  useEffect(() => {
    if (!sessionId) return;
    let attempts = 0;
    const maxAttempts = 5;

    const poll = async () => {
      setPolling(true);
      try {
        const res = await api.get(`/billing/checkout/status/${sessionId}`);
        if (res.data.payment_status === "paid") {
          setPolling(false);
          fetchMe();
          fetchInvoices();
          return;
        }
        if (res.data.status === "expired") {
          setPolling(false);
          return;
        }
      } catch {}
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        setPolling(false);
      }
    };
    poll();
  }, [sessionId, fetchMe, fetchInvoices]);

  const handleUpgrade = async (plan) => {
    setLoading(true);
    try {
      const res = await api.post("/billing/checkout", {
        plan,
        billing_cycle: "monthly",
        origin_url: window.location.origin,
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background" data-testid="billing-page">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{t("nav.billing")}</h1>

          {polling && (
            <Card className="mb-6 border-primary/50 bg-primary/5">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm">Processing payment...</span>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {Object.entries(PLANS).map(([key, plan]) => {
              const isCurrent = key === currentPlan;
              const isUpgrade = !isCurrent && (
                (currentPlan === "free" && (key === "pro" || key === "business")) ||
                (currentPlan === "pro" && key === "business")
              );

              return (
                <Card key={key} className={`relative ${isCurrent ? "border-primary ring-1 ring-primary/20" : ""}`}>
                  {isCurrent && (
                    <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-semibold py-1 text-center rounded-t-lg">
                      {t("billing.current")}
                    </div>
                  )}
                  <CardHeader className={isCurrent ? "pt-10" : ""}>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="mt-2">
                      {plan.price > 0 ? (
                        <span className="text-3xl font-bold">${plan.price}<span className="text-base font-normal text-muted-foreground">{t("billing.month")}</span></span>
                      ) : (
                        <span className="text-3xl font-bold">{t("billing.free")}</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {isUpgrade && (
                      <Button
                        data-testid={`upgrade-${key}-btn`}
                        onClick={() => handleUpgrade(key)}
                        disabled={loading}
                        className="w-full rounded-full"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        {loading ? t("common.loading") : t("billing.upgrade")}
                      </Button>
                    )}
                    {isCurrent && <Button variant="outline" className="w-full rounded-full" disabled>Current Plan</Button>}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("billing.invoices")}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{inv.plan}</TableCell>
                      <TableCell>${inv.amount?.toFixed(2)}</TableCell>
                      <TableCell><Badge variant="default" className="capitalize">{inv.payment_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
