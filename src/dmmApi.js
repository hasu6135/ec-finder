/**
 * ===================================================
 * 📡 DMM API 通信モジュール（引数連動・決定版）
 * ===================================================
 */
async function fetchDmmProducts(apiId, affiliateId, siteTitle, fetchCount) {
    try {
        const finalAffiliateId = affiliateId.endsWith('-001') ? affiliateId.replace('-001', '-990') : affiliateId;
        console.log('📡 DMM APIへリクエストを送信中...');
        
        const searchKeyword = '羞恥'; 
        
        // 💡 app.js から渡ってきた fetchCount（10）をそのまま使います。安全対策として未定義なら3にします。
        const hitsCount = fetchCount || 3; 
        console.log(`📊 設定を検知しました。DMMから新着を ${hitsCount} 件取得します。`);

        // URLとクエリパラメータの組み立て
        const url = new URL('https://api.dmm.com/affiliate/v3/ItemList');
        url.searchParams.append('api_id', apiId);
        url.searchParams.append('affiliate_id', finalAffiliateId);
        url.searchParams.append('site', 'FANZA');
        url.searchParams.append('service', 'ebook');
        url.searchParams.append('floor', 'comic');
        url.searchParams.append('keyword', searchKeyword);
        url.searchParams.append('hits', hitsCount.toString());
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

        return data.result.items.map(item => {
            const encodedRawUrl = encodeURIComponent(item.URL);
            const perfectAffiliateUrl = `https://al.fanza.co.jp/?lurl=${encodedRawUrl}&af_id=${affiliateId}&ch=search_link&ch_id=link`;
            const officialKeywords = item.iteminfo?.keyword ? item.iteminfo.keyword.map(k => k.name) : [];

            return {
                title: item.title,
                url: perfectAffiliateUrl, 
                genre: officialKeywords.map(name => ({ name })),
                description: item.description || item.review?.comment || '羞恥系おすすめの最新コミックです。',
                date: item.date || new Date().toISOString(),
                review: {
                    rating: item.review?.rating || '0.0',
                    count: item.review?.count || 0
                },
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