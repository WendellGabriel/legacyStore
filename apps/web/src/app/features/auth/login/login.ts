import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { signInSchema } from '@legacystore/shared';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    this.errorMsg.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const parsed = signInSchema.safeParse(this.form.getRawValue());
    if (!parsed.success) {
      this.errorMsg.set(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    this.loading.set(true);
    const { error } = await this.auth.signIn(parsed.data);
    this.loading.set(false);

    if (error) {
      this.errorMsg.set(this.translateError(error.message));
      return;
    }

    const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/';
    void this.router.navigateByUrl(redirect);
  }

  private translateError(msg: string): string {
    if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.';
    return 'Não foi possível entrar. Tente novamente.';
  }
}
