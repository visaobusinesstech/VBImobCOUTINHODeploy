// Testes automatizados do parser do Firecrawl v2.
// Garantem que `{ data: { web: [...] } }` (formato atual) e variantes
// históricas sejam sempre interpretadas corretamente.
import {
  assertEquals,
  assert,
  assertStrictEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseFirecrawlSearch,
  normalizarInvite,
  extrairConvites,
} from './firecrawlParser.ts';

// ---------------- parseFirecrawlSearch ----------------

Deno.test('parseFirecrawlSearch — formato v2 canônico { data: { web: [...] } }', () => {
  const resp = {
    success: true,
    data: {
      web: [
        { url: 'https://chat.whatsapp.com/ABC123', title: 'Grupo A' },
        { url: 'https://chat.whatsapp.com/DEF456', title: 'Grupo B' },
      ],
    },
  };
  const { items, shape } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 2);
  assertEquals(items[0].url, 'https://chat.whatsapp.com/ABC123');
  assert(shape.includes('data.web:2'), `shape esperado incluir data.web:2, obtido ${shape.join(',')}`);
});

Deno.test('parseFirecrawlSearch — v2 com web + news mescla ambos', () => {
  const resp = {
    data: {
      web: [{ url: 'https://chat.whatsapp.com/W1' }],
      news: [{ url: 'https://chat.whatsapp.com/N1' }],
    },
  };
  const { items, shape } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 2);
  assert(shape.includes('data.web:1'));
  assert(shape.includes('data.news:1'));
});

Deno.test('parseFirecrawlSearch — v2 com data.web vazio ainda registra o shape', () => {
  const resp = { data: { web: [] } };
  const { items, shape } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 0);
  assert(shape.includes('data.web:0'), `shape esperado incluir data.web:0, obtido ${shape.join(',')}`);
});

Deno.test('parseFirecrawlSearch — legado v1 { data: [...] } continua funcionando', () => {
  const resp = { data: [{ url: 'https://chat.whatsapp.com/L1' }] };
  const { items, shape } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 1);
  assert(shape.includes('data[]:1'));
});

Deno.test('parseFirecrawlSearch — variante { web: [...] } no topo', () => {
  const resp = { web: [{ url: 'https://chat.whatsapp.com/T1' }] };
  const { items, shape } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 1);
  assert(shape.includes('web[]:1'));
});

Deno.test('parseFirecrawlSearch — resposta desconhecida retorna items vazio e shape com chaves', () => {
  const resp = { foo: 1, bar: 2 };
  const { items, shape } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 0);
  assert(shape[0].startsWith('keys:'), `shape esperado começar com "keys:", obtido ${shape[0]}`);
  assert(shape[0].includes('foo'));
});

Deno.test('parseFirecrawlSearch — null / undefined / objeto vazio não quebram', () => {
  for (const input of [null, undefined, {}, { data: null }, { data: { web: null } }]) {
    const { items } = parseFirecrawlSearch(input);
    assertEquals(items.length, 0, `input ${JSON.stringify(input)} deveria produzir items vazio`);
  }
});

Deno.test('parseFirecrawlSearch — campo url ausente é preservado (item entra na lista)', () => {
  // O parser NÃO filtra por url — quem filtra é a camada de convites.
  const resp = { data: { web: [{ title: 'sem url' }] } };
  const { items } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 1);
  assertStrictEquals(items[0].url, undefined);
});

// ---------------- normalizarInvite ----------------

Deno.test('normalizarInvite — aceita chat.whatsapp.com e canonicaliza', () => {
  assertEquals(
    normalizarInvite('https://chat.whatsapp.com/ABC123?ref=foo'),
    'https://chat.whatsapp.com/ABC123',
  );
  assertEquals(
    normalizarInvite('http://chat.whatsapp.com/XYZ/extra/path'),
    'https://chat.whatsapp.com/XYZ',
  );
});

Deno.test('normalizarInvite — rejeita hosts que não sejam chat.whatsapp.com', () => {
  assertStrictEquals(normalizarInvite('https://whatsapp.com/ABC123'), null);
  assertStrictEquals(normalizarInvite('https://evil.com/chat.whatsapp.com/ABC'), null);
  assertStrictEquals(normalizarInvite('https://chat.whatsapp.com'), null); // sem code
  assertStrictEquals(normalizarInvite('não é url'), null);
});

// ---------------- extrairConvites (integração) ----------------

Deno.test('extrairConvites — v2 canônico produz convites únicos e normalizados', () => {
  const resp = {
    data: {
      web: [
        { url: 'https://chat.whatsapp.com/ABC123?utm=x' },
        { url: 'https://chat.whatsapp.com/ABC123' }, // duplicado após normalização
        { url: 'https://example.com/nope' },         // descartado
        { url: 'https://chat.whatsapp.com/DEF456' },
        { link: 'https://chat.whatsapp.com/GHI789' }, // usa `link` em vez de `url`
      ],
      news: [
        { url: 'https://chat.whatsapp.com/JKL000' },
      ],
    },
  };
  const { invites, raw, shape } = extrairConvites(resp);
  assertEquals(raw, 6);
  assertEquals(invites, [
    'https://chat.whatsapp.com/ABC123',
    'https://chat.whatsapp.com/DEF456',
    'https://chat.whatsapp.com/GHI789',
    'https://chat.whatsapp.com/JKL000',
  ]);
  assert(shape.includes('data.web:5'));
  assert(shape.includes('data.news:1'));
});

Deno.test('extrairConvites — resposta vazia retorna arrays vazios sem lançar', () => {
  const { invites, raw } = extrairConvites({ data: { web: [] } });
  assertEquals(invites.length, 0);
  assertEquals(raw, 0);
});

// ---------------- regressão específica ({ data: { web } }) ----------------

Deno.test('REGRESSÃO — o formato { data: { web: [...] } } NUNCA pode retornar 0 quando há web items', () => {
  // Este é o bug histórico que motivou os testes:
  // o parser antigo tratava `data` como array e ignorava `data.web`.
  const resp = {
    success: true,
    data: {
      web: Array.from({ length: 10 }, (_, i) => ({
        url: `https://chat.whatsapp.com/CODE${i}`,
        title: `Grupo ${i}`,
      })),
    },
  };
  const { items } = parseFirecrawlSearch(resp);
  assertEquals(items.length, 10, 'parser DEVE ler data.web quando `data` é objeto');
  const { invites } = extrairConvites(resp);
  assertEquals(invites.length, 10, 'todos os 10 convites devem ser extraídos');
});
