import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { 
  ArrowLeft, Plus, Trash2, Play, Pause, CheckCircle, Eye, Copy, ExternalLink,
  Gamepad2, Users, Gift, Settings, FileText, Sparkles, QrCode, Edit, AlertTriangle
} from "lucide-react";

const defaultPrize = {
  label: "",
  prize_type: "discount",
  value: "",
  weight: 10,
  stock_total: 100,
  expiration_days: 30,
  is_consolation: false,
  display_color: "#6366f1"
};

const prizeTypes = [
  { value: "discount", label: "Réduction (%)" },
  { value: "free_item", label: "Article gratuit" },
  { value: "gift", label: "Cadeau" },
  { value: "points", label: "Points fidélité" },
  { value: "consolation", label: "Lot de consolation" }
];

const prizeColors = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", 
  "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"
];

export default function AdminCampaignBuilder() {
  const { tenantId, campaignId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!campaignId;
  
  const [tenant, setTenant] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [showWizard, setShowWizard] = useState(!!searchParams.get('new') || isEdit);
  const [testLink, setTestLink] = useState(null);
  const [showTestLink, setShowTestLink] = useState(false);
  
  const [form, setForm] = useState({
    // Step 1 - Basics
    title: "",
    slug: "",
    timezone: "Europe/Paris",
    starts_at: "",
    ends_at: "",
    
    // Step 2 - Player Requirements
    require_email: true,
    require_phone: false,
    require_whatsapp: false,
    max_plays_per_email: 2,
    max_plays_per_phone: 2,
    require_social_follow: false,
    social_platforms_required: [],
    consent_marketing_email: true,
    consent_marketing_sms: false,
    consent_marketing_whatsapp: false,
    
    // Step 3 - Prizes
    prizes: [{ ...defaultPrize, label: "10% de réduction", value: "10", display_color: "#22c55e" }],
    
    // Step 4 - Legal & Display
    intro_text: "Tentez votre chance et gagnez des lots exceptionnels !",
    cta_text: "Tourner la roue !",
    terms_text: "",
    offer_terms_text: "",
    show_google_review: true
  });

  const fetchTenantData = useCallback(async () => {
    try {
      setLoading(true);
      const [tenantRes, campaignsRes] = await Promise.all([
        api.get(`/admin/tenants/${tenantId}`),
        api.get(`/admin/tenants/${tenantId}/campaigns`)
      ]);
      setTenant(tenantRes.data.tenant);
      setCampaigns(campaignsRes.data.campaigns);
      
      // If editing, load campaign data
      if (campaignId) {
        const campaign = campaignsRes.data.campaigns.find(c => c.id === campaignId);
        if (campaign) {
          setForm({
            title: campaign.title || "",
            slug: campaign.slug || "",
            timezone: campaign.timezone || "Europe/Paris",
            starts_at: campaign.starts_at?.split('T')[0] || "",
            ends_at: campaign.ends_at?.split('T')[0] || "",
            require_email: campaign.require_email ?? true,
            require_phone: campaign.require_phone ?? false,
            require_whatsapp: campaign.require_whatsapp ?? false,
            max_plays_per_email: campaign.max_plays_per_email ?? 2,
            max_plays_per_phone: campaign.max_plays_per_phone ?? 2,
            require_social_follow: campaign.require_social_follow ?? false,
            social_platforms_required: campaign.social_platforms_required || [],
            consent_marketing_email: campaign.consent_marketing_email ?? true,
            consent_marketing_sms: campaign.consent_marketing_sms ?? false,
            consent_marketing_whatsapp: campaign.consent_marketing_whatsapp ?? false,
            prizes: campaign.prizes?.length ? campaign.prizes : [defaultPrize],
            intro_text: campaign.intro_text || "",
            cta_text: campaign.cta_text || "Tourner la roue !",
            terms_text: campaign.terms_text || "",
            offer_terms_text: campaign.offer_terms_text || "",
            show_google_review: campaign.show_google_review ?? true
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, campaignId]);

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  const handleFormChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handlePrizeChange = (index, field, value) => {
    const newPrizes = [...form.prizes];
    newPrizes[index] = { ...newPrizes[index], [field]: value };
    setForm({ ...form, prizes: newPrizes });
  };

  const addPrize = () => {
    const colorIndex = form.prizes.length % prizeColors.length;
    setForm({
      ...form,
      prizes: [...form.prizes, { ...defaultPrize, display_color: prizeColors[colorIndex] }]
    });
  };

  const removePrize = (index) => {
    if (form.prizes.length <= 1) return;
    setForm({
      ...form,
      prizes: form.prizes.filter((_, i) => i !== index)
    });
  };

  const handleSave = async (asDraft = true) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null
      };

      if (isEdit) {
        await api.patch(`/admin/tenants/${tenantId}/campaigns/${campaignId}`, payload);
      } else {
        await api.post(`/admin/tenants/${tenantId}/campaigns`, payload);
      }

      setShowWizard(false);
      fetchTenantData();
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (campaign, newStatus) => {
    try {
      await api.post(`/admin/tenants/${tenantId}/campaigns/${campaign.id}/status`, {
        status: newStatus,
        reason: `Changed by admin`
      });
      fetchTenantData();
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur"));
    }
  };

  const handleGenerateTestLink = async (campaign) => {
    try {
      const res = await api.post(`/admin/tenants/${tenantId}/campaigns/${campaign.id}/test-link`);
      setTestLink(res.data);
      setShowTestLink(true);
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur"));
    }
  };

  const handleDuplicate = async (campaign) => {
    try {
      await api.post(`/admin/tenants/${tenantId}/campaigns/${campaign.id}/duplicate`);
      fetchTenantData();
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur"));
    }
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Supprimer la campagne "${campaign.title}" ?`)) return;
    try {
      await api.delete(`/admin/tenants/${tenantId}/campaigns/${campaign.id}`);
      fetchTenantData();
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur"));
    }
  };

  const validateStep = (stepNum) => {
    if (stepNum === 1) {
      if (!form.title.trim()) return "Le titre est requis";
    }
    if (stepNum === 3) {
      if (form.prizes.length === 0) return "Au moins un lot est requis";
      for (const p of form.prizes) {
        if (!p.label.trim()) return "Tous les lots doivent avoir un nom";
        if (p.stock_total <= 0) return "Le stock doit être supérieur à 0";
      }
    }
    if (stepNum === 4) {
      if (!form.terms_text.trim()) return "Les CGV sont requises";
    }
    return null;
  };

  const canGoNext = (stepNum) => {
    return !validateStep(stepNum);
  };

  const statusBadges = {
    draft: { variant: "secondary", label: "Brouillon" },
    test: { variant: "outline", label: "Test" },
    active: { variant: "default", label: "Actif" },
    paused: { variant: "destructive", label: "Pausé" },
    ended: { variant: "secondary", label: "Terminé" }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Chargement...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background" data-testid="admin-campaign-builder">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/tenants/${tenantId}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au tenant
            </Button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Gamepad2 className="w-6 h-6 text-primary" />
                Campagnes de {tenant?.name}
              </h1>
              <p className="text-muted-foreground">
                Créez et gérez les campagnes pour ce tenant
              </p>
            </div>
            <Button onClick={() => { setShowWizard(true); setStep(1); }} data-testid="create-campaign-btn">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle campagne
            </Button>
          </div>

          {/* Banner for admin-created campaigns */}
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 p-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">
              Les campagnes créées ici sont gérées par l'administrateur pour le compte du tenant.
            </span>
          </div>

          {/* Campaigns List */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Campagne</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Créé par</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">/{c.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadges[c.status]?.variant || "secondary"}>
                        {statusBadges[c.status]?.label || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.play_count || 0}
                      {c.test_play_count > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (+{c.test_play_count} test)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.stock_remaining}/{c.total_stock}
                    </TableCell>
                    <TableCell>
                      {c.created_by_admin ? (
                        <Badge variant="outline" className="text-xs">Admin</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tenant</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Status actions */}
                        {c.status === 'draft' && (
                          <Button variant="ghost" size="sm" onClick={() => handleStatusChange(c, 'test')} title="Passer en test">
                            <Play className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {c.status === 'test' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleGenerateTestLink(c)} title="Lien test">
                              <ExternalLink className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleStatusChange(c, 'active')} title="Publier">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </Button>
                          </>
                        )}
                        {c.status === 'active' && (
                          <Button variant="ghost" size="sm" onClick={() => handleStatusChange(c, 'paused')} title="Pause">
                            <Pause className="w-4 h-4 text-amber-500" />
                          </Button>
                        )}
                        {c.status === 'paused' && (
                          <Button variant="ghost" size="sm" onClick={() => handleStatusChange(c, 'active')} title="Reprendre">
                            <Play className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        
                        {/* Edit */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            navigate(`/admin/tenants/${tenantId}/campaigns/${c.id}`);
                            window.location.reload();
                          }}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        
                        {/* Duplicate */}
                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(c)} title="Dupliquer">
                          <Copy className="w-4 h-4" />
                        </Button>
                        
                        {/* Delete */}
                        {c.status !== 'active' && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(c)} title="Supprimer">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {campaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucune campagne. Créez la première !
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>

      {/* Campaign Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {isEdit ? "Modifier la campagne" : "Nouvelle campagne"}
            </DialogTitle>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s}
                className={`flex-1 h-2 rounded-full ${step >= s ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            Étape {step}/4: {
              step === 1 ? "Informations de base" :
              step === 2 ? "Exigences joueur" :
              step === 3 ? "Configuration des lots" :
              "Textes légaux et affichage"
            }
          </div>

          {/* Step 1: Basics */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Titre de la campagne *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                  placeholder="Ex: Roue de la Fortune Noël 2026"
                  className="mt-1"
                  data-testid="campaign-title"
                />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => handleFormChange("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="noel-2026 (auto-généré si vide)"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date de début</Label>
                  <Input
                    type="date"
                    value={form.starts_at}
                    onChange={(e) => handleFormChange("starts_at", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => handleFormChange("ends_at", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Player Requirements */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label>Email requis</Label>
                  <Switch
                    checked={form.require_email}
                    onCheckedChange={(c) => handleFormChange("require_email", c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label>Téléphone requis</Label>
                  <Switch
                    checked={form.require_phone}
                    onCheckedChange={(c) => handleFormChange("require_phone", c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label>WhatsApp requis</Label>
                  <Switch
                    checked={form.require_whatsapp}
                    onCheckedChange={(c) => handleFormChange("require_whatsapp", c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label>Suivre réseaux sociaux</Label>
                  <Switch
                    checked={form.require_social_follow}
                    onCheckedChange={(c) => handleFormChange("require_social_follow", c)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max parties par email</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_plays_per_email}
                    onChange={(e) => handleFormChange("max_plays_per_email", parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max parties par téléphone</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_plays_per_phone}
                    onChange={(e) => handleFormChange("max_plays_per_phone", parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
              </div>

              <h4 className="font-medium pt-2">Consentements marketing</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">Email</Label>
                  <Switch
                    checked={form.consent_marketing_email}
                    onCheckedChange={(c) => handleFormChange("consent_marketing_email", c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">SMS</Label>
                  <Switch
                    checked={form.consent_marketing_sms}
                    onCheckedChange={(c) => handleFormChange("consent_marketing_sms", c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <Label className="text-sm">WhatsApp</Label>
                  <Switch
                    checked={form.consent_marketing_whatsapp}
                    onCheckedChange={(c) => handleFormChange("consent_marketing_whatsapp", c)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Prizes */}
          {step === 3 && (
            <div className="space-y-4">
              {form.prizes.map((prize, idx) => (
                <Card key={idx} className="p-4">
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-4 h-full min-h-[100px] rounded"
                      style={{ backgroundColor: prize.display_color }}
                    />
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>Nom du lot *</Label>
                        <Input
                          value={prize.label}
                          onChange={(e) => handlePrizeChange(idx, "label", e.target.value)}
                          placeholder="Ex: 20% de réduction"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select 
                          value={prize.prize_type} 
                          onValueChange={(v) => handlePrizeChange(idx, "prize_type", v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {prizeTypes.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Valeur</Label>
                        <Input
                          value={prize.value}
                          onChange={(e) => handlePrizeChange(idx, "value", e.target.value)}
                          placeholder="20"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Poids (probabilité)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={prize.weight}
                          onChange={(e) => handlePrizeChange(idx, "weight", parseInt(e.target.value) || 1)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Stock total</Label>
                        <Input
                          type="number"
                          min="1"
                          value={prize.stock_total}
                          onChange={(e) => handlePrizeChange(idx, "stock_total", parseInt(e.target.value) || 1)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Validité (jours)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={prize.expiration_days}
                          onChange={(e) => handlePrizeChange(idx, "expiration_days", parseInt(e.target.value) || 30)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Couleur</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={prize.display_color}
                            onChange={(e) => handlePrizeChange(idx, "display_color", e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer"
                          />
                          <div className="flex items-center gap-1">
                            <Switch
                              checked={prize.is_consolation}
                              onCheckedChange={(c) => handlePrizeChange(idx, "is_consolation", c)}
                            />
                            <Label className="text-xs">Consolation</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                    {form.prizes.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removePrize(idx)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              
              <Button variant="outline" onClick={addPrize} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un lot
              </Button>
            </div>
          )}

          {/* Step 4: Legal & Display */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label>Texte d'introduction</Label>
                <Textarea
                  value={form.intro_text}
                  onChange={(e) => handleFormChange("intro_text", e.target.value)}
                  placeholder="Tentez votre chance et gagnez des lots exceptionnels !"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>Texte du bouton</Label>
                <Input
                  value={form.cta_text}
                  onChange={(e) => handleFormChange("cta_text", e.target.value)}
                  placeholder="Tourner la roue !"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Conditions Générales du Jeu (CGV) *</Label>
                <Textarea
                  value={form.terms_text}
                  onChange={(e) => handleFormChange("terms_text", e.target.value)}
                  placeholder="Règlement du jeu concours..."
                  className="mt-1"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Ce texte sera affiché et devra être accepté par le joueur
                </p>
              </div>
              <div>
                <Label>Conditions de l'offre (optionnel)</Label>
                <Textarea
                  value={form.offer_terms_text}
                  onChange={(e) => handleFormChange("offer_terms_text", e.target.value)}
                  placeholder="Conditions d'utilisation des lots..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label>Proposer un avis Google</Label>
                  <p className="text-xs text-muted-foreground">Après le jeu, proposer de laisser un avis</p>
                </div>
                <Switch
                  checked={form.show_google_review}
                  onCheckedChange={(c) => handleFormChange("show_google_review", c)}
                />
              </div>
            </div>
          )}

          {/* Validation errors */}
          {validateStep(step) && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {validateStep(step)}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Précédent
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowWizard(false)}>
                Annuler
              </Button>
              {step < 4 ? (
                <Button 
                  onClick={() => setStep(step + 1)}
                  disabled={!canGoNext(step)}
                >
                  Suivant
                </Button>
              ) : (
                <Button 
                  onClick={() => handleSave(true)}
                  disabled={saving || !canGoNext(step)}
                >
                  {saving ? "Enregistrement..." : (isEdit ? "Mettre à jour" : "Créer la campagne")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Link Dialog */}
      <Dialog open={showTestLink} onOpenChange={setShowTestLink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lien de test</DialogTitle>
          </DialogHeader>
          {testLink && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Utilisez ce lien pour tester la campagne. Les parties en test ne consomment pas de stock.
              </p>
              <div className="p-3 bg-muted rounded-lg break-all text-sm font-mono">
                {testLink.test_url}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(testLink.test_url);
                    alert("Copié !");
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copier
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => window.open(testLink.test_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ouvrir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
