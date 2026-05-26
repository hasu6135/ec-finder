const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios'); 
const { JSDOM } = require('jsdom'); // 💡 詳細ページ解析用のライブラリを追加

/**
 * ===================================================
 * ⚙️ 各種設定・定数管理
 * ===================================================
 */
const SITE_TITLE = '羞恥系コミック';
const FETCH_COUNT = 1; // 最初はテスト用に1件
const ARCHIVE_DIR = 'archive';

const DMM_API_ID = 'w3pxtk1rrTgpNCQ7JzcU'; 
const DMM_AFFILIATE_ID = '132815-001'; // 👈 自動で末尾-990に変換する処理を入れました

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

/**
 * ===================================================
 * 🔍 DMMの作品個別ページからレビューとサンプル画像を抽出する関数
 * ===================================================
 */
async function scrapeDmmProductDetail(affiliateUrl) {
    try {
        // 💡 魔法の逆算処理：アフィリエイトURLから生のDMM/FANZA商品ページURLを取り出す
        const urlObj = new URL(affiliateUrl);
        let rawUrl = urlObj.searchParams.get('lurl'); // 転送先の生URLを抽出

        if (!rawUrl) {
            console.log('⚠️ 生のURLが抽出できなかったため、アフィURLで直接試みます。');
            rawUrl = affiliateUrl;
        } else {
            rawUrl = decodeURIComponent(rawUrl); // 安全のためにデコード
        }

        console.log(`🔍 生の作品ページを詳細分析中...: ${rawUrl}`);
        
        // DMMの年齢認証（R18クッキー）をエミュレートしてアクセス
        const response = await axios.get(rawUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': 'age_check_done=1' // 💡 これがないと年齢確認画面に飛ばされて400や404になることがあります
            }
        });
        
        const dom = new JSDOM(response.data);
        const doc = dom.window.document;

        // 1. 購入者のレビュー（口コミ）のテキストを抽出
        const reviewElements = doc.querySelectorAll('.review__text, .commentBox, .comment, .d-review__list__comment'); 
        let userReviews = [];
        reviewElements.forEach(el => {
            const text = el.textContent.trim();
            if (text.length > 10) userReviews.push(text);
        });
        const reviewSummary = userReviews.slice(0, 3).join('\n---\n');

        // 2. サンプル画像（チラ見せ画像）のURLをすべて抽出
        // 同人誌（digital_doujin）のサンプル画像用セレクターに対応
        const sampleImgElements = doc.querySelectorAll('.sample-preview img, img[src*="pr.jpg"], img[src*="-sample"], .d-item-thumb-list img');
        let sampleImages = [];
        sampleImgElements.forEach(img => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy');
            if (src) {
                // サムネイルを拡大画像のURLパターンに変換
                if (src.includes('pt.jpg')) src = src.replace('pt.jpg', 'pl.jpg'); 
                if (src.includes('js-')) src = src.replace('js-', ''); // 同人特有の文字置換
                if (!src.startsWith('http')) src = 'https:' + src;
                if (!sampleImages.includes(src)) sampleImages.push(src);
            }
        });

        console.log(` └ 💬 参考レビューを取得: ${userReviews.length}件`);
        console.log(` └ 📸 サンプル画像を検出: ${sampleImages.length}枚`);

        return {
            userReviews: reviewSummary || '（まだ購入者レビューがありません。あらすじから妄想してください）',
            sampleImages: sampleImages
        };

    } catch (error) {
        console.error('⚠️ 詳細ページの解析に失敗しました（スキップします）:', error.message);
        return { userReviews: '（レビュー取得エラー）', sampleImages: [] };
    }
}

/**
 * ===================================================
 * 📦 DMM Web Service API からデータを取得する関数
 * ===================================================
 */
async function fetchDmmProducts() {
    try {
        // 安全対策：アフィリエイトIDの末尾が「-001」などの場合、自動でAPI専用の「-990」に補正
        const finalAffiliateId = DMM_AFFILIATE_ID.endsWith('-001') 
            ? DMM_AFFILIATE_ID.replace('-001', '-990') 
            : DMM_AFFILIATE_ID;

        const encodedKeyword = encodeURIComponent();

        console.log('📡 DMM APIへリクエストを送信中（人気順）...');
        const response = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
            params: {
                api_id: DMM_API_ID,
                affiliate_id: finalAffiliateId,
                site: 'FANZA',           
                floor: 'ebook',
                keyword: '羞恥 同人誌', 
                hits: FETCH_COUNT,       
                sort: 'rank'             
            }
        });

        if (!response.data.result || !response.data.result.items) {
            return [];
        }

        return response.data.result.items.map(item => ({
            title: item.title,
            url: item.affiliateURL, 
            imageUrl: item.imageURL?.large || item.imageURL?.list,
            description: item.description || ''
        }));

    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}

/**
 * ===================================================
 * 🚀 メイン処理
 * ===================================================
 */
