import { Pipe, PipeTransform } from '@angular/core';

/** Formata número como moeda brasileira: 427.48 → "R$ 427,48". */
@Pipe({ name: 'brl' })
export class BrlPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
