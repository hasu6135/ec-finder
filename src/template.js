/**
 * ===================================================
 * 📈 Google アナリティクス (GA4) の設定
 * ===================================================
 */
const GA_TRACKING_ID = 'G-1Z5RQ06GCN'; 

function getAnalyticsTag() {
    if (!GA_TRACKING_ID) return '';
    return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_TRACKING_ID}');
    </script>
    `;
}

function makeStarString(rating) {
    const score = parseFloat(rating) || 0;
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.4;
    let stars = '⭐'.repeat(fullStars);
    if (hasHalf && fullStars < 5) stars += '🌟';
    return stars || '⭐';
}

function generateSinglePostHTML(article, siteTitle) {
    const allTags = article.pageGenres || [];
    const mainVisibleBadges = allTags.slice(0, 5).map(t => 
        `<a href="../tags/${t}.html" class="bg-rose-600 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm hover:bg-rose-700 transition-all"># ${t}</a>`
    ).join(' ');

    const officialBadgesHtml = allTags.length > 0
        ? allTags.map(g => `<a href="../tags/${g}.html" class="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-xs font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors">#${g}</a>`).join(' ')
        : '<span class="text-xs text-slate-400">なし</span>';

    const starIcons = makeStarString(article.reviewRating);
    const googleAnalyticsCode = getAnalyticsTag();

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.originalTitle} - レビュー | ${siteTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${googleAnalyticsCode}
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-6 px-4 border-b border-rose-950">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <a href="../index.html" class="text-sm font-bold text-rose-400 hover:text-rose-300">← ${siteTitle} トップへ</a>
            <span class="text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">18+ ONLY</span>
        </div>
    </header>
    <main class="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-5 sm:p-10 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            
            <div class="md:w-1/3 self-start space-y-4 shrink-0 w-full block">
                
                <div class="er-hero-image-wrap">
                    <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="block bg-slate-50 flex items-center justify-center rounded-xl border border-slate-200 overflow-hidden min-h-[260px] sm:min-h-[300px] w-full hover:opacity-90 transition-opacity cursor-pointer shadow-sm">
                        <img src="${article.imgUrl}" alt="表紙" class="w-full h-full object-contain p-2 max-h-[350px]">
                    </a>
                </div>
                
                <div class="bg-rose-50/50 border border-rose-100 p-3 rounded-xl text-center w-full block">
                    <div class="text-xs font-bold text-rose-900 mb-1">ユーザー評価</div>
                    <div class="flex items-center justify-center gap-1">
                        <span class="text-lg">${starIcons}</span>
                        <span class="text-base font-extrabold text-slate-800 ml-1">${article.reviewRating}</span>
                        <span class="text-xs text-slate-400">(${article.reviewCount}件)</span>
                    </div>
                </div>

                <div class="er-hero-cta-row space-y-2 w-full block">
                    <a href="${article.link}" target="_blank" rel="noopener" class="er-hero-cta-primary block w-full py-3.5 bg-rose-600 text-white font-extrabold rounded-xl text-center text-sm shadow-md hover:bg-rose-700 transition-all">
                        FANZAで今すぐ読む
                    </a>
                    <a href="${article.sampleReadLink}" target="_blank" rel="noopener" class="er-hero-cta-secondary block w-full py-3.5 bg-white text-rose-600 font-extrabold rounded-xl text-center text-sm border border-rose-200 hover:bg-rose-50 transition-all">
                        無料の試し読みはこちら
                    </a>
                </div>
            </div>
            
            <div class="md:w-2/3 flex flex-col min-w-0 w-full mt-2 md:mt-0">
                <h1 class="text-lg sm:text-xl font-extrabold text-slate-900 mb-4 leading-snug">${article.originalTitle}</h1>
                
                <div class="mb-4">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">主要属性</div>
                    <div class="flex flex-wrap gap-1.5">${mainVisibleBadges}</div>
                </div>

                <div class="mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100 group cursor-pointer transition-all duration-300 hover:bg-rose-50/20 hover:border-rose-100">
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                        <span>公式全性癖属性 (${allTags.length}個)</span>
                        <span class="text-[10px] text-rose-500 font-semibold group-hover:hidden">⏳ タップ・ホバーで全表示</span>
                        <span class="text-[10px] text-slate-400 font-normal hidden group-hover:inline">すべての属性を展開中...</span>
                    </div>
                    <div class="flex flex-wrap gap-1 max-h-7 overflow-hidden group-hover:max-h-[600px] transition-all duration-500 ease-in-out">
                        ${officialBadgesHtml}
                    </div>
                </div>

                <div class="text-slate-700 text-sm leading-relaxed space-y-4 border-t border-rose-50 pt-4">${article.summary}</div>
            </div>
        </article>
    </main>
</body>
</html>`;
}

function generateTagPageHTML(tagName, articles) {
    const cards = articles.map(article => `
        <article class="bg-white rounded-xl shadow-sm border border-rose-100 p-4 flex gap-4 items-center">
            <div class="er-hero-image-wrap shrink-0">
                <a href="${article.link}" target="_blank" rel="noopener" class="w-16 h-24 bg-slate-50 rounded border flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity">
                    <img src="${article.imgUrl}" alt="表紙" class="w-full h-full object-contain p-0.5">
                </a>
            </div>
            <div class="min-w-0 flex-1">
                <h3 class="text-sm font-bold text-slate-900 truncate mb-1">${article.originalTitle}</h3>
                <div class="text-xs text-amber-500 font-bold mb-2">⭐ ${article.reviewRating || '0.0'}</div>
                <div class="er-hero-cta-row flex gap-2">
                    <a href="../posts/${article.id}.html" class="er-hero-cta-secondary px-3 py-1.5 bg-rose-50 text-rose-600 font-bold rounded text-xs border border-rose-100 hover:bg-rose-100 text-center flex-1">🔎 レビュー</a>
                    <a href="${article.link}" target="_blank" rel="noopener" class="er-hero-cta-primary px-3 py-1.5 bg-rose-600 text-white font-bold rounded text-xs hover:bg-rose-700 text-center flex-1">FANZA</a>
                </div>
            </div>
        </article>
    `).join('\n');

    const googleAnalyticsCode = getAnalyticsTag();

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>タグ: ${tagName} のおすすめコミック一覧</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${googleAnalyticsCode}
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <main class="max-w-3xl mx-auto px-4 py-12">
        <a href="../index.html" class="text-xs font-bold text-rose-500 hover:underline">← 総合トップに戻る</a>
        <h1 class="text-xl font-extrabold text-slate-900 mt-4 mb-8 flex items-center gap-2">
            <span class="px-3 py-1 bg-rose-600 text-white rounded-lg text-sm">#</span>
            <span>性癖属性: 「${tagName}」 の一覧（${articles.length}件）</span>
        </h1>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cards}</div>
    </main>
</body>
</html>`;
}

