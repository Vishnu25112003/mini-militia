// Loads the atlases, images and map produced by tools/extract.mjs.
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`could not load ${src}`));
  img.src = src;
});

export const assets = { atlases: {}, img: {}, map: null, sprites: new Map(), tinted: new Map() };

export async function loadAssets(onProgress) {
  const jobs = [];
  const track = (p) => { jobs.push(p); return p; };
  let done = 0;
  const tick = () => onProgress?.(++done / jobs.length);

  for (const name of ['menuTexture', 'partsTexture']) {
    track(Promise.all([fetch(`assets/atlas/${name}.json`).then((r) => r.json()), loadImage(`assets/atlas/${name}.png`)])
      .then(([json, image]) => { assets.atlases[name] = { frames: json.frames, image }; tick(); }));
  }
  for (const name of ['tile64Desert_new', 'bgDesert_new', 'blood_new', 'smoke_new', 'smokey_new', 'spark_new', 'blast_new', 'shell_new', 'streak_new', 'splatter_new', 'shrap_new', 'rock_new', 'blasticle_new', 'bullet_new', 'ammoText_new', 'ora_new']) {
    track(loadImage(`assets/img/${name}.png`).then((img) => { assets.img[name] = img; tick(); }));
  }
  track(fetch('assets/map/catacombs.json').then((r) => r.json()).then((m) => { assets.map = m; tick(); }));
  track(document.fonts.load('20px Militia').then(tick, tick));
  await Promise.all(jobs);
}

// A sprite frame as its own unrotated canvas at the frame's untrimmed source size, so variants of one
// sprite (a gun and its empty "E" frame) line up exactly. TexturePacker stores some frames rotated 90deg
// clockwise; cocos offsets are from the source centre with y up.
export function sprite(name, atlasName) {
  const key = `${atlasName || ''}:${name}`;
  let c = assets.sprites.get(key);
  if (c !== undefined) return c;
  const atlas = atlasName ? assets.atlases[atlasName] : (assets.atlases.menuTexture.frames[name] ? assets.atlases.menuTexture : assets.atlases.partsTexture);
  const f = atlas?.frames[name];
  if (!f) { assets.sprites.set(key, null); return null; }
  c = document.createElement('canvas');
  const sw = Math.max(f.sw || f.w, f.w), sh = Math.max(f.sh || f.h, f.h);
  c.width = sw; c.height = sh;
  const g = c.getContext('2d');
  g.translate(Math.round((sw - f.w) / 2 + (f.ox || 0)), Math.round((sh - f.h) / 2 - (f.oy || 0)));
  if (f.r) {
    g.translate(0, f.h);
    g.rotate(-Math.PI / 2);
    g.drawImage(atlas.image, f.x, f.y, f.h, f.w, 0, 0, f.h, f.w);
  } else {
    g.drawImage(atlas.image, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  }
  assets.sprites.set(key, c);
  return c;
}

export function tintedSprite(name, color) {
  const key = `${name}|${color}`;
  let c = assets.tinted.get(key);
  if (c) return c;
  const s = sprite(name);
  if (!s) return null;
  c = document.createElement('canvas');
  c.width = s.width; c.height = s.height;
  const g = c.getContext('2d');
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(s, 0, 0);
  assets.tinted.set(key, c);
  return c;
}

const urlCache = new Map();
export function spriteURL(name) {
  if (urlCache.has(name)) return urlCache.get(name);
  const s = sprite(name);
  const url = s ? s.toDataURL() : '';
  urlCache.set(name, url);
  return url;
}
