'use strict';

const byId = id => document.getElementById(id);
const track = byId('sequence');
const studio = track.querySelector('.studio');
const visual = track.querySelector('.visual-column');
const header = document.querySelector('.masthead');
const range = byId('scene-range');
const output = byId('scene-progress');
const claimSelect = byId('claim-select');
const elements = byId('elements');
const drawing = byId('drawing-dialog');
const playButton = byId('play');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sectionToggle = byId('toggle-section');

const SCENE_NAMES = {
  base:'101 · 기판 / 소자분리층', active:'105 · 활성 영역', channel:'141–143 · 채널층',
  'gate-upper':'160A · 게이트 상부', 'gate-lower':'160B · 게이트 하부', drain:'150 · 소스/드레인',
  plug:'180 · 콘택 플러그', dielectric:'162a/b · 게이트 유전층', ild:'190 · 층간 절연층',
  spacer:'130 · 내부 스페이서층', 'contact-face':'140·150 · 채널 접촉면', 'base-face':'105·150 · 활성 영역 접촉면'
};

const CHAPTERS = [
  {at:0, from:0, title:'조립된 소자', text:'스크롤하거나 재생을 눌러 소자 내부를 살펴보세요.'},
  {at:.19, from:.10, title:'기판과 활성 영역', text:'기판 위에서 활성 영역이 X 방향으로 이어집니다.', part:'active'},
  {at:.44, from:.30, title:'수직으로 쌓인 채널층', text:'활성 영역 위의 세 채널층 사이로 간격이 드러납니다.', part:'channel'},
  {at:.61, from:.50, title:'채널을 감싸는 게이트', text:'게이트가 Y 방향으로 교차하며 각 채널층을 감쌉니다.', part:'gate'},
  {at:.80, from:.72, title:'소스와 드레인', text:'양쪽의 소스·드레인이 세 채널층과 맞닿는 위치입니다.', part:'drain'},
  {at:1, from:.94, title:'완전 분해', text:'청구항이나 모델에서 살펴볼 부품을 선택하세요.'}
];

let currentClaim = 0;
let currentElement = null;
let manualSelection = false;
let chapterIndex = -1;
let progress = 0;
let playFrame = 0;
let scrollFrame = 0;
let previousScroll = 0;
let section = false;

function loadScene() {
  const stage = byId('scene-stage');
  const options = {hero:true,nameFor:id=>SCENE_NAMES[id],onPick(id) {
    const list = CLAIMS[currentClaim].elements;
    const match = list.find(key=>PARTS[key].targets[0]===id) ?? list.find(key=>PARTS[key].targets.includes(id));
    if (match) selectElement(match,{manual:true});
  }};
  try {
    const model = new window.ClaimStack3D.ChipScene(stage,options);
    stage.dataset.renderer = 'webgl';
    return model;
  } catch (error) {
    console.warn('WebGL 3D renderer unavailable, using the canvas renderer.', error.message);
    const canvas = stage.querySelector('canvas');
    canvas.replaceWith(canvas.cloneNode());
    stage.dataset.renderer = 'canvas';
    return new ChipScene(stage,options);
  }
}
const model = loadScene();

function scrollPosition() {
  const start = track.getBoundingClientRect().top+scrollY-header.offsetHeight;
  const narrow = matchMedia('(max-width:740px)').matches;
  const length = Math.max(1,track.offsetHeight-(narrow ? visual : studio).offsetHeight);
  return {length,position:clamp((scrollY-start)/length,0,1)};
}

function updateScroll() {
  scrollFrame = 0;
  const {position} = scrollPosition();
  const delta = position-previousScroll;
  previousScroll = position;
  if (Math.abs(delta)<.0001) return;
  stopPlayback();
  const amount = position === 0 || position === 1 ? position : progress+delta;
  setProgress(amount,{story:true});
}

addEventListener('scroll',()=>{
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
},{passive:true});
addEventListener('resize',()=>{previousScroll = scrollPosition().position});

