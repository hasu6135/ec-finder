const puppeteer = require('puppeteer'); 
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios'); 
const { JSDOM } = require('jsdom'); 

/**
 * ===================================================
 * ⚙️ 各種設定・定数管理
 * ===================================================
 */
const SITE_TITLE = '羞恥系コミック';
const FETCH_COUNT = 2; // タグ分類を検証するため5件に増やします
const ARCHIVE_DIR = 'archive';
const TAGS_DIR = 'tags'; // 追加：タグページ用フォルダ

const DMM_API_ID = 'w3pxtk1rrTgpNCQ7JzcU'; 
const DMM_AFFILIATE_ID = '132815-001'; 

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

/**
 * ===================================================
 * 🔍 DMMの作品個別ページからスクレイピング
 * ===================================================
 */
async function scrapeDmmProductDetail(affiliateUrl) {
    let browser;
    try {
        const urlObj = new URL(affiliateUrl);
        let rawUrl = urlObj.searchParams.get('lurl') || affiliateUrl;
        rawUrl = decodeURIComponent(rawUrl);
        
        if (rawUrl.includes('published.fanza.co.jp') || rawUrl.includes('book.fanza.co.jp')) {
            rawUrl = rawUrl.replace('published.fanza.co.jp', 'book.dmm.co.jp').replace('book.fanza.co.jp', 'book.dmm.co.jp');
        }

        console.log(`🔍 本物のブラウザ(Puppeteer)で詳細ページを起動中...`);
        
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setCookie(
            { name: 'age_check_done', value: '1', domain: '.dmm.co.jp', path: '/' },
            { name: 'r18', value: '1', domain: '.dmm.co.jp', path: '/' },
            { name: 'g_device', value: 'pc', domain: '.dmm.co.jp', path: '/' }
        );

        await page.goto(rawUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        
        console.log(` 📜 レビューと作品紹介を読み込むため、ページを自動スクロール中...`);
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 500;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 6000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        const rawHtml = await page.content();
        const dom = new JSDOM(rawHtml);
        const doc = dom.window.document;

        let userReviews = [];
        let productDescription = '';
        let realTachiyomiUrl = '';

        const descElem = doc.querySelector('[data-testid="description-text"]') || doc.querySelector('.sc-ef68d909-1');
        if (descElem) {
            productDescription = descElem.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        }

        const nicknames = doc.querySelectorAll('[data-testid="nickname"]');
        nicknames.forEach(nick => {
            const reviewBox = nick.closest('div');
            if (reviewBox && reviewBox.parentElement) {
                const pTxt = reviewBox.parentElement.querySelector('p');
                if (pTxt) {
                    const text = pTxt.textContent.trim().replace(/\s+/g, ' ');
                    if (text && text.length > 5 && !userReviews.includes(text)) {
                        userReviews.push(text);
                    }
                }
            }
        });

        const tachiyomiLinkElem = doc.querySelector('a[href*="/tachiyomi/"]');
        if (tachiyomiLinkElem) {
            realTachiyomiUrl = tachiyomiLinkElem.getAttribute('href');
            if (!realTachiyomiUrl.startsWith('http')) {
                realTachiyomiUrl = 'https://book.dmm.co.jp' + realTachiyomiUrl;
            }
        }

        await browser.close();

        const filteredReviews = userReviews.filter(r => {
            if (r.includes('作品の内容に関する記述が含まれています') || r.includes('ネタバレ')) return false;
            if (r.includes('特定商取引法') || r.includes('ご利用規約') || r.includes('ポイント')) return false;
            if (r.length < 10 || r.length > 400) return false;
            return true;
        });

        const reviewSummary = filteredReviews.slice(0, 3).join('\n---\n');
        
        return {
            userReviews: reviewSummary || '（ネタバレなしレビューなし）',
            productDescription: productDescription || '（作品紹介なし）',
            sampleImages: [],
            tachiyomiUrl: realTachiyomiUrl 
        };

    } catch (error) {
        if (browser) await browser.close();
        console.error('⚠️ 詳細ページの解析に失敗しました:', error.message);
        return { userReviews: '', productDescription: '', sampleImages: [], tachiyomiUrl: '' };
    }
}

/**
 * 📦 DMM Web Service API からデータを取得する（公式キーワードも取得）
 * ===================================================
 */
async function fetchDmmProducts() {
    try {
        const finalAffiliateId = DMM_AFFILIATE_ID.endsWith('-001') ? DMM_AFFILIATE_ID.replace('-001', '-990') : DMM_AFFILIATE_ID;

        console.log('📡 DMM APIへリクエストを送信中...');
        const response = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
            params: {
                api_id: DMM_API_ID,
                affiliate_id: finalAffiliateId,
                site: 'FANZA',  
                service: 'ebook',
                floor: 'comic',
                keyword: '羞恥', 
                hits: FETCH_COUNT,       
                sort: 'rank'             
            }
        });

        if (!response.data.result || !response.data.result.items) return [];

        return response.data.result.items.map(item => {
            const encodedRawUrl = encodeURIComponent(item.URL);
            const perfectAffiliateUrl = `https://al.fanza.co.jp/?lurl=${encodedRawUrl}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`;

            // 公式のジャンルタグ（キーワード）配列を取得
            const officialKeywords = item.iteminfo?.keyword ? item.iteminfo.keyword.map(k => k.name) : [];

            return {
                title: item.title,
                url: perfectAffiliateUrl, 
                imageUrl: item.imageURL?.large || item.imageURL?.list,
                officialKeywords: officialKeywords // 追加
            };
        });

    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}

