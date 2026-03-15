"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncAdMetrics } from "@/app/dashboard/creators/actions";

export function SyncButton() {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const result = await syncAdMetrics();
      if (result.success) {
        toast.success("Sincronização concluída com sucesso!");
      } else {
        toast.error(`Erro na sincronização: ${result.error}`);
      }
    } catch {
      toast.error("Erro inesperado ao sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Sincronizando..." : "Sincronizar"}
    </Button>
  );
}
