const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { OpenAI } = require('openai');

const parser = new Parser();
// ※ここでは例として、一般的な紹介用フィードやデータをもとに動かす想定です
// 実際のDLsite/FANZA等のRSSや特定URLが決まったらここに差し替えます
const TARGET_RSS = 'https://news.ycombinator.com/rss'; // 一旦形状維持のためのダミー

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

        console.log('🔄 最新の作品情報を取得中...');
        const feed = await parser.parseURL(TARGET_RSS);
        const topItems = feed.items.slice(0, 1);
        const summarizedArticles = [];

        console.log(`🤖 LM Studio(Qwen)が羞恥系レビューを脳内妄想・執筆中... (合計: ${topItems.length}件)`);

        for (let i = 0; i < topItems.length; i++) {
            const item = topItems[i];
            console.log(`\n[${i + 1}/${topItems.length}] 分析・執筆中: ${item.title}`);

            try {
                const response = await openai.chat.completions.create({
                    model: 'loading-model',
                    messages: [
                        { 
                            role: 'system', 
                            content: `あなたは成人向け同人誌の紹介で月間50万PVを稼ぐ、狂気の「エロ同人ソムリエ（天才ライター）」です。与えられた作品タイトルや情報から、その作品が持つ「羞恥シチュエーション（公開〇〇、言葉責め、モブ視線、オトされる快感など）」のヤバさを妄想プロファイリングし、読者の性癖を破壊するレベルの極上レビュー記事（日本語）を執筆してください。

以下の【執筆ルール】を限界まで遵守すること：

1. 【タイトルは『一撃で理性を吹き飛ばすフック』にせよ】
   - 機械的なラベル（「分析結果：」など）は【絶対に出力禁止】。
   - 読者が「ウッ…！これは俺の性癖に刺さりすぎる…！」と思わず悶絶してクリックしてしまう、強烈にキャッチーな日本語タイトルを1行目で作成してください。
   - 煽り文句（例：【脳が溶ける】、【神作】、公開羞恥、絶望の快感、など）を効果的に使うこと。

2. 【レビューは『ドM心の核心』を突き、リッチなHTMLで飾れ】
   - 単なるストーリー紹介は退屈です。「どんな羞恥プレイが待っているのか」「ヒロイン（または主人公）がどうプライドをへし折られて快感に沈んでいくのか」の魅力を、熱量の高い長文で深く解説してください。
   - 読者がスマホでスクロールしながら興奮できるよう、適切な改行、そして以下のHTMLタグを文章中に【必ず積極的かつ効果的に】散りばめること：
     * 最も興奮するシチュエーション・属性キーワード： <b>太字</b>
     * 読者の妄想を加速させる最高にエロい一言やメリット： <mark class="bg-rose-100 text-rose-900 px-1 rounded">ピンクのハイライト</mark>
     * 作品の「抜きどころ・見どころ」を整理する際： <ul>と<li>を使ったリスト形式
   - 各リストの先頭（<li>の中）には、内容にマッチした絵文字（🔞, 💦, 💋, 😳, 🧠 など）を必ず1つ入れてください。

3. 【Markdown記号の完全排除】
   - 「#」や「##」、「**」、「---」といったMarkdown記号、および「\`\`\`html」や「\`\`\`」のようなコードブロック記号はWebサイトでバグになるため使用は一切禁止します。文字の強調やリストは、すべて上記のHTMLタグ（<b>、<mark>、<ul>、<li>）のみで表現してください。`
                        },
                        { 
                            role: 'user', 
                            content: `Title: ${item.title}\nURL: ${item.link}` 
                        }
                    ],
                    temperature: 0.75 // 妄想力・官能的な表現力を引き出すために少し高めに設定
                });

                let summary = response.choices[0].message.content;

                // 安全装置：余計な記号を徹底削除
                summary = summary
                    .replace(/```html/g, '')
                    .replace(/```/g, '')
                    .replace(/##+/g, '')
                    .replace(/\*\*/g, '')
                    .replace(/---+/g, '')
                    .replace(/#/g, '')
                    .trim();

                const formattedSummary = summary.replace(/\n/g, '<br>');

                // ※本番運用時は、ここに実際のFANZA/DLsiteの画像URLやアフィリンクが入るようにします
                // ここでは仮で、Cloudflareに優しい外部直リンクのダミー画像URLを指定
                const dummyImgUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80"; 

                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    imgUrl: dummyImgUrl, // 画像直リンクURLを保持
                    summary: formattedSummary
                });

                console.log(`✅ [${i + 1}/${topItems.length}] レビューの執筆が完了しました！`);

            } catch (itemError) {
                console.error(`⚠️ エラーのためスキップ:`, itemError.message);
            }
        }

        const todayObj = new Date();
        const dateStr = todayObj.toISOString().split('T')[0];
        const displayDate = todayObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        const archiveHtml = generateTopPageHTML(summarizedArticles, displayDate, [], true);
        fs.writeFileSync(path.join(ARCHIVE_DIR, `${dateStr}.html`), archiveHtml, 'utf-8');

        const archiveFiles = fs.readdirSync(ARCHIVE_DIR)
            .filter(file => file.endsWith('.html'))
            .map(file => file.replace('.html', ''))
            .sort((a, b) => b.localeCompare(a));

        const indexHtml = generateTopPageHTML(summarizedArticles, displayDate, archiveFiles, false);
        fs.writeFileSync('index.html', indexHtml, 'utf-8');

        console.log('✨ すべての処理が完了しました！');

    } catch (error) {
        console.error('❌ 致命的なエラー:', error);
    }
}

