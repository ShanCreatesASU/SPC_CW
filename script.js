const PAIRS_PER_RESOURCE = 2;
const RESOURCE_TYPES = [
  { id: 'drops', label: 'Water drops', image: 'img/CW water.png' },
  { id: 'buckets', label: 'Buckets', image: 'img/CW bucket.png' },
  { id: 'cans', label: 'Jerry Cans', image: 'img/water-can-transparent.png' }
];
const CRISIS = [
  {
    id: 'storm',
    name: 'Storm',
    image: 'img/CW storm.png',
    effect: inventory => removeResources(inventory, ['drops'])
  },
  {
    id: 'flood',
    name: 'Flood',
    image: 'img/CW flood.png',
    effect: inventory => removeResources(inventory, ['drops', 'buckets'])
  },
  {
    id: 'drought',
    name: 'Drought',
    image: 'img/CW drought.png',
    effect: inventory => removeResources(inventory, ['buckets', 'cans'])
  }
];

const gameGrid = document.querySelector('.game-grid');
const crisisPanel = document.getElementById('crisis-panel');
const crisisTitle = document.getElementById('crisis-title');
const crisisMessage = document.getElementById('crisis-message');
const crisisActions = document.querySelector('.crisis-actions');
const gameStatus = document.getElementById('game-status');
const levelCelebration = document.getElementById('level-celebration');
const celebrationRain = levelCelebration.querySelector('.celebration-rain');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const introScreen = document.getElementById('intro-screen');
const gameScreen = document.getElementById('game-screen');
const brandLink = document.querySelector('.brand');
const waterDetail = document.getElementById('water-detail');
const waterSegments = document.querySelectorAll('.water-segment');

let level = 1;
let gameActive = false;
let gamePhase = 'idle';
let cards = [];
let selectedCards = [];
let mismatchTimer;
let celebrationTimer;
let bankedInventory = createInventory();
let levelInventory = createInventory();
let goldenCans = 0;
let goldenCanCollectedThisLevel = false;

function createInventory() {
  return { cans:0, drops: 0, buckets: 0 };
}

function removeResources(inventory, resourceIds) {
  return resourceIds.reduce((removed, id) => {
    removed[id] = inventory[id];
    inventory[id] = 0;
    return removed;
  }, {});
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[otherIndex]] = [items[otherIndex], items[index]];
  }
  return items;
}

function createLevel() {
  cards = [];
  selectedCards = [];
  document.getElementById('level-kicker').textContent = level === 1
    ? 'LEVEL 1 · FIND THE FIRST DROPS'
    : `LEVEL ${level} · KEEP BUILDING YOUR SUPPLY`;

  RESOURCE_TYPES.forEach(resource => {
    for (let pair = 0; pair < PAIRS_PER_RESOURCE; pair += 1) {
      cards.push(
        { id: `${level}-${resource.id}-${pair}-a`, type: 'resource', resourceId: resource.id, matched: false, faceUp: false },
        { id: `${level}-${resource.id}-${pair}-b`, type: 'resource', resourceId: resource.id, matched: false, faceUp: false }
      );
    }
  });

  CRISIS.forEach(crisis => {
    cards.push({
      id: `${level}-crisis-${crisis.id}`,
      type: 'crisis',
      crisisId: crisis.id,
      matched: false,
      faceUp: false,
      consumed: false
    });
  });

  cards.push({
    id: `${level}-golden-can`,
    type: 'bonus',
    collected: goldenCanCollectedThisLevel,
    faceUp: false
  });

  shuffle(cards);
  renderBoard();
  updateStats();
}

