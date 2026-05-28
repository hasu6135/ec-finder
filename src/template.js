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

/**
 * 🔒 【超強力アドブロック対策】
 * ブロッカーの文字列スキャンを回避するため、URLを一時的にBase64で暗号化（隠蔽）する関数
 */
function encryptStr(str) {
    if (!str) return '';
    return Buffer.from(str).toString('base64');
}

/**
 * 🚀 【全ページ共通】
 * 暗号化された画像とURLを、ブラウザ上でアドブロックをすり抜けて復元・注入するスクリプト
 */
function getBypassScript() {
    return `
    <script>
    document.addEventListener("DOMContentLoaded", function() {
        // Base64を復元するヘルパー
        function decode(b64) {
            try { return decodeURIComponent(escape(atob(b64))); } catch(e) { return ""; }
        }
        
        // 1. すべての隠蔽リンク（クラス: er-safe-lnk）を復元
        document.querySelectorAll(".er-safe-lnk").forEach(function(el) {
            var rawLurl = decode(el.getAttribute("data-enc-lurl") || "");
            var afId = el.getAttribute("data-enc-af") || "132815-001";
            if (rawLurl) {
                var perfectUrl = "https://al.fanza.co.jp/?lurl=" + encodeURIComponent(rawLurl) + "&af_id=" + afId + "&ch=api";
                el.setAttribute("href", perfectUrl);
            }
        });

        // 2. すべての隠蔽画像（クラス: er-safe-img）を復元
        document.querySelectorAll(".er-safe-img").forEach(function(el) {
            var srcUrl = decode(el.getAttribute("data-enc-src") || "");
            if (srcUrl) {
                el.setAttribute("src", srcUrl);
            }
        });
    });
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
    const bypassScript = getBypassScript();

    let rawLurl = '';
    try {
        const u = new URL(article.link);
        rawLurl = u.searchParams.get('lurl') || article.link;
    } catch(e) {
        rawLurl = article.link;
    }

    const encLurl = encryptStr(rawLurl);
    const encImg = encryptStr(article.imgUrl);

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
                
                <a class="er-safe-lnk" data-enc-lurl="${encLurl}" data-enc-af="132815-990" rel="nofollow noopener" target="_blank" style="display:inline-block;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;width:100%;text-align:center;padding:8px;text-decoration:none;cursor:pointer;">
                    <img class="er-safe-img" data-enc-src="${encImg}" alt="表紙" style="display:inline-block;max-width:100%;height:auto;max-height:350px;object-fit:contain;vertical-align:middle;border:none;">
                </a>
                
                <div class="bg-rose-50/50 border border-rose-100 p-3 rounded-xl text-center w-full block">
                    <div class="text-xs font-bold text-rose-900 mb-1">ユーザー評価</div>
                    <div class="flex items-center justify-center gap-1">
                        <span class="text-lg">${starIcons}</span>
                        <span class="text-base font-extrabold text-slate-800 ml-1">${article.reviewRating}</span>
                        <span class="text-xs text-slate-400">(${article.reviewCount}件)</span>
                    </div>
                </div>

                <div style="display:block;width:100%;margin-top:8px;">
                    <a class="er-safe-lnk" data-enc-lurl="${encLurl}" data-enc-af="132815-990" rel="nofollow noopener" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#e84393,#fd79a8);color:#fff;padding:12px 20px;border-radius:25px;font-size:14px;font-weight:bold;text-decoration:none;margin-top:8px;width:100%;text-align:center;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);cursor:pointer;">
                        FANZAで見る →
                    </a>
                    <a href="${article.sampleReadLink}" rel="nofollow noopener" target="_blank" style="display:inline-block;background:#fff;color:#e84393;padding:11px 20px;border-radius:25px;font-size:14px;font-weight:bold;text-decoration:none;margin-top:8px;width:100%;text-align:center;border:1px solid #fd79a8;">
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
    ${bypassScript}
</body>
</html>`;
}