// 共通パーツ：エロ同人メディア専用カードレイアウト（画像を左/上に配置するモダンな横並び・縦並び）
function renderArticleCards(articles) {
    return articles.map(article => `
        <article class="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transform border border-rose-50 transition-all duration-300 overflow-hidden flex flex-col md:flex-row justify-between group">
            <div class="md:w-1/3 bg-slate-900 flex items-center justify-center overflow-hidden relative min-h-[200px]">
                <img src="${article.imgUrl}" alt="作品サンプル" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100">
                <span class="absolute top-3 left-3 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">R-18</span>
            </div>

            <div class="p-6 sm:p-8 md:w-2/3 flex flex-col justify-between">
                <div>
                    <div class="flex items-center gap-2 mb-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">
                            羞恥・シチュエーション
                        </span>
                        <span class="text-xs text-slate-400">最新同人誌レビュー</span>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 tracking-tight leading-snug mb-4 group-hover:text-rose-600 transition-colors">
                        ${article.originalTitle}
                    </h3>
                    <div class="text-slate-600 text-sm leading-relaxed space-y-2 pt-4 border-t border-rose-50">
                        ${article.summary}
                    </div>
                </div>
                
                <div class="mt-6">
                    <a href="https://px.a8.net/svt/ejp?a8mat=4B3WJB+8TC27M+5HXK+5YZ75" target="_blank" rel="nofollow" class="w-full text-center inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm tracking-wider">
                        <span>🔞 この作品をDLsite / FANZAでチェックする</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>
            </div>
        </article>
    `).join('\n');
}

// 📄 テンプレート（大人向けピンク＆ダークネイビーデザイン）
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
    <title>羞恥特化型エロ同人ソムリエ - 最新成人向け同人誌レビューまとめ</title>
    
    <meta name="description" content="【18禁】言葉責め・公開羞恥・シチュエーション系同人誌に特化。AIソムリエが最新作の抜きどころを徹底レビュー。">
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
                🔞 羞恥特化型エロ同人ソムリエ
            </h1>
            <p class="mt-3 text-sm text-rose-300/80 max-w-xl mx-auto font-light">
                言葉責め、公開プレイ、尊厳破壊……。紳士の性癖を深く抉る「羞恥系同人誌」のみを厳選し、AIソムリエが毎晩その魅力を限界まで語り尽くす特化型レビューメディア。
            </p>
            <div class="mt-4 text-xs text-rose-400 font-medium">最終更新: ${displayDate}</div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-12">
        <div class="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center text-xs text-rose-800 mb-8 font-medium">
            当サイトは成人向け（R-18）の表現を含みます。18歳未満の方の閲覧は固くお断りいたします。また、掲載画像はすべて公式のアフィリエイト及び直リンクを使用しています。
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <h2 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span class="w-2 h-6 bg-rose-600 rounded-full"></span>
                    <span>本日のおすすめ羞恥同人（10選）</span>
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
            <p>© ${new Date().getFullYear()} 羞恥特化型エロ同人ソムリエ. All Rights Reserved. 18+ Only.</p>
        </div>
    </footer>
</body>
</html>
    `;
}

main();