function renderBoard() {
  gameGrid.replaceChildren();
  gameGrid.classList.toggle('is-locked', !gameActive || !['normal', 'challenge'].includes(gamePhase));

  cards.forEach(card => {
    const button = document.createElement('button');
    const revealed = card.faceUp || card.matched || card.consumed || card.collected;
    button.type = 'button';
    button.className = 'grid-cell';
    button.dataset.cardId = card.id;
    button.disabled = !canSelect(card);
    button.setAttribute('aria-pressed', String(revealed));

    if (card.type === 'bonus') {
      button.classList.add('is-golden-can');
      button.setAttribute('aria-label', revealed ? 'Golden Jerry Can bonus' : 'Face-down bonus card');
      if (revealed) {
        button.classList.add('is-revealed', 'is-collected');
        button.innerHTML = '<img src="img/water-can.png" alt=""><span>Golden Jerry Can</span>';
      } else {
        button.classList.add('is-face-down');
        button.textContent = '★';
      }
    } else if (card.type === 'resource') {
      const resource = RESOURCE_TYPES.find(item => item.id === card.resourceId);
      button.setAttribute('aria-label', revealed ? resource.label : 'Face-down card');
      if (revealed) {
        button.classList.add('is-revealed');
        if (card.matched) button.classList.add('is-matched');
        button.innerHTML = `<img src="${resource.image}" alt=""><span>${resource.label}</span>`;
      } else {
        button.classList.add('is-face-down');
        button.textContent = '?';
      }
    } else {
      const crisis = CRISIS.find(item => item.id === card.crisisId);
      button.setAttribute('aria-label', revealed ? `${crisis.name} crisis` : 'Face-down crisis card');
      if (revealed) {
        button.classList.add('is-crisis', 'is-revealed');
        if (card.consumed) button.classList.add('is-consumed');
        button.innerHTML = `<img src="${crisis.image}" alt=""><span>${crisis.name}</span>`;
      } else {
        button.classList.add('is-face-down');
        button.textContent = '?';
      }
    }

    button.addEventListener('click', () => selectCard(card.id));
    gameGrid.appendChild(button);
  });
}

function canSelect(card) {
  if (!gameActive || card.matched || card.consumed || card.collected || card.faceUp) return false;
  if (gamePhase === 'normal') return true;
  return gamePhase === 'challenge' && card.type === 'resource';
}

function selectCard(cardId) {
  const card = cards.find(item => item.id === cardId);
  if (!card || !canSelect(card)) return;

  card.faceUp = true;

  if (card.type === 'crisis') {
    triggerCrisis(card);
    return;
  }

  if (card.type === 'bonus') {
    card.collected = true;
    goldenCanCollectedThisLevel = true;
    card.faceUp = false;
    goldenCans += 1;
    gameStatus.textContent = 'Golden Jerry Can collected! It is protected from crises.';
    renderBoard();
    updateStats();
    return;
  }

  selectedCards.push(card);
  renderBoard();
  if (selectedCards.length !== 2) return;

  if (gamePhase === 'challenge') {
    resolveChallenge();
  } else {
    resolveRegularTurn();
  }
}

function resolveRegularTurn() {
  gamePhase = 'comparing';
  const [first, second] = selectedCards;
  if (resourcesMatch(first, second)) {
    gamePhase = 'match-resolving';
    awardPair(first, second);
    shuffleUnmatchedCards();
    selectedCards = [];
    gamePhase = 'normal';
    renderBoard();
    updateStats();
    checkLevelComplete();
    return;
  }

  gamePhase = 'mismatch';
  renderBoard();
  mismatchTimer = window.setTimeout(() => {
    selectedCards.forEach(card => {
      card.faceUp = false;
    });
    selectedCards = [];
    gamePhase = 'normal';
    renderBoard();
  }, 1000);
}

function resourcesMatch(first, second) {
  if (first.type !== 'resource' || second.type !== 'resource') return false;

  const firstResource = RESOURCE_TYPES.find(item => item.id === first.resourceId);
  const secondResource = RESOURCE_TYPES.find(item => item.id === second.resourceId);

  return Boolean(firstResource && secondResource
    && firstResource.image === secondResource.image
    && firstResource.label === secondResource.label);
}

function awardPair(first, second) {
  if (!resourcesMatch(first, second) || first.matched || second.matched) return false;
  first.matched = true;
  second.matched = true;
  levelInventory[first.resourceId] += 1;
  return true;
}

