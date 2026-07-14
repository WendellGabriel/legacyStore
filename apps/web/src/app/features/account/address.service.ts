import { inject, Injectable } from '@angular/core';
import type { Address, AddressInput } from '@legacystore/shared';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';

interface ViaCepResult {
  street: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async list(): Promise<Address[]> {
    const { data } = await this.supabase.client
      .from('addresses')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    return (data as Address[]) ?? [];
  }

  async create(input: AddressInput): Promise<Address | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    const { data } = await this.supabase.client
      .from('addresses')
      .insert({ ...input, user_id: userId })
      .select()
      .single();
    return (data as Address) ?? null;
  }

  async update(id: string, input: Partial<AddressInput>): Promise<void> {
    await this.supabase.client.from('addresses').update(input).eq('id', id);
  }

  async remove(id: string): Promise<void> {
    await this.supabase.client.from('addresses').delete().eq('id', id);
  }

  async setDefault(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    // remove default dos demais, depois marca este
    await this.supabase.client
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', userId);
    await this.supabase.client.from('addresses').update({ is_default: true }).eq('id', id);
  }

  /** Autocompleta endereço pelo CEP via ViaCEP (público). */
  async lookupCep(rawCep: string): Promise<ViaCepResult | null> {
    const cep = rawCep.replace(/\D/g, '');
    if (cep.length !== 8) return null;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) return null;
      return {
        street: data.logradouro || null,
        neighborhood: data.bairro || null,
        city: data.localidade,
        state: data.uf,
      };
    } catch {
      return null;
    }
  }
}