function parseMarkdownTableToHtml(text) {
    let cleanedText = text.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>').replace(/\n{3,}/g, '\n\n');
    const lines = cleanedText.split('\n');
    let inTable = false;
    let htmlOutput = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!inTable && line === '') continue;

        if (line.startsWith('|') && line.endsWith('|')) {
            const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (line.includes('---')) continue;

            if (!inTable) {
                inTable = true;
                htmlOutput.push('<div class="overflow-x-auto my-2 shadow-sm border border-rose-100 rounded-xl"><table class="min-w-full divide-y divide-rose-100 text-sm text-left"><thead class="bg-rose-50 text-rose-900 font-bold"><tr>');
                cells.forEach(cell => htmlOutput.push(`<th class="px-4 py-3">${cell}</th>`));
                htmlOutput.push('</tr></thead><tbody class="divide-y divide-rose-50 bg-white text-slate-700">');
            } else {
                htmlOutput.push('<tr class="hover:bg-slate-50/50 transition-colors">');
                cells.forEach(cell => htmlOutput.push(`<td class="px-4 py-3 font-medium">${cell}</td>`));
                htmlOutput.push('</tr>');
            }
        } else {
            if (inTable) {
                inTable = false;
                htmlOutput.push('</tbody></table></div>');
            }
            if (line.length > 0) htmlOutput.push(`<p class="mb-4">${line}</p>`);
        }
    }
    if (inTable) htmlOutput.push('</tbody></table></div>');
    return htmlOutput.join('\n');
}

