const { OpenAI } = require('openai');

const openai = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: 'lm-studio'
});

async function generateAiReview(product, detailData) {
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
1. タイトルは読者が悶絶するキャッチーなものを1行目に。
2. 本文には <b>太字</b> やピンクハイライト（<mark class="bg-rose-100 text-rose-900 px-1 rounded">文章</mark>）を積極的に使用。
3. Markdownの記号（#や**など）は一切禁止。`
            },
            { 
                role: 'user', 
                content: `【作品タイトル】\n${product.title}\n\n【公式ジャンル】\n${product.officialKeywords.join(', ')}\n\n【公式あらすじ】\n${detailData.productDescription}\n\n【購入者の口コミ】\n${detailData.userReviews}` 
            }
        ],
        temperature: 0.75 
    });

    let rawContent = response.choices[0].message.content;
    let tags = ["羞恥系"];

    const jsonMatch = rawContent.match(/TAG_JSON:\s*(\[.*?\])/);
    if (jsonMatch) {
        try {
            tags = JSON.parse(jsonMatch[1]);
            rawContent = rawContent.replace(/TAG_JSON:.*$/, '').trim();
        } catch (e) {
            if (product.officialKeywords.length > 0) tags = product.officialKeywords.slice(0, 4);
        }
    }

    return { rawContent, tags };
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

module.exports = { generateAiReview, parseMarkdownTableToHtml };