function triggerCrisis(card) {
  const crisis = CRISIS.find(item => item.id === card.crisisId);
  card.consumed = true;

  selectedCards.forEach(selected => {
    selected.faceUp = false;
  });
  selectedCards = [];

  const lost = crisis.effect(levelInventory);
  updateStats();
  gamePhase = 'crisis-decision';
  crisisTitle.textContent = `${crisis.name} crisis`;
  crisisMessage.textContent = describeCrisisEffect(crisis, lost);
  crisisActions.hidden = false;
  document.getElementById('try-again').hidden = false;
  document.getElementById('reset-level').hidden = false;
  crisisPanel.hidden = false;
  gameStatus.textContent = '';
  renderBoard();
  document.getElementById('try-again').focus();
}

function describeCrisisEffect(crisis, lost) {
  const labels = {
    cans: 'jerry cans',
    drops: 'water drops',
    buckets: 'buckets'
  };
  const losses = Object.entries(lost)
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => `${amount} ${labels[id]}`);
  const consequence = losses.length
    ? `You lost ${losses.join(' and ')}.`
    : 'You had no resources in the affected categories to lose.';
  const explanations = {
    storm: 'There is a storm brewing. Match two cards or lose all collected water drops.',
    flood: 'A flashflood is headng your way. Match the next two cards or watch all collected water drops and buckets float away.',
    drought: 'An intense drought is drying all water resources. Match the next two cards to keep all your collected buckets and jerry cans.'
  };
  return `${explanations[crisis.id]} ${consequence} Choose Accept Challenge for one matching attempt, or restart your progress and choose Reset Level.`;
}

function beginChallenge() {
  if (gamePhase !== 'crisis-decision') return;
  gamePhase = 'challenge';
  crisisTitle.textContent = 'One matching attempt';
  crisisMessage.textContent = 'Choose exactly two face-down resource cards. A match earns its resource; a mismatch loses the resources from your largest current-level category.';
  crisisActions.hidden = true;
  renderBoard();
}

function resolveChallenge() {
  gamePhase = 'challenge-resolving';
  const [first, second] = selectedCards;
  let result;

  if (resourcesMatch(first, second)) {
    awardPair(first, second);
    result = `Challenge successful: you earned 1 ${resourceLabel(first.resourceId)}.`;
  } else {
    first.faceUp = false;
    second.faceUp = false;
    result = applyChallengePenalty();
  }

  selectedCards = [];
  shuffleUnmatchedCards();
  hideCrisisPanel();
  gamePhase = 'normal';
  gameStatus.textContent = result;
  renderBoard();
  updateStats();
  checkLevelComplete();
}

function applyChallengePenalty() {
  const order = ['drops', 'buckets','cans'];
  const highest = Math.max(...order.map(id => levelInventory[id]));
  if (highest === 0) return 'Challenge failed. You had no current-level resources to lose.';

  const tiedCategories = order.filter(id => levelInventory[id] === highest);
  const lostId = tiedCategories[0];
  const lost = levelInventory[lostId];
  levelInventory[lostId] = 0;
  const tieNote = tiedCategories.length > 1
    ? ' Jerry cans take priority in a tie, followed by water drops, then buckets.'
    : '';
  return `Challenge failed. You lost ${lost} ${resourceLabel(lostId)} because that was your largest current-level resource category.${tieNote}`;
}

function resourceLabel(resourceId) {
  const resource = RESOURCE_TYPES.find(item => item.id === resourceId);
  return resource.label.toLowerCase();
}

function resetLevel() {
  if (gamePhase !== 'crisis-decision') return;
  clearTimeout(mismatchTimer);
  levelInventory = createInventory();
  gamePhase = 'normal';
  hideCrisisPanel();
  gameStatus.textContent = `Level ${level} reset. You weathered the storms. Your resources are safe.`;
  createLevel();
}

function hideCrisisPanel() {
  crisisPanel.hidden = true;
  crisisActions.hidden = false;
  document.getElementById('try-again').hidden = false;
  document.getElementById('reset-level').hidden = false;
}

function shuffleUnmatchedCards() {
  const positions = [];
  const movable = [];
  cards.forEach((card, index) => {
    if (!card.matched && !card.consumed) {
      positions.push(index);
      movable.push(card);
    }
  });
  shuffle(movable);
  positions.forEach((position, index) => {
    cards[position] = movable[index];
  });
}

