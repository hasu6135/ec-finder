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

const ARCHIVE_DIR = 'archive';

async function main() {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)){
            fs.mkdirSync(ARCHIVE_DIR);
        }

        console.log('🔄 Hacker Newsから最新記事を取得中...');
        const feed = await parser.parseURL(HACKER_NEWS_RSS);
        
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
                            content: `あなたは最高峰のテックメディアで執筆する「天才テクニカルライター」です。海外の難解な技術ニュース（タイトルとURL）の背景をプロファイリングし、日本の読者がワクワクしながら一気読みしてしまう極上の解説記事（日本語）を執筆してください。

以下の【執筆ルール】を極限まで遵守すること：

1. 【AIっぽい機械的なラベルは「完全禁止」】
   - 「分析結果」「日本語タイトル」「3行要約」「検証ポイント」といった見出しやラベルは【絶対に】出力しないでください。
   - 冒頭にインパクトのある魅力的な日本語タイトル（1行）を掲げ、その直後から自然な解説記事をスタートさせてください。
   - タイトル作成時、英語の専門用語やプロジェクト名、ツール名が出てきた場合は、日本の読者が一瞬で理解できるように、必要に応じて「（カタカナでの補足や意味）」をタイトルの末尾や文中に自然に付け足してください。

2. 【文章量を増やし、リッチなWebレイアウトで執筆せよ】
   - 単なる数行の要約ではなく、背景や技術の革新性がしっかり伝わるよう、十分な文章量を確保して深く解説してください。
   - 読者がスマホでスクロールしながらでも視覚的にパッと理解できるよう、適度な行間（改行）、リスト形式、そして重要な箇所へのHTML装飾を「AI自身の手で直接記述」してください。
   - 以下のHTMLタグを文章中に【必ず積極的かつ効果的に】散りばめること：
     * 重要なキーワードや技術名： <b>太字</b>
     * 最も注目すべき革新的な事実やメリット： <mark class="bg-amber-100 text-slate-900 px-1 rounded">ハイライト（マーカー）</mark>
     * 要点を整理する際： <ul>と<li>を使ったリスト形式（各<li>の先頭にはマッチした絵文字を必ず入れること）

3. 【Markdown記号の完全排除】
   - 「#」や「##」、「**」、「---」といったMarkdown記号、および「\`\`\`html」や「\`\`\`」のようなコードブロック記号はWebサイトでバグになるため使用は一切禁止します。`
                        },
                        { 
                            role: 'user', 
                            content: `Title: ${item.title}\nURL: ${item.link}` 
                        }
                    ],
                    temperature: 0.6 
                });

                let summary = response.choices[0].message.content;

                // 【超強力・安全装置】無駄なコードブロック記号やMarkdown記号を徹底排除
                summary = summary
                    .replace(/```html/g, '')
                    .replace(/```/g, '')
                    .replace(/##+/g, '')
                    .replace(/\*\*/g, '')
                    .replace(/---+/g, '')
                    .replace(/#/g, '')
                    .trim();

                const formattedSummary = summary.replace(/\n/g, '<br>');

                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    summary: formattedSummary
                });

                console.log(`✅ [${i + 1}/${topItems.length}] 記事の執筆が完了しました！`);

            } catch (itemError) {
                console.error(`⚠️ [${i + 1}/${topItems.length}] エラーのためスキップ:`, itemError.message);
                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    summary: 'AIによる記事の生成に失敗しました。詳細な内容は原文リンクをご確認ください。'
                });
            }
        }

        const todayObj = new Date();
        const dateStr = todayObj.toISOString().split('T')[0];
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        console.log(`\n📝 本日のアーカイブ（archive/${dateStr}.html）を作成中...`);
        const archiveHtml = generateArchivePageHTML(summarizedArticles, displayDate);
        fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateStr}.html`), archiveHtml, 'utf-8');

        const archiveFiles = fs.readdirSync(ARCHIVE_DIR)
            .filter(file => file.endsWith('.html'))
            .map(file => file.replace('.html', ''))
            .sort((a, b) => b.localeCompare(a));

        console.log('📝 メインのトップページ（index.html）を更新中...');
        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, archiveFiles);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての処理が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラーが発生しました:', error);
    }
}

// 共通パーツ：ブラッシュアップされた美麗カードデザイン（1の改善）
function renderArticleCards(articles) {
    return articles.map(article => `
        <article class="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transform border border-slate-100 transition-all duration-300 overflow-hidden flex flex-col justify-between group">
            <div class="p-6 sm:p-8">
                <div class="flex items-center gap-2 mb-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        海外テック
                    </span>
                    <span class="text-xs text-slate-400">HN注目トレンド</span>
                </div>
                <h3 class="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-4 group-hover:text-indigo-600 transition-colors">
                    <a href="${article.link}" target="_blank">${article.originalTitle}</a>
                </h3>
                <div class="text-slate-600 text-sm leading-relaxed space-y-2 pt-4 border-t border-slate-100/80">
                    ${article.summary}
                </div>
            </div>
            
            <div class="px-6 sm:px-8 pb-6 pt-2">
                <div class="bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 hover:border-indigo-200 p-4 rounded-xl text-xs text-slate-700 transition-all mb-4">
                    <div class="flex items-center gap-1.5 font-bold text-indigo-600 mb-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        <span>PICK UP RECOMMEND</span>
                    </div>
