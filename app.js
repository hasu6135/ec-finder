const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { OpenAI } = require('openai');

const parser = new Parser();
const HACKER_NEWS_RSS = 'https://news.ycombinator.com/rss';

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

// 過去ログを保存するフォルダ名
const ARCHIVE_DIR = 'archive';

async function main() {
    try {
        // 1. 過去ログ用フォルダがなければ作成
        if (!fs.existsSync(ARCHIVE_DIR)){
            fs.mkdirSync(ARCHIVE_DIR);
        }

        console.log('🔄 Hacker Newsから最新記事を取得中...');
        const feed = await parser.parseURL(HACKER_NEWS_RSS);
        
        // 最新の10件を取得（リクエスト通り10件に拡大）
        const topItems = feed.items.slice(0, 1);
        const summarizedArticles = [];

        console.log(`🤖 LM Studioと連携して要約を開始します... (合計: ${topItems.length}件)`);

        for (let i = 0; i < topItems.length; i++) {
            const item = topItems[i];
            console.log(`\n[${i + 1}/${topItems.length}] 処理中: ${item.title}`);

            try {
const response = await openai.chat.completions.create({
                    model: 'loading-model',
                    messages: [
                        { 
                            role: 'system', 
                            content: `あなたは月間100万PVを誇る超人気テックメディアの『天才編集長』です。海外の難解な技術ニュースを、日本のITエンジニアやガジェット好きが「3秒でワクワクして身悶えするレベル」の極上コンテンツに超翻訳・要約してください。

以下の【絶対ルール】を限界まで遵守すること：

1. 【日本語タイトルは『最高のフック』にせよ】
   - 「〜の提案」や「〜の試み」のような退屈な表現は【完全禁止】。
   - 読者が思わず「マジか！」「これ知りたかった！」と叫んでクリックしてしまう、強烈でキャッチーなタイトル（日本語）を1行で作成してください。
   - 煽りすぎず、知的好奇心を極限まで刺激する言葉（例：「ついに登場」「神ツール」「衝撃」「パラダイムシフト」「開発者が絶賛」など）を効果的に使うこと。

2. 【3行要約は『脳に突き刺さる具体性』を持たせよ】
   - 抽象的な解説は禁止。読者が「自分にどう関係あるか」が一瞬でわかる言葉を使う。
   - 1行目：【何が起きたのか？（衝撃の事実・技術の核心）】
   - 2行目：【何がヤバいのか？（従来との違い・圧倒的なメリットや問題点）】
   - 3行目：【未来はどうなる？（今後のエンジニアへの影響や業界のトレンド）】
   - 箇条書きの先頭には、内容にマッチした「絵文字」を必ず入れて視認性を爆上げすること。

3. 【言い訳の完全禁止】
   - 「本文が足りない」「推測できない」といったメタ発言やエラー文章は一切出力禁止。プロとしてタイトルとURLから背景にある技術トレンドを完璧にプロファイリングし、エンタメ性と知性を兼ね備えた100%完成されたHTML用テキストのみを出力してください。`
                        },
                        { 
                            role: 'user', 
                            content: `Title: ${item.title}\nURL: ${item.link}` 
                        }
                    ],
                    temperature: 0.6 // 表現の豊かさ・キャッチーさを出すために少しだけランダム性を上げます
                });

                const summary = response.choices[0].message.content;

                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    summary: summary.replace(/\n/g, '<br>')
                });

                console.log(`✅ [${i + 1}/${topItems.length}] 要約完了！`);

            } catch (itemError) {
                console.error(`⚠️ [${i + 1}/${topItems.length}] エラーのためスキップ:`, itemError.message);
                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    summary: 'AIによる要約の生成に失敗しました。詳細な内容は原文リンクをご確認ください。'
                });
            }
        }

        const todayObj = new Date();
        const dateStr = todayObj.toISOString().split('T')[0]; // YYYY-MM-DD 形式
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // 2. 本日の個別アーカイブページ（HTML）を生成して保存
        console.log(`\n📝 本日のアーカイブ（archive/${dateStr}.html）を作成中...`);
        const archiveHtml = generateArchivePageHTML(summarizedArticles, displayDate);
        fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateStr}.html`), archiveHtml, 'utf-8');

        // 3. 過去のアーカイブファイルの一覧を取得
        const archiveFiles = fs.readdirSync(ARCHIVE_DIR)
            .filter(file => file.endsWith('.html'))
            .map(file => file.replace('.html', ''))
            .sort((a, b) => b.localeCompare(a)); // 新しい日付順に並び替え

        // 4. 最新のトップページ（index.html）を生成（最新10件 ＋ 過去ログリンク）
        console.log('📝 メインのトップページ（index.html）を更新中...');
        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, archiveFiles);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての処理が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラーが発生しました:', error);
    }
}

// --- デザインテンプレート (今風の洗練されたUI) ---

// 共通パーツ：記事のカードデザイン
function renderArticleCards(articles) {
    return articles.map(article => `
        <article class="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-slate-100 transition-all duration-300 overflow-hidden flex flex-col justify-between group">
            <div class="p-6 sm:p-8">
                <div class="flex items-center gap-2 mb-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        海外テック
                    </span>
                    <span class="text-xs text-slate-400">HN注目記事</span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-4 group-hover:text-indigo-600 transition-colors">
                    <a href="${article.link}" target="_blank">${article.originalTitle}</a>
                </h3>
                <div class="text-slate-600 text-sm leading-relaxed space-y-2 pt-4 border-t border-slate-50">
                    ${article.summary}
                </div>
            </div>
            
            <div class="px-6 sm:px-8 pb-6 pt-2">
                <div class="bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 hover:border-indigo-200 p-4 rounded-xl text-xs text-slate-700 transition-all mb-4">
                    <div class="flex items-center gap-1.5 font-bold text-indigo-600 mb-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        <span>PICK UP RECOMMEND</span>
                    </div>
