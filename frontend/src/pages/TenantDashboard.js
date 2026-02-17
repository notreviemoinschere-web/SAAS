import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Play, Users, Target, Award, TicketCheck, Plus, ExternalLink, Pencil, Trash2 } from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-700",
  test: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-orange-100 text-orange-700",
  ended: "bg-red-100 text-red-700",
};

export default function TenantDashboard() {
  const { t } = useI18n();
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [players, setPlayers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "" });

  const fetchStats = useCallback(async () => {
    try { const res = await api.get("/tenant/dashboard"); setStats(res.data); } catch {}
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try { const res = await api.get("/tenant/campaigns"); setCampaigns(res.data.campaigns); } catch {}
  }, []);

  const fetchPlayers = useCallback(async () => {
    try { const res = await api.get("/tenant/players"); setPlayers(res.data.players); } catch {}
  }, []);

  const fetchStaff = useCallback(async () => {
    try { const res = await api.get("/tenant/staff"); setStaff(res.data.staff); } catch {}
  }, []);

  const fetchRewards = useCallback(async () => {
    try { const res = await api.get("/tenant/rewards"); setRewards(res.data.rewards); } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchCampaigns();
  }, [fetchStats, fetchCampaigns]);

  useEffect(() => {
    if (tab === "players") fetchPlayers();
    if (tab === "staff") fetchStaff();
    if (tab === "rewards") fetchRewards();
  }, [tab, fetchPlayers, fetchStaff, fetchRewards]);

  const addStaff = async () => {
    try {
      await api.post("/tenant/staff", staffForm);
      setShowAddStaff(false);
      setStaffForm({ name: "", email: "", password: "" });
      fetchStaff();
    } catch {}
  };

  const removeStaff = async (id) => {
    try { await api.delete(`/tenant/staff/${id}`); fetchStaff(); } catch {}
  };

  const deleteCampaign = async (id) => {
    try { await api.delete(`/tenant/campaigns/${id}`); fetchCampaigns(); fetchStats(); } catch {}
  };

  const statCards = stats ? [
    { label: t("tenant.plays_today"), value: stats.plays_today, icon: Play, color: "text-primary" },
    { label: t("tenant.leads"), value: stats.total_players, icon: Users, color: "text-blue-500" },
    { label: t("tenant.conversion"), value: `${stats.conversion_rate}%`, icon: Target, color: "text-green-500" },
    { label: t("tenant.rewards_issued"), value: stats.rewards_issued, icon: Award, color: "text-purple-500" },
    { label: t("tenant.rewards_redeemed"), value: stats.rewards_redeemed, icon: TicketCheck, color: "text-amber-500" },
  ] : [];

  return (
    <div className="flex min-h-screen bg-background" data-testid="tenant-dashboard">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{tenant?.name || t("tenant.dashboard")}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Plan: <Badge variant="outline" className="capitalize ml-1">{tenant?.plan || "free"}</Badge>
              </p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6" data-testid="tenant-tabs">
              <TabsTrigger value="overview" data-testid="tenant-tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="campaigns" data-testid="tenant-tab-campaigns">{t("nav.campaigns")}</TabsTrigger>
              <TabsTrigger value="players" data-testid="tenant-tab-players">{t("nav.players")}</TabsTrigger>
              <TabsTrigger value="staff" data-testid="tenant-tab-staff">{t("nav.staff")}</TabsTrigger>
              <TabsTrigger value="rewards" data-testid="tenant-tab-rewards">{t("nav.rewards")}</TabsTrigger>
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
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Recent Campaigns</CardTitle>
                  <Button data-testid="new-campaign-btn" size="sm" className="rounded-full" onClick={() => navigate("/dashboard/campaigns/new")}>
                    <Plus className="w-4 h-4 mr-1" /> {t("tenant.new_campaign")}
                  </Button>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">{t("common.no_data")}</p>
                  ) : (
                    <div className="space-y-3">
                      {campaigns.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div>
                            <p className="font-medium">{c.title}</p>
                            <p className="text-sm text-muted-foreground">{c.play_count || 0} plays</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/campaigns/${c.id}`)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns">
              <div className="flex justify-end mb-4">
                <Button data-testid="new-campaign-btn-tab" size="sm" className="rounded-full" onClick={() => navigate("/dashboard/campaigns/new")}>
                  <Plus className="w-4 h-4 mr-1" /> {t("tenant.new_campaign")}
                </Button>
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t("campaign.title")}</TableHead>
                      <TableHead>{t("campaign.status")}</TableHead>
                      <TableHead>Prizes</TableHead>
                      <TableHead>Plays</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span></TableCell>
                        <TableCell>{c.prize_count || 0}</TableCell>
                        <TableCell>{c.play_count || 0}</TableCell>
                        <TableCell>
                          {(c.status === "active" || c.status === "test") && (
                            <a href={`/play/${c.slug}`} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                              <ExternalLink className="w-3 h-3" /> Play
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/campaigns/${c.id}`)} data-testid={`edit-campaign-${c.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {c.status !== "active" && (
                              <Button variant="ghost" size="sm" onClick={() => deleteCampaign(c.id)} data-testid={`delete-campaign-${c.id}`}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {campaigns.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="players">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t("common.email")}</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Plays</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.email}</TableCell>
                        <TableCell>{p.phone || "-"}</TableCell>
                        <TableCell>{p.plays_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {players.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="staff">
              <div className="flex justify-end mb-4">
                <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-staff-btn" size="sm" className="rounded-full"><Plus className="w-4 h-4 mr-1" /> Add Staff</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div><Label>Name</Label><Input data-testid="staff-name" value={staffForm.name} onChange={(e) => setStaffForm({...staffForm, name: e.target.value})} /></div>
                      <div><Label>Email</Label><Input data-testid="staff-email" type="email" value={staffForm.email} onChange={(e) => setStaffForm({...staffForm, email: e.target.value})} /></div>
                      <div><Label>Password</Label><Input data-testid="staff-password" type="password" value={staffForm.password} onChange={(e) => setStaffForm({...staffForm, password: e.target.value})} /></div>
                      <Button data-testid="staff-submit" onClick={addStaff} className="w-full rounded-full">{t("common.create")}</Button>
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
                      <TableHead>Date Added</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeStaff(s.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {staff.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("common.no_data")}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="rewards">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Code</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rewards.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.code}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "active" ? "default" : r.status === "redeemed" ? "secondary" : "destructive"} className="capitalize">{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {rewards.length === 0 && (
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
