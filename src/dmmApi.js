/**
 * ===================================================
 * 📡 DMM API 通信モジュール（Node.js標準 fetch・データ構造完全一致版）
 * ===================================================
 */
async function fetchDmmProducts(apiId, affiliateId, siteTitle) {
    try {
        const finalAffiliateId = affiliateId.endsWith('-001') ? affiliateId.replace('-001', '-990') : affiliateId;
        console.log('📡 DMM APIへリクエストを送信中...');
        
        const searchKeyword = '羞恥'; 
        // 💡 app.js側からFETCH_COUNT（数字）が渡ってきた場合はそれを使い、なければデフォルトで3件にする
        const fetchCount = typeof siteTitle === 'number' ? siteTitle : 3; 

        // URLとクエリパラメータの組み立て
        const url = new URL('https://api.dmm.com/affiliate/v3/ItemList');
        url.searchParams.append('api_id', apiId);
        url.searchParams.append('affiliate_id', finalAffiliateId);
        url.searchParams.append('site', 'FANZA');
        url.searchParams.append('service', 'ebook');
        url.searchParams.append('floor', 'comic');
        url.searchParams.append('keyword', searchKeyword);
        url.searchParams.append('hits', fetchCount.toString());
        url.searchParams.append('sort', 'rank');
        url.searchParams.append('output', 'json');

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`HTTPエラー! ステータス: ${response.status}`);
        }

        const data = await response.json();
        if (!data.result || !data.result.items) {
            return [];
        }

        // 💡 【重要】app.js の仕様（変数名）と完全に一致するようにマッピングし直します
        return data.result.items.map(item => {
            const encodedRawUrl = encodeURIComponent(item.URL);
            const perfectAffiliateUrl = `https://al.fanza.co.jp/?lurl=${encodedRawUrl}&af_id=${affiliateId}&ch=search_link&ch_id=link`;
            
            // ジャンル（タグ）の配列を抽出
            const officialKeywords = item.iteminfo?.keyword ? item.iteminfo.keyword.map(k => k.name) : [];

            return {
                title: item.title,
                url: perfectAffiliateUrl, 
                // 💡 app.js の初期のオブジェクト（product.genre）がそのまま読めるように配列をシミュレート
                genre: officialKeywords.map(name => ({ name })),
                // 💡 DMM APIが返す公式あらすじ（pricesの上の階層にある、またはreview.comment等）を格納
                description: item.description || item.review?.comment || '羞恥系おすすめの最新コミックです。',
                date: item.date || new Date().toISOString(),
                review: {
                    rating: item.review?.rating || '0.0',
                    count: item.review?.count || 0
                },
                // 💡 app.js側の「product.imagePath?.large」という古い設計の呼び出しにも耐えられるように二重構造で仕込む
                imagePath: {
                    large: item.imageURL?.large || item.imageURL?.list || ''
                }
            };
        });
    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}

module.exports = { fetchDmmProducts };