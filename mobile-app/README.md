# mobile-app — README (rappel rapide)

## ⚠️ Problème fréquent : "Failed to fetch"

- Cause principale : le tunnel ADB `reverse` est perdu (déconnexion USB, redémarrage émulateur, kill-server, etc.).
- Solution rapide : exécute cette commande (PowerShell si `adb` n'est pas dans le PATH) :

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:3000 tcp:3000
```

ou simplement si `adb` est dans le PATH :

```bash
adb reverse tcp:3000 tcp:3000
```

Après cela, relance l'app sur l'émulateur/téléphone.

---

## Commandes utiles (développement)

- Build + sync Android :
```bash
npm run build
npx cap sync android
```

- Installer l'APK (debug) sur un appareil connecté :
```bash
cd android
.\gradlew.bat installDebug
```

---

## Astuce : script npm pour automatiser
Tu peux ajouter ce script dans `mobile-app/package.json` pour créer le reverse facilement :

```json
"scripts": {
  "adb-reverse": "powershell -NoProfile -Command \"& '$env:LOCALAPPDATA\\Android\\Sdk\\platform-tools\\adb.exe' reverse tcp:3000 tcp:3000\""
}
```

Et exécuter ensuite :
```bash
npm run adb-reverse
```

---

## Checklist rapide
- Si "Failed to fetch" → faire `adb reverse` → rebuild+sync si nécessaire
- Si `adb` n'est pas reconnu → utiliser le chemin complet ou ajouter `platform-tools` au PATH
- Si le téléphone n'apparaît pas dans `adb devices` → vérifier USB Debug, câble, drivers OEM

---

Conserve ce fichier comme rappel quand tu testes sur mobile. ✅
