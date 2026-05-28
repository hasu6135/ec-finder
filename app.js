/**
 * ===================================================
 * 🛠️ 追加：ファイル名として安全なIDを生成する関数
 * ===================================================
 */
function generateSafeId(title) {
    // ファイル名に使えない禁止文字やスペースをクリーンアップ
    return title
        .replace(/[\/\\:\*\?"<>\|]/g, '') // 禁止文字削除
        .replace(/\s+/g, '_')             // スペースをアンダーバーに
        .substring(0, 50);                // 長すぎるタイトルをカット
}

/**
 * ===================================================
 * 🚀 メイン処理（個別ページ生成版）
 * ===================================================
 */
async function main() {
    try {
        // 必要なフォルダ（archiveとposts）がなければ自動作成
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);
        if (!fs.existsSync('posts')) fs.mkdirSync('posts');

        const products = await fetchDmmProducts();
        if (products.length === 0) {
            console.log('⚠️ 取得できた作品データが0件のため終了します。');
            return;
        }

        const summarizedArticles = [];
        console.log(`🤖 LM Studioによる、生レビューを反映した超濃厚レビュー執筆を開始...`);

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`\n[${i + 1}/${products.length}] ターゲット作品: ${product.title}`);

            const detailData = await scrapeDmmProductDetail(product.url);

            try {
                const response = await openai.chat.completions.create({
                    model: 'loading-model', 
                    messages: [
                        { 
                            role: 'system', 
                            content: `あなたは成人向けマンガ・同人誌の紹介で爆発的な人気を誇る「エロ同人ソムリエ（天才ライター）」です。与えられた作品タイトル、公式の詳細なあらすじ、そして【実際に購入したユーザーの生レビュー（口コミ）】を徹底的に分析し、その作品が持つ「羞恥シチュエーション（公開羞恥、言葉責め、モブ視線、尊厳破壊など）」のどこが読者に刺さっているのかを反映した、狂気的なほど熱量の高い紹介記事（日本語）を執筆してください。

以下の【執筆ルール】を限界まで遵守すること：
1. 【タイトルは『一撃で理性を吹き飛ばすフック』にせよ】
   - 機械的なラベル（「分析結果：」など）は絶対に出力禁止。読者が悶絶してクリックしてしまう、強烈にキャッチーな日本語タイトルを1行目で作ること。
2. 【レビューは『実際の読者の興奮ポイント』を突き、HTMLで飾れ】
   - 与えられたユーザーの生口コミの内容の要素をレビュー内に自然に溶け込ませてください。
   - 適切な改行を挟み、以下のHTMLタグを文章中に【必ず積極的かつ効果的に】散りばめること：
     * 最も興奮する属性キーワード： <b>太字</b>
     * 妄想を加速させる最高にエロい一言： <mark class="bg-rose-100 text-rose-900 px-1 rounded">ピンクのハイライト</mark>
     * 抜きどころの整理： <ul>と<li>を使ったリスト形式
3. 【Markdown記号の完全排除】
   - 「#」や「##」、「**」、「---」といったMarkdown記号はバグになるため使用一切禁止。`
                        },
                        { 
                            role: 'user', 
                            content: `【作品タイトル】\n${product.title}\n\n【公式あらすじ】\n${detailData.productDescription}\n\n【購入者の生の口コミ・レビュー】\n${detailData.userReviews}` 
                        }
                    ],
                    temperature: 0.75 
                });

                let summary = response.choices[0].message.content;

                // 安全装置：余計な記号を徹底削除
                summary = summary
                    .replace(/```html/g, '').replace(/```/g, '').replace(/##+/g, '').replace(/\*\*/g, '').replace(/---+/g, '').replace(/#/g, '').trim();

                const tableParsedSummary = parseMarkdownTableToHtml(summary);
                const formattedSummary = tableParsedSummary.replace(/\n/g, '<br>');

                let perfectSampleReadLink = '';
                if (detailData.tachiyomiUrl) {
                    const encodedSampleUrl = encodeURIComponent(detailData.tachiyomiUrl);
                    perfectSampleReadLink = `https://al.fanza.co.jp/?lurl=${encodedSampleUrl}&af_id=${DMM_AFFILIATE_ID}&ch=search_link&ch_id=link`;
                } else {
                    perfectSampleReadLink = product.url;
                }

                // 💡個別ファイル用のデータを作成
                const articleId = generateSafeId(product.title);
                const articleData = {
                    id: articleId,
                    originalTitle: product.title,
                    link: product.url,
                    imgUrl: product.imageUrl,
                    summary: formattedSummary,
                    sampleImages: detailData.sampleImages,
                    sampleReadLink: perfectSampleReadLink 
                };

                // 💡【新機能】各作品の「個別HTMLページ」を生成して即保存
                const postHtml = generateSinglePostHTML(articleData);
                fs.writeFileSync(path.join('posts', `${articleId}.html`), postHtml, 'utf-8');
                console.log(`📄 個別ページを生成しました: posts/${articleId}.html`);

                // トップページ一覧用にデータを記録
                summarizedArticles.push(articleData);

                console.log(`✅ [${i + 1}/${products.length}] レビューの執筆が完了しました！`);

            } catch (itemError) {
                console.error(`⚠️ エラーのためスキップ:`, itemError.message);
            }
        }

        // 日付文字列の作成
        const todayObj = new Date();
        const dateStr = todayObj.toISOString().split('T')[0];
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // アーカイブ（過去ログ一覧）用のファイル処理
        const archiveFiles = fs.readdirSync(ARCHIVE_DIR).filter(file => file.endsWith('.html')).map(file => file.replace('.html', '')).sort((a, b) => b.localeCompare(a));

        // トップページ（index.html）の書き出し
        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, archiveFiles);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての個別ページとトップページの更新が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

/**
 * ===================================================
 * 📄 テンプレート1：個別記事専用のHTMLレイアウト
 * ===================================================
 */
function generateSinglePostHTML(article) {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.originalTitle} - レビュー | ${SITE_TITLE}</title>
    <meta name="description" content="${article.originalTitle}の濃厚羞恥シチュエーション徹底分析レビュー。">
    <meta name="rating" content="adult">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-8 px-4 border-b border-rose-950">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <a href="../index.html" class="text-sm font-bold text-rose-400 hover:text-rose-300 transition-all">← ${SITE_TITLE} トップへ戻る</a>
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
                <h1 class="text-2xl font-extrabold text-slate-900 mb-6 leading-snug border-b border-rose-100 pb-4">${article.originalTitle}</h1>
                <div class="text-slate-700 text-sm leading-relaxed space-y-4">
                    ${article.summary}
                </div>
            </div>
        </article>
    </main>

    <footer class="bg-slate-950 text-rose-300/40 py-8 px-4 text-center text-xs">
        <p>当サイトはFANZAのアフィリエイトプログラムに参加しています。商品リンクはFANZA WebサービスAPIを利用しています。</p>
        <p class="mt-2">© ${new Date().getFullYear()} ${SITE_TITLE}. All Rights Reserved.</p>
    </footer>
</body>
</html>
    `;
}

/**
 * ===================================================
 * 📄 テンプレート2：トップページ用のレイアウト（カード形式リンク一覧）
 * ===================================================
 */
function generateTopPageHTML(articles, displayDate, archiveFiles) {
    // 💡トップページに並ぶ各カードの見た目（ここから個別ページへ飛べるように修正）
    const cards = articles.map(article => `
        <article class="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 flex flex-row gap-6 items-center hover:shadow-md transition-all">
            <div class="w-24 h-32 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center">
                <img src="${article.imgUrl}" alt="表紙" class="w-full h-full object-contain p-1">
            </div>
            <div class="flex flex-col min-w-0 flex-1">
                <span class="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">NEW REVIEW</span>
                <h3 class="text-base font-bold text-slate-900 truncate mb-2">${article.originalTitle}</h3>
                <div class="flex gap-2 mt-2">
                    <a href="posts/${article.id}.html" class="px-4 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg text-xs border border-rose-200 hover:bg-rose-100 transition-all text-center">🔎 濃厚レビューを読む</a>
                    <a href="${article.link}" class="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg text-xs hover:bg-rose-700 transition-all text-center">🔞 FANZAで見る</a>
                </div>
            </div>
        </article>
    `).join('\n');

    const archiveLinks = archiveFiles.map(date => `
        <li>
            <a href="archive/${date}.html" class="flex items-center justify-between p-3 rounded-lg hover:bg-rose-50 text-sm font-medium text-slate-700 hover:text-rose-600 transition-all border border-transparent hover:border-slate-100">
                <span>📅 ${date} のまとめ</span>
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
    <meta name="description" content="【18禁】言葉責め・公開羞恥・露出系シチュエーションコミックに特化。最新作の抜きどころを徹底レビュー。">
    <meta name="rating" content="adult">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#fffbfb] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-950 text-white py-14 px-4 border-b border-rose-950 text-center">
        <span class="text-xs font-bold tracking-widest text-rose-400 uppercase bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">⚠️ AGE VERIFICATION: 18+ ONLY</span>
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-200 to-pink-300">
            🔞 ${SITE_TITLE}
        </h1>
        <p class="mt-3 text-sm text-rose-300/80 max-w-xl mx-auto font-light">
            言叶責め、公開プレイ、尊厳破壊……。紳士の性癖を深く抉る「羞恥系コミック・同人誌」の特化型レビューメディア。
        </p>
        <div class="mt-4 text-xs text-rose-400 font-medium">最終更新: ${displayDate}</div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-12">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-4">
                <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-2 h-6 bg-rose-600 rounded-full"></span>
                    <span>最新の濃厚レビュー一覧</span>
                </h2>
                ${cards}
            </div>
            
            <div class="lg:col-span-1">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-rose-50 sticky top-6">
                    <h2 class="text-md font-bold text-slate-900 mb-4 pb-3 border-b border-rose-100">過去のバックナンバー</h2>
                    <ul class="space-y-2">
                        ${archiveLinks.length > 0 ? archiveLinks : '<li class="text-xs text-slate-400 text-center py-4">ログはまだありません。</li>'}
                    </ul>
                </div>
            </div>
        </div>
    </main>

    <footer class="mt-24 bg-slate-950 text-rose-300/40 py-12 px-4 border-t border-rose-950 text-center text-xs">
        <div class="max-w-6xl mx-auto space-y-4">
            <p class="max-w-2xl mx-auto leading-relaxed">
                当サイトはFANZAのアフィリエイトプログラムに参加しています。<br>
                掲載している商品リンクは、FANZAのWebサービスAPIを利用して表示しています。
            </p>
            <p>© ${new Date().getFullYear()} ${SITE_TITLE}. All Rights Reserved. 18+ Only.</p>
        </div>
    </footer>
</body>
</html>
    `;
}