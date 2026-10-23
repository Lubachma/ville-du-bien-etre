const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://lubachma.github.io/ville-du-bien-etre/';
const DESCRIPTION = 'Une app gratuite de bien-être : chaque minute de lecture, de sport ou de calme fait grandir ta ville. Sans compte, sans pub, même hors connexion.';

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const html = read('index.html');

// Les attributs de chaque balise <name …> de la page, un objet par balise.
function tags(name) {
  return [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])));
}
// Le `content` de chaque <meta> dont l'attribut `attr` vaut `key`. Une balise en double se voit : la liste a deux valeurs.
const meta = (attr, key) => tags('meta').filter(tag => tag[attr] === key).map(tag => tag.content);
const canonical = () => tags('link').filter(tag => tag.rel === 'canonical').map(tag => tag.href);

test('page : indexable, avec adresse canonique et aperçu des liens', () => {
  assert.ok(!/noindex/i.test(html), "la page ne demande plus aux moteurs de recherche de l'ignorer (noindex)");
  assert.deepEqual(canonical(), [SITE]);
  assert.deepEqual(meta('name', 'description'), [DESCRIPTION]);
  const preview = {
    'og:description': DESCRIPTION,
    'og:type': 'website',
    'og:site_name': 'Ville du bien-être',
    'og:title': 'Ville du bien-être — prends soin de toi, ta ville grandit',
    'og:url': SITE,
    'og:image': SITE + 'apercu/ville-1200x630.png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:locale': 'fr_CH',
    'og:locale:alternate': 'en_GB',
  };
  for (const [property, value] of Object.entries(preview)) assert.deepEqual(meta('property', property), [value], property);
  const alt = meta('property', 'og:image:alt');
  assert.equal(alt.length, 1);
  assert.notEqual(alt[0].trim(), '');
  assert.deepEqual(meta('name', 'twitter:card'), ['summary_large_image']);
  assert.equal(html.match(/<title>([^<]*)<\/title>/)[1], 'Ville du bien-être');
});

test('manifeste : même description que la page', () => {
  assert.equal(JSON.parse(read('manifest.webmanifest')).description, DESCRIPTION);
});

test("publication : une adresse absolue n'est permise que dans les métadonnées", async () => {
  const { strayAddresses } = await import('../scripts/page-guard.mjs');
  assert.deepEqual(strayAddresses(html), []);
  // Hors des métadonnées, une adresse est une dépendance au réseau : elle est relevée, jusqu'à la fin de l'adresse.
  assert.deepEqual(strayAddresses('<script src="https://cdn.example/x.js"></script>'), ['https://cdn.example/x.js']);
  assert.deepEqual(strayAddresses('<a href="http://exemple.ch">'), ['http://exemple.ch']);
  assert.deepEqual(strayAddresses('<div style="background:url(https://x.ch/a.png)">'), ['https://x.ch/a.png']);
  assert.deepEqual(strayAddresses(`<img src="https://a.ch/1.png">\n<img src='http://b.ch/2.png'>`), ['https://a.ch/1.png', 'http://b.ch/2.png']);
  // Les trois métadonnées permises, quel que soit l'ordre de leurs attributs.
  for (const tag of [
    '<meta property="og:image" content="https://x.ch/y.png">',
    '<meta content="https://x.ch/y.png" property="og:image">',
    '<meta name="twitter:card" content="https://x.ch">',
    '<meta content="https://x.ch" name="twitter:card">',
    '<link rel="canonical" href="https://x.ch/">',
    '<link href="https://x.ch/" rel="canonical">',
  ]) assert.deepEqual(strayAddresses(tag), [], tag);
  // Rien d'autre n'est permis, même sur la ligne d'une balise permise.
  assert.deepEqual(strayAddresses('<meta name="description" content="https://x.ch">'), ['https://x.ch']);
  assert.deepEqual(strayAddresses('<link rel="stylesheet" href="https://x.ch/s.css">'), ['https://x.ch/s.css']);
  assert.deepEqual(strayAddresses('<link rel="icon" href="https://x.ch/i.png">'), ['https://x.ch/i.png']);
  assert.deepEqual(strayAddresses('<meta property="og:image" content="https://x.ch/y.png"><script src="https://cdn.example/x.js"></script>'), ['https://cdn.example/x.js']);
  assert.deepEqual(strayAddresses('<link rel="canonical" href="https://x.ch/"><link rel="preload" href="https://x.ch/f.woff2" as="font">'), ['https://x.ch/f.woff2']);
  // Ce qui entoure une balise permise n'est pas recollé en une adresse qui n'existe pas dans la page.
  assert.deepEqual(strayAddresses('http://exem<meta property="og:x" content="y">ple.ch'), ['http://exem']);
});

// Largeur et hauteur d'un PNG : octets 16 à 23 de l'en-tête, en grand-boutiste.
const pngSize = name => { const head = fs.readFileSync(path.join(__dirname, '..', name)); return [head.readUInt32BE(16), head.readUInt32BE(20)]; };

test("aperçu : image des liens en 1200 × 630, à l'adresse annoncée par la page", () => {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'apercu', 'ville-1200x630.png')));
  assert.deepEqual(pngSize('apercu/ville-1200x630.png'), [1200, 630]);
  const [image] = meta('property', 'og:image');
  assert.ok(image.endsWith('apercu/ville-1200x630.png'), image);
});

test('manifeste : trois captures étroites qui existent, à leur taille', () => {
  const { screenshots } = JSON.parse(read('manifest.webmanifest'));
  assert.equal(screenshots.length, 3);
  for (const shot of screenshots) {
    assert.equal(shot.form_factor, 'narrow');
    assert.notEqual(String(shot.label || '').trim(), '');
    assert.equal(shot.type, 'image/png');
    assert.ok(fs.existsSync(path.join(__dirname, '..', shot.src)), shot.src);
    const [w, h] = pngSize(shot.src);
    assert.equal(shot.sizes, w + 'x' + h, shot.src);
    assert.ok(Math.max(w, h) / Math.min(w, h) <= 2.3, shot.src);
  }
});

test('publication : apercu est copié dans dist/', () => {
  const line = read('scripts/package.mjs').split('\n').find(l => l.includes("'index.html'"));
  assert.ok(line.includes("'apercu'"), line);
});
