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

  const CJK_PROMO = new Set(['赞助', '贊助', '推广', '推廣']);

  PC.labelMatches = (text, dictionary) => {
    const value = PC.normalizeLabel(text);
    if (!value || value.length > 96) return false;
    const compact = value.replace(/\s+/g, '');
    return dictionary.some((item) => {
      const token = PC.normalizeLabel(item);
      if (!token) return false;
      if (/[^\x00-\x7f]/.test(token)) {
        if (value === token || value === `${token}内容` || value === `${token}內容`) return true;
        if (CJK_PROMO.has(token) && compact.startsWith(token)) {
          const rest = compact.slice(token.length);
          // 赞助的 Pin 图 / 赞助的Pin图 / 贊助的 Pin
          if (!rest || rest === '内容' || rest === '內容') return true;
          if (/^的?pin(图|圖)?$/.test(rest)) return true;
          if (rest.startsWith('的pin')) return true;
        }
        return value.startsWith(`${token} `);
      }
      return value === token
        || value.startsWith(`${token} `)
        || value.endsWith(` ${token}`)
        || value.includes(` ${token} `);
    });
  };

  /** Broader scan for promo badges inside a short card chrome string. */
  PC.textHasPromotedLabel = (text) => {
    const value = PC.normalizeLabel(text);
    if (!value) return false;
    if (PC.labelMatches(value, PC.AD_LABELS.promoted)) return true;
    const compact = value.replace(/\s+/g, '');
    if (/(赞助|贊助)的?pin(图|圖)?/.test(compact)) return true;
    if (/(^|[^a-z])(promoted|sponsored)([^a-z]|$)/i.test(value)) return true;
    return false;
  };
})();
