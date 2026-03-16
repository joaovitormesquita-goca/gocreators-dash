import { SyncButton } from "@/components/sync-button";
import { SyncHistoryTable } from "@/components/sync-history-table";
import { getSyncLogs } from "./actions";

export default async function SyncPage() {
  const logs = await getSyncLogs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sincronização</h1>
        <SyncButton />
      </div>
      <SyncHistoryTable logs={logs} />
    </div>
  );
}