<a href="https://px.a8.net/svt/ejp?a8mat=4B3WJB+8TC27M+5HXK+5YRHE" rel="nofollow">コスパ最強ゲーミングPCなら【MDL.make】</a>

<img border="0" width="1" height="1" src="https://www14.a8.net/0.gif?a8mat=4B3WJB+8TC27M+5HXK+5YRHE" alt="">
                </div>

                <div class="flex items-center justify-between text-xs text-slate-400">
                    <a href="${article.link}" target="_blank" class="inline-flex items-center gap-1 text-indigo-500 font-medium hover:text-indigo-700 transition-colors">
                        <span>原文ソースを確認する</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>
        </article>
    `).join('\n');
}

// 📄 テンプレートA：トップページ（OGP対応・1, 5の改善）
function generateTopPageHTML(articles, displayDate, archiveFiles) {
    const cards = renderArticleCards(articles);
    
    const archiveLinks = archiveFiles.map(date => `
        <li>
            <a href="/archive/${date}.html" class="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-100">
                <span>📅 ${date} のダイジェスト</span>
                <span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">LOG</span>
            </a>
        </li>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overseas Tech Digest - 最先端海外テックニュース自動要約メディア</title>
    
    <meta name="description" content="海外の難解な先端技術ニュースをローカルLLMが毎晩自動で超翻訳・要約。一歩先を行くエンジニアのためのテックメディア。">
    <meta property="og:url" content="https://tech-summary-bot-seven.vercel.app">
    <meta property="og:type" content="website">
    <meta property="og:title" content="Overseas Tech Digest - 最先端海外テックニュース自動要約メディア">
    <meta property="og:description" content="海外の難解な先端技術ニュースをローカルLLMが毎晩自動で超翻訳・要約。一歩先を行くエンジニアのためのテックメディア。">
    <meta property="og:site_name" content="Overseas Tech Digest">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Overseas Tech Digest - 最先端海外テックニュース自動要約メディア">
    <meta name="twitter:description" content="海外の難解な先端技術ニュースをローカルLLMが毎晩自動で超翻訳・要約。一歩先を行くエンジニアのためのテックメディア。">

    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }
    </style>
</head>
<body class="bg-[#f8fafc] text-slate-900 antialiased min-h-screen">

    <header class="bg-slate-900 text-white py-14 px-4 border-b border-slate-800 relative overflow-hidden">
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
        
        <div class="bg-white border border-slate-200/80 p-6 rounded-2xl text-center mb-12 shadow-sm flex flex-col items-center justify-center">
            <span class="inline-block text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded mb-4">SPONSOR</span>
            <div class="inline-block overflow-hidden rounded-lg shadow-sm hover:shadow transition-shadow">
<a href="https://px.a8.net/svt/ejp?a8mat=4B3WJB+8TC27M+5HXK+5YRHE" rel="nofollow">コスパ最強ゲーミングPCなら【MDL.make】</a>

<img border="0" width="1" height="1" src="https://www14.a8.net/0.gif?a8mat=4B3WJB+8TC27M+5HXK+5YRHE" alt="">
            </div>
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
            <p>© ${new Date().getFullYear()} Tech Summary Media. Powered by Node.js, LM Studio, and Vercel.</p>
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