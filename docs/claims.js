'use strict';

const CLAIM_TEXT = {
  "1": "기판 상에서 제1 방향으로 연장되는 활성 영역;\n상기 활성 영역 상에 상기 기판의 상면에 수직한 수직 방향으로 서로 이격되어 배치되는 복수의 채널층들;\n상기 기판 상에서 상기 활성 영역 및 상기 복수의 채널층들과 교차하여 상기 복수의 채널층들을 각각 둘러싸고,\n제2 방향으로 연장되는 게이트 구조물; 및\n상기 게이트 구조물의 적어도 일측에서 상기 활성 영역 상에 배치되며, 상기 복수의 채널층들과 접촉하는 소스/드레인 영역들을 포함하되,\n상기 게이트 구조물은 상기 복수의 채널층들과 수직하게 중첩하는 영역에서, 상기 복수의 채널층들 중 최상부 채널층 상에 배치되는 상부 부분 및 각각의 상기 복수의 채널층들 사이에 배치되는 하부 부분들을 포함하고,\n상기 복수의 채널층들 각각의 상기 제1 방향을 따른 폭은 상기 게이트 구조물의 상기 하부 부분들 중 상기 각각의 채널층들에 인접한 하부 부분들의 상기 제1 방향을 따른 폭보다 작은 반도체 소자.",
  "2": "제1 항에 있어서,\n상기 소스/드레인 영역들의 최하부는 상기 게이트 구조물의 상기 하부 부분들 중 최하부 보다 낮은 레벨에 배치되는 반도체 소자.",
  "3": "제1 항에 있어서,\n상기 소스/드레인 영역들과 상기 복수의 채널층들이 접촉하는 면들 중 적어도 일부는 (111) 결정 배향을 갖는 반도체 소자.",
  "4": "제3 항에 있어서,\n상기 소스/드레인 영역들과 상기 복수의 채널층들이 접촉하는 면들 중 일부는 (110) 결정 배향을 갖는 반도체 소자.",
  "5": "제3 항에 있어서,\n상기 소스/드레인 영역들과 상기 활성 영역이 접촉하는 면들 중 적어도 일부는 상기 기판의 상면과 평행한 반도체 소자.",
  "6": "제1 항에 있어서,\n상기 소스/드레인 영역들과 상기 활성 영역이 접촉하는 면들 중 적어도 일부는 (111) 결정 배향을 갖는 반도체 소자.",
  "7": "제1 항에 있어서,\n상기 소스/드레인 영역들을 덮는 층간 절연층을 더 포함하되,\n상기 게이트 구조물은 게이트 유전층 및 게이트 유전층 상의 게이트 전극을 포함하고,\n상기 게이트 구조물의 상기 상부 부분에서, 상기 게이트 유전층은 상기 층간 절연층 및 상기 소스/드레인 영역들 중 적어도 하나와 접촉하는 반도체 소자.",
  "8": "제1 항에 있어서,\n상기 복수의 채널층들 각각의 하면 상에서 상기 제1 방향을 따른 상기 게이트 구조물의 양측에 배치되는 내부 스페이서층들을 더 포함하는 반도체 소자.",
  "9": "기판 상에서 제1 방향으로 연장되는 활성 영역;\n상기 활성 영역 상에 상기 기판의 상면에 수직한 수직 방향으로 서로 이격되어 배치되는 복수의 채널층들;\n상기 기판 상에서 상기 활성 영역 및 상기 복수의 채널층들과 교차하여 상기 복수의 채널층들을 각각 둘러싸고,\n제2 방향으로 연장되는 게이트 구조물; 및\n상기 게이트 구조물의 적어도 일측에서 상기 활성 영역 상에 배치되며, 상기 복수의 채널층들과 접촉하는 소스/드레인 영역들을 포함하되,\n상기 소스/드레인 영역들과 상기 복수의 채널층들이 접촉하는 면들 중 적어도 일부는 (111) 결정 배향을 갖는 반도체 소자.",
  "10": "기판 상에서 제1 방향으로 연장되는 활성 영역;\n상기 활성 영역 상에 상기 기판의 상면에 수직한 수직 방향으로 서로 이격되어 배치되는 복수의 채널층들;\n상기 기판 상에서 상기 활성 영역 및 상기 복수의 채널층들과 교차하여 상기 복수의 채널층들을 각각 둘러싸고,\n제2 방향으로 연장되는 게이트 구조물; 및\n상기 게이트 구조물의 적어도 일측에서 상기 활성 영역 상에 배치되며, 상기 복수의 채널층들과 접촉하는 소스/드레인 영역들을 포함하되,\n상기 게이트 구조물은 상기 복수의 채널층들과 수직하게 중첩하는 영역에서, 상기 복수의 채널층들 중 최상부 채널층 상에 배치되는 상부 부분 및 각각의 상기 복수의 채널층들의 아래에 배치되는 하부 부분들을 포함하고,\n상기 복수의 채널층들 중 각각의 채널층들의 중앙 레벨에서, 상기 복수의 채널층들 중 상기 각각의 채널층들의 상기 제1 방향을 따른 폭은 상기 게이트 구조물의 상기 하부 부분들 각각의 중앙 레벨에서, 인접한 상기 소스/드레인 영역들의 외측면들 사이의 제1 방향을 따른 폭보다 작고,\n상기 소스/드레인 영역들과 상기 복수의 채널층들이 접촉하는 면들 중 적어도 일부는 (111) 결정 배향을 갖고,\n상기 소스/드레인 영역들의 최하부는 상기 게이트 구조물의 상기 하부 부분들 중 최하부 보다 낮은 레벨에 배치되는 반도체 소자."
};

