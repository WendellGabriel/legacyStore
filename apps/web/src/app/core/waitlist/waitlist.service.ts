import { inject, Injectable } from '@angular/core';
import type { WaitlistInput } from '@legacystore/shared';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from '../auth/auth.service';

/**
 * Registro de interesse na pré-venda de um produto esgotado (lista de aviso).
 * Guest-friendly: funciona logado ou anônimo. RLS permite insert público.
 */
@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** Sugestão de e-mail para pré-preencher o formulário (se logado). */
  suggestedEmail(): string {
    return this.auth.user()?.email ?? '';
  }

  async join(productId: string, input: WaitlistInput): Promise<{ error: string | null }> {
    const row = {
      product_id: productId,
      user_id: this.auth.user()?.id ?? null,
      email: input.email.trim().toLowerCase(),
      whatsapp: input.whatsapp?.trim() || null,
    };
    const { error } = await this.supabase.client.from('product_waitlist').insert(row);

    // duplicidade (já cadastrado) não é erro para o usuário
    if (error && /duplicate|unique|23505/i.test(error.message)) {
      return { error: null };
    }
    return { error: error?.message ?? null };
  }
}
