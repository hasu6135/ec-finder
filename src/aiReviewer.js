const { OpenAI } = require('openai');

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

/**
 * 📖 AIによる熱量の高い3部構成レビューを生成する関数
 */
async function generateAiReview(product, detailData) {
    try {
        const response = await openai.chat.completions.create({
            model: 'loading-model', 
            messages: [
                { 
                    role: 'system', 
                    content: `あなたは成人向けマンガの紹介で爆発的な人気を誇る「エロ同人ソムリエ」です。
与えられた作品情報（タイトル、ジャンル、あらすじ、口コミなど）から、読者が読みやすく、かつ猛烈に買いたくなる紹介記事を執筆してください。

【重要：執筆ルール】
1. 1行目は、必ず作品タイトルを含んだ悶絶するキャッチーな見出しにしてください（例: 「〇〇」をガチ評価！）。
2. 本文は必ず【3つのサブヘッダー（見出し）】で区切って構成してください。サブヘッダーは 💡 や 🍑 などの絵文字を先頭に付けた <h3> タグで囲んでください。
   （例: <h3 class="text-base font-extrabold text-slate-950 mt-6 mb-2 border-l-4 border-rose-500 pl-2">💡 サブヘッダータイトル</h3>）
3. 各セクションは、2〜3行ごとに空行（改行）を挟み、スマホでもサクサク読める快適な文章量に調整してください。
4. 表（テーブル）の出力は絶対に禁止します。
5. 重要な単語や興奮するポイントには、適宜 <b>太字</b> やピンクハイライト（<mark class="bg-rose-100 text-rose-900 px-1 rounded">文章</mark>）を使って見やすく色付けしてください。
6. Markdownの記号（# や ** や --- など）は一切禁止です。すべてHTMLタグ（<b>, <mark>, <h3 class="...">, <p>など）だけで出力してください。

【厳格な出力制限】
・「はい、どうぞ」や「以下がレビューです」などの前置き・解説の挨拶は一切出力しないでください。
・出力を \`\`\`html や \`\`\` などのコードブロック（バックティック）で囲むことは絶対に禁止します。
・生成されたHTMLテキストそのものだけを1文字目から直接出力してください。`
                },
                { 
                    role: 'user', 
                    content: `【作品タイトル】\n${product.title}\n\n【公式ジャンル】\n${detailData.pageGenres ? detailData.pageGenres.join(', ') : ''}\n\n【公式あらすじ】\n${detailData.productDescription || ''}\n\n【購入者の口コミ】\n${detailData.userReviews || ''}` 
                }
            ],
            // 💡 温度を 0.7 ➔ 0.2 に下げることで、AIが勝手な装飾や挨拶を喋るのを防ぎ、ルールを厳格に守らせます
            temperature: 0.2,
            max_tokens: 2000,
        });

        const rawText = response.choices[0].message.content || '';
        return formatAiResponseToHtml(rawText);
    } catch (error) {
        console.error('⚠️ AIレビューの生成に失敗しました。フォールバックテキストを使用します:', error.message);
        return `<h1 class="text-base font-extrabold text-slate-900 mb-4">「${product.title}」をガチ評価！</h1>
        <p class="text-sm text-slate-600">公式あらすじや口コミを参考にしてください。</p>`;
    }
}

/**
 * 🛠️ AIの出力テキストを解析し、完璧な空行と段落を持ったHTMLに強制変換するヘルパー
 */
