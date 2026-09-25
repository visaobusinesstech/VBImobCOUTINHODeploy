export const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

export const formatCpf = (value: string) => {
  const digits = normalizeCpf(value);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const isValidCpf = (value: string) => {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(cpf[i]) * (10 - i);
  }

  let firstDigit = 11 - (sum % 11);
  if (firstDigit >= 10) firstDigit = 0;
  if (Number(cpf[9]) !== firstDigit) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(cpf[i]) * (11 - i);
  }

  let secondDigit = 11 - (sum % 11);
  if (secondDigit >= 10) secondDigit = 0;

  return Number(cpf[10]) === secondDigit;
};

export const maskCpf = (value: string) => {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) return formatCpf(cpf);

  return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
};