function generateTagPageHTML(tagName, articles) {
    const cards = articles.map(article => {
        let rawLurl = '';
        try { const u = new URL(article.link); rawLurl = u.searchParams.get('lurl') || article.link; } catch(e) { rawLurl = article.link; }
        
        const encLurl = encryptStr(rawLurl);
        const encImg = encryptStr(article.imgUrl);

        return `
        <article class="bg-white rounded-xl shadow-sm border border-rose-100 p-3 flex gap-3 items-center">
            <div style="flex-shrink:0;width:32%;max-width:100px;aspect-ratio:3/4;">
                <a class="er-safe-lnk" data-enc-lurl="${encLurl}" data-enc-af="132815-990" rel="nofollow noopener" target="_blank" style="display:inline-block;width:100%;height:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;text-align:center;text-decoration:none;cursor:pointer;">
                    <img class="er-safe-img" data-enc-src="${encImg}" alt="表紙" style="width:100%;height:100%;object-fit:contain;padding:2px;border:none;">
                </a>
            </div>
            <div class="min-w-0 flex-1 flex flex-col justify-between self-stretch py-0.5">
                <div>
                    <h3 class="text-sm font-bold text-slate-900 leading-snug mb-1 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${article.originalTitle}</h3>
                    <div class="text-xs text-amber-500 font-bold mb-1">⭐ ${article.reviewRating || '0.0'}</div>
                </div>
                <div class="flex flex-col sm:flex-row gap-1.5 items-stretch sm:items-center w-full mt-1">
                    <a href="../posts/${article.id}.html" class="px-2 py-1.5 bg-rose-50 text-rose-600 font-bold rounded text-[11px] border border-rose-100 hover:bg-rose-100 text-center flex-1">🔎 レビュー</a>
                    <a class="er-safe-lnk" data-enc-lurl="${encLurl}" data-enc-af="132815-990" rel="nofollow noopener" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#e84393,#fd79a8);color:#fff;padding:6px 10px;border-radius:25px;font-size:11px;font-weight:bold;text-decoration:none;text-align:center;cursor:pointer;" class="flex-1">FANZA</a>
                </div>
            </div>
        </article>
        `;
    }).join('\n');

    const googleAnalyticsCode = getAnalyticsTag();
    const bypassScript = getBypassScript();

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
    ${bypassScript}
</body>
</html>`;
}

function generateTopPageHTML(articles, displayDate, allTags, siteTitle) {
    const cards = articles.map(article => {
        let rawLurl = '';
        try { const u = new URL(article.link); rawLurl = u.searchParams.get('lurl') || article.link; } catch(e) { rawLurl = article.link; }
        
        const encLurl = encryptStr(rawLurl);
        const encImg = encryptStr(article.imgUrl);

        return `
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-3 flex flex-row gap-3 items-center hover:shadow-md transition-all">
            <!-- 【トップページ】スマホ画面幅のきっちり半分（50%）をイラストに使用 -->
            <div style="flex-shrink:0;width:50%;max-width:160px;aspect-ratio:3/4;">
                <a class="er-safe-lnk" data-enc-lurl="${encLurl}" data-enc-af="132815-990" rel="nofollow noopener" target="_blank" style="display:inline-block;width:100%;height:100%;background:#f8fafc;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden;text-align:center;text-decoration:none;cursor:pointer;">
                    <img class="er-safe-img" data-enc-src="${encImg}" alt="表紙" style="width:100%;height:100%;object-fit:contain;padding:4px;border:none;">
                </a>
            </div>
            <!-- 右側テキストセクション（残り50%） -->
            <div class="flex flex-col min-w-0 flex-1 justify-between self-stretch py-0.5">
                <div>
                    <h3 class="text-xs sm:text-base font-bold text-slate-900 leading-snug mb-1 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${article.originalTitle}</h3>
                    <div class="text-[11px] text-slate-500 flex items-center gap-1 mb-1">
                        <span class="text-amber-500 font-bold">⭐ ${article.reviewRating || '0.0'}</span>
                        <span class="hidden sm:inline">(${article.reviewCount || '0'}件)</span>
                    </div>
                    <div class="flex flex-wrap gap-1 mb-2 hidden sm:flex">
                        ${(article.tags || []).slice(0, 4).map(t => `<span class="text-[9px] bg-slate-50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-100">#${t}</span>`).join('')}
                    </div>
                </div>
                <!-- 50%の幅でも絶対に崩れない縦並びミニマルボタン -->
                <div class="flex flex-col sm:flex-row gap-1.5 items-stretch w-full">
                    <a href="posts/${article.id}.html" class="py-1.5 bg-rose-50 text-rose-600 font-bold rounded-lg text-[10px] sm:text-xs border border-rose-200 hover:bg-rose-100 text-center flex-1">🔎 レビュー</a>
                    <a class="er-safe-lnk" data-enc-lurl="${encLurl}" data-enc-af="132815-990" rel="nofollow noopener" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#e84393,#fd79a8);color:#fff;padding:6px 12px;border-radius:25px;font-size:10px;font-weight:bold;text-decoration:none;text-align:center;line-height:16px;cursor:pointer;" class="flex-1">FANZAで見る</a>
                </div>
            </div>
        </article>
        `;
    }).join('\n');

    const tagCloudLinks = allTags.map(tag => `
        <li>
            <a href="tags/${tag}.html" class="inline-block m-1 px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition-all rounded-lg text-xs font-medium border border-rose-100">
                🏷️ ${tag}
            </a>
        </li>
    `).join('\n');

    const googleAnalyticsCode = getAnalyticsTag();
    const bypassScript = getBypassScript();

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
    ${bypassScript}
</body>
</html>`;
}

module.exports = { generateSinglePostHTML, generateTagPageHTML, generateTopPageHTML };