import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { signUpSchema } from '@legacystore/shared';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register.html',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly success = signal(false);
  protected readonly hidePassword = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    this.errorMsg.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const parsed = signUpSchema.safeParse({
      ...raw,
      phone: raw.phone || undefined,
    });
    if (!parsed.success) {
      this.errorMsg.set(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    this.loading.set(true);
    const { data, error } = await this.auth.signUp(parsed.data);
    this.loading.set(false);

    if (error) {
      this.errorMsg.set(this.translateError(error.message));
      return;
    }

    // Se o e-mail exigir confirmação, não há sessão ativa ainda.
    if (data.session) {
      void this.router.navigateByUrl('/');
    } else {
      this.success.set(true);
    }
  }

  private translateError(msg: string): string {
    if (/already registered|already exists/i.test(msg)) return 'Este e-mail já está cadastrado.';
    if (/password/i.test(msg)) return 'Senha muito fraca (mínimo 8 caracteres).';
    return 'Não foi possível criar a conta. Tente novamente.';
  }
}
