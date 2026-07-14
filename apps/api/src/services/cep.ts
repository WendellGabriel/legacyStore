export interface CepInfo {
  cep: string;
  street: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
}

/**
 * Resolve um CEP em cidade/UF/bairro usando o ViaCEP (gratuito e público).
 * Retorna null se o CEP não existir.
 */
export async function lookupCep(rawCep: string): Promise<CepInfo | null> {
  const cep = rawCep.replace(/\D/g, '');
  if (cep.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro || !data.localidade || !data.uf) return null;

    return {
      cep,
      street: data.logradouro || null,
      neighborhood: data.bairro || null,
      city: data.localidade,
      state: data.uf,
    };
  } catch {
    return null;
  }
}