const DRAWINGS = {
  '1': {label:'도 1', title:'평면 배치', page:15},
  '2a': {label:'도 2a', title:'기본 실시예의 세 단면', page:16},
  '2b': {label:'도 2b', title:'내부 스페이서층을 포함한 단면', page:17},
  '3a': {label:'도 3a', title:'(111) 결정 배향의 접촉면', page:20},
  '3c': {label:'도 3c', title:'기판 상면과 평행한 접촉면', page:22},
  '4ab': {label:'도 4a·4b', title:'(111)·(110) 결정 배향과 수평 단면', page:24},
  '5a': {label:'도 5a', title:'게이트 유전층의 접촉 관계', page:26}
};

const PARTS = {
  active: {code:'101 · 105', title:'기판과 활성 영역', detail:'기판 위로 돌출된 활성 영역이 제1 방향(X)으로 이어집니다.', color:'#b6a0fb', targets:['base','active'], spread:.34},
  channel: {code:'141–143', title:'복수의 채널층', detail:'활성 영역 위에 세 채널층이 수직 방향으로 떨어져 배치됩니다.', color:'#e8b4ff', targets:['channel'], spread:.66},
  gate: {code:'160', title:'게이트 구조물', detail:'제2 방향(Y)으로 교차하며 각 채널층을 둘러쌉니다.', color:'#bc8dff', targets:['gate-upper','gate-lower'], spread:.48},
  drain: {code:'150', title:'소스/드레인 영역', detail:'활성 영역 위에서 채널층들과 맞닿습니다.', color:'#e8ad91', targets:['drain'], spread:.58},
  gateSections: {code:'160A/B', title:'게이트 상부와 하부', detail:'최상부 채널층 위에는 상부, 채널층 사이에는 하부가 놓입니다.', color:'#bc8dff', targets:['gate-upper','gate-lower'], spread:.78},
  widths: {code:'140 · 160B', title:'제1 방향의 폭 비교', detail:'각 채널층의 X 방향 폭은 인접한 게이트 하부의 X 방향 폭보다 작습니다.', color:'#e8b4ff', targets:['channel','gate-lower','dimensions'], spread:.65},
  levels: {code:'150 · 160B', title:'최하부 높이 비교', detail:'소스/드레인의 최하부가 게이트 하부의 최하부보다 더 낮습니다.', color:'#e8ad91', targets:['drain','gate-lower','levels'], spread:0},
  face111: {code:'(111)', title:'채널 접촉면의 (111) 배향', detail:'소스/드레인과 채널층이 만나는 면 중 적어도 일부에 해당합니다.', color:'#efc3fb', targets:['contact-face'], spread:.70},
  face110: {code:'(110)', title:'채널 접촉면의 (110) 배향', detail:'소스/드레인과 채널층의 접촉면 일부는 (110) 배향을 갖습니다.', color:'#efc3fb', targets:['contact-face'], spread:.70},
  flatBase: {code:'105 · 150', title:'기판 상면과 평행한 접촉면', detail:'소스/드레인과 활성 영역이 맞닿는 면 중 일부가 기판 상면과 평행합니다.', color:'#efc3fb', targets:['base-face','active'], spread:.72},
  base111: {code:'(111)', title:'활성 영역 접촉면의 (111) 배향', detail:'소스/드레인과 활성 영역이 맞닿는 면 중 적어도 일부에 해당합니다.', color:'#efc3fb', targets:['base-face','active'], spread:.72},
  insulation: {code:'190', title:'층간 절연층', detail:'소스/드레인 영역을 덮습니다.', color:'#a7a3ec', targets:['ild'], spread:.65},
  dielectric: {code:'162a/b · 165', title:'게이트 유전층과 전극', detail:'게이트 전극은 게이트 유전층 위에 위치합니다.', color:'#a9d6ff', targets:['dielectric','gate-upper','gate-lower'], spread:.59},
  dielectricContact: {code:'162a/b', title:'상부 게이트 유전층의 접촉', detail:'상부의 유전층은 층간 절연층과 소스/드레인 중 적어도 하나에 접촉합니다.', color:'#a9d6ff', targets:['dielectric','ild','drain'], spread:.46},
  spacer: {code:'130', title:'내부 스페이서층', detail:'각 채널층의 하면에서 게이트 하부의 양측에 배치됩니다.', color:'#f0aed4', targets:['spacer'], spread:.67},
  centerGap: {code:'140 · 150', title:'중앙 레벨에서의 폭 비교', detail:'채널층의 폭은 게이트 하부 중앙 높이에서 잰 인접 소스/드레인 외측면 사이 거리보다 작습니다.', color:'#e8b4ff', targets:['channel','drain','center-gap'], spread:0}
};