function setProgress(value,{story=false,chapterClick=false}={}) {
  progress = clamp(value,0,1);
  if (section && progress>.025) setSection(false);
  model.setAmount(progress);
  const percent = Math.round(progress*100);
  range.value = percent;
  range.style.setProperty('--value',`${percent}%`);
  output.value = `${percent}%`;
  const index = CHAPTERS.findLastIndex(chapter=>progress>=chapter.from);
  if (index !== chapterIndex) {
    chapterIndex = index;
    const chapter = CHAPTERS[index];
    for (const step of document.querySelectorAll('[data-chapter]')) {
      if (Number(step.dataset.chapter)===index) step.setAttribute('aria-current','step');
      else step.removeAttribute('aria-current');
    }
    if (story && currentClaim===0) selectElement(chapter.part ?? null,{manual:false});
  } else if (chapterClick && currentClaim===0) {
    selectElement(CHAPTERS[index].part ?? null,{manual:false});
  }
  updateStageText();
}

function updateStageText() {
  const index = Math.max(0,chapterIndex);
  const chapter = CHAPTERS[index];
  const picked = manualSelection && currentElement ? PARTS[currentElement] : null;
  const step = picked ? picked.code : `${String(index+1).padStart(2,'0')} / 06`;
  const description = picked?.detail ?? (section ? '도 2a의 I–I′ 방향으로 자른 조립 상태입니다.' : chapter.text);
  for (const [id,value] of [['chapter-step',step],['chapter-title',picked?.title ?? chapter.title],['chapter-text',description]]) {
    const element = byId(id);
    if (element.textContent!==value) element.textContent = value;
  }
}

function selectElement(key,{manual=false,move=false}={}) {
  const part = key ? PARTS[key] : null;
  currentElement = key;
  manualSelection = manual;
  model.setSelection(part?.targets ?? [],CLAIMS[currentClaim].mode ?? 'default');
  byId('part-readout').textContent = manual && part ? part.title : '구성요소를 눌러 위치 확인';
  updateStageText();
  for (const button of elements.querySelectorAll('button')) {
    button.setAttribute('aria-pressed',String(button.dataset.element===key));
  }
  if (part && move && !section) {
    stopPlayback();
    const measurement = ['levels','centerGap','widths'].includes(key);
    setProgress(measurement ? part.spread : Math.max(progress,part.spread));
  }
}

function setSection(enabled) {
  section = enabled;
  sectionToggle.setAttribute('aria-pressed',String(enabled));
  model.setSection(enabled);
  updateStageText();
}

sectionToggle.addEventListener('click',()=>{
  stopPlayback();
  const next = !section;
  if (next) {
    setProgress(0,{story:!manualSelection,chapterClick:!manualSelection});
    model.rotate('reset');
  }
  setSection(next);
});

function createElement(key) {
  const part = PARTS[key];
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'element';
  button.dataset.element = key;
  button.style.setProperty('--part-accent',window.ClaimStack3D.colorForPart(part.targets[0]));
  button.setAttribute('aria-pressed','false');
  const code = document.createElement('span');
  code.className = 'element-code';
  code.textContent = part.code;
  const content = document.createElement('span');
  const title = document.createElement('span');
  title.className = 'element-title';
  title.textContent = part.title;
  const description = document.createElement('span');
  description.className = 'element-text';
  description.textContent = part.detail;
  content.append(title,description);
  const indicator = document.createElement('span');
  indicator.className = 'element-indicator';
  indicator.setAttribute('aria-hidden','true');
  button.append(code,content,indicator);
  button.addEventListener('click',()=>{
    if (manualSelection && currentElement===key) selectElement(null,{manual:true});
    else selectElement(key,{manual:true,move:true});
  });
  return button;
}

