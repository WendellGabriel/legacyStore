import { computed, Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, SignInInput, SignUpInput } from '@legacystore/shared';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Estado de autenticação da aplicação, exposto via Signals.
 * - `user()` / `session()` refletem a sessão do Supabase.
 * - `profile()` traz o registro em public.profiles (inclui a role).
 * - `isAdmin()` é derivado da role.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);
  private readonly _profile = signal<Profile | null>(null);
  private readonly _loading = signal(true);

  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => !!this._session());
  readonly isAdmin = computed(() => this._profile()?.role === 'admin');

  constructor(private readonly supabase: SupabaseService) {
    void this.init();
  }

  private async init(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    this._session.set(data.session);
    if (data.session) await this.loadProfile();
    this._loading.set(false);

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      if (session) void this.loadProfile();
      else this._profile.set(null);
    });
  }

  private async loadProfile(): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) return;
    const { data } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    this._profile.set((data as Profile) ?? null);
  }

  async signUp(input: SignUpInput) {
    const { data, error } = await this.supabase.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.full_name, phone: input.phone } },
    });
    return { data, error };
  }

  async signIn(input: SignInInput) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    return { data, error };
  }

  async resetPassword(email: string) {
    return this.supabase.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/nova-senha`,
    });
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
    this._profile.set(null);
  }
}