const CRYSTAL_NOTE = '3D에서는 접촉 위치를 표시합니다. 결정면 형상과 배향은 공보 도면에서 확인할 수 있습니다.';
const CLAIMS = [
  {summary:'GAA 소자의 기본 구조', fig:'2a', elements:['active','channel','gate','drain','gateSections','widths']},
  {summary:'소스/드레인과 게이트 하부의 높이 관계', fig:'2a', parent:1, elements:['levels','drain','gate']},
  {summary:'채널 접촉면의 (111) 결정 배향', fig:'3a', parent:1, note:CRYSTAL_NOTE, elements:['face111','channel','drain']},
  {summary:'채널 접촉면의 (110) 결정 배향', fig:'4ab', parent:3, note:CRYSTAL_NOTE, elements:['face110','channel','drain']},
  {summary:'활성 영역과 소스/드레인의 평행 접촉면', fig:'3c', parent:3, mode:'facet-flat', elements:['flatBase','active','drain']},
  {summary:'활성 영역 접촉면의 (111) 결정 배향', fig:'3a', parent:1, note:CRYSTAL_NOTE, elements:['base111','active','drain']},
  {summary:'층간 절연층과 게이트 유전층의 접촉 관계', fig:'5a', parent:1, mode:'dielectric', elements:['insulation','dielectric','dielectricContact']},
  {summary:'채널층 아래의 내부 스페이서', fig:'2b', parent:1, mode:'spacer', elements:['spacer','channel','gate']},
  {summary:'(111) 결정 배향을 포함하는 GAA 소자', fig:'3a', note:CRYSTAL_NOTE, elements:['active','channel','gate','drain','face111']},
  {summary:'폭, 결정 배향 및 최하부 높이의 결합', fig:'3a', note:CRYSTAL_NOTE, elements:['active','channel','gate','drain','gateSections','centerGap','face111','levels']}
];
