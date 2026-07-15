import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

type SettingsMap = Record<string, unknown>;

/**
 * Carrega as configurações públicas da loja (tabela store_settings) uma vez
 * e as expõe via signal. Usado por WhatsApp, Analytics, SEO, etc.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly supabase = inject(SupabaseService);
  private readonly _settings = signal<SettingsMap>({});
  readonly settings = this._settings.asReadonly();
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const { data } = await this.supabase.client.from('store_settings').select('key, value');
    const map: SettingsMap = {};
    for (const row of (data as { key: string; value: unknown }[]) ?? []) {
      map[row.key] = row.value;
    }
    this._settings.set(map);
  }

  get<T = string>(key: string, fallback?: T): T | undefined {
    const v = this._settings()[key];
    return (v as T) ?? fallback;
  }

  string(key: string, fallback = ''): string {
    const v = this._settings()[key];
    return typeof v === 'string' ? v : fallback;
  }
}
