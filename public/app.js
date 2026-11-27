'use strict';
const byId = id => document.getElementById(id);
const panel = byId('panel');
const subjects = ['数学', '英語', '理科', '国語', '地歴', '情報'];
const examples = [
  { topic: 'square', hints: [0, 1], sample: true },
  { topic: 'present', hints: [0], sample: true },
  { topic: 'forces', hints: [], sample: true }
];
let catalog = [];
let posts = [];
let subject = 'すべて';

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}

function message(id, text = '') {
  byId(id).textContent = text;
  byId(id).hidden = !text;
}

async function request(url, payload) {
  const options = payload === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  };
  let response;
  try { response = await fetch(url, options); }
  catch { throw new Error('接続できません。通信環境を確認して、もう一度お試しください。'); }
  if (!response.ok) {
    const info = await response.json().catch(() => ({}));
    throw new Error(info.error || '読み込みに失敗しました。もう一度お試しください。');
  }
  return response.json();
}

const topicFor = id => catalog.find(topic => topic.id === id);
const hintNames = ['最初の一歩', '考え方', '確かめ方'];
function subjectTag(name) {
  return el('span', name, 'tag s' + subjects.indexOf(name));
}

function drawFilters() {
  byId('subjects').replaceChildren(...['すべて', ...subjects].map(name => {
    const chip = el('button', name, 'chip');
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(name === subject));
    chip.addEventListener('click', () => {
      subject = name;
      for (const button of byId('subjects').children) button.setAttribute('aria-pressed', String(button === chip));
      drawCards();
    });
    return chip;
  }));
}

function drawCards() {
  const visibleExamples = examples.filter(example => !posts.some(post => post.topic === example.topic));
  const rows = [...posts, ...visibleExamples].filter(row => {
    const topic = topicFor(row.topic);
    return topic && (subject === 'すべて' || topic.subject === subject)
      && (!byId('waiting').checked || row.hints.length === 0);
  });
  byId('total').textContent = rows.length + '件の質問';
  const cards = rows.map(row => {
    const topic = topicFor(row.topic);
    const card = el('button', undefined, 'card');
    card.type = 'button';
    const top = el('span', undefined, 'cardtop');
    top.append(subjectTag(topic.subject), el('span', topic.unit));
    if (row.sample) top.append(el('span', '見本', 'sample'));
    const foot = el('span', undefined, 'cardfoot');
    const count = row.hints.length;
    const arrow = el('b', '↗');
    arrow.setAttribute('aria-hidden','true');
    foot.append(el('i', undefined, count ? 'dot' : 'dot wait'), el('span', count ? 'ヒント ' + count + '件' : 'ヒント待ち'), arrow);
    card.append(top, el('span', topic.title, 'cardtitle'), foot);
    card.addEventListener('click', () => showPost(row));
    return card;
  });
  if (!cards.length) cards.push(el('p', 'この条件の質問はまだありません。別の科目を選ぶか、質問を出してみよう。', 'empty'));
  byId('cards').replaceChildren(...cards);
}

function openPanel(tag, title) {
  byId('dialogTag').textContent = tag;
  byId('dialogTitle').textContent = title;
  byId('dialogBody').replaceChildren();
  message('dialogStatus');
  if (!panel.open) panel.showModal();
  panel.scrollTop = 0;
}

function openSelect(labelText, options) {
  const label = el('label', labelText, 'field');
  const select = el('select');
  for (const [value, text] of options) select.add(new Option(text, value));
  label.append(select);
  return [label, select];
}

function action(text, job) {
  const button = el('button', text, 'primary');
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    message('dialogStatus');
    try { await job(); }
    catch (error) { message('dialogStatus', error.message); }
    finally { button.disabled = false; }
  });
  return button;
}

function record(row) {
  posts = [row, ...posts.filter(item => item.topic !== row.topic)].sort((a, b) => b.created - a.created);
  drawCards();
}

