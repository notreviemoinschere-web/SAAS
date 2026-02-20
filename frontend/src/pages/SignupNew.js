import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Gift, Check, Sparkles, Building2, User, Phone, Mail, Lock, ArrowRight } from "lucide-react";

const plans = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    features: ['1 campagne', '500 parties/mois', 'Support email'],
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '29€',
    period: '/mois',
    features: ['Campagnes illimitées', '10 000 parties/mois', '5 membres staff', 'Export données', 'Sans branding'],
    popular: true
  },
  {
    id: 'business',
    name: 'Business',
    price: '99€',
    period: '/mois',
    features: ['Tout illimité', 'API access', 'White label', 'Support prioritaire', 'Multi-établissements'],
    popular: false
  }
];

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('free');
  
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    phone: "",
    email: "",
    password: "",
    password_confirm: "",
    gdpr_consent: false
  });

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
    setError("");
  };

  const validateStep1 = () => {
    if (!form.first_name.trim()) return "Le prénom est requis";
    if (!form.last_name.trim()) return "Le nom est requis";
    if (!form.company_name.trim()) return "Le nom de l'entreprise est requis";
    if (!form.phone.trim()) return "Le téléphone est requis";
    return null;
  };

  const validateStep2 = () => {
    if (!form.email.trim()) return "L'email est requis";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Email invalide";
    if (!form.password) return "Le mot de passe est requis";
    if (form.password.length < 6) return "Le mot de passe doit faire au moins 6 caractères";
    if (form.password !== form.password_confirm) return "Les mots de passe ne correspondent pas";
    if (!form.gdpr_consent) return "Vous devez accepter les conditions";
    return null;
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/signup", {
        first_name: form.first_name,
        last_name: form.last_name,
        company_name: form.company_name,
        phone: form.phone,
        email: form.email,
        password: form.password,
        gdpr_consent: form.gdpr_consent
      });

      // Auto-login
      if (res.data.token) {
        login(res.data.token, res.data.user);
        // Show plan selection modal
        setShowPlanModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async () => {
    if (selectedPlan === 'free') {
      navigate('/dashboard');
    } else {
      // Redirect to billing for paid plan
      navigate(`/billing?upgrade=${selectedPlan}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-primary">
            <Gift className="w-8 h-8" />
            PrizeWheel Pro
          </Link>
          <p className="text-muted-foreground mt-2">Créez votre compte en quelques secondes</p>
        </div>

        <Card className="shadow-xl border-0" data-testid="signup-card">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {step === 1 ? "Vos informations" : "Votre compte"}
            </CardTitle>
            <CardDescription>
              Étape {step} sur 2
            </CardDescription>
            {/* Progress bar */}
            <div className="flex gap-2 mt-4">
              <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4" data-testid="signup-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {step === 1 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="first_name" className="flex items-center gap-1 text-sm">
                        <User className="w-3 h-3" /> Prénom
                      </Label>
                      <Input
                        id="first_name"
                        value={form.first_name}
                        onChange={(e) => handleChange("first_name", e.target.value)}
                        placeholder="Jean"
                        className="mt-1"
                        data-testid="signup-firstname"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name" className="text-sm">Nom</Label>
                      <Input
                        id="last_name"
                        value={form.last_name}
                        onChange={(e) => handleChange("last_name", e.target.value)}
                        placeholder="Dupont"
                        className="mt-1"
                        data-testid="signup-lastname"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="company_name" className="flex items-center gap-1 text-sm">
                      <Building2 className="w-3 h-3" /> Nom de l'entreprise
                    </Label>
                    <Input
                      id="company_name"
                      value={form.company_name}
                      onChange={(e) => handleChange("company_name", e.target.value)}
                      placeholder="Mon Restaurant"
                      className="mt-1"
                      data-testid="signup-company"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="flex items-center gap-1 text-sm">
                      <Phone className="w-3 h-3" /> Téléphone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="mt-1"
                      data-testid="signup-phone"
                    />
                  </div>

                  <Button 
                    type="button" 
                    onClick={handleNext} 
                    className="w-full rounded-full mt-4"
                    data-testid="signup-next"
                  >
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-1 text-sm">
                      <Mail className="w-3 h-3" /> Email professionnel
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="jean@monrestaurant.fr"
                      className="mt-1"
                      data-testid="signup-email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="flex items-center gap-1 text-sm">
                      <Lock className="w-3 h-3" /> Mot de passe
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      data-testid="signup-password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password_confirm" className="text-sm">Confirmer le mot de passe</Label>
                    <Input
                      id="password_confirm"
                      type="password"
                      value={form.password_confirm}
                      onChange={(e) => handleChange("password_confirm", e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      data-testid="signup-password-confirm"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox
                      id="gdpr"
                      checked={form.gdpr_consent}
                      onCheckedChange={(checked) => handleChange("gdpr_consent", checked)}
                      data-testid="signup-gdpr"
                    />
                    <label htmlFor="gdpr" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      J'accepte les <a href="/terms" className="text-primary underline">Conditions Générales</a> et la <a href="/privacy" className="text-primary underline">Politique de Confidentialité</a>. Mes données seront traitées conformément au RGPD.
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setStep(1)} 
                      className="flex-1 rounded-full"
                    >
                      Retour
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading} 
                      className="flex-1 rounded-full"
                      data-testid="signup-submit"
                    >
                      {loading ? "Création..." : "Créer mon compte"}
                    </Button>
                  </div>
                </div>
              )}
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Déjà un compte ?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Selection Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Choisissez votre plan
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid md:grid-cols-3 gap-4 py-4">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedPlan === plan.id 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                } ${plan.popular ? 'relative' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
                data-testid={`plan-${plan.id}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-3 py-1 rounded-full">
                    Populaire
                  </div>
                )}
                <CardContent className="pt-6">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === plan.id && (
                    <div className="mt-4 flex justify-center">
                      <Check className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button 
              onClick={handleSelectPlan} 
              className="w-full rounded-full"
              data-testid="confirm-plan"
            >
              {selectedPlan === 'free' ? 'Commencer gratuitement' : `Choisir ${plans.find(p => p.id === selectedPlan)?.name}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
