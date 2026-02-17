import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
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
import { Switch } from "../components/ui/switch";
import { 
  Users, Gamepad2, Play, DollarSign, ShieldAlert, Plus, Ban, CheckCircle2,
  Settings, CreditCard, MessageSquare, FileText, Search, Eye, Trash2, Edit,
  AlertTriangle, Info, Bell, Filter, RefreshCw, Shield
} from "lucide-react";

export default function AdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [tenantsTotal, setTenantsTotal] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState({ categories: [], actions: [] });
  const [fraudFlags, setFraudFlags] = useState([]);
  const [bans, setBans] = useState({ banned_ips: [], banned_devices: [], blacklisted_identities: [] });
  const [plans, setPlans] = useState([]);
  const [messages, setMessages] = useState([]);
  const [billingSettings, setBillingSettings] = useState(null);
  
  // Forms and dialogs
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(null);
  const [showBillingSettings, setShowBillingSettings] = useState(false);
  const [showCreateMessage, setShowCreateMessage] = useState(false);
  const [showCreateBan, setShowCreateBan] = useState(false);
  
  // Filters
  const [tenantFilters, setTenantFilters] = useState({ search: "", status: "", plan: "" });
  const [auditLogFilters, setAuditLogFilters] = useState({ category: "", action: "", tenant_id: "" });
  const [fraudFilter, setFraudFilter] = useState({ type: "" });
  
  // Form states
  const [tenantForm, setTenantForm] = useState({ business_name: "", email: "", password: "" });
  const [planForm, setPlanForm] = useState({
    id: "", name: "", price_monthly: 0, price_yearly: 0, 
    limits: { campaigns: 1, plays_per_month: 500, staff: 0, export: false, branding_removable: false },
    features: [], is_active: true, sort_order: 0
  });
  const [billingForm, setBillingForm] = useState({
    test_secret_key: "", live_secret_key: "", test_publishable_key: "",
    live_publishable_key: "", webhook_secret: "", mode: "test"
  });
  const [messageForm, setMessageForm] = useState({
    title: "", content: "", message_type: "info", target_type: "broadcast", target_tenant_ids: []
  });
  const [banForm, setBanForm] = useState({ ban_type: "ip", value: "", reason: "" });

  // Fetch functions
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/dashboard");
      setStats(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const params = {};
      if (tenantFilters.search) params.search = tenantFilters.search;
      if (tenantFilters.status) params.status = tenantFilters.status;
      if (tenantFilters.plan) params.plan = tenantFilters.plan;
      const res = await api.get("/admin/tenants/list", { params });
      setTenants(res.data.tenants);
      setTenantsTotal(res.data.total);
    } catch (err) {
      console.error(err);
    }
  }, [tenantFilters]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await api.get("/admin/plans");
      setPlans(res.data.plans);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchBillingSettings = useCallback(async () => {
    try {
      const res = await api.get("/admin/settings/billing");
      setBillingSettings(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get("/admin/messages");
      setMessages(res.data.messages);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const params = {};
      if (auditLogFilters.category) params.category = auditLogFilters.category;
      if (auditLogFilters.action) params.action = auditLogFilters.action;
      if (auditLogFilters.tenant_id) params.tenant_id = auditLogFilters.tenant_id;
      const res = await api.get("/admin/audit-logs/enhanced", { params });
      setAuditLogs(res.data.logs);
      setAuditFilters(res.data.filters);
    } catch (err) {
      console.error(err);
    }
  }, [auditLogFilters]);

  const fetchFraud = useCallback(async () => {
    try {
      const [flagsRes, bansRes] = await Promise.all([
        api.get("/admin/fraud/flags/enhanced", { params: fraudFilter.type ? { flag_type: fraudFilter.type } : {} }),
        api.get("/admin/fraud/bans")
      ]);
      setFraudFlags(flagsRes.data.flags);
      setBans(bansRes.data);
    } catch (err) {
      console.error(err);
    }
  }, [fraudFilter]);

  useEffect(() => {
    fetchStats();
    fetchTenants();
  }, [fetchStats, fetchTenants]);

  useEffect(() => {
    if (tab === "plans") {
      fetchPlans();
      fetchBillingSettings();
    }
    if (tab === "messages") fetchMessages();
    if (tab === "audit") fetchAuditLogs();
    if (tab === "fraud") fetchFraud();
  }, [tab, fetchPlans, fetchBillingSettings, fetchMessages, fetchAuditLogs, fetchFraud]);

  // Actions
  const createTenant = async () => {
    try {
      await api.post("/admin/tenants", tenantForm);
      setShowCreateTenant(false);
      setTenantForm({ business_name: "", email: "", password: "" });
      fetchTenants();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const toggleTenantStatus = async (tid, currentStatus) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await api.put(`/admin/tenants/${tid}/status`, { status: newStatus });
      fetchTenants();
    } catch (err) {
      console.error(err);
    }
  };

  const createPlan = async () => {
    try {
      await api.post("/admin/plans", planForm);
      setShowCreatePlan(false);
      setPlanForm({
        id: "", name: "", price_monthly: 0, price_yearly: 0,
        limits: { campaigns: 1, plays_per_month: 500, staff: 0, export: false, branding_removable: false },
        features: [], is_active: true, sort_order: 0
      });
      fetchPlans();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const updatePlan = async () => {
    try {
      await api.put(`/admin/plans/${showEditPlan.id}`, planForm);
      setShowEditPlan(null);
      fetchPlans();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm("Supprimer ce plan ?")) return;
    try {
      await api.delete(`/admin/plans/${planId}`);
      fetchPlans();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const saveBillingSettings = async () => {
    try {
      const payload = {};
      if (billingForm.test_secret_key) payload.test_secret_key = billingForm.test_secret_key;
      if (billingForm.live_secret_key) payload.live_secret_key = billingForm.live_secret_key;
      if (billingForm.test_publishable_key) payload.test_publishable_key = billingForm.test_publishable_key;
      if (billingForm.live_publishable_key) payload.live_publishable_key = billingForm.live_publishable_key;
      if (billingForm.webhook_secret) payload.webhook_secret = billingForm.webhook_secret;
      if (billingForm.mode) payload.mode = billingForm.mode;
      
      await api.patch("/admin/settings/billing", payload);
      setShowBillingSettings(false);
      fetchBillingSettings();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const createMessage = async () => {
    try {
      await api.post("/admin/messages", messageForm);
      setShowCreateMessage(false);
      setMessageForm({ title: "", content: "", message_type: "info", target_type: "broadcast", target_tenant_ids: [] });
      fetchMessages();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    try {
      await api.delete(`/admin/messages/${messageId}`);
      fetchMessages();
    } catch (err) {
      console.error(err);
    }
  };

  const createBan = async () => {
    try {
      await api.post("/admin/fraud/bans", banForm);
      setShowCreateBan(false);
      setBanForm({ ban_type: "ip", value: "", reason: "" });
      fetchFraud();
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur");
    }
  };

  const removeBan = async (banType, banId) => {
    if (!window.confirm("Supprimer ce ban ?")) return;
    try {
      await api.delete(`/admin/fraud/bans/${banType}/${banId}`);
      fetchFraud();
    } catch (err) {
      console.error(err);
    }
  };

  const statCards = stats ? [
    { label: t("admin.total_tenants"), value: stats.total_tenants, icon: Users, color: "text-primary" },
    { label: t("admin.active_campaigns"), value: stats.active_campaigns, icon: Gamepad2, color: "text-green-500" },
    { label: t("admin.total_plays"), value: stats.total_plays, icon: Play, color: "text-purple-500" },
    { label: t("admin.revenue"), value: `$${stats.total_revenue?.toFixed(2) || "0.00"}`, icon: DollarSign, color: "text-amber-500" },
    { label: t("admin.fraud"), value: stats.fraud_alerts, icon: ShieldAlert, color: "text-red-500" },
  ] : [];

  const messageTypeIcons = {
    info: <Info className="w-4 h-4 text-blue-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    urgent: <Bell className="w-4 h-4 text-red-500" />,
    maintenance: <Settings className="w-4 h-4 text-gray-500" />
  };

  return (
    <div className="flex min-h-screen bg-background" data-testid="admin-dashboard">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t("admin.dashboard")}</h1>
          
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1" data-testid="admin-tabs">
              <TabsTrigger value="overview" data-testid="admin-tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="tenants" data-testid="admin-tab-tenants">{t("nav.tenants")}</TabsTrigger>
              <TabsTrigger value="plans" data-testid="admin-tab-plans">Plans & Stripe</TabsTrigger>
              <TabsTrigger value="messages" data-testid="admin-tab-messages">Messages</TabsTrigger>
              <TabsTrigger value="audit" data-testid="admin-tab-audit">{t("nav.audit")}</TabsTrigger>
              <TabsTrigger value="fraud" data-testid="admin-tab-fraud">{t("nav.fraud")}</TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {statCards.map((s, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <s.icon className={`w-5 h-5 ${s.color}`} />
                        <div>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className="text-xl font-bold">{s.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {stats?.plan_breakdown && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Distribution des plans</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-6">
                      {Object.entries(stats.plan_breakdown).map(([plan, count]) => (
                        <div key={plan} className="text-center">
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-sm text-muted-foreground capitalize">{plan}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TENANTS TAB */}
            <TabsContent value="tenants">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input 
                    data-testid="tenant-search" 
                    placeholder="Rechercher..." 
                    value={tenantFilters.search} 
                    onChange={(e) => setTenantFilters({...tenantFilters, search: e.target.value})} 
                    className="w-48"
                  />
                  <Select value={tenantFilters.status || "all"} onValueChange={(v) => setTenantFilters({...tenantFilters, status: v === "all" ? "" : v})}>
                    <SelectTrigger className="w-32" data-testid="filter-status">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="suspended">Suspendu</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tenantFilters.plan || "all"} onValueChange={(v) => setTenantFilters({...tenantFilters, plan: v === "all" ? "" : v})}>
                    <SelectTrigger className="w-32" data-testid="filter-plan">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={showCreateTenant} onOpenChange={setShowCreateTenant}>
                  <DialogTrigger asChild>
                    <Button data-testid="create-tenant-btn" size="sm" className="rounded-full">
                      <Plus className="w-4 h-4 mr-1" />{t("admin.create_tenant")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("admin.create_tenant")}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Nom de l'entreprise</Label>
                        <Input data-testid="create-tenant-name" value={tenantForm.business_name} onChange={(e) => setTenantForm({...tenantForm, business_name: e.target.value})} />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input data-testid="create-tenant-email" type="email" value={tenantForm.email} onChange={(e) => setTenantForm({...tenantForm, email: e.target.value})} />
                      </div>
                      <div>
                        <Label>Mot de passe</Label>
                        <Input data-testid="create-tenant-password" type="password" value={tenantForm.password} onChange={(e) => setTenantForm({...tenantForm, password: e.target.value})} />
                      </div>
                      <Button data-testid="create-tenant-submit" onClick={createTenant} className="w-full rounded-full">{t("common.create")}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>{t("common.email")}</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>Campagnes</TableHead>
                      <TableHead>Parties/mois</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((ten) => (
                      <TableRow key={ten.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/tenants/${ten.id}`)}>
                        <TableCell className="font-medium">{ten.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ten.owner?.email}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{ten.plan}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={ten.status === "active" ? "default" : "destructive"} className="capitalize">{ten.status}</Badge>
                        </TableCell>
                        <TableCell>{ten.campaign_count} ({ten.active_campaign_count} actives)</TableCell>
                        <TableCell>{ten.plays_this_month}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/tenants/${ten.id}`)} data-testid={`view-tenant-${ten.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleTenantStatus(ten.id, ten.status)} data-testid={`toggle-tenant-${ten.id}`}>
                              {ten.status === "active" ? <Ban className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tenants.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
              <p className="text-sm text-muted-foreground mt-2">{tenantsTotal} tenant(s) au total</p>
            </TabsContent>

            {/* PLANS & STRIPE TAB */}
            <TabsContent value="plans">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Stripe Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Configuration Stripe
                    </CardTitle>
                    <CardDescription>Gérez vos clés API Stripe (chiffrées au repos)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {billingSettings && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Mode actuel</span>
                          <Badge variant={billingSettings.mode === "live" ? "default" : "secondary"}>
                            {billingSettings.mode === "live" ? "LIVE" : "TEST"}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Clé secrète test</span>
                            <span className="font-mono">{billingSettings.test_secret_key_masked || "Non configurée"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Clé secrète live</span>
                            <span className="font-mono">{billingSettings.live_secret_key_masked || "Non configurée"}</span>
                          </div>
                        </div>
                      </>
                    )}
                    <Dialog open={showBillingSettings} onOpenChange={setShowBillingSettings}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="edit-stripe-settings">
                          <Settings className="w-4 h-4 mr-1" />
                          Configurer
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Configuration Stripe</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                          <div>
                            <Label>Mode</Label>
                            <Select value={billingForm.mode} onValueChange={(v) => setBillingForm({...billingForm, mode: v})}>
                              <SelectTrigger data-testid="stripe-mode-select">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="test">Test</SelectItem>
                                <SelectItem value="live">Live</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Clé secrète TEST (sk_test_...)</Label>
                            <Input 
                              type="password" 
                              value={billingForm.test_secret_key} 
                              onChange={(e) => setBillingForm({...billingForm, test_secret_key: e.target.value})}
                              placeholder="Laisser vide pour ne pas modifier"
                              data-testid="stripe-test-secret"
                            />
                          </div>
                          <div>
                            <Label>Clé secrète LIVE (sk_live_...)</Label>
                            <Input 
                              type="password" 
                              value={billingForm.live_secret_key} 
                              onChange={(e) => setBillingForm({...billingForm, live_secret_key: e.target.value})}
                              placeholder="Laisser vide pour ne pas modifier"
                              data-testid="stripe-live-secret"
                            />
                          </div>
                          <div>
                            <Label>Clé publique TEST (pk_test_...)</Label>
                            <Input 
                              value={billingForm.test_publishable_key} 
                              onChange={(e) => setBillingForm({...billingForm, test_publishable_key: e.target.value})}
                              placeholder={billingSettings?.test_publishable_key || "Non configurée"}
                              data-testid="stripe-test-public"
                            />
                          </div>
                          <div>
                            <Label>Clé publique LIVE (pk_live_...)</Label>
                            <Input 
                              value={billingForm.live_publishable_key} 
                              onChange={(e) => setBillingForm({...billingForm, live_publishable_key: e.target.value})}
                              placeholder={billingSettings?.live_publishable_key || "Non configurée"}
                              data-testid="stripe-live-public"
                            />
                          </div>
                          <div>
                            <Label>Webhook Secret</Label>
                            <Input 
                              type="password"
                              value={billingForm.webhook_secret} 
                              onChange={(e) => setBillingForm({...billingForm, webhook_secret: e.target.value})}
                              placeholder="whsec_..."
                              data-testid="stripe-webhook-secret"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowBillingSettings(false)}>Annuler</Button>
                          <Button onClick={saveBillingSettings} data-testid="save-stripe-settings">Enregistrer</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                {/* Plans List */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Plans d'abonnement</CardTitle>
                      <CardDescription>Gérez les plans et leurs limites</CardDescription>
                    </div>
                    <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="create-plan-btn">
                          <Plus className="w-4 h-4 mr-1" />
                          Nouveau
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Nouveau plan</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>ID (unique)</Label>
                              <Input value={planForm.id} onChange={(e) => setPlanForm({...planForm, id: e.target.value})} data-testid="plan-id" />
                            </div>
                            <div>
                              <Label>Nom</Label>
                              <Input value={planForm.name} onChange={(e) => setPlanForm({...planForm, name: e.target.value})} data-testid="plan-name" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Prix mensuel ($)</Label>
                              <Input type="number" value={planForm.price_monthly} onChange={(e) => setPlanForm({...planForm, price_monthly: parseFloat(e.target.value) || 0})} data-testid="plan-price-monthly" />
                            </div>
                            <div>
                              <Label>Prix annuel ($)</Label>
                              <Input type="number" value={planForm.price_yearly} onChange={(e) => setPlanForm({...planForm, price_yearly: parseFloat(e.target.value) || 0})} data-testid="plan-price-yearly" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Limites</Label>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span>Campagnes (-1 = illimité)</span>
                                <Input type="number" className="w-20" value={planForm.limits.campaigns} onChange={(e) => setPlanForm({...planForm, limits: {...planForm.limits, campaigns: parseInt(e.target.value) || 0}})} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Parties/mois</span>
                                <Input type="number" className="w-20" value={planForm.limits.plays_per_month} onChange={(e) => setPlanForm({...planForm, limits: {...planForm.limits, plays_per_month: parseInt(e.target.value) || 0}})} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Staff</span>
                                <Input type="number" className="w-20" value={planForm.limits.staff} onChange={(e) => setPlanForm({...planForm, limits: {...planForm.limits, staff: parseInt(e.target.value) || 0}})} />
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Export</span>
                                <Switch checked={planForm.limits.export} onCheckedChange={(c) => setPlanForm({...planForm, limits: {...planForm.limits, export: c}})} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreatePlan(false)}>Annuler</Button>
                          <Button onClick={createPlan} data-testid="save-plan-btn">Créer</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {plans.map(plan => (
                        <div key={plan.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{plan.name}</p>
                            <p className="text-sm text-muted-foreground">${plan.price_monthly}/mois • ${plan.price_yearly}/an</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!plan.is_active && <Badge variant="secondary">Inactif</Badge>}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setPlanForm(plan);
                                setShowEditPlan(plan);
                              }}
                              data-testid={`edit-plan-${plan.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {plan.id !== 'free' && (
                              <Button variant="ghost" size="sm" onClick={() => deletePlan(plan.id)} data-testid={`delete-plan-${plan.id}`}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Edit Plan Dialog */}
              <Dialog open={!!showEditPlan} onOpenChange={(open) => !open && setShowEditPlan(null)}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Modifier le plan</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <Label>Nom</Label>
                      <Input value={planForm.name} onChange={(e) => setPlanForm({...planForm, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Prix mensuel ($)</Label>
                        <Input type="number" value={planForm.price_monthly} onChange={(e) => setPlanForm({...planForm, price_monthly: parseFloat(e.target.value) || 0})} />
                      </div>
                      <div>
                        <Label>Prix annuel ($)</Label>
                        <Input type="number" value={planForm.price_yearly} onChange={(e) => setPlanForm({...planForm, price_yearly: parseFloat(e.target.value) || 0})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Limites</Label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Campagnes</span>
                          <Input type="number" className="w-20" value={planForm.limits?.campaigns || 0} onChange={(e) => setPlanForm({...planForm, limits: {...planForm.limits, campaigns: parseInt(e.target.value) || 0}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Parties/mois</span>
                          <Input type="number" className="w-20" value={planForm.limits?.plays_per_month || 0} onChange={(e) => setPlanForm({...planForm, limits: {...planForm.limits, plays_per_month: parseInt(e.target.value) || 0}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Staff</span>
                          <Input type="number" className="w-20" value={planForm.limits?.staff || 0} onChange={(e) => setPlanForm({...planForm, limits: {...planForm.limits, staff: parseInt(e.target.value) || 0}})} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Export</span>
                          <Switch checked={planForm.limits?.export || false} onCheckedChange={(c) => setPlanForm({...planForm, limits: {...planForm.limits, export: c}})} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Actif</Label>
                      <Switch checked={planForm.is_active} onCheckedChange={(c) => setPlanForm({...planForm, is_active: c})} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEditPlan(null)}>Annuler</Button>
                    <Button onClick={updatePlan}>Enregistrer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* MESSAGES TAB */}
            <TabsContent value="messages">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Messages administrateur</h2>
                <Dialog open={showCreateMessage} onOpenChange={setShowCreateMessage}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="create-message-btn">
                      <Plus className="w-4 h-4 mr-1" />
                      Nouveau message
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Nouveau message</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Titre</Label>
                        <Input value={messageForm.title} onChange={(e) => setMessageForm({...messageForm, title: e.target.value})} data-testid="message-title" />
                      </div>
                      <div>
                        <Label>Contenu</Label>
                        <Textarea value={messageForm.content} onChange={(e) => setMessageForm({...messageForm, content: e.target.value})} rows={4} data-testid="message-content" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Type</Label>
                          <Select value={messageForm.message_type} onValueChange={(v) => setMessageForm({...messageForm, message_type: v})}>
                            <SelectTrigger data-testid="message-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="info">Info</SelectItem>
                              <SelectItem value="warning">Avertissement</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Cible</Label>
                          <Select value={messageForm.target_type} onValueChange={(v) => setMessageForm({...messageForm, target_type: v})}>
                            <SelectTrigger data-testid="message-target">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="broadcast">Tous les tenants</SelectItem>
                              <SelectItem value="targeted">Tenants spécifiques</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateMessage(false)}>Annuler</Button>
                      <Button onClick={createMessage} data-testid="send-message-btn">Envoyer</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-4">
                {messages.map(msg => (
                  <Card key={msg.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {messageTypeIcons[msg.message_type]}
                          <div>
                            <h3 className="font-medium">{msg.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{msg.content}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{new Date(msg.created_at).toLocaleString()}</span>
                              <Badge variant="outline">{msg.target_type === "broadcast" ? "Tous" : "Ciblé"}</Badge>
                              <span>{msg.read_count}/{msg.total_recipients} lu(s)</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteMessage(msg.id)} data-testid={`delete-message-${msg.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {messages.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucun message
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* AUDIT TAB */}
            <TabsContent value="audit">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Select value={auditLogFilters.category || "all"} onValueChange={(v) => setAuditLogFilters({...auditLogFilters, category: v === "all" ? "" : v})}>
                  <SelectTrigger className="w-40" data-testid="audit-filter-category">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {auditFilters.categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Action..."
                  value={auditLogFilters.action}
                  onChange={(e) => setAuditLogFilters({...auditLogFilters, action: e.target.value})}
                  className="w-40"
                  data-testid="audit-filter-action"
                />
                <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Action</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Détails</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                        <TableCell>
                          {log.category && <Badge variant="secondary">{log.category}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{log.details}</TableCell>
                        <TableCell className="text-sm font-mono">{log.ip_address}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {auditLogs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            {/* FRAUD TAB */}
            <TabsContent value="fraud">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Fraud Flags */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      Alertes fraude
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Détails</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fraudFlags.map((flag) => (
                          <TableRow key={flag.id}>
                            <TableCell><Badge variant="destructive">{flag.type}</Badge></TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{flag.details}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(flag.created_at).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        {fraudFlags.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Aucune alerte</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Bans Management */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Bans actifs
                    </CardTitle>
                    <Dialog open={showCreateBan} onOpenChange={setShowCreateBan}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="destructive" data-testid="create-ban-btn">
                          <Plus className="w-4 h-4 mr-1" />
                          Bannir
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Nouveau ban</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <Label>Type</Label>
                            <Select value={banForm.ban_type} onValueChange={(v) => setBanForm({...banForm, ban_type: v})}>
                              <SelectTrigger data-testid="ban-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ip">Adresse IP</SelectItem>
                                <SelectItem value="device">Device Hash</SelectItem>
                                <SelectItem value="identity">Email/Phone Hash</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Valeur</Label>
                            <Input value={banForm.value} onChange={(e) => setBanForm({...banForm, value: e.target.value})} placeholder="IP, hash..." data-testid="ban-value" />
                          </div>
                          <div>
                            <Label>Raison</Label>
                            <Input value={banForm.reason} onChange={(e) => setBanForm({...banForm, reason: e.target.value})} placeholder="Optionnel" data-testid="ban-reason" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreateBan(false)}>Annuler</Button>
                          <Button variant="destructive" onClick={createBan} data-testid="confirm-ban-btn">Bannir</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* IP Bans */}
                    {bans.banned_ips.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">IPs ({bans.banned_ips.length})</h4>
                        <div className="space-y-2">
                          {bans.banned_ips.slice(0, 5).map(ban => (
                            <div key={ban.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                              <span className="font-mono">{ban.value}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeBan("ip", ban.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Device Bans */}
                    {bans.banned_devices.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Devices ({bans.banned_devices.length})</h4>
                        <div className="space-y-2">
                          {bans.banned_devices.slice(0, 5).map(ban => (
                            <div key={ban.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                              <span className="font-mono text-xs truncate max-w-[150px]">{ban.value}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeBan("device", ban.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Identity Bans */}
                    {bans.blacklisted_identities.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Identités ({bans.blacklisted_identities.length})</h4>
                        <div className="space-y-2">
                          {bans.blacklisted_identities.slice(0, 5).map(ban => (
                            <div key={ban.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                              <span className="font-mono text-xs truncate max-w-[150px]">{ban.value}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeBan("identity", ban.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {bans.banned_ips.length === 0 && bans.banned_devices.length === 0 && bans.blacklisted_identities.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun ban actif</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
