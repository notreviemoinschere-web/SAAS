import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Gift, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [status, setStatus] = useState(null); // null | 'success' | 'error'
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      verifyToken(t);
    }
  }, [searchParams]);

  const verifyToken = async (t) => {
    setLoading(true);
    try {
      await api.post("/auth/verify-email", { token: t || token });
      setStatus("success");
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" data-testid="verify-email-page">
      <Card className="w-full max-w-md shadow-lg text-center">
        <CardContent className="pt-8 pb-6">
          <Link to="/" className="flex items-center justify-center gap-2 mb-6">
            <Gift className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">PrizeWheel Pro</span>
          </Link>
          {status === "success" ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Email Verified!</h2>
              <p className="text-muted-foreground mb-6">Your email has been verified. You can now log in.</p>
              <Button data-testid="goto-login-verified" onClick={() => navigate("/login")} className="rounded-full px-8">
                Go to Login
              </Button>
            </>
          ) : status === "error" ? (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Verification Failed</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button data-testid="retry-verify" variant="outline" onClick={() => { setStatus(null); setError(""); }} className="rounded-full px-8">
                Try Again
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">Verify Your Email</h2>
              <p className="text-muted-foreground mb-6">Enter the verification token sent to your email.</p>
              <div className="space-y-4">
                <Input data-testid="verify-token-input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter verification token" />
                <Button data-testid="verify-submit" onClick={() => verifyToken(token)} disabled={loading || !token} className="w-full rounded-full">
                  {loading ? "Verifying..." : "Verify Email"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
