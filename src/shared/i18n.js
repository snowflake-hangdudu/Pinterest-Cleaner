const messages = {
  en: {
    brandTitle: 'Pinterest Cleaner',
    brandProduct: 'AI Filter & Ad Blocker',
    todayCleaned: 'Cleaned today',
    total: 'Total',
    ai: 'AI content',
    ads: 'Promoted',
    keywords: 'Keywords',
    creators: 'Creators',
    enabled: 'Extension enabled',
    aiFilter: 'AI filter',
    aiMode: 'AI mode',
    aiStrict: 'Strict',
    aiStandard: 'Standard',
    aiAggressive: 'Aggressive',
    adFilter: 'Ads & promoted',
    customRules: 'Custom rules',
    pageCleaner: 'Page cleaner',
    showFiltered: 'Show filtered content',
    pause5: 'Pause 5 min',
    pause30: 'Pause 30 min',
    pauseTab: 'Pause this tab',
    pauseOff: 'Resume filtering',
    openSettings: 'Settings',
    options: 'Open settings',
    rulesCount: '{n} rules',
    paused: 'Paused',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Could not save settings',
    loadFailed: 'Could not load settings',
    language: 'Language',
    languageAuto: 'Follow browser',
    languageEnglish: 'English',
    languageChinese: '简体中文',
    feedback: 'Feedback',
    feedbackHelp: 'Email questions or suggestions',
    privacyNote: 'Local only · no account · no upload',
    aggressiveHint: 'Aggressive may hide some non-AI pins.'
  },
  'zh-CN': {
    brandTitle: 'Pinterest Cleaner',
    brandProduct: 'AI 过滤与广告屏蔽',
    todayCleaned: '今天已净化',
    total: '总计',
    ai: 'AI 内容',
    ads: '推广内容',
    keywords: '关键词',
    creators: '发布者',
    enabled: '启用扩展',
    aiFilter: 'AI 过滤',
    aiMode: 'AI 模式',
    aiStrict: '严格',
    aiStandard: '标准',
    aiAggressive: '强力',
    adFilter: '广告与推广',
    customRules: '自定义规则',
    pageCleaner: '页面净化',
    showFiltered: '显示被过滤内容',
    pause5: '暂停 5 分钟',
    pause30: '暂停 30 分钟',
    pauseTab: '暂停当前标签页',
    pauseOff: '恢复过滤',
    openSettings: '设置',
    options: '打开设置页',
    rulesCount: '{n} 条',
    paused: '已暂停',
    saving: '保存中…',
    saved: '已保存',
    saveFailed: '保存失败',
    loadFailed: '无法读取设置',
    language: '语言',
    languageAuto: '跟随浏览器',
    languageEnglish: 'English',
    languageChinese: '简体中文',
    feedback: '意见反馈',
    feedbackHelp: '欢迎邮件反馈问题或建议',
    privacyNote: '仅本地运行 · 无账号 · 不上传',
    aggressiveHint: '强力模式可能隐藏部分非 AI 内容。'
  }
};

export function resolveLanguage(preference = 'en') {
  if (preference === 'zh-CN' || preference === 'en') return preference;
  const browserLang = globalThis.chrome?.i18n?.getUILanguage?.() || navigator.language || 'en';
  return /^(?:zh(?:[-_](?:cn|sg|hans))?)\b/i.test(browserLang) ? 'zh-CN' : 'en';
}

export function translate(language, key, vars = {}) {
  let text = messages[language]?.[key] ?? messages.en[key] ?? key;
  for (const [name, value] of Object.entries(vars)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

export function applyTranslations(root, language) {
  const doc = root.documentElement ? root : document;
  const owner = root.documentElement ? root : document;
  owner.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : 'en';
  for (const element of doc.querySelectorAll('[data-i18n]')) {
    element.textContent = translate(language, element.dataset.i18n);
  }
  for (const element of doc.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', translate(language, element.dataset.i18nAria));
  }
}

export const I18N = messages;
