import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import Sidebar from "../components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Building2, User, MapPin, Phone, Mail, FileText, Palette, Image, Save, Plus, Trash2, Globe, Instagram, Facebook, Link2 } from "lucide-react";

export default function TenantProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("info");
  const [profile, setProfile] = useState({
    manager_first_name: "",
    manager_last_name: "",
    company_name: "",
    address: "",
    city: "",
    postal_code: "",
    country: "France",
    phone: "",
    email: "",
    registration_number: "",
    vat_number: "",
    google_review_url: "",
    social_links: {}
  });
  const [branding, setBranding] = useState({
    primary_color: "#6366f1",
    secondary_color: "#8b5cf6",
    logo_url: ""
  });
  const [newSocialPlatform, setNewSocialPlatform] = useState("");
  const [newSocialUrl, setNewSocialUrl] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get("/tenant/profile");
      setProfile(res.data.profile || {});
      setBranding(res.data.branding || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleProfileChange = (field, value) => {
    setProfile({ ...profile, [field]: value });
  };

  const handleBrandingChange = (field, value) => {
    setBranding({ ...branding, [field]: value });
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put("/tenant/profile", profile);
      alert("Profil enregistré !");
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await api.put("/tenant/branding", branding);
      alert("Branding enregistré !");
    } catch (err) {
      alert("Erreur: " + (err.response?.data?.detail || "Erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/tenant/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setBranding({ ...branding, logo_url: res.data.logo_url });
      setProfile({ ...profile, logo_url: res.data.logo_url });
    } catch (err) {
      alert("Erreur upload: " + (err.response?.data?.detail || "Fichier trop grand"));
    }
  };

  const addSocialLink = () => {
    if (!newSocialPlatform.trim() || !newSocialUrl.trim()) return;
    
    const newLinks = { ...profile.social_links, [newSocialPlatform]: newSocialUrl };
    setProfile({ ...profile, social_links: newLinks });
    setNewSocialPlatform("");
    setNewSocialUrl("");
  };

  const removeSocialLink = (platform) => {
    const newLinks = { ...profile.social_links };
    delete newLinks[platform];
    setProfile({ ...profile, social_links: newLinks });
  };

  const socialPlatformIcons = {
    facebook: <Facebook className="w-4 h-4" />,
    instagram: <Instagram className="w-4 h-4" />,
    tiktok: <Globe className="w-4 h-4" />,
    twitter: <Globe className="w-4 h-4" />,
    linkedin: <Globe className="w-4 h-4" />,
    youtube: <Globe className="w-4 h-4" />
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
    <div className="flex min-h-screen bg-background" data-testid="tenant-profile-page">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 ml-0 lg:ml-64">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Mon Entreprise</h1>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="info">Informations</TabsTrigger>
              <TabsTrigger value="social">Réseaux Sociaux</TabsTrigger>
              <TabsTrigger value="branding">Apparence</TabsTrigger>
            </TabsList>

            {/* Business Info Tab */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Coordonnées de l'entreprise
                  </CardTitle>
                  <CardDescription>
                    Ces informations apparaîtront sur vos factures
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Manager Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1">
                        <User className="w-3 h-3" /> Prénom du gérant
                      </Label>
                      <Input
                        value={profile.manager_first_name || ""}
                        onChange={(e) => handleProfileChange("manager_first_name", e.target.value)}
                        className="mt-1"
                        data-testid="profile-manager-firstname"
                      />
                    </div>
                    <div>
                      <Label>Nom du gérant</Label>
                      <Input
                        value={profile.manager_last_name || ""}
                        onChange={(e) => handleProfileChange("manager_last_name", e.target.value)}
                        className="mt-1"
                        data-testid="profile-manager-lastname"
                      />
                    </div>
                  </div>

                  {/* Company Info */}
                  <div>
                    <Label className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Nom de l'entreprise
                    </Label>
                    <Input
                      value={profile.company_name || ""}
                      onChange={(e) => handleProfileChange("company_name", e.target.value)}
                      className="mt-1"
                      data-testid="profile-company-name"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <Label className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Adresse
                    </Label>
                    <Input
                      value={profile.address || ""}
                      onChange={(e) => handleProfileChange("address", e.target.value)}
                      placeholder="123 rue de la Paix"
                      className="mt-1"
                      data-testid="profile-address"
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label>Code postal</Label>
                      <Input
                        value={profile.postal_code || ""}
                        onChange={(e) => handleProfileChange("postal_code", e.target.value)}
                        placeholder="75001"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Ville</Label>
                      <Input
                        value={profile.city || ""}
                        onChange={(e) => handleProfileChange("city", e.target.value)}
                        placeholder="Paris"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Pays</Label>
                      <Input
                        value={profile.country || "France"}
                        onChange={(e) => handleProfileChange("country", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Téléphone
                      </Label>
                      <Input
                        value={profile.phone || ""}
                        onChange={(e) => handleProfileChange("phone", e.target.value)}
                        placeholder="+33 1 23 45 67 89"
                        className="mt-1"
                        data-testid="profile-phone"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </Label>
                      <Input
                        value={profile.email || ""}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                        placeholder="contact@entreprise.fr"
                        className="mt-1"
                        data-testid="profile-email"
                      />
                    </div>
                  </div>

                  {/* Legal Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> N° SIRET/SIREN
                      </Label>
                      <Input
                        value={profile.registration_number || ""}
                        onChange={(e) => handleProfileChange("registration_number", e.target.value)}
                        placeholder="123 456 789 00012"
                        className="mt-1"
                        data-testid="profile-siret"
                      />
                    </div>
                    <div>
                      <Label>N° TVA Intracommunautaire</Label>
                      <Input
                        value={profile.vat_number || ""}
                        onChange={(e) => handleProfileChange("vat_number", e.target.value)}
                        placeholder="FR12345678901"
                        className="mt-1"
                        data-testid="profile-vat"
                      />
                    </div>
                  </div>

                  {/* Google Review */}
                  <div>
                    <Label className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> Lien Avis Google
                    </Label>
                    <Input
                      value={profile.google_review_url || ""}
                      onChange={(e) => handleProfileChange("google_review_url", e.target.value)}
                      placeholder="https://g.page/r/..."
                      className="mt-1"
                      data-testid="profile-google-review"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ce lien sera proposé aux joueurs après avoir joué pour laisser un avis
                    </p>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving} className="rounded-full" data-testid="save-profile-btn">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Links Tab */}
            <TabsContent value="social">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Réseaux Sociaux
                  </CardTitle>
                  <CardDescription>
                    Ajoutez vos réseaux sociaux pour que les clients puissent vous suivre
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Existing Social Links */}
                  {Object.entries(profile.social_links || {}).length > 0 && (
                    <div className="space-y-3">
                      {Object.entries(profile.social_links).map(([platform, url]) => (
                        <div key={platform} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          {socialPlatformIcons[platform.toLowerCase()] || <Link2 className="w-4 h-4" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium capitalize">{platform}</p>
                            <p className="text-sm text-muted-foreground truncate">{url}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => removeSocialLink(platform)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Social Link */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Ajouter un réseau</h4>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div>
                        <Label>Plateforme</Label>
                        <Input
                          value={newSocialPlatform}
                          onChange={(e) => setNewSocialPlatform(e.target.value)}
                          placeholder="Instagram, Facebook, TikTok..."
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>URL</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={newSocialUrl}
                            onChange={(e) => setNewSocialUrl(e.target.value)}
                            placeholder="https://instagram.com/votrecompte"
                          />
                          <Button onClick={addSocialLink} variant="outline">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveProfile} disabled={saving} className="rounded-full">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Enregistrement..." : "Enregistrer les réseaux sociaux"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Apparence
                  </CardTitle>
                  <CardDescription>
                    Personnalisez l'apparence de vos jeux
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo */}
                  <div>
                    <Label className="flex items-center gap-1">
                      <Image className="w-3 h-3" /> Logo de l'entreprise
                    </Label>
                    <div className="flex items-center gap-4 mt-2">
                      {branding.logo_url ? (
                        <img 
                          src={branding.logo_url} 
                          alt="Logo" 
                          className="w-20 h-20 object-contain rounded-lg border"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                          <Image className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label htmlFor="logo-upload">
                          <Button variant="outline" size="sm" asChild>
                            <span className="cursor-pointer">Changer le logo</span>
                          </Button>
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG. Max 2MB.</p>
                      </div>
                    </div>
                  </div>

                  {/* Colors */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Couleur principale</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={branding.primary_color || "#6366f1"}
                          onChange={(e) => handleBrandingChange("primary_color", e.target.value)}
                          className="w-10 h-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={branding.primary_color || "#6366f1"}
                          onChange={(e) => handleBrandingChange("primary_color", e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Couleur secondaire</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={branding.secondary_color || "#8b5cf6"}
                          onChange={(e) => handleBrandingChange("secondary_color", e.target.value)}
                          className="w-10 h-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={branding.secondary_color || "#8b5cf6"}
                          onChange={(e) => handleBrandingChange("secondary_color", e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-3">Aperçu des couleurs</p>
                    <div className="flex gap-4">
                      <div 
                        className="w-20 h-12 rounded flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: branding.primary_color }}
                      >
                        Primaire
                      </div>
                      <div 
                        className="w-20 h-12 rounded flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: branding.secondary_color }}
                      >
                        Secondaire
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveBranding} disabled={saving} className="rounded-full">
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Enregistrement..." : "Enregistrer l'apparence"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
