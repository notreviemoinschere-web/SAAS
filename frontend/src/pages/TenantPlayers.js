import { useState, useEffect } from "react";
import { useI18n } from "../lib/i18n";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { 
  Users, Search, Download, Mail, Phone, Calendar, 
  Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  MessageSquare, RefreshCw
} from "lucide-react";

export default function TenantPlayers() {
  const { t } = useI18n();
  const [players, setPlayers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [consentFilter, setConsentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const perPage = 20;

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    with_email: 0,
    with_phone: 0,
    marketing_consent: 0
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [page, campaignFilter, consentFilter, search, dateFrom, dateTo]);

  const loadCampaigns = async () => {
    try {
      const res = await api.get("/tenant/campaigns");
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    }
  };

  const loadPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: perPage.toString(),
      });
      
      if (campaignFilter !== "all") params.append("campaign_id", campaignFilter);
      if (consentFilter !== "all") params.append("marketing_consent", consentFilter);
      if (search) params.append("search", search);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);

      const res = await api.get(`/tenant/players?${params}`);
      setPlayers(res.data.players || []);
      setTotalPages(res.data.pages || 1);
      setTotalPlayers(res.data.total || 0);
      setStats(res.data.stats || stats);
    } catch (err) {
      console.error("Failed to load players:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (campaignFilter !== "all") params.append("campaign_id", campaignFilter);
      if (consentFilter !== "all") params.append("marketing_consent", consentFilter);
      if (search) params.append("search", search);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);

      const res = await api.get(`/tenant/players/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `players_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Erreur lors de l'export. Vérifiez que votre plan permet l'export.");
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6" data-testid="tenant-players-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Mes Joueurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez vos contacts pour le remarketing
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadPlayers}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button 
            size="sm"
            onClick={handleExport}
            disabled={exporting || totalPlayers === 0}
            data-testid="export-players-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? "Export..." : "Exporter CSV"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total joueurs" 
          value={stats.total} 
          icon={Users}
          color="text-blue-500"
        />
        <StatCard 
          label="Avec email" 
          value={stats.with_email} 
          icon={Mail}
          color="text-green-500"
        />
        <StatCard 
          label="Avec téléphone" 
          value={stats.with_phone} 
          icon={Phone}
          color="text-purple-500"
        />
        <StatCard 
          label="Consent marketing" 
          value={stats.marketing_consent} 
          icon={MessageSquare}
          color="text-pink-500"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email ou téléphone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
                data-testid="search-players"
              />
            </div>
            
            <Select 
              value={campaignFilter} 
              onValueChange={(v) => { setCampaignFilter(v); setPage(1); }}
            >
              <SelectTrigger data-testid="campaign-filter">
                <SelectValue placeholder="Toutes les campagnes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les campagnes</SelectItem>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={consentFilter} 
              onValueChange={(v) => { setConsentFilter(v); setPage(1); }}
            >
              <SelectTrigger data-testid="consent-filter">
                <SelectValue placeholder="Tous les consentements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="true">Avec consentement marketing</SelectItem>
                <SelectItem value="false">Sans consentement marketing</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                placeholder="Du"
                className="text-sm"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                placeholder="Au"
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Players Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : players.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Aucun joueur trouvé</p>
              <p className="text-sm">Les joueurs apparaîtront ici après avoir participé à vos campagnes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Campagne</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Gain</TableHead>
                    <TableHead className="text-center">Marketing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow key={player.id} data-testid={`player-row-${player.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          {player.email || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {player.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{player.first_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {player.campaign_title || player.campaign_id}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(player.played_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {player.won ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            {player.prize_label || "Gagné"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Perdu
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {player.marketing_consent ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} sur {totalPages} ({totalPlayers} joueurs)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
