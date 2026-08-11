export const STRINGS = {
  en: {
    tagline: 'The hold-it-up guessing game',
    play: 'Play',
    players: 'Players',
    scoreboard: 'Scoreboard',
    howto: 'How to play',
    addPlayer: 'Add',
    playerPlaceholder: 'Player name',
    continue: 'Continue',
    back: 'Back',
    categories: 'Categories',
    difficulty: 'Difficulty',
    dMixed: 'Mixed',
    dEasy: 'Easy',
    dMedium: 'Medium',
    dHard: 'Hard',
    roundLength: 'Round length',
    start: 'Start',
    passTo: 'Pass the phone to',
    holdUp: 'Hold the phone on your forehead, screen facing out',
    correct: 'CORRECT',
    pass: 'PASS',
    recap: 'Round recap',
    tapToFix: 'Tap a word to change it',
    points: 'points',
    confirm: 'Confirm',
    nextPlayer: 'Next player',
    newGame: 'New game',
    resetConfirm: 'Reset all scores?',
    tapHint: 'No motion sensor — tap the right side for CORRECT, the left side for PASS',
    needCategory: 'Pick at least one category',
    needPlayer: 'Add at least one player',
    howtoText: 'One player holds the phone on their forehead, screen facing the group.\nEveryone else shouts clues for the word on screen.\nGot it? The player tilts the phone DOWN (screen to the floor).\nToo hard? Tilt UP to pass.\nWhen the timer ends, review the round, fix any miscalls, and pass the phone on.\nHighest total wins!',
  },
  es: {
    tagline: 'El juego de adivinar con el teléfono en la frente',
    play: 'Jugar',
    players: 'Jugadores',
    scoreboard: 'Marcador',
    howto: 'Cómo jugar',
    addPlayer: 'Agregar',
    playerPlaceholder: 'Nombre',
    continue: 'Continuar',
    back: 'Volver',
    categories: 'Categorías',
    difficulty: 'Dificultad',
    dMixed: 'Mixta',
    dEasy: 'Fácil',
    dMedium: 'Media',
    dHard: 'Difícil',
    roundLength: 'Duración de la ronda',
    start: 'Empezar',
    passTo: 'Pásale el teléfono a',
    holdUp: 'Pon el teléfono en tu frente con la pantalla hacia afuera',
    correct: '¡BIEN!',
    pass: 'PASO',
    recap: 'Resumen de la ronda',
    tapToFix: 'Toca una palabra para corregirla',
    points: 'puntos',
    confirm: 'Confirmar',
    nextPlayer: 'Siguiente jugador',
    newGame: 'Nuevo juego',
    resetConfirm: '¿Borrar todos los puntajes?',
    tapHint: 'Sin sensor de movimiento: toca el lado derecho para ¡BIEN! y el izquierdo para PASO',
    needCategory: 'Elige al menos una categoría',
    needPlayer: 'Agrega al menos un jugador',
    howtoText: 'Un jugador sostiene el teléfono en su frente, con la pantalla hacia el grupo.\nLos demás gritan pistas sobre la palabra en pantalla.\n¿La adivinó? Inclina el teléfono hacia ABAJO (pantalla al piso).\n¿Muy difícil? Inclínalo hacia ARRIBA para pasar.\nCuando termina el tiempo, revisa la ronda, corrige errores y pasa el teléfono.\n¡Gana quien sume más puntos!',
  },
};

let lang = 'en';

export function initLang(saved) {
  if (saved && STRINGS[saved]) lang = saved;
  else lang = (navigator.language || '').startsWith('es') ? 'es' : 'en';
}
export function setLang(l) { if (STRINGS[l]) lang = l; }
export function getLang() { return lang; }

export function t(key, vars = {}) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', v);
  return s;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