function renderClaim(index,initial=false) {
  currentClaim = index;
  const claim = CLAIMS[index];
  const figure = DRAWINGS[claim.fig];
  byId('claim-type').textContent = claim.parent ? `종속항 · 제${claim.parent}항 인용` : '독립항';
  byId('claim-summary').textContent = claim.summary;
  byId('scene-figure').textContent = figure.label;
  byId('claim-note').textContent = claim.note ?? '';
  byId('claim-note').hidden = !claim.note;
  byId('related-label').textContent = `${figure.label} 원본`;
  byId('related-drawing').dataset.drawing = claim.fig;
  byId('full-claim').textContent = CLAIM_TEXT[index+1];
  elements.replaceChildren(...claim.elements.map(createElement));
  byId('claim-content').scrollTop = 0;
  const defaults = {8:'face111',9:'centerGap'};
  if (initial || index===0) selectElement(CHAPTERS[Math.max(0,chapterIndex)].part ?? null);
  else selectElement(defaults[index] ?? claim.elements[0],{manual:true,move:true});
}

function setPlayState(active) {
  playButton.setAttribute('aria-pressed',String(active));
  playButton.setAttribute('aria-label',active ? '분해 애니메이션 일시정지' : '분해 애니메이션 재생');
  byId('play-text').textContent = active ? '일시정지' : '재생';
}

function stopPlayback() {
  if (!playFrame) return;
  cancelAnimationFrame(playFrame);
  playFrame = 0;
  setPlayState(false);
}

playButton.addEventListener('click',()=>{
  if (playFrame) {
    stopPlayback();
    return;
  }
  if (progress>=.99) setProgress(0,{story:true});
  if (reducedMotion.matches) {
    setProgress(1,{story:true});
    return;
  }
  const origin = progress;
  const started = performance.now();
  setPlayState(true);
  const step = now=>{
    const elapsed = Math.max(0,(now-started)/6900);
    setProgress(origin+elapsed,{story:true});
    if (progress<1) playFrame = requestAnimationFrame(step);
    else {
      playFrame = 0;
      setPlayState(false);
    }
  };
  playFrame = requestAnimationFrame(step);
});

range.addEventListener('input',()=>{
  stopPlayback();
  setProgress(Number(range.value)/100,{story:true});
});
document.querySelectorAll('[data-chapter]').forEach(button=>{
  button.addEventListener('click',()=>{
    stopPlayback();
    setProgress(CHAPTERS[Number(button.dataset.chapter)].at,{story:true,chapterClick:true});
  });
});
document.querySelectorAll('a[href="#top"]').forEach(link=>link.addEventListener('click',()=>{
  stopPlayback();
  setProgress(0,{story:true});
}));
byId('claim-nav').addEventListener('click',event=>{
  if (matchMedia('(max-width:740px)').matches) return;
  event.preventDefault();
  byId('claims').focus({preventScroll:true});
  if (scrollPosition().position===1 && studio.getBoundingClientRect().bottom<header.offsetHeight+80) {
    window.scrollTo({top:0,behavior:'instant'});
  }
});

CLAIMS.forEach((_,index)=>{
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = `청구항 ${index+1}`;
  claimSelect.append(option);
});
claimSelect.addEventListener('change',()=>renderClaim(Number(claimSelect.value)));
previousScroll = scrollPosition().position;
setProgress(previousScroll);
if (previousScroll<.025) setSection(true);
renderClaim(0,true);
setPlayState(false);

function showDrawing(key) {
  const item = DRAWINGS[key];
  if (!item) return;
  stopPlayback();
  byId('drawing-title').textContent = `${item.label} · ${item.title}`;
  byId('drawing-image').src = `./assets/fig-${key}.png`;
  byId('drawing-image').alt = `${item.label} ${item.title}`;
  byId('drawing-page').textContent = `공개특허공보 ${item.page}쪽`;
  byId('drawing-pdf').href = `./assets/KR20240040371A.pdf#page=${item.page}`;
  drawing.showModal();
  byId('close-drawing').focus();
}

document.querySelectorAll('[data-drawing]').forEach(button=>{
  button.addEventListener('click',()=>showDrawing(button.dataset.drawing));
});
byId('close-drawing').addEventListener('click',()=>drawing.close());
drawing.addEventListener('click',event=>{
  if (event.target===drawing) drawing.close();
});
