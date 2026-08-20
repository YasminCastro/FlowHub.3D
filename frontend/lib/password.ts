export function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const label = ["Fraca", "Fraca", "Razoável", "Boa", "Forte"][score];
  return { score, label };
}