function generateSafeId(title) {
    return title.replace(/[\/\\:\*\?"<>\|]/g, '').replace(/\s+/g, '_').substring(0, 50);
}

/**
 * ===================================================
 * 🚀 メイン処理（タグ完全自動管理版）
 * ===================================================
 */
async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');
        if (!fs.existsSync(TAGS_DIR)) fs.mkdirSync(TAGS_DIR); // tagsフォルダ作成

        const products = await fetchDmmProducts();
        if (products.length === 0) {
            console.log('⚠️ 作品データが0件のため終了します。');
            return;
        }

        const summarizedArticles = [];
        const tagMap = new Map(); // タグごとの記事を分類するマップ

        console.log(`🤖 LM Studioによるタグ自動パース付きレビュー執筆を開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`\n[${i + 1}/${products.length}] ターゲット: ${product.title}`);
            const detailData = await scrapeDmmProductDetail(product.url);

            try {
                // AIに公式タグも参考データとして渡す
                const response = await openai.chat.completions.create({
                    model: 'loading-model', 
                    messages: [
                        { 
                            role: 'system', 
                            content: `あなたは成人向けマンガの紹介で爆発的な人気を誇る「エロ同人ソムリエ」です。
与えられた作品情報から狂気的なほど熱量の高い紹介記事を執筆してください。

【重要：出力フォーマットの厳守】
あなたの出力の最後に、必ず以下の形式で【作品に最も適合する性癖タグ（3〜5個）】をJSON形式で1行で出力してください。これ以外の文字をJSONの行に混ぜないでください。
TAG_JSON: ["公開羞恥", "言葉責め", "拘束"]

【執筆ルール】
1. タイトルは読者が悶絶する強烈にキャッチーなものを1行目に。
2. 本文には <b>太字</b> やピンクハイライト（<mark class="bg-rose-100 text-rose-900 px-1 rounded">文章</mark>）を積極的に使用。
3. Markdownの記号（#や**など）はバグの原因になるため一切禁止。`
                        },
                        { 
                            role: 'user', 
                            content: `【作品タイトル】\n${product.title}\n\n【公式ジャンル】\n${product.officialKeywords.join(', ')}\n\n【公式あらすじ】\n${detailData.productDescription}\n\n【購入者の口コミ】\n${detailData.userReviews}` 
                        }
                    ],
                    temperature: 0.75 
                });

                let rawContent = response.choices[0].message.content;

                // 💡AIの出力からTAG_JSONの行を分離して解析する
                let tags = ["羞恥系"]; // フォールバック用初期タグ
                const jsonMatch = rawContent.match(/TAG_JSON:\s*(\[.*?\])/);
                if (jsonMatch) {
                    try {
                        tags = JSON.parse(jsonMatch[1]);
                        // 元の文章からJSON部分を綺麗に削る
                        rawContent = rawContent.replace(/TAG_JSON:.*$/, '').trim();
                    } catch (e) {
                        console.log("⚠️ AIのタグJSONパースに失敗しました。公式キーワードを使用します。");
                        if (product.officialKeywords.length > 0) tags = product.officialKeywords.slice(0, 4);
                    }
                }

                let summary = rawContent.replace(/```html/g, '').replace(/```/g, '').replace(/##+/g, '').replace(/\*\*/g, '').replace(/---+/g, '').replace(/#/g, '').trim();
                const tableParsedSummary = parseMarkdownTableToHtml(summary);
                const formattedSummary = tableParsedSummary.replace(/\n/g, '<br>');

                let perfectSampleReadLink = detailData.tachiyomiUrl 
                    ? `https://al.fanza.co.jp/?lurl=${encodeURIComponent(detailData.tachiyomiUrl)}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`
                    : product.url;

                const articleId = generateSafeId(product.title);
                const articleData = {
                    id: articleId,
                    originalTitle: product.title,
                    link: product.url,
                    imgUrl: product.imageUrl,
                    summary: formattedSummary,
                    sampleReadLink: perfectSampleReadLink,
                    tags: tags // タグ配列を格納
                };

                // 各記事の個別HTMLページを生成して保存（個別ページにもタグを表示させる）
                const postHtml = generateSinglePostHTML(articleData);
                fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtml, 'utf-8');

                // 全体リストとタグマップへ追加
                summarizedArticles.push(articleData);
                tags.forEach(tag => {
                    if (!tagMap.has(tag)) tagMap.set(tag, []);
                    tagMap.get(tag).push(articleData);
                });

                console.log(`✅ レビュー執筆＆タグ付け完了: [${tags.join(', ')}]`);

            } catch (itemError) {
                console.error(`⚠️ エラーのためスキップ:`, itemError.message);
            }
        }

        const todayObj = new Date();
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // 💡【新機能】各タグごとの一覧インデックスページを自動生成する
        console.log(`📂 タグ別一覧ページの全自動生成を開始...`);
        for (const [tagName, articles] of tagMap.entries()) {
            const tagHtml = generateTagPageHTML(tagName, articles);
            fs.writeFileSync(path.join(TAGS_DIR, `${tagName}.html`), tagHtml, 'utf-8');
            console.log(`🏷️  tags/${tagName}.html を生成しました（該当: ${articles.length}件）`);
        }

        // トップページの更新（全タグのリストもサイドバーに渡す）
        const allAvailableTags = Array.from(tagMap.keys());
        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, allAvailableTags);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての個別ページ、タグ別一覧、トップページの同期が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

/**
 * ===================================================
 * 📄 テンプレート：個別記事（タグ表示対応）
 * ===================================================
 */
function generateSinglePostHTML(article) {
    const tagBadges = article.tags.map(t => `<a href="../tags/${t}.html" class="bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded-full text-xs font-bold hover:bg-rose-100 transition-all"># ${t}</a>`).join(' ');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.originalTitle} - レビュー | ${SITE_TITLE}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-6 px-4 border-b border-rose-950">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <a href="../index.html" class="text-sm font-bold text-rose-400 hover:text-rose-300">← ${SITE_TITLE} トップへ</a>
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
                <div class="text-slate-700 text-sm leading-relaxed space-y-4 border-t border-rose-50 pt-4">
                    ${article.summary}
                </div>
            </div>
        </article>
    </main>
</body>
</html>
    `;
}

/**
 * ===================================================
 * 📄 ⚠️新追加テンプレート：タグ別一覧ページ専用レイアウト
 * ===================================================
 */
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
    <title>タグ: ${tagName} のおすすめ羞恥コミック一覧 | ${SITE_TITLE}</title>
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
</html>
    `;
}

/**
 * ===================================================
 * 📄 テンプレート：トップページ（タグクラウド連携版）
 * ===================================================
 */
function generateTopPageHTML(articles, displayDate, allTags) {
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

    // サイドバーに表示するタグ一覧（タグクラウド）
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
    <title>${SITE_TITLE} - 羞恥専門成人向けレビューまとめ</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-12 px-4 text-center">
        <h1 class="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-pink-300">🔞 ${SITE_TITLE}</h1>
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
                    <ul class="flex flex-wrap -m-1">
                        ${tagCloudLinks.length > 0 ? tagCloudLinks : '<li class="text-xs text-slate-400 py-2">タグはまだありません。</li>'}
                    </ul>
                </div>
            </div>
        </div>
    </main>
</body>
</html>
    `;
}

main();