import { BrlPipe } from './brl.pipe';

describe('BrlPipe', () => {
  const pipe = new BrlPipe();

  it('formata valor como moeda brasileira', () => {
    const out = pipe.transform(427.48);
    expect(out).toContain('R$');
    expect(out).toContain('427,48');
  });

  it('usa separador de milhar', () => {
    expect(pipe.transform(1000)).toContain('1.000,00');
  });

  it('formata zero', () => {
    expect(pipe.transform(0)).toContain('0,00');
  });

  it('retorna vazio para null/undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
