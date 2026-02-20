import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { WheelOfFortune2026 } from "../components/WheelOfFortune2026";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { 
  Gift, Globe, Copy, CheckCircle2, XCircle, Star, 
  Instagram, Facebook, ExternalLink, Shield, Sparkles,
  PartyPopper, Heart, Share2
} from "lucide-react";
import api from "../lib/api";

export default function PlayGame() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { t, lang, switchLang } = useI18n();
  
  const [campaign, setCampaign] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);
  
  // Form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  
  // Consent state (GDPR mandatory)
  const [gdprConsent, setGdprConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  
  // Pre-play tasks state
  const [tasksCompleted, setTasksCompleted] = useState({});
  
  // Game flow state
  const [phase, setPhase] = useState("loading"); // loading, gdpr, tasks, form, spinning, result, review
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const isTestMode = searchParams.get("mode") === "test";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/game/${slug}?lang=${lang}`);
        setCampaign(res.data.campaign);
        setPrizes(res.data.prizes);
        setTenantInfo(res.data.tenant);
        setTenantProfile(res.data.tenant_profile || {});
        // Start with GDPR consent phase
        setPhase("gdpr");
      } catch (err) {
        setError(err.response?.data?.detail || "Campagne introuvable");
        setPhase("error");
      }
    };
    load();
  }, [slug, lang]);

  const socialLinks = tenantProfile?.social_links || {};
  const hasSocialTasks = Object.keys(socialLinks).length > 0 && campaign?.require_social_follow;

  const handleGdprAccept = () => {
    if (!gdprConsent) {
      setError("Vous devez accepter les conditions pour continuer");
      return;
    }
    setError("");
    if (hasSocialTasks) {
      setPhase("tasks");
    } else {
      setPhase("form");
    }
  };

  const handleTasksComplete = () => {
    setPhase("form");
  };

  const handleSpin = async () => {
    if (!email || !gdprConsent) {
      setError("Veuillez remplir votre email");
      return null;
    }
    
    if (campaign?.require_phone && !phone) {
      setError("Le numéro de téléphone est requis");
      return null;
    }
    
    setError("");
    setSpinning(true);
    setPhase("spinning");

    try {
      const res = await api.post(`/game/${slug}/play`, {
        email,
        phone: phone || null,
        first_name: firstName || null,
        consent_accepted: true,
        marketing_consent: marketingConsent,
        device_hash: navigator.userAgent,
        lang,
        tasks_completed: tasksCompleted,
      });

      // Wait for wheel animation (5 seconds)
      setTimeout(() => {
        setResult(res.data);
        setSpinning(false);
        setPhase("result");
      }, 5200);

      return res.data.prize_index;
    } catch (err) {
      setSpinning(false);
      setPhase("form");
      setError(err.response?.data?.detail || "Impossible de jouer");
      return null;
    }
  };

  const copyCode = () => {
    if (result?.reward?.code) {
      navigator.clipboard.writeText(result.reward.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToReview = () => {
    if (tenantProfile?.google_review_url) {
      window.open(tenantProfile.google_review_url, "_blank");
    }
  };

  const shareResult = async () => {
    if (navigator.share && result?.won) {
      try {
        await navigator.share({
          title: `J'ai gagné chez ${tenantInfo?.name}!`,
          text: `J'ai gagné "${result.reward?.prize_label}" avec la roue de la fortune!`,
          url: window.location.href,
        });
      } catch (e) {
        console.log("Share cancelled");
      }
    }
  };

  // Loading state
  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/70 animate-pulse">Chargement...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 px-4" data-testid="game-error">
        <Card className="w-full max-w-md text-center bg-white/10 backdrop-blur-xl border-white/20">
          <CardContent className="pt-8 pb-6">
            <XCircle className="w-20 h-20 text-red-400 mx-auto mb-4" />
            <p className="text-xl font-medium text-white mb-4">{error}</p>
            <a href="/" className="text-purple-400 text-sm hover:underline">Retour à l'accueil</a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = tenantProfile?.primary_color || "#6366f1";
  const secondaryColor = tenantProfile?.secondary_color || "#8b5cf6";

  return (
    <div 
      className="min-h-screen flex flex-col overflow-hidden"
      style={{
        background: `linear-gradient(135deg, #0f0f1a 0%, ${primaryColor}15 50%, #0f0f1a 100%)`
      }}
      data-testid="play-game-page"
    >
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 -top-48 -left-48 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute w-96 h-96 -bottom-48 -right-48 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: "1s"}}></div>
        <div className="absolute w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: "2s"}}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3">
          {tenantProfile?.logo_url ? (
            <img src={tenantProfile.logo_url} alt={tenantInfo?.name} className="h-8 w-auto rounded" />
          ) : (
            <Gift className="w-6 h-6 text-purple-400" />
          )}
          <span className="font-semibold text-white">{tenantInfo?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {(campaign?.status === "test" || isTestMode) && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">MODE TEST</Badge>
          )}
          <button 
            data-testid="game-lang-toggle" 
            onClick={() => switchLang(lang === "en" ? "fr" : "en")} 
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <Globe className="w-4 h-4" />{lang === "en" ? "FR" : "EN"}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6">
        
        {/* GDPR Consent Phase */}
        {phase === "gdpr" && (
          <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="text-center pb-2">
              <Shield className="w-12 h-12 text-purple-400 mx-auto mb-2" />
              <CardTitle className="text-white text-xl">Protection de vos données</CardTitle>
              <p className="text-white/60 text-sm">Avant de jouer, veuillez lire et accepter nos conditions</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-500/20 text-red-300 text-sm p-3 rounded-lg border border-red-500/30">
                  {error}
                </div>
              )}
              
              <div className="bg-white/5 rounded-lg p-4 max-h-40 overflow-y-auto text-sm text-white/70 leading-relaxed">
                <p className="mb-2"><strong>Conditions de participation :</strong></p>
                <p>{campaign?.terms_text || "En participant à ce jeu, vous acceptez les conditions générales d'utilisation et notre politique de confidentialité. Vos données personnelles seront traitées conformément au RGPD."}</p>
                {campaign?.legal_text && (
                  <p className="mt-2 text-xs opacity-70">{campaign.legal_text}</p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <Checkbox 
                    id="gdpr" 
                    checked={gdprConsent} 
                    onCheckedChange={setGdprConsent}
                    className="mt-0.5 border-white/30 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                  />
                  <label htmlFor="gdpr" className="text-sm text-white/80 cursor-pointer leading-relaxed">
                    <span className="text-red-400">*</span> J'accepte les conditions générales et la politique de confidentialité (obligatoire)
                  </label>
                </div>

                {campaign?.consent_marketing_email && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <Checkbox 
                      id="marketing" 
                      checked={marketingConsent} 
                      onCheckedChange={setMarketingConsent}
                      className="mt-0.5 border-white/30 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                    />
                    <label htmlFor="marketing" className="text-sm text-white/80 cursor-pointer leading-relaxed">
                      J'accepte de recevoir des offres et actualités par email (optionnel)
                    </label>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleGdprAccept}
                disabled={!gdprConsent}
                className="w-full py-6 text-lg font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25"
                data-testid="gdpr-accept-btn"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Continuer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Social Tasks Phase */}
        {phase === "tasks" && (
          <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="text-center pb-2">
              <Heart className="w-12 h-12 text-pink-400 mx-auto mb-2" />
              <CardTitle className="text-white text-xl">Suivez-nous !</CardTitle>
              <p className="text-white/60 text-sm">Augmentez vos chances en nous suivant sur les réseaux</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {socialLinks.instagram && (
                  <SocialTaskButton 
                    icon={Instagram}
                    label="Suivre sur Instagram"
                    url={socialLinks.instagram}
                    completed={tasksCompleted.instagram}
                    onComplete={() => setTasksCompleted(prev => ({...prev, instagram: true}))}
                    color="from-purple-500 to-pink-500"
                  />
                )}
                {socialLinks.facebook && (
                  <SocialTaskButton 
                    icon={Facebook}
                    label="Aimer sur Facebook"
                    url={socialLinks.facebook}
                    completed={tasksCompleted.facebook}
                    onComplete={() => setTasksCompleted(prev => ({...prev, facebook: true}))}
                    color="from-blue-600 to-blue-500"
                  />
                )}
                {socialLinks.tiktok && (
                  <SocialTaskButton 
                    icon={() => <span className="text-lg font-bold">TT</span>}
                    label="Suivre sur TikTok"
                    url={socialLinks.tiktok}
                    completed={tasksCompleted.tiktok}
                    onComplete={() => setTasksCompleted(prev => ({...prev, tiktok: true}))}
                    color="from-black to-gray-800"
                  />
                )}
              </div>

              <p className="text-center text-white/50 text-xs">Ces actions sont optionnelles</p>

              <Button 
                onClick={handleTasksComplete}
                className="w-full py-6 text-lg font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25"
                data-testid="tasks-continue-btn"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Jouer maintenant
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Form & Wheel Phase */}
        {(phase === "form" || phase === "spinning") && (
          <>
            {/* Title */}
            <div className="text-center animate-in fade-in slide-in-from-top-4 duration-700">
              <h1 className="font-display text-4xl sm:text-5xl tracking-wider text-white drop-shadow-lg">
                {campaign?.intro_text || "Tentez votre chance !"}
              </h1>
              {campaign?.description && (
                <p className="text-base text-white/60 mt-3 max-w-md">{campaign.description}</p>
              )}
            </div>

            {/* Wheel */}
            <div className="animate-in zoom-in-95 duration-700" style={{animationDelay: "200ms"}}>
              <WheelOfFortune2026
                prizes={prizes}
                onSpinRequest={handleSpin}
                spinning={spinning}
                disabled={phase === "spinning"}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
              />
            </div>

            {/* Form Card */}
            {phase === "form" && (
              <Card className="w-full max-w-sm bg-white/10 backdrop-blur-xl border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{animationDelay: "400ms"}}>
                <CardContent className="pt-6 space-y-4">
                  {error && (
                    <div data-testid="game-play-error" className="bg-red-500/20 text-red-300 text-sm p-3 rounded-lg border border-red-500/30">
                      {error}
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-sm text-white/80">Prénom (optionnel)</Label>
                    <Input 
                      data-testid="game-firstname"
                      type="text" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)} 
                      placeholder="Votre prénom"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-500"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm text-white/80">Email <span className="text-red-400">*</span></Label>
                    <Input 
                      data-testid="game-email"
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="votre@email.com"
                      required 
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-500"
                    />
                  </div>
                  
                  {campaign?.require_phone && (
                    <div>
                      <Label className="text-sm text-white/80">Téléphone <span className="text-red-400">*</span></Label>
                      <Input 
                        data-testid="game-phone"
                        type="tel" 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="+33 6 12 34 56 78"
                        required
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-500"
                      />
                    </div>
                  )}

                  <Button 
                    data-testid="spin-btn"
                    onClick={handleSpin} 
                    disabled={!email || spinning} 
                    className="w-full py-6 text-xl font-display tracking-wider rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                    size="lg"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    {campaign?.cta_text || "TOURNER LA ROUE"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Spinning indicator */}
            {phase === "spinning" && (
              <p className="text-xl font-medium text-white/80 animate-pulse">
                La roue tourne...
              </p>
            )}
          </>
        )}

        {/* Result Phase */}
        {phase === "result" && result && (
          <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border-white/20 animate-in zoom-in-95 duration-500">
            <CardContent className="pt-8 pb-6 text-center space-y-5">
              {result.won ? (
                <>
                  <div className="relative">
                    <PartyPopper className="w-20 h-20 text-yellow-400 mx-auto animate-bounce" />
                    <Sparkles className="w-8 h-8 text-pink-400 absolute top-0 right-1/4 animate-pulse" />
                    <Sparkles className="w-6 h-6 text-purple-400 absolute bottom-0 left-1/4 animate-pulse" style={{animationDelay: "500ms"}} />
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Félicitations !</h2>
                    <p className="text-white/70 text-lg">
                      {firstName ? `Bravo ${firstName}, vous` : "Vous"} avez gagné :
                    </p>
                    <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400 mt-2">
                      {result.reward?.prize_label}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl p-5 border border-white/10">
                    <p className="text-xs text-white/50 mb-2">Votre code cadeau</p>
                    <div className="flex items-center justify-center gap-3">
                      <code data-testid="reward-code" className="text-3xl font-mono font-bold tracking-widest text-white">
                        {result.reward?.code}
                      </code>
                      <button 
                        onClick={copyCode} 
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors group"
                        data-testid="copy-code-btn"
                      >
                        {copied ? (
                          <CheckCircle2 className="w-6 h-6 text-green-400" />
                        ) : (
                          <Copy className="w-6 h-6 text-white/50 group-hover:text-white" />
                        )}
                      </button>
                    </div>
                    {result.reward?.expires_at && (
                      <p className="text-xs text-white/50 mt-3">
                        Valable jusqu'au {new Date(result.reward.expires_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>

                  {result.is_test && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                      TEST - Code non utilisable
                    </Badge>
                  )}

                  {/* Share button */}
                  {navigator.share && (
                    <Button
                      variant="outline"
                      onClick={shareResult}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Partager ma victoire
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="w-20 h-20 text-white/40 mx-auto" />
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Pas de chance cette fois...</h2>
                    <p className="text-white/60">Tentez à nouveau la prochaine fois !</p>
                  </div>
                </>
              )}

              {/* Google Review CTA */}
              {tenantProfile?.google_review_url && (
                <div className="pt-4 border-t border-white/10">
                  <p className="text-white/60 text-sm mb-3">
                    Vous avez apprécié votre expérience ?
                  </p>
                  <Button
                    onClick={goToReview}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white"
                    data-testid="google-review-btn"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Laissez-nous un avis Google
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer with rules */}
      {campaign?.rules && (
        <footer className="relative z-10 px-4 py-4 bg-black/30 backdrop-blur-md border-t border-white/10">
          <p className="text-xs text-white/50 text-center max-w-md mx-auto">{campaign.rules}</p>
        </footer>
      )}
    </div>
  );
}

// Social task button component
function SocialTaskButton({ icon: Icon, label, url, completed, onComplete, color }) {
  const handleClick = () => {
    window.open(url, "_blank");
    setTimeout(() => onComplete(), 1000);
  };

  return (
    <button
      onClick={handleClick}
      disabled={completed}
      className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
        completed 
          ? "bg-green-500/20 border border-green-500/30" 
          : `bg-gradient-to-r ${color} hover:opacity-90`
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${completed ? "bg-green-500" : "bg-white/20"}`}>
          {completed ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
        </div>
        <span className="text-white font-medium">{label}</span>
      </div>
      <ExternalLink className="w-5 h-5 text-white/70" />
    </button>
  );
}