<a href="https://px.a8.net/svt/ejp?a8mat=4B3WJB+8TC27M+5HXK+5YZ75" rel="nofollow">
<img border="0" width="300" height="250" alt="" src="https://www23.a8.net/svt/bgt?aid=260522615533&wid=001&eno=01&mid=s00000025652001003000&mc=1"></a>
<img border="0" width="1" height="1" src="https://www13.a8.net/0.gif?a8mat=4B3WJB+8TC27M+5HXK+5YZ75" alt="">
                </div>

                <div class="flex items-center justify-between text-xs text-slate-400">
                    <a href="${article.link}" target="_blank" class="inline-flex items-center gap-1 text-indigo-500 font-medium hover:text-indigo-700 transition-colors">
                        <span>原文をソースで読む</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>
        </article>
    `).join('\n');
}

// 📄 テンプレートA：トップページ（index.html）用
function generateTopPageHTML(articles, displayDate, archiveFiles) {
    const cards = renderArticleCards(articles);
    
    // 過去ログの一覧リンクを生成
    const archiveLinks = archiveFiles.map(date => `
        <li>
            <a href="archive/${date}.html" class="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-100">
                <span>📅 ${date} のダイジェスト</span>
                <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md group-hover:bg-indigo-100">LOG</span>
            </a>
        </li>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overseas Tech Digest - 最先端海外テックニュース自動要約</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#f8fafc] text-slate-900 antialiased min-h-screen">

    <header class="bg-slate-900 text-white py-12 px-4 border-b border-slate-800 relative overflow-hidden">
        <div class="absolute inset-0 bg-grid-white/[0.05] bg-[center_top]"></div>
        <div class="max-w-6xl mx-auto text-center relative z-10">
            <span class="text-xs font-bold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">AI Automated Media</span>
            <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight mt-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
                🌐 Overseas Tech Digest
            </h1>
            <p class="mt-3 text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-light">
                海外の先端情報をローカルLLMが毎晩自動で要約。一歩先を行くビジネスパーソンのためのテックメディア。
            </p>
            <div class="mt-4 text-xs text-indigo-300 font-medium">最終更新: ${displayDate} (毎日自動更新)</div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-12">
        
        <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 rounded-2xl text-center mb-12 shadow-sm relative overflow-hidden group">
            <div class="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-24 h-24 bg-amber-200/20 rounded-full blur-xl"></div>
            <span class="inline-block text-[10px] font-bold tracking-wider text-amber-700 uppercase bg-amber-200/50 px-2 py-0.5 rounded mb-2">SPONSOR</span>
            <p class="text-sm font-bold text-slate-800 mb-1">【限定セール】エンジニア必須のハイスペックガジェット・PC特集</p>
<a href="https://px.a8.net/svt/ejp?a8mat=4B3WJB+8TC27M+5HXK+5YZ75" rel="nofollow">
<img border="0" width="300" height="250" alt="" src="https://www23.a8.net/svt/bgt?aid=260522615533&wid=001&eno=01&mid=s00000025652001003000&mc=1"></a>
<img border="0" width="1" height="1" src="https://www13.a8.net/0.gif?a8mat=4B3WJB+8TC27M+5HXK+5YZ75" alt="">
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div class="lg:col-span-2">
                <h2 class="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span class="w-2 h-6 bg-indigo-600 rounded-full"></span>
                    <span>最新のアップデート（10件）</span>
                </h2>
                <div class="space-y-6">
                    ${cards}
                </div>
            </div>

            <div class="lg:col-span-1">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-6">
                    <h2 class="text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
                        <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                        <span>バックナンバー（過去ログ）</span>
                    </h2>
                    <div class="max-h-[500px] overflow-y-auto pr-1">
                        <ul class="space-y-2">
                            ${archiveLinks.length > 0 ? archiveLinks : '<li class="text-xs text-slate-400 text-center py-4">過去のログはまだありません。</li>'}
                        </ul>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <footer class="mt-24 bg-slate-900 text-slate-400 py-12 px-4 border-t border-slate-800 text-center text-xs">
        <div class="max-w-6xl mx-auto">
            <p class="mb-2">⚠️ 当サイトで提供される要約情報はAIによって自動生成された推測を含みます。正確な情報は原文ソースをご参照ください。</p>
            <p>© ${new Date().getFullYear()} Tech Summary Media. Powered by Node.js, LM Studio (Qwen 3.5), and Vercel.</p>
        </div>
    </footer>
</body>
</html>
    `;
}

// 📄 テンプレートB：個別アーカイブページ用
function generateArchivePageHTML(articles, displayDate) {
    const cards = renderArticleCards(articles);
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${displayDate} のダイジェスト - Overseas Tech Digest</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#f8fafc] text-slate-900 antialiased min-h-screen">
    <header class="bg-slate-900 text-white py-10 px-4 text-center">
        <div class="max-w-3xl mx-auto">
            <a href="../index.html" class="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 mb-2 transition-colors">
                ← トップページに戻る
            </a>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
                📅 ${displayDate} バックナンバー
            </h1>
        </div>
    </header>
    <main class="max-w-3xl mx-auto px-4 py-12">
        <div class="space-y-6">
            ${cards}
        </div>
    </main>
    <footer class="bg-slate-900 text-slate-500 py-8 text-center text-xs">
        <p>© Tech Summary Media. Archive Mode.</p>
    </footer>
</body>
</html>
    `;
}

main();