import { useState, useEffect } from "react";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { 
  TrendingUp, Users, Gift, Ticket, Target, Calendar,
  ArrowUpRight, ArrowDownRight, Percent, Trophy, RefreshCw
} from "lucide-react";

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function TenantAnalytics() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [campaigns, setCampaigns] = useState([]);
  
  // Analytics data
  const [stats, setStats] = useState({
    total_plays: 0,
    total_wins: 0,
    total_players: 0,
    conversion_rate: 0,
    codes_redeemed: 0,
    redemption_rate: 0,
    plays_change: 0,
    wins_change: 0,
    players_change: 0
  });
  
  const [playsOverTime, setPlaysOverTime] = useState([]);
  const [prizeDistribution, setPrizeDistribution] = useState([]);
  const [hourlyDistribution, setHourlyDistribution] = useState([]);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [period, campaignFilter]);

  const loadCampaigns = async () => {
    try {
      const res = await api.get("/tenant/campaigns");
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (campaignFilter !== "all") params.append("campaign_id", campaignFilter);

      const res = await api.get(`/tenant/analytics?${params}`);
      const data = res.data;

      setStats({
        total_plays: data.total_plays || 0,
        total_wins: data.total_wins || 0,
        total_players: data.unique_players || 0,
        conversion_rate: data.conversion_rate || 0,
        codes_redeemed: data.codes_redeemed || 0,
        redemption_rate: data.redemption_rate || 0,
        plays_change: data.plays_change || 0,
        wins_change: data.wins_change || 0,
        players_change: data.players_change || 0
      });

      setPlaysOverTime(data.plays_over_time || []);
      setPrizeDistribution(data.prize_distribution || []);
      setHourlyDistribution(data.hourly_distribution || []);
      setTopCampaigns(data.top_campaigns || []);
      setRecentActivity(data.recent_activity || []);

    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6" data-testid="tenant-analytics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Statistiques
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Suivez les performances de vos campagnes
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[180px]" data-testid="analytics-campaign-filter">
              <SelectValue placeholder="Toutes les campagnes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les campagnes</SelectItem>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]" data-testid="analytics-period-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
              <SelectItem value="90d">90 derniers jours</SelectItem>
              <SelectItem value="365d">Cette année</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="icon"
            onClick={loadAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Parties jouées"
          value={stats.total_plays}
          change={stats.plays_change}
          icon={Gift}
          color="text-indigo-500"
          bgColor="bg-indigo-50"
        />
        <KPICard
          title="Lots gagnés"
          value={stats.total_wins}
          change={stats.wins_change}
          icon={Trophy}
          color="text-pink-500"
          bgColor="bg-pink-50"
        />
        <KPICard
          title="Joueurs uniques"
          value={stats.total_players}
          change={stats.players_change}
          icon={Users}
          color="text-emerald-500"
          bgColor="bg-emerald-50"
        />
        <KPICard
          title="Taux de conversion"
          value={formatPercent(stats.conversion_rate)}
          icon={Target}
          color="text-amber-500"
          bgColor="bg-amber-50"
          isPercent
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Plays over time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Évolution des parties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : playsOverTime.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={playsOverTime}>
                  <defs>
                    <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWins" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="plays" 
                    name="Parties" 
                    stroke="#6366f1" 
                    fillOpacity={1}
                    fill="url(#colorPlays)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="wins" 
                    name="Gains" 
                    stroke="#ec4899" 
                    fillOpacity={1}
                    fill="url(#colorWins)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Prize distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Répartition des lots
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : prizeDistribution.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={prizeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="label"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {prizeDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Hourly distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribution horaire</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : hourlyDistribution.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="plays" name="Parties" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top campagnes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : topCampaigns.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <div className="space-y-4">
                {topCampaigns.slice(0, 5).map((campaign, index) => (
                  <div key={campaign.id} className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm`}
                         style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.title}</p>
                      <p className="text-xs text-muted-foreground">{campaign.plays} parties</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">{campaign.wins}</p>
                      <p className="text-xs text-muted-foreground">gains</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Redemption stats */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              Utilisation des codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-3xl font-bold text-primary">{stats.total_wins}</p>
                <p className="text-sm text-muted-foreground mt-1">Codes générés</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-3xl font-bold text-emerald-600">{stats.codes_redeemed}</p>
                <p className="text-sm text-muted-foreground mt-1">Codes utilisés</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl">
                <p className="text-3xl font-bold text-amber-600">{formatPercent(stats.redemption_rate)}</p>
                <p className="text-sm text-muted-foreground mt-1">Taux d'utilisation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Aucune activité récente
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${activity.won ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <span className="flex-1 truncate">{activity.email}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(activity.played_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ title, value, change, icon: Icon, color, bgColor, isPercent }) {
  const hasChange = typeof change === 'number' && !isPercent;
  const isPositive = change > 0;

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {hasChange && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span>{Math.abs(change)}% vs période précédente</span>
              </div>
            )}
          </div>
          <div className={`p-2 rounded-lg ${bgColor}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
