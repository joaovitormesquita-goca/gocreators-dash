import type { MetabaseRow } from "./types.ts";

export class MetabaseClient {
  private sessionToken: string | null = null;

  constructor(
    private url: string,
    private username: string,
    private password: string,
    private databaseId: number,
  ) {}

  async authenticate(): Promise<void> {
    const res = await fetch(`${this.url}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Metabase auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    this.sessionToken = data.id;
  }

  async executeQuery(sql: string): Promise<MetabaseRow[]> {
    const PAGE_SIZE = 2000;
    const allRows: MetabaseRow[] = [];
    let offset = 0;

    while (true) {
      const paginatedSql = `${sql}\nORDER BY ad_id, date\nLIMIT ${PAGE_SIZE} OFFSET ${offset}`;
      const rows = await this.executeSingleQuery(paginatedSql);
      allRows.push(...this.parseRows(rows));
      console.log(`Metabase page offset=${offset}: ${rows.data.rows.length} rows`);

      if (rows.data.rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    return allRows;
  }

  private async executeSingleQuery(
    sql: string,
    retry = true,
  ): Promise<{ data: { cols: { name: string }[]; rows: unknown[][] } }> {
    if (!this.sessionToken) {
      await this.authenticate();
    }

    const res = await fetch(`${this.url}/api/dataset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Metabase-Session": this.sessionToken!,
      },
      body: JSON.stringify({
        database: this.databaseId,
        type: "native",
        native: { query: sql },
        constraints: null,
      }),
    });

    if (res.status === 401 && retry) {
      await this.authenticate();
      return this.executeSingleQuery(sql, false);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Metabase query failed (${res.status}): ${text}`);
    }

    return await res.json();
  }

  async executeRawQuery(
    sql: string,
    retry = true,
  ): Promise<Record<string, unknown>[]> {
    if (!this.sessionToken) {
      await this.authenticate();
    }

    const res = await fetch(`${this.url}/api/dataset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Metabase-Session": this.sessionToken!,
      },
      body: JSON.stringify({
        database: this.databaseId,
        type: "native",
        native: { query: sql },
        constraints: null,
      }),
    });

    if (res.status === 401 && retry) {
      await this.authenticate();
      return this.executeRawQuery(sql, false);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Metabase query failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return this.parseRawRows(data);
  }

  private parseRows(data: {
    data: { cols: { name: string }[]; rows: unknown[][] };
  }): MetabaseRow[] {
    const cols = data.data.cols.map((c: { name: string }) => c.name);
    return data.data.rows.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return {
        ad_id: String(obj.ad_id),
        ad_name: String(obj.ad_name),
        created_time: String(obj.created_time),
        date: String(obj.date),
        spend: Number(obj.spend) || 0,
        revenue: Number(obj.revenue) || 0,
        link_clicks: Number(obj.link_clicks) || 0,
        impressions: Number(obj.impressions) || 0,
      };
    });
  }

  private parseRawRows(data: {
    data: { cols: { name: string }[]; rows: unknown[][] };
  }): Record<string, unknown>[] {
    const cols = data.data.cols.map((c: { name: string }) => c.name);
    return data.data.rows.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }
}