function generateTopPageHTML(articles, displayDate, allTags, siteTitle) {
    const cards = articles.map(article => `
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-4 sm:p-6 flex flex-row gap-4 sm:gap-6 items-center hover:shadow-md transition-all">
            <div class="er-hero-image-wrap shrink-0">
                <a href="${article.link}" target="_blank" rel="noopener" class="w-20 h-28 sm:w-24 sm:h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center hover:opacity-90 transition-opacity">
                    <img src="${article.imgUrl}" alt="表紙" class="w-full h-full object-contain p-1">
                </a>
            </div>
            <div class="flex flex-col min-w-0 flex-1">
                <h3 class="text-sm sm:text-base font-bold text-slate-900 truncate mb-1">${article.originalTitle}</h3>
                <div class="text-xs text-slate-500 flex items-center gap-1 mb-2">
                    <span class="text-amber-500 font-bold">⭐ ${article.reviewRating || '0.0'}</span>
                    <span>(${article.reviewCount || '0'}件)</span>
                </div>
                <div class="flex flex-wrap gap-1 mb-3">
                    ${(article.tags || []).slice(0, 4).map(t => `<span class="text-[9px] sm:text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">#${t}</span>`).join('')}
                </div>
                <div class="er-hero-cta-row flex gap-2">
                    <a href="posts/${article.id}.html" class="er-hero-cta-secondary px-3 sm:px-4 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg text-[11px] sm:text-xs border border-rose-200 hover:bg-rose-100 text-center flex-1">🔎 レビュー</a>
                    <a href="${article.link}" target="_blank" rel="noopener" class="er-hero-cta-primary px-3 sm:px-4 py-2 bg-rose-600 text-white font-bold rounded-lg text-[11px] sm:text-xs hover:bg-rose-700 text-center flex-1">FANZA</a>
                </div>
            </div>
        </article>
    `).join('\n');

    const tagCloudLinks = allTags.map(tag => `
        <li>
            <a href="tags/${tag}.html" class="inline-block m-1 px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-all rounded-lg text-xs font-medium border border-rose-100">
                🏷️ ${tag}
            </a>
        </li>
    `).join('\n');

    const googleAnalyticsCode = getAnalyticsTag();

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteTitle} - 羞恥専門成人向けレビューまとめ</title>
    <script src="https://cdn.tailwindcss.com"></script>
    ${googleAnalyticsCode}
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-12 px-4 text-center">
        <h1 class="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-300">🔞 ${siteTitle}</h1>
        <p class="mt-2 text-xs text-rose-300 font-light">言葉責め・公開羞恥に特化した大容量データベース型レビューメディア。</p>
        <div class="mt-2 text-[10px] text-rose-400">最終更新: ${displayDate}</div>
    </header>
    <main class="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-4">
                <h2 class="text-lg font-bold text-slate-900 mb-4">最新の濃厚レビュー一覧</h2>
                ${cards}
            </div>
            <div class="lg:col-span-1">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-rose-50 sticky top-6">
                    <h2 class="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-rose-100">性癖属性（タグ一覧）</h2>
                    <ul class="flex flex-wrap -m-1">${tagCloudLinks.length > 0 ? tagCloudLinks : '<li class="text-xs text-slate-400 py-2">タグはまだありません。</li>'}</ul>
                </div>
            </div>
        </div>
    </main>
</body>
</html>`;
}

module.exports = { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML };