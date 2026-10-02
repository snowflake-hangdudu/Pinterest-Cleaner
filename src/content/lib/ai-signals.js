(() => {
  'use strict';
  const PC = globalThis.PC;

  PC.AI_OFFICIAL = [
    'ai modified',
    'gen ai',
    'generated with ai',
    'modified with ai',
    'ai generated',
    'made with ai',
    'created with ai',
    'ai disclosure',
    'contains ai generated content',
    'ai-generated',
    'ai artwork label',
    '生成式 ai',
    'ai 生成',
    'ai生成',
    '由 ai 生成',
    '使用 ai 修改'
  ];

  PC.AI_HEURISTICS = [
    'midjourney',
    'stable diffusion',
    'stable-diffusion',
    'dall-e',
    'dalle',
    'dall·e',
    'flux ai',
    'flux.1',
    'chatgpt',
    'leonardo ai',
    'ideogram',
    'firefly',
    'ai art',
    'ai artwork',
    'ai illustration',
    'ai generated',
    'generated with ai',
    'prompt:'
  ];

  PC.textHasAny = (haystack, needles) => {
    const text = PC.normalizeLabel(haystack);
    if (!text) return false;
    return needles.some((item) => text.includes(item));
  };
})();