function formatAiResponseToHtml(text) {
    if (!text) return '';
    
    // 💡太字(b)やハイライト(mark)部分に、インラインで文字を少し大きく(105%)、さらに読みやすくするスタイルを適用
    let cleanedText = text
        .replace(/\*\*(.*?)\*\*/g, '<b class="inline-block text-[106%] font-extrabold text-slate-950 px-0.5">$1</b>')
        .replace(/\*(.*?)\*/g, '<b class="inline-block text-[106%] font-extrabold text-slate-950 px-0.5">$1</b>')
        .replace(/<b>(.*?)<\/b>/g, '<b class="inline-block text-[106%] font-extrabold text-slate-950 px-0.5">$1</b>')
        .replace(/<mark class="bg-rose-100 text-rose-900 px-1 rounded">(.*?)<\/mark>/g, '<mark class="bg-rose-100 text-rose-950 px-1 rounded font-bold inline-block text-[106%] shadow-sm">$1</mark>');

    // Windowsの改行コードを統一
    cleanedText = cleanedText.replace(/\r\n/g, '\n');
    // AIが文中に混ぜてきた生改行タグ（<br>や<br />）を一旦すべて通常の改行にリセット
    cleanedText = cleanedText.replace(/<br\s*\/?>/gi, '\n');

    // 💡【強力空行検知】2連続以上の改行、またはスペースだけの行を確実に[BLANK_LINE]へ変換
    cleanedText = cleanedText.replace(/\n\s*\n/g, '\n[BLANK_LINE]\n');

    // 行ごとに分解して処理
    const lines = cleanedText.split('\n');
    let htmlOutput = [];
    let isFirstLine = true;
    let currentParagraph = [];

    // 💡【判定強化】溜まった文章を出力する際、長すぎる場合は2〜3行（約80〜120文字）ごとに空行を強制注入する
    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            let chunk = [];
            currentParagraph.forEach((sentence, idx) => {
                chunk.push(sentence);
                // 💡 2行〜3行ごと、または句点(。)で終わるちょうどいいタイミングで空行を自動作成
                if ((idx + 1) % 2 === 0 || sentence.endsWith('。') && chunk.length >= 2) {
                    htmlOutput.push(`<p class="mb-4 text-slate-700 leading-relaxed">${chunk.join('<br>')}</p>`);
                    chunk = [];
                }
            });
            if (chunk.length > 0) {
                htmlOutput.push(`<p class="mb-4 text-slate-700 leading-relaxed">${chunk.join('<br>')}</p>`);
            }
            currentParagraph = [];
        }
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        
        // AIが意図的に作った「空行」の目印、または区切り線
        if (trimmed === '[BLANK_LINE]' || trimmed === '---' || trimmed === '***') {
            flushParagraph();
            htmlOutput.push(`<div class="h-5"></div>`); // しっかりと高さを確保した空行を挿入
            return;
        }

        if (trimmed === '') return;

        // 1行目はメインキャッチコピーとして特別扱い
        if (isFirstLine) {
            if (trimmed.startsWith('<h1') || trimmed.startsWith('<h2')) {
                htmlOutput.push(trimmed);
            } else {
                htmlOutput.push(`<h2 class="text-base sm:text-lg font-extrabold text-rose-600 mb-4 border-b-2 border-rose-100 pb-2">${trimmed.replace(/^#+\s*/, '')}</h2>`);
            }
            isFirstLine = false;
            return;
        }

        // 見出しタグ（h3等）が出てきたら、それまでの文章を区切って見出しを挿入
        if (trimmed.startsWith('<h3') || trimmed.startsWith('<h4')) {
            flushParagraph();
            htmlOutput.push(trimmed);
        } else if (trimmed.startsWith('<p')) {
            flushParagraph();
            htmlOutput.push(trimmed);
        } else {
            // 普通の文章を一度配列に溜める
            currentParagraph.push(trimmed);
        }
    });

    // 最後に残った文章を出力
    flushParagraph();

    return htmlOutput.join('\n');
}

// 💡 app.js側でエラーにならないよう、ダミー関数としてエラーを回避させます
function parseMarkdownTableToHtml(text) {
    return text; // すでにHTML化されているか不要なため、そのまま右から左へ流すだけ
}

// 外部へ公開する関数一覧
module.exports = { 
    generateAiReview, 
    parseMarkdownTableToHtml 
};