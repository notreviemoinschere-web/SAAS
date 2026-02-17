import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ArrowLeft, Plus, Trash2, ExternalLink, TestTube, Rocket, Pause, StopCircle, Play } from "lucide-react";

const STATUS_ACTIONS = {
  draft: [
    { target: "test", label: "campaign.test_mode", icon: TestTube, variant: "outline" },
    { target: "active", label: "campaign.publish", icon: Rocket, variant: "default" },
  ],
  test: [
    { target: "active", label: "campaign.publish", icon: Rocket, variant: "default" },
    { target: "draft", label: "common.back", icon: ArrowLeft, variant: "outline" },
  ],
  active: [
    { target: "paused", label: "campaign.pause", icon: Pause, variant: "outline" },
    { target: "ended", label: "campaign.end", icon: StopCircle, variant: "destructive" },
  ],
  paused: [
    { target: "active", label: "campaign.resume", icon: Play, variant: "default" },
    { target: "ended", label: "campaign.end", icon: StopCircle, variant: "destructive" },
  ],
  ended: [],
};

const PRIZE_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

export default function CampaignEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isNew = !id || id === "new";

  const [campaign, setCampaign] = useState({
    title: "", title_fr: "", description: "", description_fr: "",
    start_date: "", end_date: "", legal_text: "", legal_text_fr: "",
    rules: "", rules_fr: "", status: "draft",
  });
  const [prizes, setPrizes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");

  const fetchCampaign = useCallback(async () => {
    if (isNew) return;
    try {
      const res = await api.get(`/tenant/campaigns/${id}`);
      setCampaign(res.data);
      setPrizes(res.data.prizes || []);
    } catch {
      navigate("/dashboard");
    }
  }, [id, isNew, navigate]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  const saveCampaign = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        const res = await api.post("/tenant/campaigns", campaign);
        navigate(`/dashboard/campaigns/${res.data.id}`);
      } else {
        await api.put(`/tenant/campaigns/${id}`, campaign);
        fetchCampaign();
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (target) => {
    setStatusError("");
    try {
      await api.put(`/tenant/campaigns/${id}/status`, { status: target });
      fetchCampaign();
    } catch (err) {
      setStatusError(err.response?.data?.detail || "Cannot change status");
    }
  };

  const addPrize = async () => {
    if (isNew) { setError("Save campaign first"); return; }
    try {
      const color = PRIZE_COLORS[prizes.length % PRIZE_COLORS.length];
      const res = await api.post(`/tenant/campaigns/${id}/prizes`, {
        label: "New Prize", weight: 1, stock: 10, color, prize_type: "coupon", value: "",
      });
      setPrizes([...prizes, res.data]);
    } catch {}
  };

  const updatePrize = async (prizeId, field, value) => {
    const updated = prizes.map((p) => p.id === prizeId ? { ...p, [field]: value } : p);
    setPrizes(updated);
  };

  const savePrize = async (prize) => {
    try {
      await api.put(`/tenant/prizes/${prize.id}`, {
        label: prize.label, label_fr: prize.label_fr, weight: parseInt(prize.weight),
        stock: parseInt(prize.stock), prize_type: prize.prize_type, value: prize.value, color: prize.color,
      });
    } catch {}
  };

  const deletePrize = async (prizeId) => {
    try {
      await api.delete(`/tenant/prizes/${prizeId}`);
      setPrizes(prizes.filter((p) => p.id !== prizeId));
    } catch {}
  };

  const actions = STATUS_ACTIONS[campaign.status] || [];
  const editable = ["draft", "paused"].includes(campaign.status);

  return (
    <div className="flex min-h-screen bg-background" data-testid="campaign-editor">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} data-testid="back-to-dashboard">
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">
              {isNew ? t("tenant.new_campaign") : campaign.title}
            </h1>
            {!isNew && (
              <Badge variant="outline" className="capitalize">{campaign.status}</Badge>
            )}
          </div>

          {error && <div data-testid="campaign-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">{error}</div>}
          {statusError && <div data-testid="status-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4">{statusError}</div>}

          {/* Status Actions */}
          {!isNew && actions.length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {actions.map((a) => (
                <Button key={a.target} variant={a.variant} size="sm" className="rounded-full" onClick={() => changeStatus(a.target)} data-testid={`status-${a.target}`}>
                  <a.icon className="w-4 h-4 mr-1" /> {t(a.label)}
                </Button>
              ))}
              {(campaign.status === "active" || campaign.status === "test") && (
                <a href={`/play/${campaign.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium hover:bg-primary/20 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Play Link: /play/{campaign.slug}
                </a>
              )}
            </div>
          )}

          {/* Campaign Details */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-base">Campaign Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{t("campaign.title")}</Label><Input data-testid="campaign-title" value={campaign.title} onChange={(e) => setCampaign({...campaign, title: e.target.value})} disabled={!editable && !isNew} /></div>
                <div><Label>{t("campaign.title_fr")}</Label><Input data-testid="campaign-title-fr" value={campaign.title_fr || ""} onChange={(e) => setCampaign({...campaign, title_fr: e.target.value})} disabled={!editable && !isNew} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{t("campaign.desc")}</Label><Textarea data-testid="campaign-desc" value={campaign.description || ""} onChange={(e) => setCampaign({...campaign, description: e.target.value})} disabled={!editable && !isNew} rows={3} /></div>
                <div><Label>{t("campaign.desc_fr")}</Label><Textarea data-testid="campaign-desc-fr" value={campaign.description_fr || ""} onChange={(e) => setCampaign({...campaign, description_fr: e.target.value})} disabled={!editable && !isNew} rows={3} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>{t("campaign.start")}</Label><Input data-testid="campaign-start" type="date" value={campaign.start_date || ""} onChange={(e) => setCampaign({...campaign, start_date: e.target.value})} disabled={!editable && !isNew} /></div>
                <div><Label>{t("campaign.end")}</Label><Input data-testid="campaign-end" type="date" value={campaign.end_date || ""} onChange={(e) => setCampaign({...campaign, end_date: e.target.value})} disabled={!editable && !isNew} /></div>
              </div>
              <div><Label>{t("campaign.legal")}</Label><Textarea data-testid="campaign-legal" value={campaign.legal_text || ""} onChange={(e) => setCampaign({...campaign, legal_text: e.target.value})} disabled={!editable && !isNew} rows={3} placeholder="Enter terms and conditions for this campaign..." /></div>
              <div><Label>{t("campaign.rules")}</Label><Textarea data-testid="campaign-rules" value={campaign.rules || ""} onChange={(e) => setCampaign({...campaign, rules: e.target.value})} disabled={!editable && !isNew} rows={2} placeholder="Game rules visible to players..." /></div>
              {(editable || isNew) && (
                <Button data-testid="save-campaign" onClick={saveCampaign} disabled={saving} className="rounded-full">
                  {saving ? t("common.loading") : t("common.save")}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Prizes */}
          {!isNew && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t("campaign.prizes")} ({prizes.length})</CardTitle>
                {editable && (
                  <Button data-testid="add-prize-btn" size="sm" variant="outline" className="rounded-full" onClick={addPrize}>
                    <Plus className="w-4 h-4 mr-1" /> {t("prize.add")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {prizes.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">No prizes added yet. Add at least one prize to publish.</p>
                ) : (
                  <div className="space-y-4">
                    {prizes.map((prize, i) => (
                      <div key={prize.id} className="border rounded-xl p-4 bg-muted/20">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-6 h-6 rounded-full border-2 flex-shrink-0" style={{ backgroundColor: prize.color || PRIZE_COLORS[i % PRIZE_COLORS.length] }} />
                          <span className="font-medium text-sm">Prize #{i + 1}</span>
                          {editable && (
                            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => deletePrize(prize.id)} data-testid={`delete-prize-${i}`}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">{t("prize.label")}</Label>
                            <Input data-testid={`prize-label-${i}`} value={prize.label} onChange={(e) => updatePrize(prize.id, "label", e.target.value)} onBlur={() => savePrize(prize)} disabled={!editable} className="h-9 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">{t("prize.weight")}</Label>
                            <Input data-testid={`prize-weight-${i}`} type="number" min="0" value={prize.weight} onChange={(e) => updatePrize(prize.id, "weight", e.target.value)} onBlur={() => savePrize(prize)} disabled={!editable} className="h-9 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">{t("prize.stock")}</Label>
                            <Input data-testid={`prize-stock-${i}`} type="number" min="0" value={prize.stock} onChange={(e) => updatePrize(prize.id, "stock", e.target.value)} onBlur={() => savePrize(prize)} disabled={!editable} className="h-9 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">{t("prize.value")}</Label>
                            <Input data-testid={`prize-value-${i}`} value={prize.value || ""} onChange={(e) => updatePrize(prize.id, "value", e.target.value)} onBlur={() => savePrize(prize)} disabled={!editable} className="h-9 text-sm" placeholder="e.g. 10% off" />
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Stock remaining: {prize.stock_remaining ?? prize.stock} | Color: 
                          <input type="color" value={prize.color || PRIZE_COLORS[i % PRIZE_COLORS.length]} onChange={(e) => { updatePrize(prize.id, "color", e.target.value); }} onBlur={() => savePrize(prize)} disabled={!editable} className="w-6 h-4 ml-1 cursor-pointer inline-block rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