function checkLevelComplete() {
  const allPairsMatched = cards
    .filter(card => card.type === 'resource')
    .every(card => card.matched);
  if (!allPairsMatched) return;

  const completedLevel = level;
  RESOURCE_TYPES.forEach(resource => {
    bankedInventory[resource.id] += levelInventory[resource.id];
  });
  levelInventory = createInventory();
  goldenCanCollectedThisLevel = false;
  level += 1;
  gameStatus.textContent = `You did it! Level ${completedLevel} complete. Welcome to Level ${level}. Resources earned in earlier levels are saved.`;
  showLevelCelebration();
  createLevel();
}

function showLevelCelebration() {
  clearTimeout(celebrationTimer);
  celebrationRain.replaceChildren();

  for (let index = 0; index < 28; index += 1) {
    const drop = document.createElement('span');
    drop.className = 'celebration-raindrop';
    drop.textContent = '💧';
    drop.style.setProperty('--drop-left', `${Math.random() * 100}%`);
    drop.style.setProperty('--drop-delay', `${Math.random() * 0.8}s`);
    drop.style.setProperty('--drop-duration', `${1.4 + Math.random() * 1.2}s`);
    celebrationRain.appendChild(drop);
  }

  levelCelebration.hidden = false;
  celebrationTimer = window.setTimeout(() => {
    levelCelebration.hidden = true;
  }, 3000);
}

function updateStats() {
  document.getElementById('current-level').textContent = String(level);
  document.getElementById('golden-cans').textContent = String(goldenCans);
  RESOURCE_TYPES.forEach(resource => {
    const total = bankedInventory[resource.id] + levelInventory[resource.id];
    document.getElementById(`current-${resource.id}`).textContent = String(total);
    document.getElementById(`level-${resource.id}`).textContent = String(levelInventory[resource.id]);
  });
}

function startGame() {
  if (!gameActive) {
    gameActive = true;
    gamePhase = 'normal';
    gameStatus.textContent = 'Match resource pairs. Watch out for crisis cards!';
    createLevel();
  }
  introScreen.hidden = true;
  gameScreen.hidden = false;
  restartButton.hidden = false;
  gameGrid.querySelector('button:not(:disabled)')?.focus();
}

function restartGame() {
  clearTimeout(mismatchTimer);
  clearTimeout(celebrationTimer);
  levelCelebration.hidden = true;
  gameActive = true;
  level = 1;
  bankedInventory = createInventory();
  levelInventory = createInventory();
  goldenCans = 0;
  goldenCanCollectedThisLevel = false;
  gamePhase = 'normal';
  hideCrisisPanel();
  gameStatus.textContent = 'New game started. Match resource pairs and watch out for crises!';
  introScreen.hidden = true;
  gameScreen.hidden = false;
  restartButton.hidden = false;
  createLevel();
}

function showIntro() {
  introScreen.hidden = false;
  gameScreen.hidden = true;
}

function updateWaterDetail(category) {
  const details = {
    needs: '<strong>Needs · Everyday essentials</strong><br>Drinking, cooking, and hygiene. The illustrative monthly baseline is 2,820 gallons.',
    routine: '<strong>Routine · 1,050 gallons per month</strong><br>Laundry and standard showers. The illustrative monthly baseline is 2,820 gallons.',
    waste: '<strong>Waste · Water lost unnecessarily</strong><br>Leaks and avoidable use. The illustrative monthly baseline is 2,820 gallons.'
  };
  waterDetail.innerHTML = details[category];
  waterSegments.forEach(segment => {
    const isSelected = segment.dataset.category === category;
    segment.classList.toggle('is-selected', isSelected);
    segment.setAttribute('aria-pressed', String(isSelected));
  });
}

document.getElementById('try-again').addEventListener('click', beginChallenge);
document.getElementById('reset-level').addEventListener('click', resetLevel);
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', restartGame);
brandLink.addEventListener('click', showIntro);
waterSegments.forEach(segment => {
  segment.addEventListener('click', () => updateWaterDetail(segment.dataset.category));
});
createLevel();
