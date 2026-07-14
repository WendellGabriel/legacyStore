import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    this.errorMsg.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { password, confirm } = this.form.getRawValue();
    if (password !== confirm) {
      this.errorMsg.set('As senhas não coincidem.');
      return;
    }

    this.loading.set(true);
    const { error } = await this.supabase.client.auth.updateUser({ password });
    this.loading.set(false);

    if (error) {
      this.errorMsg.set(
        /session|token/i.test(error.message)
          ? 'Link expirado ou inválido. Solicite um novo.'
          : 'Não foi possível alterar a senha.',
      );
      return;
    }
    void this.router.navigateByUrl('/');
  }
}
