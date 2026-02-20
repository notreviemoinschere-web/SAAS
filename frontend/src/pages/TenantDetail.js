import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ArrowLeft, Building2, Mail, Users, Gamepad2, Play, Gift, TrendingUp, CreditCard, Download, Ban, CheckCircle2, UserCog, FileText, Trash2, Plus, ExternalLink, MapPin, Phone, Hash } from "lucide-react";

export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ plan_id: "", reason: "" });
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [exporting, setExporting] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tenantRes, plansRes] = await Promise.all([
        api.get(`/admin/tenants/${tenantId}`),
        api.get("/admin/plans")
      ]);
      setData(tenantRes.data);
      setPlans(plansRes.data.plans);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusToggle = async () => {
    const newStatus = data.tenant.status === "active" ? "suspended" : "active";
    try {
      await api.put(`/admin/tenants/${tenantId}/status`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePlan = async () => {
    try {
      await api.put(`/admin/tenants/${tenantId}/plan`, newPlan);
      setShowChangePlan(false);
      setNewPlan({ plan_id: "", reason: "" });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler l'abonnement ? Le tenant passera au plan gratuit.")) return;
    try {
      await api.post(`/admin/tenants/${tenantId}/cancel-subscription`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async () => {
    try {
      await api.post(`/admin/tenants/${tenantId}/notes`, { content: noteContent });
      setShowAddNote(false);
      setNoteContent("");
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    try {
      await api.delete(`/admin/tenants/${tenantId}/notes/${noteId}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const response = await api.get(`/admin/tenants/${tenantId}/exports/${type}.csv`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${tenantId}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting("");
    }
  };

  const handleImpersonate = async () => {
    if (!window.confirm("Vous allez être connecté en tant que ce tenant. Continuer ?")) return;
    try {
      const res = await api.post(`/admin/tenants/${tenantId}/impersonate`);
      localStorage.setItem("pwp_token", res.data.token);
      localStorage.setItem("pwp_impersonating", "true");
      window.location.href = "/dashboard";
    } catch (err) {
      console.error(err);
    }
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

  if (!data) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
          <div className="flex items-center justify-center h-64">
            <div className="text-destructive">Tenant introuvable</div>
          </div>
        </main>
      </div>
    );
  }

  const { tenant, owner, staff, campaigns, stats, billing, notes } = data;

  return (
    <div className="flex min-h-screen bg-background" data-testid="tenant-detail-page">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} data-testid="back-to-admin">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{tenant.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {owner?.email || "N/A"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tenant.status === "active" ? "default" : "destructive"} className="capitalize">
                {tenant.status}
              </Badge>
              <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
              
              <Button size="sm" onClick={() => navigate(`/admin/tenants/${tenantId}/campaigns?new=1`)} data-testid="create-campaign-btn">
                <Plus className="w-4 h-4 mr-1" />
                Créer campagne
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleStatusToggle} data-testid="toggle-status-btn">
                {tenant.status === "active" ? <Ban className="w-4 h-4 mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                {tenant.status === "active" ? "Suspendre" : "Activer"}
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleImpersonate} data-testid="impersonate-btn">
                <UserCog className="w-4 h-4 mr-1" />
                Impersonner
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6" data-testid="tenant-detail-tabs">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
              <TabsTrigger value="billing">Facturation</TabsTrigger>
              <TabsTrigger value="exports">Exports</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Campagnes</p>
                        <p className="text-xl font-bold">{stats.total_campaigns}</p>
                        <p className="text-xs text-green-500">{stats.active_campaigns} actives</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <Play className="w-5 h-5 text-purple-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Parties</p>
                        <p className="text-xl font-bold">{stats.total_plays}</p>
                        <p className="text-xs text-muted-foreground">{stats.plays_this_month} ce mois</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Joueurs</p>
                        <p className="text-xl font-bold">{stats.total_players}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <Gift className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Codes</p>
                        <p className="text-xl font-bold">{stats.rewards_issued}</p>
                        <p className="text-xs text-green-500">{stats.rewards_redeemed} utilisés</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Plays Chart */}
              {stats.daily_plays && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Parties (7 derniers jours)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-32">
                      {stats.daily_plays.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div 
                            className="w-full bg-primary/20 rounded-t"
                            style={{ 
                              height: `${Math.max(4, (d.plays / Math.max(...stats.daily_plays.map(x => x.plays), 1)) * 100)}%`,
                              minHeight: '4px'
                            }}
                          >
                            <div 
                              className="w-full h-full bg-primary rounded-t transition-all"
                              style={{ opacity: 0.3 + (d.plays / Math.max(...stats.daily_plays.map(x => x.plays), 1)) * 0.7 }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{d.date.split('-')[2]}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Owner & Staff */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Coordonnées Entreprise
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      {tenant.profile?.manager_first_name && (
                        <p className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Gérant:</span> 
                          {tenant.profile.manager_first_name} {tenant.profile.manager_last_name}
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Société:</span> {tenant.name}
                      </p>
                      {tenant.profile?.address && (
                        <p className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Adresse:</span> 
                          {tenant.profile.address}, {tenant.profile.postal_code} {tenant.profile.city}
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Tél:</span> {tenant.profile?.phone || owner?.phone || "N/A"}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span> {owner?.email || "N/A"}
                      </p>
                      {tenant.profile?.registration_number && (
                        <p className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">SIRET:</span> {tenant.profile.registration_number}
                        </p>
                      )}
                      {tenant.profile?.vat_number && (
                        <p className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">TVA:</span> {tenant.profile.vat_number}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Créé le: {new Date(tenant.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Staff ({staff?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {staff && staff.length > 0 ? (
                      <div className="space-y-2">
                        {staff.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-sm">
                            <span>{s.name}</span>
                            <span className="text-muted-foreground">{s.email}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun staff</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Campaigns Tab */}
            <TabsContent value="campaigns">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Titre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Parties</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Créé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns && campaigns.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "active" ? "default" : "outline"} className="capitalize">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.play_count}</TableCell>
                        <TableCell>{c.prize_count}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!campaigns || campaigns.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucune campagne
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing">
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Abonnement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plan actuel</span>
                      <Badge variant="outline" className="capitalize text-lg px-3 py-1">
                        {tenant.plan}
                      </Badge>
                    </div>
                    {billing?.subscription && (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Statut</span>
                          <Badge variant={billing.subscription.status === "active" ? "default" : "secondary"}>
                            {billing.subscription.status}
                          </Badge>
                        </div>
                        {billing.subscription.admin_override && (
                          <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">
                            Override admin: {billing.subscription.admin_override_reason || "N/A"}
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="change-plan-btn">
                            Changer de plan
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Changer le plan</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div>
                              <Label>Nouveau plan</Label>
                              <Select value={newPlan.plan_id} onValueChange={(v) => setNewPlan({...newPlan, plan_id: v})}>
                                <SelectTrigger data-testid="select-new-plan">
                                  <SelectValue placeholder="Sélectionner un plan" />
                                </SelectTrigger>
                                <SelectContent>
                                  {plans.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name} (${p.price_monthly}/mois)</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Raison (optionnel)</Label>
                              <Input 
                                value={newPlan.reason} 
                                onChange={(e) => setNewPlan({...newPlan, reason: e.target.value})}
                                placeholder="Raison du changement"
                                data-testid="change-plan-reason"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowChangePlan(false)}>Annuler</Button>
                            <Button onClick={handleChangePlan} data-testid="confirm-change-plan">Confirmer</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {tenant.plan !== "free" && (
                        <Button variant="destructive" size="sm" onClick={handleCancelSubscription} data-testid="cancel-subscription-btn">
                          Annuler
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Limites du plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {billing?.plan?.limits ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Campagnes</span>
                          <span>{billing.plan.limits.campaigns === -1 ? "Illimité" : billing.plan.limits.campaigns}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Parties/mois</span>
                          <span>{billing.plan.limits.plays_per_month === -1 ? "Illimité" : billing.plan.limits.plays_per_month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Staff</span>
                          <span>{billing.plan.limits.staff === -1 ? "Illimité" : billing.plan.limits.staff}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Export</span>
                          <span>{billing.plan.limits.export ? "Oui" : "Non"}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Limites non définies</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Invoices */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historique des paiements</CardTitle>
                </CardHeader>
                <CardContent>
                  {billing?.invoices && billing.invoices.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billing.invoices.map(inv => (
                          <TableRow key={inv.id}>
                            <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="capitalize">{inv.plan}</TableCell>
                            <TableCell>${inv.amount}</TableCell>
                            <TableCell>
                              <Badge variant={inv.payment_status === "paid" ? "default" : "secondary"}>
                                {inv.payment_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun paiement</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Exports Tab */}
            <TabsContent value="exports">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Exports CSV</CardTitle>
                  <CardDescription>
                    Exports conformes RGPD. Les données personnelles sont masquées si le consentement marketing n'a pas été donné.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex-col gap-2"
                      onClick={() => handleExport("players")}
                      disabled={exporting === "players"}
                      data-testid="export-players-btn"
                    >
                      <Users className="w-6 h-6" />
                      <span>Joueurs</span>
                      {exporting === "players" && <span className="text-xs">Téléchargement...</span>}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex-col gap-2"
                      onClick={() => handleExport("plays")}
                      disabled={exporting === "plays"}
                      data-testid="export-plays-btn"
                    >
                      <Play className="w-6 h-6" />
                      <span>Parties</span>
                      {exporting === "plays" && <span className="text-xs">Téléchargement...</span>}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-auto py-4 flex-col gap-2"
                      onClick={() => handleExport("codes")}
                      disabled={exporting === "codes"}
                      data-testid="export-codes-btn"
                    >
                      <Gift className="w-6 h-6" />
                      <span>Codes</span>
                      {exporting === "codes" && <span className="text-xs">Téléchargement...</span>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notes internes
                  </CardTitle>
                  <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="add-note-btn">
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nouvelle note</DialogTitle>
                      </DialogHeader>
                      <div className="pt-4">
                        <Textarea 
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Contenu de la note..."
                          rows={4}
                          data-testid="note-content-input"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddNote(false)}>Annuler</Button>
                        <Button onClick={handleAddNote} data-testid="save-note-btn">Enregistrer</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {notes && notes.length > 0 ? (
                    <div className="space-y-4">
                      {notes.map(note => (
                        <div key={note.id} className="p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {note.created_by_email} • {new Date(note.created_at).toLocaleString()}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteNote(note.id)}
                              data-testid={`delete-note-${note.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucune note</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
