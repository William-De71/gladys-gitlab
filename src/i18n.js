// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, widget contents, scene summaries,
// messages of the Configuration screen. Vocabulary of the Gladys interface:
// appareil / Gerät / dispositivo, scène / Szene / escena.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  repositoryDeviceName: {
    en: 'GitLab {repository}',
    fr: 'GitLab {repository}',
    de: 'GitLab {repository}',
    es: 'GitLab {repository}',
  },
  accountDeviceName: {
    en: 'GitLab @{login}',
    fr: 'GitLab @{login}',
    de: 'GitLab @{login}',
    es: 'GitLab @{login}',
  },
  featureStars: {
    en: 'Stars',
    fr: 'Étoiles',
    de: 'Sterne',
    es: 'Estrellas',
  },
  featureForks: {
    en: 'Forks',
    fr: 'Forks',
    de: 'Forks',
    es: 'Forks',
  },
  featureOpenIssues: {
    en: 'Open issues',
    fr: 'Issues ouvertes',
    de: 'Offene Issues',
    es: 'Issues abiertas',
  },
  featureOpenMergeRequests: {
    en: 'Open merge requests',
    fr: 'Merge requests ouvertes',
    de: 'Offene Merge-Requests',
    es: 'Merge requests abiertas',
  },
  featureMergedMergeRequests: {
    en: 'Merged merge requests',
    fr: 'Merge requests fusionnées',
    de: 'Gemergte Merge-Requests',
    es: 'Merge requests fusionadas',
  },
  featureLatestRelease: {
    en: 'Latest release',
    fr: 'Dernière version',
    de: 'Neuestes Release',
    es: 'Última versión',
  },
  featureLatestTag: {
    en: 'Latest tag',
    fr: 'Dernier tag',
    de: 'Neuester Tag',
    es: 'Última etiqueta',
  },
  featureLatestCommit: {
    en: 'Latest commit',
    fr: 'Dernier commit',
    de: 'Neuester Commit',
    es: 'Último commit',
  },
  featureLatestIssue: {
    en: 'Latest issue',
    fr: 'Dernière issue',
    de: 'Neuestes Issue',
    es: 'Última issue',
  },
  featureLatestMergeRequest: {
    en: 'Latest merge request',
    fr: 'Dernière merge request',
    de: 'Neuester Merge-Request',
    es: 'Última merge request',
  },
  featurePipeline: {
    en: 'Pipeline of the default branch',
    fr: 'Pipeline de la branche par défaut',
    de: 'Pipeline des Standard-Branches',
    es: 'Pipeline de la rama por defecto',
  },
  featureFollowers: {
    en: 'Followers',
    fr: 'Abonnés',
    de: 'Follower',
    es: 'Seguidores',
  },
  featureFollowing: {
    en: 'Following',
    fr: 'Abonnements',
    de: 'Folgt',
    es: 'Siguiendo',
  },
  featureProjects: {
    en: 'Projects',
    fr: 'Projets',
    de: 'Projekte',
    es: 'Proyectos',
  },
  pipeline_success: {
    en: 'Passed',
    fr: 'Réussi',
    de: 'Erfolgreich',
    es: 'Correcto',
  },
  pipeline_failed: {
    en: 'Failed',
    fr: 'Échoué',
    de: 'Fehlgeschlagen',
    es: 'Fallido',
  },
  pipeline_canceled: {
    en: 'Canceled',
    fr: 'Annulé',
    de: 'Abgebrochen',
    es: 'Cancelado',
  },
  pipeline_running: {
    en: 'Running',
    fr: 'En cours',
    de: 'Läuft',
    es: 'En curso',
  },
  summaryRelease: {
    en: '{repository}: release {release} is out.',
    fr: '{repository} : la version {release} est publiée.',
    de: '{repository}: Release {release} ist erschienen.',
    es: '{repository}: se ha publicado la versión {release}.',
  },
  summaryIssue: {
    en: '{repository}: new issue #{number} "{title}" by {author}.',
    fr: '{repository} : nouvelle issue #{number} « {title} » de {author}.',
    de: '{repository}: neues Issue #{number} „{title}“ von {author}.',
    es: '{repository}: nueva issue #{number} «{title}» de {author}.',
  },
  summaryMergeRequest: {
    en: '{repository}: new merge request !{number} "{title}" by {author}.',
    fr: '{repository} : nouvelle merge request !{number} « {title} » par {author}.',
    de: '{repository}: neuer Merge-Request !{number} „{title}“ von {author}.',
    es: '{repository}: nueva merge request !{number} «{title}» de {author}.',
  },
  summaryCommit: {
    en: '{repository} ({branch}): "{message}" by {author}.',
    fr: '{repository} ({branch}) : « {message} » de {author}.',
    de: '{repository} ({branch}): „{message}“ von {author}.',
    es: '{repository} ({branch}): «{message}» de {author}.',
  },
  summaryStar: {
    en: '{repository} got a new star: {stars} in total.',
    fr: '{repository} a reçu une nouvelle étoile : {stars} au total.',
    de: '{repository} hat einen neuen Stern: {stars} insgesamt.',
    es: '{repository} ha recibido una nueva estrella: {stars} en total.',
  },
  summaryPipeline_success: {
    en: '{repository} ({branch}): pipeline passed for "{message}".',
    fr: '{repository} ({branch}) : pipeline réussi pour « {message} ».',
    de: '{repository} ({branch}): Pipeline erfolgreich für „{message}“.',
    es: '{repository} ({branch}): pipeline correcto para «{message}».',
  },
  summaryPipeline_failed: {
    en: '{repository} ({branch}): pipeline failed for "{message}".',
    fr: '{repository} ({branch}) : pipeline échoué pour « {message} ».',
    de: '{repository} ({branch}): Pipeline fehlgeschlagen für „{message}“.',
    es: '{repository} ({branch}): pipeline fallido para «{message}».',
  },
  summaryPipeline_canceled: {
    en: '{repository} ({branch}): pipeline canceled for "{message}".',
    fr: '{repository} ({branch}) : pipeline annulé pour « {message} ».',
    de: '{repository} ({branch}): Pipeline abgebrochen für „{message}“.',
    es: '{repository} ({branch}): pipeline cancelado para «{message}».',
  },
  summaryRepository: {
    en: '{repository}: {stars} stars, {issues} open issues, {merges} open merge requests, latest release {release}.',
    fr: '{repository} : {stars} étoiles, {issues} issues ouvertes, {merges} merge requests ouvertes, dernière version {release}.',
    de: '{repository}: {stars} Sterne, {issues} offene Issues, {merges} offene Merge-Requests, neuestes Release {release}.',
    es: '{repository}: {stars} estrellas, {issues} issues abiertas, {merges} merge requests abiertas, última versión {release}.',
  },
  none: {
    en: 'none',
    fr: 'aucune',
    de: 'keines',
    es: 'ninguna',
  },
  stars: {
    en: 'Stars',
    fr: 'Étoiles',
    de: 'Sterne',
    es: 'Estrellas',
  },
  forks: {
    en: 'Forks',
    fr: 'Forks',
    de: 'Forks',
    es: 'Forks',
  },
  issues: {
    en: 'Issues',
    fr: 'Issues',
    de: 'Issues',
    es: 'Issues',
  },
  mergeRequests: {
    en: 'Merge requests',
    fr: 'Merge requests',
    de: 'Merge-Requests',
    es: 'Merge requests',
  },
  latestRelease: {
    en: 'Latest release',
    fr: 'Dernière version',
    de: 'Neuestes Release',
    es: 'Última versión',
  },
  pipelineOf: {
    en: 'Pipeline ({branch})',
    fr: 'Pipeline ({branch})',
    de: 'Pipeline ({branch})',
    es: 'Pipeline ({branch})',
  },
  lastCommit: {
    en: 'Last commit',
    fr: 'Dernier commit',
    de: 'Letzter Commit',
    es: 'Último commit',
  },
  state: {
    en: 'State',
    fr: 'État',
    de: 'Status',
    es: 'Estado',
  },
  archived: {
    en: 'Archived',
    fr: 'Archivé',
    de: 'Archiviert',
    es: 'Archivado',
  },
  openGitlab: {
    en: 'Open on GitLab',
    fr: 'Ouvrir sur GitLab',
    de: 'Auf GitLab öffnen',
    es: 'Abrir en GitLab',
  },
  activityOf: {
    en: 'Activity of {repository}',
    fr: 'Activité de {repository}',
    de: 'Aktivität von {repository}',
    es: 'Actividad de {repository}',
  },
  activityAll: {
    en: 'Activity of {count} projects',
    fr: 'Activité de {count} projets',
    de: 'Aktivität von {count} Projekten',
    es: 'Actividad de {count} proyectos',
  },
  noActivity: {
    en: 'Nothing to show yet.',
    fr: 'Rien à afficher pour l’instant.',
    de: 'Noch nichts anzuzeigen.',
    es: 'Nada que mostrar por ahora.',
  },
  badgeRelease: {
    en: 'Release',
    fr: 'Version',
    de: 'Release',
    es: 'Versión',
  },
  badgeIssue: {
    en: 'Issue',
    fr: 'Issue',
    de: 'Issue',
    es: 'Issue',
  },
  badgeMergeRequest: {
    en: 'Merge request',
    fr: 'Merge request',
    de: 'Merge-Request',
    es: 'Merge request',
  },
  badgeDraft: {
    en: 'Draft',
    fr: 'Brouillon',
    de: 'Entwurf',
    es: 'Borrador',
  },
  badgeCommit: {
    en: 'Commit',
    fr: 'Commit',
    de: 'Commit',
    es: 'Commit',
  },
  byAuthor: {
    en: '{repository} · by {author}',
    fr: '{repository} · par {author}',
    de: '{repository} · von {author}',
    es: '{repository} · de {author}',
  },
  followers: {
    en: 'Followers',
    fr: 'Abonnés',
    de: 'Follower',
    es: 'Seguidores',
  },
  following: {
    en: 'Following',
    fr: 'Abonnements',
    de: 'Folgt',
    es: 'Siguiendo',
  },
  projects: {
    en: 'Projects',
    fr: 'Projets',
    de: 'Projekte',
    es: 'Proyectos',
  },
  apiQuota: {
    en: 'API quota left',
    fr: 'Quota d’API restant',
    de: 'Verbleibendes API-Limit',
    es: 'Cuota de API restante',
  },
  followedRepositories: {
    en: 'Followed projects',
    fr: 'Projets suivis',
    de: 'Verfolgte Projekte',
    es: 'Proyectos seguidos',
  },
  quotaReset: {
    en: 'Quota reset',
    fr: 'Renouvellement du quota',
    de: 'Limit-Erneuerung',
    es: 'Renovación de la cuota',
  },
  inMinutes: {
    en: 'in {n} min',
    fr: 'dans {n} min',
    de: 'in {n} Min.',
    es: 'en {n} min',
  },
  openProfile: {
    en: 'Open the profile',
    fr: 'Voir le profil',
    de: 'Profil öffnen',
    es: 'Abrir el perfil',
  },
  ago_now: {
    en: 'just now',
    fr: 'à l’instant',
    de: 'gerade eben',
    es: 'ahora mismo',
  },
  ago_minutes: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  ago_hours: {
    en: '{n} h ago',
    fr: 'il y a {n} h',
    de: 'vor {n} Std.',
    es: 'hace {n} h',
  },
  ago_days: {
    en: '{n} d ago',
    fr: 'il y a {n} j',
    de: 'vor {n} T.',
    es: 'hace {n} d',
  },
  noToken: {
    en: 'Add a GitLab access token in the integration settings.',
    fr: 'Ajoutez un jeton d’accès GitLab dans les réglages de l’intégration.',
    de: 'Füge in den Einstellungen der Integration ein GitLab-Zugriffstoken hinzu.',
    es: 'Añada un token de acceso de GitLab en los ajustes de la integración.',
  },
  noRepository: {
    en: 'Follow a project in the integration settings.',
    fr: 'Suivez un projet dans les réglages de l’intégration.',
    de: 'Verfolge ein Projekt in den Einstellungen der Integration.',
    es: 'Siga un proyecto en los ajustes de la integración.',
  },
  notReadYet: {
    en: 'GitLab has not been read yet: come back in a minute.',
    fr: 'GitLab n’a pas encore été lu : revenez dans une minute.',
    de: 'GitLab wurde noch nicht gelesen: Schau in einer Minute wieder vorbei.',
    es: 'GitLab aún no se ha leído: vuelva dentro de un minuto.',
  },
  statusConnected: {
    en: 'Connected as @{login}, {count} projects followed.',
    fr: 'Connecté en tant que @{login}, {count} projets suivis.',
    de: 'Verbunden als @{login}, {count} Projekte verfolgt.',
    es: 'Conectado como @{login}, {count} proyectos seguidos.',
  },
  statusMissing: {
    en: 'Connected as @{login}. Not found or not visible to the token: {missing}.',
    fr: 'Connecté en tant que @{login}. Introuvables ou invisibles pour le jeton : {missing}.',
    de: 'Verbunden als @{login}. Nicht gefunden oder für das Token nicht sichtbar: {missing}.',
    es: 'Conectado como @{login}. No encontrados o no visibles para el token: {missing}.',
  },
  statusInvalidToken: {
    en: 'GitLab refused the token: check it, or create a new one.',
    fr: 'GitLab a refusé le jeton : vérifiez-le, ou créez-en un nouveau.',
    de: 'GitLab hat das Token abgelehnt: Prüfe es oder erstelle ein neues.',
    es: 'GitLab rechazó el token: compruébelo o cree uno nuevo.',
  },
  statusForbidden: {
    en: 'GitLab denied access with this token: it needs the read_api scope.',
    fr: 'GitLab a refusé l’accès avec ce jeton : il lui faut la portée read_api.',
    de: 'GitLab hat den Zugriff mit diesem Token verweigert: Es braucht den Bereich read_api.',
    es: 'GitLab denegó el acceso con este token: necesita el alcance read_api.',
  },
  statusRateLimited: {
    en: 'GitLab asks to slow down: reading resumes when the quota renews.',
    fr: 'GitLab demande de ralentir : la lecture reprend au renouvellement du quota.',
    de: 'GitLab bittet, langsamer zu werden: Das Lesen geht weiter, sobald das Kontingent erneuert ist.',
    es: 'GitLab pide ir más despacio: la lectura se reanuda cuando se renueve la cuota.',
  },
  statusUnreachable: {
    en: 'GitLab cannot be reached at this address for now: check the address of the instance; new attempt at the next round.',
    fr: 'GitLab est injoignable à cette adresse pour l’instant : vérifiez l’adresse de l’instance ; nouvel essai au prochain tour.',
    de: 'GitLab ist unter dieser Adresse gerade nicht erreichbar: Prüfe die Adresse der Instanz; neuer Versuch in der nächsten Runde.',
    es: 'No se puede contactar con GitLab en esta dirección por ahora: compruebe la dirección de la instancia; nuevo intento en la próxima ronda.',
  },
  testOk: {
    en: 'Token accepted for @{login} ({remaining}/{limit} requests left this minute).',
    fr: 'Jeton accepté pour @{login} ({remaining}/{limit} requêtes restantes cette minute).',
    de: 'Token für @{login} akzeptiert ({remaining}/{limit} Anfragen in dieser Minute übrig).',
    es: 'Token aceptado para @{login} ({remaining}/{limit} peticiones restantes este minuto).',
  },
  testRepositories: {
    en: 'Projects read: {ok}/{total}.',
    fr: 'Projets lus : {ok}/{total}.',
    de: 'Gelesene Projekte: {ok}/{total}.',
    es: 'Proyectos leídos: {ok}/{total}.',
  },
  testCapped: {
    en: '{matched} projects match, {max} are followed: those named in full, then the most recently active.',
    fr: '{matched} projets correspondent, {max} sont suivis : ceux nommés en entier, puis les plus récemment actifs.',
    de: '{matched} Projekte passen, {max} werden verfolgt: die vollständig genannten, dann die zuletzt aktiven.',
    es: '{matched} proyectos coinciden, se siguen {max}: los nombrados por completo y después los más recientemente activos.',
  },
  testMissing: {
    en: 'Not found or not visible: {missing}.',
    fr: 'Introuvables ou invisibles : {missing}.',
    de: 'Nicht gefunden oder nicht sichtbar: {missing}.',
    es: 'No encontrados o no visibles: {missing}.',
  },
};

/**
 * @description Whether a value is one of the supported languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de or es.
 * @example
 * isLanguage('fr'); // -> true
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryStar', 'fr', { repository: 'octo/hello', stars: 12 });
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusConnected', { login: 'octocat', count: 2 });
 */
function all(key, values = {}) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, t(key, language, values)]));
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 * @example
 * ago(Date.now() - 600000, Date.now(), 'en'); // -> '10 min ago'
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago };
