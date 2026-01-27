export async function login(email: string, password: string): Promise<void> {
  // Petit stub d'authentification : accepte tout mot de passe >= 4 caractères
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (password.length >= 4 && email.includes('@')) {
        resolve();
      } else {
        reject(new Error('Email ou mot de passe invalide'));
      }
    }, 600);
  });
}
