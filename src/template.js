function generateSinglePostHTML(article, siteTitle) {
    const tagBadges = article.tags.map(t => `<a href="../tags/${t}.html" class="bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded-full text-xs font-bold hover:bg-rose-100 transition-all"># ${t}</a>`).join(' ');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.originalTitle} - レビュー | ${siteTitle}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-6 px-4 border-b border-rose-950">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <a href="../index.html" class="text-sm font-bold text-rose-400 hover:text-rose-300">← ${siteTitle} トップへ</a>
            <span class="text-xs font-bold text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">18+ ONLY</span>
        </div>
    </header>
    <main class="max-w-4xl mx-auto px-4 py-12">
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 sm:p-10 flex flex-col md:flex-row gap-8 items-start">
            <div class="md:w-1/3 sticky top-6 self-start space-y-4 shrink-0 w-full">
                <div class="bg-slate-50 flex items-center justify-center rounded-xl border border-slate-200 overflow-hidden min-h-[300px]">
                    <img src="${article.imgUrl}" alt="表紙" class="w-full h-full object-contain p-2">
                </div>
                <div class="flex flex-col gap-2">
                    <a href="${article.link}" class="w-full py-3 bg-rose-600 text-white font-bold rounded-lg text-center text-sm shadow-md hover:bg-rose-700">🔞 今すぐ読む</a>
                    <a href="${article.sampleReadLink}" class="w-full py-3 bg-white text-rose-600 font-bold rounded-lg text-center text-sm border border-rose-200 hover:bg-rose-50">👀 試し読み</a>
                </div>
            </div>
            <div class="md:w-2/3 flex flex-col min-w-0">
                <h1 class="text-2xl font-extrabold text-slate-900 mb-2 leading-snug">${article.originalTitle}</h1>
                <div class="flex flex-wrap gap-2 mb-6">${tagBadges}</div>
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
            <img src="${article.imgUrl}" alt="表紙" class="w-16 h-24 object-contain rounded border bg-slate-50 shrink-0">
            <div class="min-w-0 flex-1">
                <h3 class="text-sm font-bold text-slate-900 truncate mb-2">${article.originalTitle}</h3>
                <div class="flex gap-2">
                    <a href="../posts/${article.id}.html" class="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold rounded text-xs border border-rose-100 hover:bg-rose-100">🔎 レビュー</a>
                    <a href="${article.link}" class="px-3 py-1.5 bg-rose-600 text-white font-bold rounded text-xs hover:bg-rose-700">🔞 FANZA</a>
                </div>
            </div>
        </article>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>タグ: ${tagName} のおすすめ羞恥コミック一覧</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 flex flex-row gap-6 items-center hover:shadow-md transition-all">
            <div class="w-24 h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center">
                <img src="${article.imgUrl}" alt="表紙" class="w-full h-full object-contain p-1">
            </div>
            <div class="flex flex-col min-w-0 flex-1">
                <h3 class="text-base font-bold text-slate-900 truncate mb-1">${article.originalTitle}</h3>
                <div class="flex flex-wrap gap-1 mb-3">
                    ${article.tags.map(t => `<span class="text-[10px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">#${t}</span>`).join('')}
                </div>
                <div class="flex gap-2">
                    <a href="posts/${article.id}.html" class="px-4 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg text-xs border border-rose-200 hover:bg-rose-100 text-center">🔎 濃厚レビューを読む</a>
                    <a href="${article.link}" class="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg text-xs hover:bg-rose-700 text-center">🔞 FANZA</a>
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

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${siteTitle} - 羞恥専門成人向けレビューまとめ</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-12 px-4 text-center">
        <h1 class="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-300">🔞 ${siteTitle}</h1>
        <p class="mt-2 text-xs text-rose-300 font-light">言葉責め・公開羞恥に特化した究極のデータベース型レビューメディア。</p>
        <div class="mt-2 text-[10px] text-rose-400">最終更新: ${displayDate}</div>
    </header>
    <main class="max-w-6xl mx-auto px-4 py-12">
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