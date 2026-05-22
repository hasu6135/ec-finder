const fs = require('fs');
const Parser = require('rss-parser');
const { OpenAI } = require('openai');

const parser = new Parser();
const HACKER_NEWS_RSS = 'https://news.ycombinator.com/rss';

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

async function main() {
    try {
        console.log('🔄 Hacker Newsから最新記事を取得中...');
        const feed = await parser.parseURL(HACKER_NEWS_RSS);
        
        const topItems = feed.items.slice(0, 5);
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
                            content: 'あなたはテックニュースの編集者です。与えられた英語のタイトルとURLから、それがどのような技術や話題に関するものか推測し、「日本語タイトル」と「それが扱うと思われるトピックの推測（3行の箇条書き）」を必ず作成してください。情報が足りないという言い訳やエラーの返答は一切禁止します。必ず指定のフォーマットで出力してください。' 
                        },
                        { 
                            role: 'user', 
                            content: `Title: ${item.title}\nURL: ${item.link}` 
                        }
                    ],
                    temperature: 0.5 
                });

                const summary = response.choices[0].message.content;

                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    summary: summary.replace(/\n/g, '<br>')
                });

                console.log(`✅ [${i + 1}/${topItems.length}] 要約完了！`);

            } catch (itemError) {
                console.error(`⚠️ [${i + 1}/${topItems.length}] の処理中にエラーが発生したため、スキップします。`, itemError.message);
                summarizedArticles.push({
                    originalTitle: item.title,
                    link: item.link,
                    summary: 'AIによる要約の生成に失敗しました。'
                });
            }
        }

        console.log('\n📝 ホームページ（index.html）を出力中...');
        const htmlContent = generateHTML(summarizedArticles);
        
        fs.writeFileSync('index.html', htmlContent, 'utf-8');
        console.log('✨ 完了しました！「index.html」が作成されました。');

    } catch (error) {
        console.error('❌ 致命的なエラーが発生しました:', error);
    }
}

function generateHTML(articles) {
    const today = new Date().toLocaleDateString('ja-JP');
    
    // 各記事のカードデザイン（アフィリエイト枠付き）
    const cards = articles.map(article => `
        <div class="bg-white p-6 rounded-lg shadow-md border border-gray-100 mb-6">
            <h2 class="text-xl font-bold text-gray-800 mb-3">
                <a href="${article.link}" target="_blank" class="hover:text-blue-600 transition-colors">
                    ${article.originalTitle}
                </a>
            </h2>
            <div class="text-gray-600 text-sm leading-relaxed bg-gray-50 p-4 rounded border-l-4 border-blue-500 mb-4">
                ${article.summary}
            </div>
            
            <div class="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-800 mb-3">
                <strong>💡 編集部おすすめ：</strong> 
                <a href="https://px.a8.net/svt/ejp?a8mat=YOUR_ID" target="_blank" class="underline font-semibold hover:text-blue-600">
                    最新の生成AI・プログラミング効率化スキルを学ぶならこちら ↗
                </a>
            </div>

            <div class="text-xs text-gray-400">
                <a href="${article.link}" target="_blank" class="text-blue-400 hover:underline">原文をみる ↗</a>
            </div>
        </div>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>海外テックニュース自動要約</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen py-10">
    <div class="max-w-3xl mx-auto px-4">
        <header class="mb-6 text-center">
            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
                🌐 Overseas Tech Digest
            </h1>
            <p class="mt-2 text-sm text-gray-500">更新日: ${today} (LM Studio AI 自動要約)</p>
        </header>

        <div class="bg-yellow-50 border-2 border-dashed border-yellow-300 p-4 rounded-lg text-center mb-10 text-xs text-gray-600">
            <p class="font-bold mb-1">【スポンサーリンク】</p>
            <a href="https://px.a8.net/svt/ejp?a8mat=YOUR_ID" target="_blank" class="text-blue-600 underline font-semibold">
                [PR] 12VRAM以上のGPU搭載PCも対象！PC・ガジェットセールの詳細はこちら ↗
            </a>
        </div>
        
        <div class="space-y-6">
            ${cards}
        </div>

        <footer class="mt-16 text-center text-xs text-gray-400">
            <p>© ${new Date().getFullYear()} Tech Summary Bot. Built with Node.js & LM Studio.</p>
        </footer>
    </div>
</body>
</html>
    `;
}

main();