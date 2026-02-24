/**
 * Объявление модуля для TypeScript (сборка на Vercel).
 * Пакет @supabase/supabase-js в dependencies — при npm install будет установлен.
 */
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    from(table: string): {
      select(query?: string, opts?: { count?: 'exact'; head?: boolean }): Promise<{ count: number | null; error: { message: string } | null }>;
      upsert(data: object, opts?: { onConflict?: string }): Promise<{ error: { message: string } | null }>;
    };
  }
  export function createClient(url: string, key: string, options?: unknown): SupabaseClient;
}
