import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Gift, CheckCircle2, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setStatus("success");
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed");
      setStatus("error");
    } finally { setLoading(false); }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="reset-success">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardContent className="pt-8 pb-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Password Reset!</h2>
            <p className="text-muted-foreground mb-6">Your password has been reset successfully.</p>
            <Button data-testid="goto-login-reset" onClick={() => navigate("/login")} className="rounded-full px-8">Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="reset-password-page">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <Link to="/" className="flex items-center justify-center gap-2 mb-4">
            <Gift className="w-8 h-8 text-primary" /><span className="text-2xl font-bold">PrizeWheel Pro</span>
          </Link>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">{error}</div>}
            {!searchParams.get("token") && (
              <div className="space-y-2"><Label>Reset Token</Label><Input data-testid="reset-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste reset token" required /></div>
            )}
            <div className="space-y-2"><Label>New Password</Label><Input data-testid="reset-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} /></div>
            <Button data-testid="reset-submit" type="submit" className="w-full rounded-full" disabled={loading || !token}>{loading ? "Resetting..." : "Reset Password"}</Button>
            <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">Back to Login</Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
