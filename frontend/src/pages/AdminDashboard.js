import { useState, useEffect, useCallback } from "react";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Users, Gamepad2, Play, DollarSign, ShieldAlert, Plus, Ban, CheckCircle2 } from "lucide-react";

export default function AdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [fraudFlags, setFraudFlags] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ business_name: "", email: "", password: "" });
  const [search, setSearch] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/dashboard");
      setStats(res.data);
    } catch {}
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const params = search ? { search } : {};
      const res = await api.get("/admin/tenants", { params });
      setTenants(res.data.tenants);
    } catch {}
  }, [search]);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await api.get("/admin/audit-logs");
      setAuditLogs(res.data.logs);
    } catch {}
  }, []);

  const fetchFraud = useCallback(async () => {
    try {
      const res = await api.get("/admin/fraud");
      setFraudFlags(res.data.flags);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTenants();
  }, [fetchStats, fetchTenants]);

  useEffect(() => {
    if (tab === "audit") fetchAudit();
    if (tab === "fraud") fetchFraud();
  }, [tab, fetchAudit, fetchFraud]);

  const createTenant = async () => {
    try {
      await api.post("/admin/tenants", form);
      setShowCreate(false);
      setForm({ business_name: "", email: "", password: "" });
      fetchTenants();
      fetchStats();
    } catch {}
  };

  const toggleTenantStatus = async (tid, currentStatus) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await api.put(`/admin/tenants/${tid}/status`, { status: newStatus });
      fetchTenants();
    } catch {}
  };

  const statCards = stats ? [
    { label: t("admin.total_tenants"), value: stats.total_tenants, icon: Users, color: "text-primary" },
    { label: t("admin.active_campaigns"), value: stats.active_campaigns, icon: Gamepad2, color: "text-green-500" },
    { label: t("admin.total_plays"), value: stats.total_plays, icon: Play, color: "text-purple-500" },
    { label: t("admin.revenue"), value: `$${stats.total_revenue?.toFixed(2) || "0.00"}`, icon: DollarSign, color: "text-amber-500" },
    { label: t("admin.fraud"), value: stats.fraud_alerts, icon: ShieldAlert, color: "text-red-500" },
  ] : [];

  return (
    <div className="flex min-h-screen bg-background" data-testid="admin-dashboard">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t("admin.dashboard")}</h1>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6" data-testid="admin-tabs">
              <TabsTrigger value="overview" data-testid="admin-tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="tenants" data-testid="admin-tab-tenants">{t("nav.tenants")}</TabsTrigger>
              <TabsTrigger value="audit" data-testid="admin-tab-audit">{t("nav.audit")}</TabsTrigger>
              <TabsTrigger value="fraud" data-testid="admin-tab-fraud">{t("nav.fraud")}</TabsTrigger>
            </TabsList>

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
                  <CardHeader><CardTitle className="text-base">Plan Distribution</CardTitle></CardHeader>
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

            <TabsContent value="tenants">
              <div className="flex items-center justify-between mb-4 gap-4">
                <Input data-testid="tenant-search" placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                  <DialogTrigger asChild>
                    <Button data-testid="create-tenant-btn" size="sm" className="rounded-full"><Plus className="w-4 h-4 mr-1" />{t("admin.create_tenant")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{t("admin.create_tenant")}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div><Label>Business Name</Label><Input data-testid="create-tenant-name" value={form.business_name} onChange={(e) => setForm({...form, business_name: e.target.value})} /></div>
                      <div><Label>Email</Label><Input data-testid="create-tenant-email" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
                      <div><Label>Password</Label><Input data-testid="create-tenant-password" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} /></div>
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
                      <TableHead>Campaigns</TableHead>
                      <TableHead>Plays</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((ten) => (
                      <TableRow key={ten.id}>
                        <TableCell className="font-medium">{ten.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ten.owner?.email}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{ten.plan}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={ten.status === "active" ? "default" : "destructive"} className="capitalize">{ten.status}</Badge>
                        </TableCell>
                        <TableCell>{ten.campaign_count}</TableCell>
                        <TableCell>{ten.play_count}</TableCell>
                        <TableCell>
                          <Button data-testid={`toggle-tenant-${ten.id}`} variant="ghost" size="sm" onClick={() => toggleTenantStatus(ten.id, ten.status)}>
                            {ten.status === "active" ? <Ban className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tenants.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{log.details}</TableCell>
                        <TableCell className="text-sm font-mono">{log.ip_address}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {auditLogs.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="fraud">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fraudFlags.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell><Badge variant="destructive">{flag.type}</Badge></TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{flag.details}</TableCell>
                        <TableCell className="text-sm font-mono">{flag.ip_address}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(flag.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {fraudFlags.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
