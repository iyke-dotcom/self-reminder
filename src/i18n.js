const CATALOG = {
  en: {
    appName: "Self Reminder",
    reminderAdded: "Reminder added",
    reminderUpdated: "Reminder updated",
    reminderDeleted: "Reminder deleted",
    reminderDue: "Reminder: {title}",
    emptyState:
      "Nothing here yet. Add a reminder above, or adjust your filters.",
    notifBlocked: "Notifications blocked in browser settings",
    backupDownloaded: "Backup downloaded",
    backupImported: "Imported {count} reminders",
    snoozed: "Reminder snoozed for 5 minutes",
    migrated: "Legacy data migrated to the new storage engine",
    nlDateMissing:
      'Could not understand that date. Try "tomorrow 9am" or "in 2 hours".',
    theme: "Theme",
    syncing: "Syncing…",
    synced: "Synced {count} reminders",
    syncFailed: "Sync failed: {reason}",
    loggedInAs: "Logged in as {username}",
    notLoggedIn: "Not logged in",
  },
  fr: {
    appName: "Self Reminder",
    reminderAdded: "Rappel ajouté",
    reminderUpdated: "Rappel mis à jour",
    reminderDeleted: "Rappel supprimé",
    reminderDue: "Rappel : {title}",
    emptyState:
      "Rien ici pour l'instant. Ajoutez un rappel ci-dessus ou ajustez vos filtres.",
    notifBlocked: "Notifications bloquées dans les réglages du navigateur",
    backupDownloaded: "Sauvegarde téléchargée",
    backupImported: "{count} rappels importés",
    snoozed: "Rappel différé de 5 minutes",
    migrated: "Données anciennes migrées vers le nouveau moteur de stockage",
    nlDateMissing: 'Date incomprise. Essayez "demain 9h" ou "dans 2 heures".',
    theme: "Thème",
    syncing: "Synchronisation…",
    synced: "{count} rappels synchronisés",
    syncFailed: "Échec de synchronisation : {reason}",
    loggedInAs: "Connecté en tant que {username}",
    notLoggedIn: "Non connecté",
  },
};

export function createI18n(locale = "en", messages) {
  const catalog = messages || CATALOG[locale] || CATALOG.en;
  function t(key, params = {}) {
    const template = catalog[key] ?? CATALOG.en[key] ?? key;
    return template.replace(
      /\{(\w+)\}/g,
      (_, name) => params[name] ?? `{${name}}`,
    );
  }
  return {
    locale,
    t,
  };
}

export function supportedLocales() {
  return Object.keys(CATALOG);
}
