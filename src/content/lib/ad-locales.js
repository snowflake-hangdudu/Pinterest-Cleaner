(() => {
  'use strict';
  const PC = globalThis.PC;
  PC.AD_LABELS = Object.freeze({
    promoted: [
      'promoted', 'sponsored', 'advertisement', 'ad',
      '推广', '赞助', '广告', '推广内容', '赞助内容',
      '推廣', '贊助', '廣告',
      'gesponsert', 'anzeige', 'werbung',
      'sponsorisé', 'sponsorise', 'publicité', 'publicite',
      'patrocinado', 'promocionado', 'anuncio',
      'patrocinado', 'publicidade',
      'sponsorizzato', 'pubblicità', 'pubblicita',
      'プロモーション', '広告', 'スポンサー',
      '프로모션', '광고', '스폰서'
    ],
    shopping: [
      'shop', 'shopping', 'buy', 'product',
      '购物', '商品', '购买', '購買', '購物',
      'kaufen', 'acheter', 'comprar', '購入', '쇼핑'
    ]
  });

  PC.normalizeLabel = (value) => String(value || '')
    .normalize('NFKC')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  PC.labelMatches = (text, dictionary) => {
    const value = PC.normalizeLabel(text);
    if (!value || value.length > 96) return false;
    return dictionary.some((item) => value === item || value.startsWith(`${item} `) || value.includes(` ${item} `));
  };
})();