async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)){
            fs.mkdirSync(ARCHIVE_DIR);
        }

        const products = await fetchDmmProducts();
        if (products.length === 0) {
            console.log('⚠️ 取得できた作品データが0件のため終了します。');
            return;
        }

        const summarizedArticles = [];
        console.log(`🤖 LM Studio(Qwen)による、生レビューを反映した超濃厚レビュー執筆を開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`\n[${i + 1}/${products.length}] ターゲット作品: ${product.title}`);

            // 💡 拡張ステップ：詳細ページへ行ってレビューとサンプル画像を引っこ抜く
            const detailData = await scrapeDmmProductDetail(product.url);

            try {
                const response = await openai.chat.completions.create({
                    model: 'loading-model',
                    messages: [
                        { 
                            role: 'system', 
                            content: `あなたは成人向けマンガ・同人誌の紹介で爆発的な人気を誇る「エロ同人ソムリエ（天才ライター）」です。与えられた作品タイトル、公式のあらすじ、そして【実際に購入したユーザーの生レビュー（口コミ）】を徹底的に分析し、その作品が持つ「羞恥シチュエーション（公開羞恥、言葉責め、モブ視線、尊厳破壊など）」のどこが読者に刺さっているのかを反映した、狂気的なほど熱量の高い紹介記事（日本語）を執筆してください。

以下の【執筆ルール】を限界まで遵守すること：
1. 【タイトルは『一撃で理性を吹き飛ばすフック』にせよ】
   - 機械的なラベル（「分析結果：」など）は絶対に出力禁止。読者が悶絶してクリックしてしまう、強烈にキャッチーな日本語タイトルを1行目で作ること。
2. 【レビューは『実際の読者の興奮ポイント』を突き、HTMLで飾れ】
   - 与えられたユーザーの生口コミの内容（例：「○○のシーンの赤面が最高」「言葉責めが抜ける」など）の要素をレビュー内に自然に溶け込ませ、「実際に読んだ人が絶賛しているポイント」として熱弁してください。
   - 適切な改行を挟み、以下のHTMLタグを文章中に【必ず積極的かつ効果的に】散りばめること：
     * 最も興奮する属性キーワード： <b>太字</b>
     * 妄想を加速させる最高にエロい一言： <mark class="bg-rose-100 text-rose-900 px-1 rounded">ピンクのハイライト</mark>
     * 作品の「抜きどころ」を整理する際： <ul>と<li>を使ったリスト形式（先頭に🔞, 💦, 💋 などの絵文字を1つ入れる）
3. 【Markdown記号の完全排除】
   - 「#」や「##」、「**」、「---」といったMarkdown記号、および「\`\`\`」のようなコードブロック記号はWebサイトのバグになるため使用一切禁止。`
                        },
                        { 
                            role: 'user', 
                            content: `【作品タイトル】\n${product.title}\n\n【公式あらすじ】\n${product.description}\n\n【購入者の生の口コミ・レビュー】\n${detailData.userReviews}` 
                        }
                    ],
                    temperature: 0.75 
                });

                let summary = response.choices[0].message.content;

                // 安全装置：余計な記号を徹底削除
                summary = summary
                    .replace(/```html/g, '').replace(/```/g, '').replace(/##+/g, '').replace(/\*\*/g, '').replace(/---+/g, '').replace(/#/g, '').trim();

                const formattedSummary = summary.replace(/\n/g, '<br>');

                summarizedArticles.push({
                    originalTitle: product.title,
                    link: product.url,
                    imgUrl: product.imageUrl,
                    summary: formattedSummary,
                    sampleImages: detailData.sampleImages // 💡 サンプル画像の配列を格納
                });

                console.log(`✅ [${i + 1}/${products.length}] レビューの執筆が完了しました！`);

            } catch (itemError) {
                console.error(`⚠️ エラーのためスキップ:`, itemError.message);
            }
        }

        const todayObj = new Date();
        const dateStr = todayObj.toISOString().split('T')[0];
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        const archiveHtml = generateTopPageHTML(summarizedArticles, displayDate, [], true);
        fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateStr}.html`), archiveHtml, 'utf-8');

        const archiveFiles = fs.readdirSync(ARCHIVE_DIR).filter(file => file.endsWith('.html')).map(file => file.replace('.html', '')).sort((a, b) => b.localeCompare(a));

        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, archiveFiles, false);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての処理が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

// 共通パーツ：カードレイアウトの中に「全サンプル画像」のグリッド表示を追加
function renderArticleCards(articles) {
    return articles.map(article => {
        // 📸 サンプル画像のHTMLを組み立てる（Cloudflareの転送量を消費しない直リンク仕様）
        let samplesHtml = '';
        if (article.sampleImages && article.sampleImages.length > 0) {
            const imgTags = article.sampleImages.map(imgUrl => `
                <div class="aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <img src="${imgUrl}" alt="サンプル" class="w-full h-full object-cover lazy" loading="lazy">
                </div>
            `).join('\n');

            samplesHtml = `
                <div class="mt-6 pt-6 border-t border-rose-50">
                    <h4 class="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 flex items-center gap-1">
                        <span>👀 本編チラ見せ・サンプル画像一覧（${article.sampleImages.length}枚）</span>
                    </h4>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        ${imgTags}
                    </div>
                </div>
            `;
        }

        return `
        <article class="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-rose-50 transition-all duration-300 overflow-hidden flex flex-col p-6 sm:p-8 group">
            <div class="flex flex-col md:flex-row gap-6 md:gap-8 justify-between">
                <!-- 左：メイン表紙画像 -->
                <div class="md:w-1/3 bg-slate-900 flex items-center justify-center overflow-hidden relative min-h-[260px] rounded-xl shadow-inner">
                    <img src="${article.imgUrl}" alt="作品サンプル" class="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity">
                    <span class="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">R-18</span>
                </div>

                <!-- 右：生レビューを参考にしてAIが書いた濃厚テキスト -->
                <div class="md:w-2/3 flex flex-col justify-between">
                    <div>
                        <div class="flex items-center gap-2 mb-3">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                                羞恥・ランキング上位
                            </span>
                            <span class="text-xs text-slate-400">口コミ分析レビュー</span>
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-4 group-hover:text-rose-600 transition-colors">
                            ${article.originalTitle}
                        </h3>
                        <div class="text-slate-600 text-sm leading-relaxed space-y-2 pt-4 border-t border-rose-50">
                            ${article.summary}
                        </div>
                    </div>
                    
                    <div class="mt-6">
                        <a href="${article.link}" target="_blank" rel="nofollow" class="w-full text-center inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm tracking-wider">
                            <span>🔞 この作品をDMM / FANZAで今すぐ読む ↗</span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- 💡 下部：サンプル画像一覧をここに美しく配置 -->
            ${samplesHtml}
        </article>
        `;
    }).join('\n');
}

// 📄 テンプレート（変更なし）
function generateTopPageHTML(articles, displayDate, archiveFiles, isArchive) {
    const cards = renderArticleCards(articles);
    const archiveLinks = archiveFiles.map(date => `
        <li>
            <a href="${isArchive ? '../' : '/'}archive/${date}.html" class="flex items-center justify-between p-3 rounded-lg hover:bg-rose-50 text-sm font-medium text-slate-700 hover:text-rose-600 transition-all border border-transparent hover:border-slate-100">
                <span>📅 ${date} の新着まとめ</span>
                <span class="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md">LOG</span>
            </a>
        </li>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${SITE_TITLE} - 最新成人向け羞恥マンガ・同人誌レビューまとめ</title>
    <meta name="description" content="【18禁】言葉責め・公開羞恥・露出系シチュエーションコミックに特化。AIソムリエが最新作の抜きどころを徹底レビュー。">
    <meta name="rating" content="adult">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-14 px-4 border-b border-rose-950 relative overflow-hidden">
        <div class="max-w-6xl mx-auto text-center relative z-10">
            <span class="text-xs font-bold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">⚠️ AGE VERIFICATION: 18+ ONLY</span>
            <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-200 to-pink-300">
                🔞 ${SITE_TITLE}
            </h1>
            <p class="mt-3 text-sm text-rose-300/80 max-w-xl mx-auto font-light">
                言葉責め、公開プレイ、尊厳破壊……。紳士の性癖を深く抉る「羞恥系コミック・同人誌」のみを厳選し、AIソムリエが毎晩その魅力を限界まで語り尽くす特化型レビューメディア。
            </p>
            <div class="mt-4 text-xs text-rose-400 font-medium">最終更新: ${displayDate}</div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-12">
        <div class="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center text-xs text-rose-800 mb-8 font-medium">
            当サイトは成人向け（R-18）の表現を含みます。18歳未満の方の閲覧は固くお断りいたします。
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-2 h-6 bg-rose-600 rounded-full"></span>
                    <span>本日のおすすめ羞恥コミック（最新情報）</span>
                </h2>
                ${cards}
            </div>
            <div class="lg:col-span-1">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-rose-50 sticky top-6">
                    <h2 class="text-md font-bold text-slate-900 mb-4 pb-3 border-b border-rose-100 flex items-center gap-2">
                        <span>過去のバックナンバー</span>
                    </h2>
                    <ul class="space-y-2">
                        ${archiveLinks.length > 0 ? archiveLinks : '<li class="text-xs text-slate-400 text-center py-4">ログはまだありません。</li>'}
                    </ul>
                </div>
            </div>
        </div>
    </main>
    <footer class="mt-24 bg-slate-950 text-rose-300/40 py-12 px-4 border-t border-rose-950 text-center text-xs">
        <div class="max-w-6xl mx-auto">
            <p>© ${new Date().getFullYear()} ${SITE_TITLE}. All Rights Reserved. 18+ Only.</p>
        </div>
    </footer>
</body>
</html>
    `;
}

main();