function compose(initialTopic) {
  openPanel('質問を出す', 'どこでつまずいた？');
  const body = byId('dialogBody');
  const [subjectLabel, subjectSelect] = openSelect('科目', subjects.map(s => [s, s]));
  const [topicLabel, topicSelect] = openSelect('質問', []);
  subjectSelect.value = initialTopic?.subject || (subjects.includes(subject) ? subject : subjects[0]);
  function updateTopics() {
    topicSelect.replaceChildren();
    for (const topic of catalog.filter(t => t.subject === subjectSelect.value)) {
      topicSelect.add(new Option(topic.title, topic.id));
    }
  }
  updateTopics();
  if (initialTopic) topicSelect.value = initialTopic.id;
  subjectSelect.addEventListener('change', updateTopics);
  body.append(el('p', '自分の疑問に近いカードを選んでね。同じ質問があれば、その投稿に合流します。', 'muted'), subjectLabel, topicLabel);
  body.append(action('この質問を掲示する', async () => {
    const row = await request('/api/posts', { topic: topicSelect.value });
    record(row);
    showPost(row);
    message('dialogStatus', '掲示板にある、みんなで使える質問です。');
  }));
}

function showPost(row) {
  const topic = topicFor(row.topic);
  openPanel(topic.subject + ' ・ ' + topic.unit + (row.sample ? ' ・ 見本' : ''), topic.title);
  const body = byId('dialogBody');
  if (!row.sample) {
    const stamp = new Intl.DateTimeFormat('ja-JP', { month:'numeric', day:'numeric', timeZone:'Asia/Tokyo' }).format(row.created);
    body.append(el('p', stamp + ' 投稿 ・ 7日間掲載', 'muted'));
  }
  body.append(el('h3', '届いたヒント（' + row.hints.length + '件）'));
  if (!row.hints.length) body.append(el('p', '最初のヒントを待っています。', 'muted'));
  for (const index of row.hints) {
    const detail = el('details', undefined, 'hint');
    detail.append(el('summary', hintNames[index]), el('p', topic.hints[index]));
    body.append(detail);
  }
  if (row.sample) {
    body.append(el('p', 'これは掲示板の見本です。同じ質問を自分で出すと、ほかの人が返信できます。', 'muted'),
      action('このテーマで質問する', () => compose(topic)));
    return;
  }
  const remaining = topic.hints.map((_, index) => index).filter(index => !row.hints.includes(index));
  if (!remaining.length) return;
  const group = el('fieldset', undefined, 'reply');
  group.append(el('legend', 'ヒントを届ける'));
  for (const index of remaining) {
    const label = el('label', undefined, 'hintchoice');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'reply';
    radio.value = String(index);
    label.append(radio, el('span', topic.hints[index]));
    group.append(label);
  }
  body.append(group, action('選んだヒントを送る', async () => {
    const chosen = group.querySelector('input:checked');
    if (!chosen) throw new Error('届けたいヒントを一つ選んでください。');
    const updated = await request('/api/hints', { topic: row.topic, post: row.id, hint: Number(chosen.value) });
    record(updated);
    showPost(updated);
    message('dialogStatus', 'ヒントが届きました。');
  }));
}

async function refresh() {
  byId('refresh').disabled = true;
  message('status');
  try {
    if (!catalog.length) {
      catalog = await request('/catalog.json');
      drawFilters();
    }
    posts = await request('/api/posts');
    byId('compose').disabled = false;
    drawCards();
  } catch (error) {
    if (!byId('cards').childElementCount) byId('total').textContent = '一覧を読み込めませんでした';
    message('status', error.message);
  } finally { byId('refresh').disabled = false; }
}
byId('close').addEventListener('click', () => panel.close());
byId('waiting').addEventListener('change', drawCards);
byId('refresh').addEventListener('click', refresh);
byId('compose').addEventListener('click', () => compose());
refresh();
