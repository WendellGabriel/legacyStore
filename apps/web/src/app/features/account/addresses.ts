import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { Address } from '@legacystore/shared';
import { BRAZIL_STATES, addressSchema } from '@legacystore/shared';
import { AddressService } from './address.service';

@Component({
  selector: 'app-addresses',
  imports: [ReactiveFormsModule, MatIconModule, MatButtonModule],
  templateUrl: './addresses.html',
})
export class Addresses {
  private readonly service = inject(AddressService);
  private readonly fb = inject(FormBuilder);

  protected readonly states = BRAZIL_STATES;
  protected readonly addresses = signal<Address[]>([]);
  protected readonly loading = signal(true);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    label: [''],
    recipient: ['', Validators.required],
    cep: ['', Validators.required],
    street: ['', Validators.required],
    number: ['', Validators.required],
    complement: [''],
    neighborhood: ['', Validators.required],
    city: ['', Validators.required],
    state: ['PE', Validators.required],
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.addresses.set(await this.service.list());
    this.loading.set(false);
  }

  openNew(): void {
    this.editingId.set(null);
    this.form.reset({ state: 'PE' });
    this.showForm.set(true);
  }

  openEdit(a: Address): void {
    this.editingId.set(a.id);
    this.form.setValue({
      label: a.label ?? '',
      recipient: a.recipient,
      cep: a.cep,
      street: a.street,
      number: a.number,
      complement: a.complement ?? '',
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
    });
    this.showForm.set(true);
  }

  async onCepBlur(): Promise<void> {
    const info = await this.service.lookupCep(this.form.controls.cep.value);
    if (info) {
      this.form.patchValue({
        street: info.street ?? '',
        neighborhood: info.neighborhood ?? '',
        city: info.city,
        state: info.state,
      });
    }
  }

  async save(): Promise<void> {
    const parsed = addressSchema.safeParse(this.form.getRawValue());
    if (!parsed.success) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.editingId();
    if (id) await this.service.update(id, parsed.data);
    else await this.service.create(parsed.data);
    this.showForm.set(false);
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await this.service.remove(id);
    await this.load();
  }

  async setDefault(id: string): Promise<void> {
    await this.service.setDefault(id);
    await this.load();
  }
}
