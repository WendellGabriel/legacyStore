import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly email = this.auth.user()?.email ?? '';

  protected readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    cpf: [''],
  });

  // --- troca de senha ---
  protected readonly changingPassword = signal(false);
  protected readonly passwordSaved = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly hideCurrent = signal(true);
  protected readonly hideNew = signal(true);

  protected readonly passwordForm = this.fb.nonNullable.group({
    current: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  constructor() {
    // preenche o form quando o profile carrega
    effect(() => {
      const p = this.auth.profile();
      if (p) {
        this.form.patchValue({
          full_name: p.full_name ?? '',
          phone: p.phone ?? '',
          cpf: p.cpf ?? '',
        });
      }
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saved.set(false);
    const v = this.form.getRawValue();
    const { error } = await this.auth.updateProfile({
      full_name: v.full_name,
      phone: v.phone || undefined,
      cpf: v.cpf || undefined,
    });
    this.saving.set(false);
    if (!error) {
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2500);
    }
  }

  async changePassword(): Promise<void> {
    this.passwordError.set(null);
    this.passwordSaved.set(false);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { current, password, confirm } = this.passwordForm.getRawValue();
    if (password !== confirm) {
      this.passwordError.set('As senhas não coincidem.');
      return;
    }

    this.changingPassword.set(true);
    const { error } = await this.auth.changePassword(current, password);
    this.changingPassword.set(false);

    if (error) {
      this.passwordError.set(error);
      return;
    }
    this.passwordForm.reset();
    this.passwordSaved.set(true);
    setTimeout(() => this.passwordSaved.set(false), 2500);
  }
}
