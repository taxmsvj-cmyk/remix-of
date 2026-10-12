import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="text-lg font-bold text-primary">
          مغز دانشی MKA
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {email ? (
            <>
              <Link to="/memory" className="rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-secondary font-semibold" }}>
                حافظه
              </Link>
              <Link to="/ask" className="rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-secondary font-semibold" }}>
                پرسش
              </Link>
              <Button variant="outline" size="sm" onClick={signOut}>
                خروج
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">ورود</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
