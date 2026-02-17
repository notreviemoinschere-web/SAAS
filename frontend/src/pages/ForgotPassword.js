import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Gift, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setSent(true);
      if (res.data.reset_token) setResetToken(res.data.reset_token);
    } catch {} finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="forgot-password-sent">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardContent className="pt-8 pb-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
            <p className="text-muted-foreground mb-4">If an account exists, a reset link has been sent.</p>
            {resetToken && (
              <div className="bg-muted rounded-lg p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Reset Token (for testing):</p>
                <code className="text-sm font-mono break-all">{resetToken}</code>
              </div>
            )}
            <div className="flex gap-3">
              {resetToken && <Button data-testid="goto-reset" onClick={() => navigate(`/reset-password?token=${resetToken}`)} className="flex-1 rounded-full">Reset Password</Button>}
              <Button variant="outline" onClick={() => navigate("/login")} className="flex-1 rounded-full">Back to Login</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="forgot-password-page">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            <Gift className="w-8 h-8 text-primary" /><span className="text-2xl font-bold">PrizeWheel Pro</span>
          </Link>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Email</Label><Input data-testid="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <Button data-testid="forgot-submit" type="submit" className="w-full rounded-full" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</Button>
            <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Back to Login</Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
