import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Address, ShippingQuote } from '@legacystore/shared';
import { BRAZIL_STATES, addressSchema } from '@legacystore/shared';
import { CartService } from '../../core/cart/cart.service';
import { AuthService } from '../../core/auth/auth.service';
import { AddressService } from '../account/address.service';
import { OrderService } from '../account/order.service';
import { PaymentService } from './payment.service';
import { BrlPipe } from '../../shared/pipes/brl.pipe';

@Component({
  selector: 'app-checkout',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    BrlPipe,
  ],
  templateUrl: './checkout.html',
})
export class Checkout {
  protected readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly addressService = inject(AddressService);
  private readonly orderService = inject(OrderService);
  private readonly payment = inject(PaymentService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly states = BRAZIL_STATES;

  protected readonly addresses = signal<Address[]>([]);
  protected readonly selectedAddressId = signal<string | null>(null);
  protected readonly showForm = signal(false);

  protected readonly quotes = signal<ShippingQuote[]>([]);
  protected readonly selectedShipping = signal<ShippingQuote | null>(null);
  protected readonly loadingShipping = signal(false);
  protected readonly shippingError = signal<string | null>(null);

  protected readonly placing = signal(false);
  protected readonly placeError = signal<string | null>(null);

  protected readonly selectedAddress = computed(
    () => this.addresses().find((a) => a.id === this.selectedAddressId()) ?? null,
  );
  protected readonly grandTotal = computed(
    () => this.cart.total() + (this.selectedShipping()?.price ?? 0),
  );

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
    void this.init();
  }

  private async init(): Promise<void> {
    await this.cart.whenReady;
    if (this.cart.isEmpty()) {
      void this.router.navigateByUrl('/carrinho');
      return;
    }
    const list = await this.addressService.list();
    this.addresses.set(list);
    const def = list.find((a) => a.is_default) ?? list[0];
    if (def) void this.selectAddress(def.id);
    else this.showForm.set(true);
  }

  async selectAddress(id: string): Promise<void> {
    this.selectedAddressId.set(id);
    this.showForm.set(false);
    await this.calculateShipping();
  }

  /** Autocompleta o formulário pelo CEP. */
  async onCepBlur(): Promise<void> {
    const cep = this.form.controls.cep.value;
    const info = await this.addressService.lookupCep(cep);
    if (info) {
      this.form.patchValue({
        street: info.street ?? '',
        neighborhood: info.neighborhood ?? '',
        city: info.city,
        state: info.state,
      });
    }
  }

  async saveAddress(): Promise<void> {
    const parsed = addressSchema.safeParse(this.form.getRawValue());
    if (!parsed.success) {
      this.form.markAllAsTouched();
      return;
    }
    const created = await this.addressService.create(parsed.data);
    if (created) {
      this.addresses.update((list) => [created, ...list]);
      await this.selectAddress(created.id);
    }
  }

  private async calculateShipping(): Promise<void> {
    const address = this.selectedAddress();
    if (!address) return;
    this.loadingShipping.set(true);
    this.shippingError.set(null);
    this.selectedShipping.set(null);
    this.quotes.set([]);

    try {
      const res = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep: address.cep, items: this.cart.toOrderItems() }),
      });
      const data = await res.json();
      if (!res.ok || !data.quotes?.length) {
        this.shippingError.set(data.error ?? 'Não foi possível calcular o frete.');
      } else {
        this.quotes.set(data.quotes);
        this.selectedShipping.set(data.quotes[0]);
      }
    } catch {
      this.shippingError.set('Falha ao calcular o frete. Tente novamente.');
    } finally {
      this.loadingShipping.set(false);
    }
  }

  async placeOrder(): Promise<void> {
    const address = this.selectedAddress();
    const shipping = this.selectedShipping();
    if (!address || !shipping) return;

    this.placing.set(true);
    this.placeError.set(null);

    const { order, error } = await this.orderService.create({
      items: this.cart.toOrderItems(),
      address,
      shipping,
      couponCode: this.cart.couponCode(),
      customerEmail: this.auth.user()?.email ?? '',
      customerPhone: this.auth.profile()?.phone ?? undefined,
    });

    if (error || !order) {
      this.placing.set(false);
      this.placeError.set(error ?? 'Erro ao finalizar o pedido.');
      return;
    }

    // Pedido criado → inicia o pagamento
    const result = await this.payment.startCheckout(order.order_number);
    this.cart.clear();

    if (result.init_point) {
      // Redireciona para a tela do Mercado Pago
      window.location.href = result.init_point;
      return;
    }

    // Modo dev (sem Mercado Pago) ou erro → vai para a confirmação
    this.placing.set(false);
    void this.router.navigate(['/pedido', order.order_number]);
  }
}
